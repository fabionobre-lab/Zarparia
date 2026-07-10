export type ShareLinkRole = 'viewer' | 'editor';

export interface ShareLinkRow {
	token: string;
	role: ShareLinkRole;
}

/** 32 random bytes, base64url-encoded without padding. */
function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The trip's link, or null when link sharing is off. */
export async function getShareLink(db: D1Database, tripId: string): Promise<ShareLinkRow | null> {
	return await db
		.prepare('SELECT token, role FROM trip_share_links WHERE trip_id = ?')
		.bind(tripId)
		.first<ShareLinkRow>();
}

/**
 * Enable or re-permission the trip's link. A fresh token is minted only when no
 * link exists yet — changing the role keeps the existing token so already-shared
 * URLs keep working.
 */
export async function upsertShareLink(
	db: D1Database,
	tripId: string,
	role: ShareLinkRole
): Promise<ShareLinkRow> {
	const existing = await getShareLink(db, tripId);
	if (existing) {
		if (existing.role !== role) {
			await db.prepare('UPDATE trip_share_links SET role = ? WHERE trip_id = ?').bind(role, tripId).run();
		}
		return { token: existing.token, role };
	}
	const token = generateToken();
	await db
		.prepare('INSERT INTO trip_share_links (trip_id, token, role, created_at) VALUES (?, ?, ?, ?)')
		.bind(tripId, token, role, Date.now())
		.run();
	return { token, role };
}

export async function deleteShareLink(db: D1Database, tripId: string): Promise<void> {
	await db.prepare('DELETE FROM trip_share_links WHERE trip_id = ?').bind(tripId).run();
}

/**
 * Redeem a link for the given user. No-ops (but succeeds) if the user already
 * owns the trip. Otherwise grants a trip_shares row, keeping the HIGHER role
 * when one already exists (editor > viewer). Returns { tripId } on success, or
 * null for an unknown/revoked token.
 */
export async function redeemShareLink(
	db: D1Database,
	token: string,
	userId: string
): Promise<{ tripId: string } | null> {
	const link = await db
		.prepare('SELECT trip_id AS tripId, role FROM trip_share_links WHERE token = ?')
		.bind(token)
		.first<{ tripId: string; role: ShareLinkRole }>();
	if (!link) return null;

	const owner = await db
		.prepare('SELECT owner_id AS ownerId FROM trips WHERE id = ?')
		.bind(link.tripId)
		.first<{ ownerId: string }>();
	if (!owner) return null; // trip removed out from under the link
	if (owner.ownerId === userId) return { tripId: link.tripId };

	const existing = await db
		.prepare('SELECT permission FROM trip_shares WHERE trip_id = ? AND user_id = ?')
		.bind(link.tripId, userId)
		.first<{ permission: ShareLinkRole }>();
	// Keep the higher of the existing grant and the link's role.
	const role: ShareLinkRole =
		existing?.permission === 'editor' || link.role === 'editor' ? 'editor' : 'viewer';

	await db
		.prepare(
			`INSERT INTO trip_shares (trip_id, user_id, permission) VALUES (?, ?, ?)
			 ON CONFLICT (trip_id, user_id) DO UPDATE SET permission = excluded.permission`
		)
		.bind(link.tripId, userId, role)
		.run();

	return { tripId: link.tripId };
}
