import type { Handle } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	validateSessionToken,
	setSessionCookie,
	deleteSessionCookie
} from '$lib/server/session';
import { clearPhotosTokenCookie } from '$lib/server/googlephotos';
import {
	LOCALE_COOKIE,
	LOCALE_COOKIE_MAX_AGE,
	isLocale,
	resolveLocale
} from '$lib/i18n';
import { THEME_COOKIE, resolveTheme, themeAttr } from '$lib/theme';

// Cross-origin form-POST guard, re-implemented here because SvelteKit's built-in
// check (csrf.checkOrigin) is disabled in vite.config so the OAuth token/register
// endpoints and /mcp can be called cross-origin by MCP clients. These exact paths
// are the only exemptions; every other state-changing form POST from a foreign
// origin is still rejected (the consent action at /oauth/authorize included).
const CSRF_EXEMPT_PATHS = new Set(['/oauth/token', '/oauth/register', '/mcp']);
const FORM_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isCrossOriginFormForbidden(event: Parameters<Handle>[0]['event']): boolean {
	if (!UNSAFE_METHODS.has(event.request.method)) return false;
	if (CSRF_EXEMPT_PATHS.has(event.url.pathname)) return false;
	const contentType = (event.request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!FORM_CONTENT_TYPES.includes(contentType)) return false;
	const origin = event.request.headers.get('origin');
	return origin !== event.url.origin;
}

// Baseline security headers applied to every response (including error
// responses), set directly on the Response object after resolve() rather
// than via setHeaders() in individual load functions — the latter can only
// reach page responses, not API routes, static assets, or error pages.
// Deliberately no full CSP (script-src etc.) here: frame-ancestors only,
// to keep this a low-risk addition. /oauth/authorize sets its own
// X-Frame-Options/CSP via setHeaders for the same values; harmless overlap.
function applySecurityHeaders(response: Response): Response {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
	return response;
}

/** Resolve the session cookie to a user on every request. */
export const handle: Handle = async ({ event, resolve }) => {
	if (isCrossOriginFormForbidden(event)) {
		return applySecurityHeaders(new Response('Cross-site form submissions are forbidden', { status: 403 }));
	}

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
			// The session cookie is gone; drop any leftover Photos token cookie
			// too so it can't outlive the session it was scoped to.
			clearPhotosTokenCookie(event.cookies);
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

	// ── Theme ──
	// Cookie holds light|dark|system (default system). For an explicit mode we
	// stamp data-theme on <html> so the first server-rendered byte carries the
	// right palette (no flash); `system` stamps nothing and lets the @media
	// (prefers-color-scheme) rules in tokens.css decide.
	const theme = resolveTheme(event.cookies.get(THEME_COOKIE));
	event.locals.theme = theme;

	// Stamp <html lang="%lang%"%theme-attr%> so the very first server-rendered
	// byte carries the right language + palette (no post-hydration correction).
	const response = await resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%lang%', locale).replace('%theme-attr%', themeAttr(theme))
	});
	return applySecurityHeaders(response);
};
