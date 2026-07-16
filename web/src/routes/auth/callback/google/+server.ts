import { error, redirect } from '@sveltejs/kit';
import { OAuth2RequestError } from 'arctic';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getGoogle, fetchGoogleProfile } from '$lib/server/oauth';
import { upsertGoogleUser } from '$lib/server/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/session';
import { takeReturnTo } from '$lib/server/returnto';
import { setPhotosTokenCookie } from '$lib/server/googlephotos';

export const GET: RequestHandler = async ({ locals, platform, url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('google_oauth_state');
	const codeVerifier = cookies.get('google_code_verifier');
	// Which flow started this round-trip: 'photos' (incremental Photos-Picker
	// consent for an already-signed-in user, from /auth/photos/connect) or
	// sign-in (no cookie). Both share this registered redirect URI.
	const flow = cookies.get('google_oauth_flow');
	cookies.delete('google_oauth_flow', { path: '/' });

	if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
		throw error(400, 'Invalid or expired sign-in request. Please try again.');
	}

	const google = getGoogle(platform, url.origin);
	let accessToken: string;
	let accessTokenExpiresAt: Date | null = null;
	try {
		const tokens = await google.validateAuthorizationCode(code, codeVerifier);
		accessToken = tokens.accessToken();
		try {
			accessTokenExpiresAt = tokens.accessTokenExpiresAt();
		} catch {
			accessTokenExpiresAt = null; // no expires_in in the response
		}
	} catch (e) {
		if (e instanceof OAuth2RequestError) throw error(400, 'Google rejected the sign-in. Please try again.');
		throw e;
	}

	if (flow === 'photos') {
		// Capability grant, not a sign-in: just stash the short-lived Picker
		// token for the existing session and return to the trip page.
		if (!locals.user) redirect(302, '/');
		const expiresAt = accessTokenExpiresAt ?? new Date(Date.now() + 30 * 60 * 1000);
		setPhotosTokenCookie(cookies, accessToken, expiresAt);
		cookies.delete('google_oauth_state', { path: '/' });
		cookies.delete('google_code_verifier', { path: '/' });
		redirect(303, takeReturnTo(cookies));
	}

	const profile = await fetchGoogleProfile(accessToken);
	if (!profile.email) throw error(400, 'Google account has no email address.');
	// Reject explicitly-unverified emails (undefined passes — some responses omit the claim).
	if (profile.email_verified === false)
		throw error(403, 'Your Google account email is unverified. Verify it with Google and try again.');

	const db = getDb(platform);
	const user = await upsertGoogleUser(db, profile, platform);
	const token = generateSessionToken();
	await createSession(db, token, user.id);
	setSessionCookie(cookies, token);

	cookies.delete('google_oauth_state', { path: '/' });
	cookies.delete('google_code_verifier', { path: '/' });

	// Return to where the visitor started (e.g. a /join/<token> invite), if a
	// safe same-origin path was stashed before the OAuth round-trip.
	redirect(303, takeReturnTo(cookies));
};
