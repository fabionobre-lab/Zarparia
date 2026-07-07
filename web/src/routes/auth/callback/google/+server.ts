import { error, redirect } from '@sveltejs/kit';
import { OAuth2RequestError } from 'arctic';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getGoogle, fetchGoogleProfile } from '$lib/server/oauth';
import { upsertGoogleUser } from '$lib/server/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/session';

export const GET: RequestHandler = async ({ platform, url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('google_oauth_state');
	const codeVerifier = cookies.get('google_code_verifier');

	if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
		throw error(400, 'Invalid or expired sign-in request. Please try again.');
	}

	const google = getGoogle(platform, url.origin);
	let accessToken: string;
	try {
		const tokens = await google.validateAuthorizationCode(code, codeVerifier);
		accessToken = tokens.accessToken();
	} catch (e) {
		if (e instanceof OAuth2RequestError) throw error(400, 'Google rejected the sign-in. Please try again.');
		throw e;
	}

	const profile = await fetchGoogleProfile(accessToken);
	if (!profile.email) throw error(400, 'Google account has no email address.');
	// Reject explicitly-unverified emails (undefined passes — some responses omit the claim).
	if (profile.email_verified === false)
		throw error(403, 'Your Google account email is unverified. Verify it with Google and try again.');

	const db = getDb(platform);
	const user = await upsertGoogleUser(db, profile);
	const token = generateSessionToken();
	await createSession(db, token, user.id);
	setSessionCookie(cookies, token);

	cookies.delete('google_oauth_state', { path: '/' });
	cookies.delete('google_code_verifier', { path: '/' });

	redirect(303, '/');
};
