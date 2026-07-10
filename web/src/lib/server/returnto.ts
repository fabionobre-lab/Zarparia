import type { Cookies } from '@sveltejs/kit';

const RETURN_TO_COOKIE = 'return_to';
const TEN_MINUTES = 60 * 10;

/**
 * Only same-origin absolute paths are safe post-login redirect targets: a single
 * leading '/', and the second char must not be '/' or '\' (which would make it a
 * protocol-relative URL like `//evil.com`). Absolute URLs (`https://…`) never
 * start with '/', so they are rejected too.
 */
export function isSafeReturnTo(path: string | null | undefined): path is string {
	return (
		typeof path === 'string' &&
		path.length > 1 &&
		path[0] === '/' &&
		path[1] !== '/' &&
		path[1] !== '\\'
	);
}

/** Stash a validated return-to path in a short-lived httpOnly cookie. */
export function setReturnTo(cookies: Cookies, path: string): void {
	if (!isSafeReturnTo(path)) return;
	cookies.set(RETURN_TO_COOKIE, path, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: TEN_MINUTES
	});
}

/** Read and clear the return-to cookie, returning a validated path or '/'. */
export function takeReturnTo(cookies: Cookies): string {
	const raw = cookies.get(RETURN_TO_COOKIE);
	cookies.delete(RETURN_TO_COOKIE, { path: '/' });
	return isSafeReturnTo(raw) ? raw : '/';
}
