import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { SESSION_COOKIE, invalidateSession, deleteSessionCookie } from '$lib/server/session';

export const POST: RequestHandler = async ({ platform, cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) {
		await invalidateSession(getDb(platform), token);
		deleteSessionCookie(cookies);
	}
	redirect(303, '/');
};
