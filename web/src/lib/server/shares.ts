import { roleFor } from './trips';

export type SharePermission = 'editor' | 'viewer';

export interface ShareRow {
	userId: string;
	email: string;
	name: string | null;
	permission: SharePermission;
}

/** A share that can't take effect yet because the invitee has no account —
 *  stored in trip_invites and claimed on their first sign-in. */
export interface InviteRow {
	email: string;
	permission: SharePermission;
}

export type ShareResult =
	| { ok: true; share: ShareRow }
	| { ok: true; invite: InviteRow }
	| { ok: false; reason: 'not_owner' | 'self' };

/** People a trip is shared with (owner-facing). */
export async function listShares(db: D1Database, tripId: string): Promise<ShareRow[]> {
	const rows = await db
		.prepare(
			`SELECT ts.user_id AS userId, u.email AS email, u.name AS name, ts.permission AS permission
			 FROM trip_shares ts JOIN users u ON u.id = ts.user_id
			 WHERE ts.trip_id = ? ORDER BY u.email`
		)
		.bind(tripId)
		.all<ShareRow>();
	return rows.results;
}

/** Pending invites on a trip (emails with no account yet), owner-facing. */
export async function listInvites(db: D1Database, tripId: string): Promise<InviteRow[]> {
	const rows = await db
		.prepare(
			`SELECT email, permission FROM trip_invites WHERE trip_id = ? ORDER BY email`
		)
		.bind(tripId)
		.all<InviteRow>();
	return rows.results;
}

/**
 * Share (or re-permission) a trip by email. Only the owner may share.
 *  - If the email already has an account → a real trip_shares row is written.
 *  - If it doesn't → a pending invite (trip_invites) is recorded and claimed
 *    automatically when that person first signs in (see claimInvites in users.ts).
 * Either way the caller gets `{ ok: true }` with `share` or `invite` set.
 */
export async function shareWithEmail(
	db: D1Database,
	callerId: string,
	tripId: string,
	email: string,
	permission: SharePermission
): Promise<ShareResult> {
	if ((await roleFor(db, callerId, tripId)) !== 'owner') return { ok: false, reason: 'not_owner' };

	const normalizedEmail = email.trim().toLowerCase();
	const target = await db
		.prepare('SELECT id, email, name FROM users WHERE email = ?')
		.bind(normalizedEmail)
		.first<{ id: string; email: string; name: string | null }>();

	if (target) {
		if (target.id === callerId) return { ok: false, reason: 'self' };
		await db
			.prepare(
				`INSERT INTO trip_shares (trip_id, user_id, permission) VALUES (?, ?, ?)
				 ON CONFLICT (trip_id, user_id) DO UPDATE SET permission = excluded.permission`
			)
			.bind(tripId, target.id, permission)
			.run();
		return { ok: true, share: { userId: target.id, email: target.email, name: target.name, permission } };
	}

	// No account yet — record a pending invite, updating the permission if one
	// already exists for this (trip, email) pair.
	await db
		.prepare(
			`INSERT INTO trip_invites (trip_id, email, permission, invited_by) VALUES (?, ?, ?, ?)
			 ON CONFLICT (trip_id, email) DO UPDATE SET permission = excluded.permission`
		)
		.bind(tripId, normalizedEmail, permission, callerId)
		.run();
	return { ok: true, invite: { email: normalizedEmail, permission } };
}

export async function removeShare(
	db: D1Database,
	callerId: string,
	tripId: string,
	userId: string
): Promise<{ ok: true } | { ok: false; reason: 'not_owner' }> {
	if ((await roleFor(db, callerId, tripId)) !== 'owner') return { ok: false, reason: 'not_owner' };
	await db.prepare('DELETE FROM trip_shares WHERE trip_id = ? AND user_id = ?').bind(tripId, userId).run();
	return { ok: true };
}

/** Withdraw a pending invite (owner-only). Email is matched normalized. */
export async function removeInvite(
	db: D1Database,
	callerId: string,
	tripId: string,
	email: string
): Promise<{ ok: true } | { ok: false; reason: 'not_owner' }> {
	if ((await roleFor(db, callerId, tripId)) !== 'owner') return { ok: false, reason: 'not_owner' };
	await db
		.prepare('DELETE FROM trip_invites WHERE trip_id = ? AND email = ?')
		.bind(tripId, email.trim().toLowerCase())
		.run();
	return { ok: true };
}
