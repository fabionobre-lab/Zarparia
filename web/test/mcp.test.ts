// Phase 3 approval gate — the MCP bearer-token path. A token can be perfectly
// valid (unexpired, unrevoked) while the account behind it is not approved —
// e.g. an admin flips approval off after the token was issued — so this is
// re-checked on every /mcp call, not just once at OAuth-consent time.
// Issuance itself is also gated: issueTokenPair refuses non-approved accounts
// (UserNotApprovedError), so the only way to hold a token while pending is to
// have been approved when it was minted.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { registerClient } from '../src/lib/server/mcp/oauth';
import { issueTokenPair, validateAccessToken, UserNotApprovedError } from '../src/lib/server/mcp/tokens';
import { upsertGoogleUser, setUserStatus } from '../src/lib/server/users';
import { POST } from '../src/routes/mcp/+server';

/** Approved user gets a token, then approval is revoked — the realistic path
 *  to a valid token whose owner is no longer approved. */
async function revokedAfterIssueAccessToken(email: string) {
	const user = await upsertGoogleUser(env.DB, { sub: 'google-sub-' + email, email, name: 'MCP User' }, undefined);
	expect(user.status).toBe('pending');
	await setUserStatus(env.DB, user.id, 'approved');
	const client = await registerClient(env.DB, {
		client_name: 'Test Client',
		redirect_uris: ['http://localhost/callback']
	});
	if (!client.ok || !client.client) throw new Error('client registration failed in test setup');
	const tokens = await issueTokenPair(env.DB, {
		clientId: client.client.client_id,
		userId: user.id,
		scope: 'trips'
	});
	await setUserStatus(env.DB, user.id, 'pending');
	return { user, accessToken: tokens.accessToken };
}

describe('issueTokenPair — refuses non-approved accounts', () => {
	it('throws UserNotApprovedError for a pending user', async () => {
		const user = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-mcp-issue-pending', email: 'mcp-issue-pending@example.com', name: 'MCP User' },
			undefined
		);
		expect(user.status).toBe('pending');
		const client = await registerClient(env.DB, {
			client_name: 'Test Client',
			redirect_uris: ['http://localhost/callback']
		});
		if (!client.ok || !client.client) throw new Error('client registration failed in test setup');
		await expect(
			issueTokenPair(env.DB, { clientId: client.client.client_id, userId: user.id, scope: 'trips' })
		).rejects.toBeInstanceOf(UserNotApprovedError);
	});
});

describe('validateAccessToken — carries approval status', () => {
	it('resolves a de-approved user with userStatus "pending"', async () => {
		const { accessToken } = await revokedAfterIssueAccessToken('mcp-pending@example.com');
		const ctx = await validateAccessToken(env.DB, accessToken);
		expect(ctx?.userStatus).toBe('pending');
	});
});

describe('POST /mcp — rejects tools/call for a non-approved user', () => {
	it('a valid token for a de-approved user gets 403, not the tool result', async () => {
		const { accessToken } = await revokedAfterIssueAccessToken('mcp-pending-call@example.com');
		const platform = { env: { DB: env.DB } } as unknown as App.Platform;
		const request = new Request('https://example.com/mcp', {
			method: 'POST',
			headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
		});
		const res = await POST({ request, platform, url: new URL(request.url) } as never);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('access_denied');
	});
});
