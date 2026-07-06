import type { Cookies } from '@sveltejs/kit';
import type { SessionUser } from '$lib/types';

const DAY = 1000 * 60 * 60 * 24;
const SESSION_TTL_MS = 30 * DAY;
const RENEW_WITHIN_MS = 15 * DAY; // sliding window: extend when less than this remains

export const SESSION_COOKIE = 'session';

function toHex(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) out += b.toString(16).padStart(2, '0');
	return out;
}

/** Session id stored in D1 is the SHA-256 of the cookie token, so a DB leak
 *  does not expose usable session tokens. */
async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return toHex(new Uint8Array(digest));
}

export function generateSessionToken(): string {
	const bytes = new Uint8Array(24);
	crypto.getRandomValues(bytes);
	return toHex(bytes);
}

export async function createSession(db: D1Database, token: string, userId: string): Promise<void> {
	const id = await hashToken(token);
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
	await db
		.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
		.bind(id, userId, expiresAt)
		.run();
}

/** Returns the user for a valid, unexpired session; renews near expiry.
 *  Deletes and returns null for expired/unknown sessions. */
export async function validateSessionToken(
	db: D1Database,
	token: string
): Promise<SessionUser | null> {
	const id = await hashToken(token);
	const row = await db
		.prepare(
			`SELECT s.expires_at AS expiresAt, u.id AS id, u.email AS email, u.name AS name, u.avatar_url AS avatarUrl
			 FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
		)
		.bind(id)
		.first<{ expiresAt: string; id: string; email: string; name: string | null; avatarUrl: string | null }>();
	if (!row) return null;

	const expiresMs = new Date(row.expiresAt).getTime();
	if (Date.now() >= expiresMs) {
		await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
		return null;
	}
	if (expiresMs - Date.now() < RENEW_WITHIN_MS) {
		const newExpiry = new Date(Date.now() + SESSION_TTL_MS).toISOString();
		await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(newExpiry, id).run();
	}
	return { id: row.id, email: row.email, name: row.name, avatarUrl: row.avatarUrl };
}

export async function invalidateSession(db: D1Database, token: string): Promise<void> {
	const id = await hashToken(token);
	await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}

export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: new Date(Date.now() + SESSION_TTL_MS)
		// `secure` defaults to true except on http localhost (SvelteKit).
	});
}

export function deleteSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
