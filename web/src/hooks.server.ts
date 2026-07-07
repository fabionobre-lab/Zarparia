import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	validateSessionToken,
	setSessionCookie,
	deleteSessionCookie
} from '$lib/server/session';

/** Resolve the session cookie to a user on every request. */
export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const db = event.platform?.env?.DB;

	if (token && db) {
		const result = await validateSessionToken(db, token);
		if (result) {
			event.locals.user = result.user;
			// Re-issue the cookie with a fresh 30-day expiry when the DB session
			// was renewed, so the sliding window actually slides (the browser
			// otherwise deletes the cookie 30 days after login).
			if (result.renewed) setSessionCookie(event.cookies, token);
		} else {
			event.locals.user = null;
			deleteSessionCookie(event.cookies);
		}
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
