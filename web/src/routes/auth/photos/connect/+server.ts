import { redirect } from '@sveltejs/kit';
import { generateState, generateCodeVerifier } from 'arctic';
import type { RequestHandler } from './$types';
import { getGoogle } from '$lib/server/oauth';
import { PHOTOS_SCOPE } from '$lib/server/googlephotos';
import { setReturnTo } from '$lib/server/returnto';

const TEN_MINUTES = 60 * 10;

/** Incremental consent for the Google Photos Picker scope. Reuses the login
 *  OAuth client and redirect URI (no extra Google-side provisioning); the
 *  shared callback tells the two flows apart via the `google_oauth_flow`
 *  cookie. Requires an existing app session — this grants a capability to a
 *  signed-in user, it does not sign anyone in. */
export const GET: RequestHandler = async ({ locals, platform, url, cookies }) => {
	if (!locals.user || locals.user.status !== 'approved') redirect(302, '/');

	const google = getGoogle(platform, url.origin);
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const authUrl = google.createAuthorizationURL(state, codeVerifier, [PHOTOS_SCOPE]);
	// Keep the grant on the account they signed in with, and merge with the
	// scopes already granted at login instead of replacing them.
	authUrl.searchParams.set('login_hint', locals.user.email);
	authUrl.searchParams.set('include_granted_scopes', 'true');

	const opts = { path: '/', httpOnly: true, sameSite: 'lax', maxAge: TEN_MINUTES } as const;
	cookies.set('google_oauth_state', state, opts);
	cookies.set('google_code_verifier', codeVerifier, opts);
	cookies.set('google_oauth_flow', 'photos', opts);
	setReturnTo(cookies, url.searchParams.get('return') ?? '/');

	redirect(302, authUrl.toString());
};
