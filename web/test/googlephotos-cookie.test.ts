// Cross-user leak audit, Finding 1 — the Google Photos Picker access-token
// cookie (`gp_access`) must (a) be bound server-side to the user it was
// issued to, so a stale cookie is inert for anyone else, and (b) be cleared
// on every session end (logout, account deletion). Same discipline as the
// other test files: real D1 via Miniflare where a route handler needs it.
import { env } from 'cloudflare:workers';
import { isRedirect, type Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import {
	PHOTOS_TOKEN_COOKIE,
	setPhotosTokenCookie,
	getPhotosToken,
	clearPhotosTokenCookie
} from '../src/lib/server/googlephotos';
import { createSession, generateSessionToken, validateSessionToken } from '../src/lib/server/session';
import { upsertGoogleUser, setUserStatus } from '../src/lib/server/users';
import { POST as logoutPOST } from '../src/routes/auth/logout/+server';
import { DELETE as accountDELETE } from '../src/routes/api/account/+server';

/** In-memory stand-in for SvelteKit's Cookies — records deletions so tests
 *  can assert exactly which cookies each path cleared. */
function fakeCookies(initial: Record<string, string> = {}) {
	const jar = new Map(Object.entries(initial));
	const deleted: string[] = [];
	const cookies = {
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => void jar.set(name, value),
		delete: (name: string) => {
			jar.delete(name);
			deleted.push(name);
		}
	} as unknown as Cookies;
	return { cookies, jar, deleted };
}

function platformWith(db: D1Database) {
	return { env: { DB: db, PHOTOS: env.PHOTOS } } as unknown as App.Platform;
}

async function approvedUser(email: string) {
	const user = await upsertGoogleUser(env.DB, { sub: 'sub-' + email, email, name: 'GP User' }, undefined);
	await setUserStatus(env.DB, user.id, 'approved');
	return { ...user, status: 'approved' as const };
}

// Real Google access tokens contain dots ("ya29.a0Af...") — the uid/token
// split must survive that.
const DOTTED_TOKEN = 'ya29.a0AfB_byExample.Token-With.Dots';

describe('photos token cookie — user binding', () => {
	it('round-trips the token for the user it was issued to', () => {
		const { cookies } = fakeCookies();
		setPhotosTokenCookie(cookies, 'user-a', DOTTED_TOKEN, new Date(Date.now() + 3600_000));
		expect(getPhotosToken(cookies, 'user-a')).toBe(DOTTED_TOKEN);
	});

	it('returns null AND clears the cookie when a different user reads it', () => {
		const { cookies, jar, deleted } = fakeCookies();
		setPhotosTokenCookie(cookies, 'user-a', DOTTED_TOKEN, new Date(Date.now() + 3600_000));
		expect(getPhotosToken(cookies, 'user-b')).toBeNull();
		expect(deleted).toContain(PHOTOS_TOKEN_COOKIE);
		expect(jar.has(PHOTOS_TOKEN_COOKIE)).toBe(false);
		// And the rightful owner can't resurrect it either — it's gone.
		expect(getPhotosToken(cookies, 'user-a')).toBeNull();
	});

	it('returns null when no cookie is present', () => {
		const { cookies } = fakeCookies();
		expect(getPhotosToken(cookies, 'user-a')).toBeNull();
	});

	it('treats a legacy/malformed value (no uid prefix) as no token and clears it', () => {
		// A cookie set before user-binding existed holds the bare token — it has
		// dots but its "uid" segment is a token fragment, never a real user id.
		const { cookies, deleted } = fakeCookies({ [PHOTOS_TOKEN_COOKIE]: 'sometokenwithoutdots' });
		expect(getPhotosToken(cookies, 'user-a')).toBeNull();
		expect(deleted).toContain(PHOTOS_TOKEN_COOKIE);
	});

	it('clearPhotosTokenCookie removes the cookie', () => {
		const { cookies, jar } = fakeCookies();
		setPhotosTokenCookie(cookies, 'user-a', DOTTED_TOKEN, new Date(Date.now() + 3600_000));
		clearPhotosTokenCookie(cookies);
		expect(jar.has(PHOTOS_TOKEN_COOKIE)).toBe(false);
	});
});

describe('photos token cookie — cleared on every session end', () => {
	it('POST /auth/logout invalidates the session and clears BOTH cookies', async () => {
		const user = await approvedUser('gp-logout@example.com');
		const sessionToken = generateSessionToken();
		await createSession(env.DB, sessionToken, user.id);

		const { cookies, deleted } = fakeCookies({ session: sessionToken });
		setPhotosTokenCookie(cookies, user.id, DOTTED_TOKEN, new Date(Date.now() + 3600_000));

		try {
			await logoutPOST({ platform: platformWith(env.DB), cookies } as never);
			expect.unreachable('logout must redirect');
		} catch (e) {
			expect(isRedirect(e)).toBe(true);
		}
		expect(deleted).toContain('session');
		expect(deleted).toContain(PHOTOS_TOKEN_COOKIE);
		// The session row is gone server-side too.
		expect(await validateSessionToken(env.DB, sessionToken)).toBeNull();
	});

	it('POST /auth/logout clears the photos cookie even with no live session', async () => {
		const { cookies, deleted } = fakeCookies({ [PHOTOS_TOKEN_COOKIE]: `stale-uid.${DOTTED_TOKEN}` });
		try {
			await logoutPOST({ platform: platformWith(env.DB), cookies } as never);
			expect.unreachable('logout must redirect');
		} catch (e) {
			expect(isRedirect(e)).toBe(true);
		}
		expect(deleted).toContain(PHOTOS_TOKEN_COOKIE);
	});

	it('DELETE /api/account clears the photos cookie alongside the session cookie', async () => {
		const user = await approvedUser('gp-delete@example.com');
		const { cookies, deleted } = fakeCookies();
		setPhotosTokenCookie(cookies, user.id, DOTTED_TOKEN, new Date(Date.now() + 3600_000));

		const request = new Request('https://example.com/api/account', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ confirm: 'DELETE' })
		});
		const res = await accountDELETE({
			platform: platformWith(env.DB),
			locals: { user },
			request,
			cookies
		} as never);
		expect(res.status).toBe(200);
		expect(deleted).toContain('session');
		expect(deleted).toContain(PHOTOS_TOKEN_COOKIE);
	});
});
