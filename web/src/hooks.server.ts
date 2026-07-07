import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	validateSessionToken,
	deleteSessionCookie
} from '$lib/server/session';

/** Resolve the session cookie to a user on every request. */
export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const db = event.platform?.env?.DB;

	if (token && db) {
		const user = await validateSessionToken(db, token);
		if (user) {
			event.locals.user = user;
		} else {
			event.locals.user = null;
			deleteSessionCookie(event.cookies);
		}
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
