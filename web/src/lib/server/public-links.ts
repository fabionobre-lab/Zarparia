// Public share route (docs/public-share-route-spec.md): trip_public_links is
// the anonymous, read-only counterpart to trip_share_links (share-links.ts) —
// see that file's header for why the two are deliberately separate tables.

export interface PublicLinkRow {
	token: string;
	createdAt: number;
}

/** 32 random bytes, base64url-encoded without padding. Same generator as
 *  share-links.ts's generateToken() — duplicated rather than imported, since
 *  the spec calls for the public link to have its own table/module entirely
 *  (never sharing code paths that could blur "public" and "collaborator"). */
function generateToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The trip's active public link, or null when public sharing is off (never
 *  enabled, or revoked). */
export async function getPublicLink(db: D1Database, tripId: string): Promise<PublicLinkRow | null> {
	return await db
		.prepare('SELECT token, created_at AS createdAt FROM trip_public_links WHERE trip_id = ? AND revoked_at IS NULL')
		.bind(tripId)
		.first<PublicLinkRow>();
}

/**
 * Enable public sharing for the trip. Idempotent while a link is already
 * active — returns the existing token unchanged, so a URL an owner already
 * copied keeps working. Mints a FRESH token when enabling for the first time
 * or re-enabling after a revoke, so a revoked (potentially leaked) token can
 * never come back to life under a new "on" state.
 */
export async function enablePublicLink(db: D1Database, tripId: string): Promise<PublicLinkRow> {
	const existing = await getPublicLink(db, tripId);
	if (existing) return existing;
	const token = generateToken();
	const createdAt = Date.now();
	await db
		.prepare(
			`INSERT INTO trip_public_links (trip_id, token, created_at, revoked_at) VALUES (?, ?, ?, NULL)
			 ON CONFLICT (trip_id) DO UPDATE SET token = excluded.token, created_at = excluded.created_at, revoked_at = NULL`
		)
		.bind(tripId, token, createdAt)
		.run();
	return { token, createdAt };
}

/** Revoke (soft-delete) the trip's public link, if any. Idempotent. Takes
 *  effect immediately for every future request — the token→trip lookup below
 *  filters on revoked_at, with no cache layer that could outlive this. */
export async function revokePublicLink(db: D1Database, tripId: string): Promise<void> {
	await db.prepare('UPDATE trip_public_links SET revoked_at = ? WHERE trip_id = ?').bind(Date.now(), tripId).run();
}

/** token → trip_id for the public route (and the public-token photo grant).
 *  Null for unknown OR revoked — the two are indistinguishable to a visitor,
 *  same as an unknown share-link token. */
export async function getTripIdForPublicToken(db: D1Database, token: string): Promise<string | null> {
	const row = await db
		.prepare('SELECT trip_id AS tripId FROM trip_public_links WHERE token = ? AND revoked_at IS NULL')
		.bind(token)
		.first<{ tripId: string }>();
	return row?.tripId ?? null;
}
