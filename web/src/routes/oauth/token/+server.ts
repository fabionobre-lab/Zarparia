// OAuth 2.1 token endpoint. Public clients only (no client auth). Supports the
// authorization_code (with mandatory PKCE S256) and refresh_token (rotating)
// grants. Called cross-origin by MCP clients with an
// application/x-www-form-urlencoded body — this path is exempted from the
// origin-CSRF guard in hooks.server.ts (SvelteKit's own check is disabled via
// csrf.checkOrigin=false in vite.config and re-implemented there with an
// allowlist), so the form POST is accepted. JSON bodies are also accepted.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { consumeAuthCode, getClient, verifyPkceS256 } from '$lib/server/mcp/oauth';
import { issueTokenPair, rotateRefreshToken } from '$lib/server/mcp/tokens';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

function oauthError(error: string, description: string, status = 400) {
	return json({ error, error_description: description }, { status, headers: CORS });
}

/** Read the request body as a param map, accepting form-encoded or JSON. */
async function readParams(request: Request): Promise<Record<string, string>> {
	const ct = request.headers.get('content-type') ?? '';
	const out: Record<string, string> = {};
	if (ct.includes('application/json')) {
		const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
		if (body && typeof body === 'object') {
			for (const [k, v] of Object.entries(body)) if (typeof v === 'string') out[k] = v;
		}
		return out;
	}
	const text = await request.text();
	for (const [k, v] of new URLSearchParams(text)) out[k] = v;
	return out;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform);
	const p = await readParams(request);
	const grantType = p.grant_type;

	if (grantType === 'authorization_code') {
		const { code, redirect_uri, client_id, code_verifier } = p;
		if (!code || !redirect_uri || !client_id || !code_verifier) {
			return oauthError(
				'invalid_request',
				'code, redirect_uri, client_id and code_verifier are required.'
			);
		}
		// Single-use consume happens first (atomic delete), so even a request that
		// later fails validation cannot be replayed with the same code.
		const consumed = await consumeAuthCode(db, code);
		if (!consumed) return oauthError('invalid_grant', 'Authorization code is invalid or already used.');
		if (consumed.expired) return oauthError('invalid_grant', 'Authorization code has expired.');
		if (consumed.clientId !== client_id)
			return oauthError('invalid_grant', 'Authorization code was issued to a different client.');
		if (consumed.redirectUri !== redirect_uri)
			return oauthError('invalid_grant', 'redirect_uri does not match the authorization request.');
		if (consumed.codeChallengeMethod !== 'S256')
			return oauthError('invalid_grant', 'Unsupported code_challenge_method.');
		if (!(await verifyPkceS256(code_verifier, consumed.codeChallenge)))
			return oauthError('invalid_grant', 'PKCE verification failed.');

		const tokens = await issueTokenPair(db, {
			clientId: consumed.clientId,
			userId: consumed.userId,
			scope: consumed.scope
		});
		return json(
			{
				access_token: tokens.accessToken,
				token_type: 'Bearer',
				expires_in: tokens.expiresInSeconds,
				refresh_token: tokens.refreshToken,
				scope: tokens.scope
			},
			{ headers: CORS }
		);
	}

	if (grantType === 'refresh_token') {
		const { refresh_token, client_id } = p;
		if (!refresh_token || !client_id)
			return oauthError('invalid_request', 'refresh_token and client_id are required.');
		// Confirm the client still exists (it may have been pruned).
		if (!(await getClient(db, client_id)))
			return oauthError('invalid_client', 'Unknown client_id.', 401);

		const result = await rotateRefreshToken(db, refresh_token, client_id);
		if (!result.ok) {
			const desc =
				result.reason === 'reuse'
					? 'Refresh token reuse detected; the token family has been revoked. Re-authorize.'
					: result.reason === 'expired'
						? 'Refresh token has expired. Re-authorize.'
						: result.reason === 'client_mismatch'
							? 'Refresh token was issued to a different client.'
							: 'Refresh token is invalid.';
			return oauthError('invalid_grant', desc);
		}
		return json(
			{
				access_token: result.tokens.accessToken,
				token_type: 'Bearer',
				expires_in: result.tokens.expiresInSeconds,
				refresh_token: result.tokens.refreshToken,
				scope: result.tokens.scope
			},
			{ headers: CORS }
		);
	}

	return oauthError('unsupported_grant_type', `Unsupported grant_type: ${grantType ?? '(none)'}.`);
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: {
			...CORS,
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'content-type, authorization'
		}
	});
