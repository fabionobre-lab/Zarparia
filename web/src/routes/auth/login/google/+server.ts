import { redirect } from '@sveltejs/kit';
import { generateState, generateCodeVerifier } from 'arctic';
import type { RequestHandler } from './$types';
import { getGoogle } from '$lib/server/oauth';

const TEN_MINUTES = 60 * 10;

export const GET: RequestHandler = async ({ platform, url, cookies }) => {
	const google = getGoogle(platform, url.origin);
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const authUrl = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

	const opts = { path: '/', httpOnly: true, sameSite: 'lax', maxAge: TEN_MINUTES } as const;
	cookies.set('google_oauth_state', state, opts);
	cookies.set('google_code_verifier', codeVerifier, opts);

	redirect(302, authUrl.toString());
};
