// OAuth 2.1 authorization endpoint — a SvelteKit PAGE so it can render an
// app-styled consent screen and require an authenticated session.
//
// Flow:
//  - Validate client_id + exact redirect_uri BEFORE anything else. If either is
//    bad we must NOT redirect back (could be an open redirect / spoofed client),
//    so we render an error instead.
//  - Other protocol errors (bad response_type, missing/!S256 PKCE) redirect back
//    to the client with an OAuth `error` param, per OAuth 2.1.
//  - If the visitor isn't signed in, bounce through the existing Google login and
//    return to this exact authorize URL afterwards.
//  - Approve (form action) mints a single-use code; Deny returns access_denied.
import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getDb } from '$lib/server/db';
import { getAuthEnv } from '$lib/server/authenv';
import { setReturnTo } from '$lib/server/returnto';
import { getClient, createAuthCode, SUPPORTED_SCOPE } from '$lib/server/mcp/oauth';
import { limit, clientIp, ipKey } from '$lib/server/ratelimit';

/** Append an OAuth error to the client's redirect_uri and bounce there. */
function redirectWithError(redirectUri: string, err: string, state: string | null): never {
	const u = new URL(redirectUri);
	u.searchParams.set('error', err);
	if (state) u.searchParams.set('state', state);
	throw redirect(302, u.toString());
}

export const load: PageServerLoad = async ({ url, locals, platform, cookies, setHeaders, request }) => {
	// This page must never be framed (clickjacking of the Approve button).
	setHeaders({ 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "frame-ancestors 'none'" });

	const db = getDb(platform);
	const rl = await limit(db, ipKey(clientIp(request), 'oauth-authorize'), { max: 30, windowSeconds: 60 });
	if (!rl.allowed) throw error(429, 'Too many requests. Please slow down.');
	const clientId = url.searchParams.get('client_id');
	const redirectUri = url.searchParams.get('redirect_uri');
	const responseType = url.searchParams.get('response_type');
	const codeChallenge = url.searchParams.get('code_challenge');
	const codeChallengeMethod = url.searchParams.get('code_challenge_method');
	const state = url.searchParams.get('state');
	const resource = url.searchParams.get('resource');

	if (!clientId || !redirectUri) throw error(400, 'Missing client_id or redirect_uri.');
	const client = await getClient(db, clientId);
	if (!client) throw error(400, 'Unknown client_id. Register the client first.');
	// Exact match — no prefix/substring matching.
	if (!client.redirect_uris.includes(redirectUri))
		throw error(400, 'redirect_uri does not match any registered URI for this client.');

	// From here, redirect_uri is trusted, so protocol errors go back to the client.
	if (responseType !== 'code') redirectWithError(redirectUri, 'unsupported_response_type', state);
	if (!codeChallenge || codeChallengeMethod !== 'S256')
		redirectWithError(redirectUri, 'invalid_request', state);

	// Require an authenticated user; bounce through login and come back here.
	if (!locals.user) {
		const returnTo = url.pathname + url.search;
		if (getAuthEnv(platform).devAuth) {
			throw redirect(302, `/auth/dev-login?returnTo=${encodeURIComponent(returnTo)}`);
		}
		setReturnTo(cookies, returnTo);
		throw redirect(302, '/auth/login/google');
	}

	// Phase 3 approval gate: a pending/rejected user is signed in but must not
	// see (or be able to approve) the consent screen — that would hand an MCP
	// client a token before the account itself is trusted.
	if (locals.user.status !== 'approved') {
		throw error(403, 'Your Zarparia account is pending approval. You can authorize this connector once approved.');
	}

	return {
		clientName: client.client_name,
		account: locals.user.email,
		params: {
			client_id: clientId,
			redirect_uri: redirectUri,
			code_challenge: codeChallenge,
			code_challenge_method: codeChallengeMethod,
			scope: SUPPORTED_SCOPE,
			state: state ?? '',
			resource: resource ?? ''
		}
	};
};

export const actions: Actions = {
	approve: async ({ request, locals, platform }) => {
		if (!locals.user) throw error(401, 'Sign in required.');
		if (locals.user.status !== 'approved') throw error(403, 'Account pending approval.');
		const db = getDb(platform);
		const form = await request.formData();
		const clientId = String(form.get('client_id') ?? '');
		const redirectUri = String(form.get('redirect_uri') ?? '');
		const codeChallenge = String(form.get('code_challenge') ?? '');
		const codeChallengeMethod = String(form.get('code_challenge_method') ?? '');
		const state = String(form.get('state') ?? '');
		const resource = String(form.get('resource') ?? '');

		// Re-validate everything against the DB — never trust the hidden fields.
		const client = await getClient(db, clientId);
		if (!client || !client.redirect_uris.includes(redirectUri) || codeChallengeMethod !== 'S256') {
			return fail(400, { error: 'Invalid authorization request.' });
		}

		const code = await createAuthCode(db, {
			clientId,
			userId: locals.user.id,
			redirectUri,
			codeChallenge,
			codeChallengeMethod,
			scope: SUPPORTED_SCOPE,
			resource: resource || null
		});

		const u = new URL(redirectUri);
		u.searchParams.set('code', code);
		if (state) u.searchParams.set('state', state);
		throw redirect(302, u.toString());
	},

	deny: async ({ request, platform }) => {
		const db = getDb(platform);
		const form = await request.formData();
		const clientId = String(form.get('client_id') ?? '');
		const redirectUri = String(form.get('redirect_uri') ?? '');
		const state = String(form.get('state') ?? '');
		// Same rule as approve: only ever redirect to a URI registered for the client.
		const client = await getClient(db, clientId);
		if (!client || !client.redirect_uris.includes(redirectUri)) {
			return fail(400, { error: 'Invalid authorization request.' });
		}
		redirectWithError(redirectUri, 'access_denied', state || null);
	}
};
