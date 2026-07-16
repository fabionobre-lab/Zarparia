import { error, redirect } from '@sveltejs/kit';
import { generateState, generateCodeVerifier } from 'arctic';
import type { RequestHandler } from './$types';
import { getGoogle } from '$lib/server/oauth';
import { getDb } from '$lib/server/db';
import { limit, clientIp, ipKey } from '$lib/server/ratelimit';

const TEN_MINUTES = 60 * 10;

export const GET: RequestHandler = async ({ platform, url, cookies, request }) => {
	// Shared 20/min-per-IP budget with /auth/callback/google — covers the whole
	// login→callback round trip so splitting requests across the two endpoints
	// can't double an attacker's effective rate.
	const db = getDb(platform);
	const rl = await limit(db, ipKey(clientIp(request), 'auth-google'), { max: 20, windowSeconds: 60 });
	if (!rl.allowed) throw error(429, 'Too many requests. Please slow down.');

	const google = getGoogle(platform, url.origin);
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const authUrl = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

	const opts = { path: '/', httpOnly: true, sameSite: 'lax', maxAge: TEN_MINUTES } as const;
	cookies.set('google_oauth_state', state, opts);
	cookies.set('google_code_verifier', codeVerifier, opts);

	redirect(302, authUrl.toString());
};
