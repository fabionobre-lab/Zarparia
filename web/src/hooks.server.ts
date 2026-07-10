import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	validateSessionToken,
	setSessionCookie,
	deleteSessionCookie
} from '$lib/server/session';
import {
	LOCALE_COOKIE,
	LOCALE_COOKIE_MAX_AGE,
	isLocale,
	resolveLocale
} from '$lib/i18n';

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

	// ── UI locale ──
	// Cookie wins; first visit derives from Accept-Language (pt* → pt-BR, else
	// en-GB) and is persisted so the choice is stable on later requests.
	const cookieLocale = event.cookies.get(LOCALE_COOKIE);
	const locale = resolveLocale(cookieLocale, event.request.headers.get('accept-language'));
	event.locals.locale = locale;
	if (!isLocale(cookieLocale)) {
		event.cookies.set(LOCALE_COOKIE, locale, {
			path: '/',
			sameSite: 'lax',
			httpOnly: false, // the client switcher rewrites this cookie via document.cookie
			maxAge: LOCALE_COOKIE_MAX_AGE
		});
	}

	// Stamp <html lang="%lang%"> so the very first server-rendered byte carries
	// the right language (no post-hydration correction).
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', locale)
	});
};
