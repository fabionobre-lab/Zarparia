// Phase 3 approval gate — the MCP bearer-token path. A token can be perfectly
// valid (unexpired, unrevoked) while the account behind it is not approved —
// e.g. an admin flips approval off after the token was issued — so this is
// re-checked on every /mcp call, not just once at OAuth-consent time.
// Issuance itself is also gated: issueTokenPair refuses non-approved accounts
// (UserNotApprovedError), so the only way to hold a token while pending is to
// have been approved when it was minted.
import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { registerClient } from '../src/lib/server/mcp/oauth';
import {
	issueTokenPair,
	pruneExpiredOAuthRows,
	rotateRefreshToken,
	validateAccessToken,
	UserNotApprovedError
} from '../src/lib/server/mcp/tokens';
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

// Phase D1-hygiene follow-up: oauth_codes/oauth_tokens are indexed on
// expires_at (migrations/0006) but nothing ever deleted stale rows.
// pruneExpiredOAuthRows (tokens.ts) sweeps rows whose OWN expires_at lapsed
// more than 7 days ago — see the PRUNE_GRACE_MS comment in tokens.ts for why
// that threshold cannot weaken refresh-token reuse detection.
describe('pruneExpiredOAuthRows', () => {
	async function approvedUserAndClient(email: string) {
		const user = await upsertGoogleUser(env.DB, { sub: 'google-sub-' + email, email, name: 'Prune User' }, undefined);
		await setUserStatus(env.DB, user.id, 'approved');
		const client = await registerClient(env.DB, {
			client_name: 'Prune Test Client',
			redirect_uris: ['http://localhost/callback']
		});
		if (!client.ok || !client.client) throw new Error('client registration failed in test setup');
		return { user, clientId: client.client.client_id };
	}

	it('deletes only rows whose expires_at is more than 7 days in the past, leaving fresh and recently-expired rows', async () => {
		const { user, clientId } = await approvedUserAndClient('prune-thresholds@example.com');
		const now = Date.now();
		const DAY = 24 * 60 * 60 * 1000;
		const isoAt = (offsetMs: number) => new Date(now + offsetMs).toISOString();

		const codeRows = [
			{ hash: 'code-fresh-' + crypto.randomUUID(), expiresAt: isoAt(10 * 60 * 1000) }, // 10 min future
			{ hash: 'code-recent-' + crypto.randomUUID(), expiresAt: isoAt(-2 * DAY) }, // 2 days ago
			{ hash: 'code-stale-' + crypto.randomUUID(), expiresAt: isoAt(-10 * DAY) } // 10 days ago
		];
		for (const row of codeRows) {
			await env.DB.prepare(
				`INSERT INTO oauth_codes
				 (code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, expires_at, created_at)
				 VALUES (?, ?, ?, 'http://localhost/callback', 'challenge', 'S256', 'trips', NULL, ?, datetime('now'))`
			)
				.bind(row.hash, clientId, user.id, row.expiresAt)
				.run();
		}

		const tokenRows = [
			{ hash: 'token-fresh-' + crypto.randomUUID(), expiresAt: isoAt(60 * 60 * 1000) }, // 1 hour future
			{ hash: 'token-recent-' + crypto.randomUUID(), expiresAt: isoAt(-2 * DAY) }, // 2 days ago
			{ hash: 'token-stale-' + crypto.randomUUID(), expiresAt: isoAt(-10 * DAY) } // 10 days ago
		];
		for (const row of tokenRows) {
			await env.DB.prepare(
				`INSERT INTO oauth_tokens (token_hash, kind, client_id, user_id, scope, family_id, expires_at, created_at)
				 VALUES (?, 'access', ?, ?, 'trips', NULL, ?, datetime('now'))`
			)
				.bind(row.hash, clientId, user.id, row.expiresAt)
				.run();
		}

		await pruneExpiredOAuthRows(env.DB);

		const remainingCodeHashes = new Set(
			(await env.DB.prepare('SELECT code_hash FROM oauth_codes WHERE code_hash LIKE ?').bind('code-%').all<{ code_hash: string }>())
				.results.map((r) => r.code_hash)
		);
		expect(remainingCodeHashes.has(codeRows[0].hash)).toBe(true); // fresh — kept
		expect(remainingCodeHashes.has(codeRows[1].hash)).toBe(true); // recently expired — kept (within grace)
		expect(remainingCodeHashes.has(codeRows[2].hash)).toBe(false); // long expired — pruned

		const remainingTokenHashes = new Set(
			(await env.DB.prepare('SELECT token_hash FROM oauth_tokens WHERE token_hash LIKE ?').bind('token-%').all<{ token_hash: string }>())
				.results.map((r) => r.token_hash)
		);
		expect(remainingTokenHashes.has(tokenRows[0].hash)).toBe(true); // fresh — kept
		expect(remainingTokenHashes.has(tokenRows[1].hash)).toBe(true); // recently expired — kept (within grace)
		expect(remainingTokenHashes.has(tokenRows[2].hash)).toBe(false); // long expired — pruned
	});

	it('never deletes a rotated-out (replaced) refresh token before it is past its own expiry + grace — reuse detection still fires', async () => {
		const { user, clientId } = await approvedUserAndClient('prune-reuse-safety@example.com');
		const first = await issueTokenPair(env.DB, { clientId, userId: user.id, scope: 'trips' });

		// Rotate: the OLD refresh token row is now revoked+replaced_by, but its
		// expires_at is still ~60 days out (REFRESH_TTL_MS), untouched by rotation.
		const rotated = await rotateRefreshToken(env.DB, first.refreshToken, clientId);
		expect(rotated.ok).toBe(true);

		// Prune runs (e.g. triggered by the very next token issuance) — should be
		// a no-op for the rotated-out row, since its own expiry is weeks away.
		await pruneExpiredOAuthRows(env.DB);

		// Presenting the OLD (rotated-out) refresh token again must still be
		// detected as reuse (and burn the family), not 'invalid' — which is what
		// would happen if pruning had deleted the row out from under the check.
		const replay = await rotateRefreshToken(env.DB, first.refreshToken, clientId);
		expect(replay.ok).toBe(false);
		if (!replay.ok) expect(replay.reason).toBe('reuse');
	});

	it('is a safe no-op on a D1 error (never throws)', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const throwingDb = {
			batch() {
				throw new Error('boom');
			}
		} as unknown as D1Database;
		await expect(pruneExpiredOAuthRows(throwingDb)).resolves.toBeUndefined();
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});
