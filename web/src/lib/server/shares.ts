import { roleFor } from './trips';

export type SharePermission = 'editor' | 'viewer';

export interface ShareRow {
	userId: string;
	email: string;
	name: string | null;
	permission: SharePermission;
}

export type ShareResult =
	| { ok: true; share: ShareRow }
	| { ok: false; reason: 'not_owner' | 'no_user' | 'self' };

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

/**
 * Share (or re-permission) a trip with an existing user by email. Only the
 * owner may share. The target must already have an account — pending email
 * invites are a future enhancement (would need an invites table + claim on
 * signup).
 */
export async function shareWithEmail(
	db: D1Database,
	callerId: string,
	tripId: string,
	email: string,
	permission: SharePermission
): Promise<ShareResult> {
	if ((await roleFor(db, callerId, tripId)) !== 'owner') return { ok: false, reason: 'not_owner' };

	const target = await db
		.prepare('SELECT id, email, name FROM users WHERE email = ?')
		.bind(email.trim().toLowerCase())
		.first<{ id: string; email: string; name: string | null }>();
	if (!target) return { ok: false, reason: 'no_user' };
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
