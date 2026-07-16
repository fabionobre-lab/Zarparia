import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { SESSION_COOKIE, invalidateSession, deleteSessionCookie } from '$lib/server/session';
import { clearPhotosTokenCookie } from '$lib/server/googlephotos';

export const POST: RequestHandler = async ({ platform, cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) {
		await invalidateSession(getDb(platform), token);
		deleteSessionCookie(cookies);
	}
	// The Google Photos access-token cookie is bound to this session's user
	// (see googlephotos.ts), but clear it here too regardless — belt-and-
	// suspenders so it never lingers past sign-out even for one browser tick.
	clearPhotosTokenCookie(cookies);
	redirect(303, '/');
};
