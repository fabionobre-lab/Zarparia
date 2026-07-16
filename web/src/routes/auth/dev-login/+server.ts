import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAuthEnv } from '$lib/server/authenv';
import { upsertGoogleUser } from '$lib/server/users';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/session';
import { isSafeReturnTo } from '$lib/server/returnto';

/**
 * DEV ONLY. Establishes a session without Google, so the app is usable locally
 * before OAuth credentials exist. Enabled only when DEV_AUTH=1 in the Worker
 * env (set in web/.dev.vars, never in production). Returns 404 otherwise.
 *   GET /auth/dev-login?email=you@example.com
 */
export const GET: RequestHandler = async ({ platform, cookies, url }) => {
	if (!getAuthEnv(platform).devAuth) throw error(404, 'Not found');

	const email = url.searchParams.get('email') || 'dev@example.com';
	const db = getDb(platform);
	const user = await upsertGoogleUser(
		db,
		{
			sub: 'dev:' + email,
			email,
			name: 'Dev User'
		},
		platform
	);
	const token = generateSessionToken();
	await createSession(db, token, user.id);
	setSessionCookie(cookies, token);

	// Honour a safe same-origin return path (used by the /join invite flow).
	const returnTo = url.searchParams.get('returnTo');
	redirect(303, isSafeReturnTo(returnTo) ? returnTo : '/');
};
