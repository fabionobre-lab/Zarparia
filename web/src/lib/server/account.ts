// GDPR data export + account deletion (Phase 2 — LAUNCH_PLAN.md).
//
// Export: a single JSON snapshot of everything this app holds that is "about"
// the requesting user — their own records in full, plus only the minimum of
// someone else's data needed to make a share relationship legible (a trip
// title + the other party's display name — never their email unless the
// requesting user is the one who typed it in to grant the share themselves).
//
// Deletion: a manual, explicit cascade. Several tables already carry
// ON DELETE CASCADE, but R2 photo bytes are unreachable by any FK, so the
// cascade is driven by hand here to keep D1 rows and R2 objects in lockstep.
// Every step is idempotent — each DELETE is a no-op on rows already gone, and
// R2 delete on a missing key is a no-op too — so a retry after a partial
// failure (a request that died mid-cascade) is always safe.
import type { UserStatus } from '$lib/types';
import { listFeedbackForUser, type FeedbackRow } from './feedback';
import { photoR2Key } from './photos';

export interface AccountExportProfile {
	id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
	createdAt: string;
	status: UserStatus;
}

export interface AccountExportTrip {
	id: string;
	title: string | null;
	status: string;
	startDate: string | null;
	endDate: string | null;
	createdAt: string;
	updatedAt: string;
	/** Full trip JSON document (GDPR Art. 20 — the actual portable content). */
	doc: unknown;
}

/** A share this user (as trip owner) GRANTED to someone else. The grantee's
 *  email is included because the owner chose and typed it in themselves. */
export interface AccountExportShareGranted {
	tripId: string;
	tripTitle: string | null;
	granteeEmail: string;
	granteeName: string | null;
	permission: string;
}

/** A share this user RECEIVED on someone else's trip. Proportionate to what
 *  the recipient already knows: the trip title and the owner's display name —
 *  never the owner's email. */
export interface AccountExportShareReceived {
	tripId: string;
	tripTitle: string | null;
	ownerName: string | null;
	permission: string;
}

/** A share-by-link on one of this user's owned trips. The token is a bearer
 *  capability — exporting it in full would let the export file itself grant
 *  access, so only the last 4 characters are included (enough to recognise
 *  which link this is, useless to redeem). */
export interface AccountExportShareLink {
	tripId: string;
	tripTitle: string | null;
	tokenLast4: string;
	role: string;
	createdAt: number;
}

/** Manifest row for a cached photo on an owned trip — metadata + the R2 key
 *  layout, never the image bytes themselves. */
export interface AccountExportPhoto {
	id: string;
	tripId: string;
	creationTime: string;
	contentType: string | null;
	width: number | null;
	height: number | null;
	r2Keys: { thumb: string; disp: string };
}

/** One row per (MCP client, scope) this user has ever granted — never the
 *  token hashes themselves (those aren't "data about the user" in the
 *  portability sense, and exposing them would be a bearer-credential leak). */
export interface AccountExportMcpGrant {
	clientId: string;
	clientName: string | null;
	scope: string;
	issuedAt: string;
}

export interface AccountExport {
	exportedAt: string;
	profile: AccountExportProfile;
	ownedTrips: AccountExportTrip[];
	sharesGranted: AccountExportShareGranted[];
	sharesReceived: AccountExportShareReceived[];
	shareLinks: AccountExportShareLink[];
	feedback: FeedbackRow[];
	photos: AccountExportPhoto[];
	mcpGrants: AccountExportMcpGrant[];
}

/** Build the full export for one user, or null if the account no longer
 *  exists (defensive — callers resolve `userId` from a live session, so this
 *  should not happen in practice). */
export async function buildAccountExport(db: D1Database, userId: string): Promise<AccountExport | null> {
	const profile = await db
		.prepare(
			'SELECT id, email, name, avatar_url AS avatarUrl, created_at AS createdAt, status FROM users WHERE id = ?'
		)
		.bind(userId)
		.first<AccountExportProfile>();
	if (!profile) return null;

	const tripsRes = await db
		.prepare(
			`SELECT id, title, status, start_date AS startDate, end_date AS endDate,
			        created_at AS createdAt, updated_at AS updatedAt, doc
			 FROM trips WHERE owner_id = ? ORDER BY created_at`
		)
		.bind(userId)
		.all<{
			id: string;
			title: string | null;
			status: string;
			startDate: string | null;
			endDate: string | null;
			createdAt: string;
			updatedAt: string;
			doc: string;
		}>();
	const ownedTrips: AccountExportTrip[] = tripsRes.results.map(({ doc, ...r }) => {
		let parsed: unknown = null;
		try {
			parsed = JSON.parse(doc);
		} catch {
			parsed = null;
		}
		return { ...r, doc: parsed };
	});

	const sharesGranted = await db
		.prepare(
			`SELECT ts.trip_id AS tripId, t.title AS tripTitle, u.email AS granteeEmail,
			        u.name AS granteeName, ts.permission AS permission
			 FROM trip_shares ts
			 JOIN trips t ON t.id = ts.trip_id
			 JOIN users u ON u.id = ts.user_id
			 WHERE t.owner_id = ?
			 ORDER BY ts.trip_id, u.email`
		)
		.bind(userId)
		.all<AccountExportShareGranted>();

	const sharesReceived = await db
		.prepare(
			`SELECT ts.trip_id AS tripId, t.title AS tripTitle, owner.name AS ownerName,
			        ts.permission AS permission
			 FROM trip_shares ts
			 JOIN trips t ON t.id = ts.trip_id
			 JOIN users owner ON owner.id = t.owner_id
			 WHERE ts.user_id = ?
			 ORDER BY ts.trip_id`
		)
		.bind(userId)
		.all<AccountExportShareReceived>();

	const linksRes = await db
		.prepare(
			`SELECT tsl.trip_id AS tripId, t.title AS tripTitle, tsl.token AS token,
			        tsl.role AS role, tsl.created_at AS createdAt
			 FROM trip_share_links tsl
			 JOIN trips t ON t.id = tsl.trip_id
			 WHERE t.owner_id = ?
			 ORDER BY tsl.trip_id`
		)
		.bind(userId)
		.all<{ tripId: string; tripTitle: string | null; token: string; role: string; createdAt: number }>();
	const shareLinks: AccountExportShareLink[] = linksRes.results.map(({ token, ...r }) => ({
		...r,
		tokenLast4: token.slice(-4)
	}));

	const feedback = await listFeedbackForUser(db, userId);

	const photosRes = await db
		.prepare(
			`SELECT tp.id AS id, tp.trip_id AS tripId, tp.creation_time AS creationTime,
			        tp.content_type AS contentType, tp.width AS width, tp.height AS height
			 FROM trip_photos tp
			 JOIN trips t ON t.id = tp.trip_id
			 WHERE t.owner_id = ?
			 ORDER BY tp.trip_id, tp.creation_time`
		)
		.bind(userId)
		.all<{
			id: string;
			tripId: string;
			creationTime: string;
			contentType: string | null;
			width: number | null;
			height: number | null;
		}>();
	const photos: AccountExportPhoto[] = photosRes.results.map((p) => ({
		...p,
		r2Keys: { thumb: photoR2Key(p.tripId, p.id, 'thumb'), disp: photoR2Key(p.tripId, p.id, 'disp') }
	}));

	const mcpGrants = await db
		.prepare(
			`SELECT ot.client_id AS clientId, oc.client_name AS clientName, ot.scope AS scope,
			        MIN(ot.created_at) AS issuedAt
			 FROM oauth_tokens ot
			 JOIN oauth_clients oc ON oc.client_id = ot.client_id
			 WHERE ot.user_id = ? AND ot.kind = 'access'
			 GROUP BY ot.client_id, ot.scope
			 ORDER BY issuedAt`
		)
		.bind(userId)
		.all<AccountExportMcpGrant>();

	return {
		exportedAt: new Date().toISOString(),
		profile,
		ownedTrips,
		sharesGranted: sharesGranted.results,
		sharesReceived: sharesReceived.results,
		shareLinks,
		feedback,
		photos,
		mcpGrants: mcpGrants.results
	};
}

// ── Deletion ────────────────────────────────────────────────────────────

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

/** Remove one owned trip entirely: cached R2 photo bytes, then every D1 row
 *  that references it, then the trip row itself. Safe to re-run. */
async function purgeTrip(db: D1Database, bucket: R2Bucket, tripId: string): Promise<void> {
	const photos = await db
		.prepare('SELECT id FROM trip_photos WHERE trip_id = ?')
		.bind(tripId)
		.all<{ id: string }>();
	const keys = photos.results.flatMap((p) => [
		photoR2Key(tripId, p.id, 'thumb'),
		photoR2Key(tripId, p.id, 'disp')
	]);
	// R2 batch delete caps out well above what any single trip will ever hold,
	// but chunk anyway so a very-photo-heavy trip can't blow a request limit.
	for (const batch of chunk(keys, 500)) {
		if (batch.length) await bucket.delete(batch);
	}
	await db.prepare('DELETE FROM trip_photos WHERE trip_id = ?').bind(tripId).run();
	await db.prepare('DELETE FROM trip_shares WHERE trip_id = ?').bind(tripId).run();
	await db.prepare('DELETE FROM trip_share_links WHERE trip_id = ?').bind(tripId).run();
	await db.prepare('DELETE FROM trips WHERE id = ?').bind(tripId).run();
}

/**
 * Full GDPR erasure cascade for one account (LAUNCH_PLAN Phase 2.3). Order
 * matters: auth material first (a half-deleted account must never still
 * authenticate), then every owned trip (R2 + its D1 rows — owned trips are
 * deleted WITH the account, including for people they're shared with), then
 * shares this user received elsewhere, then feedback, then the user row last.
 *
 * Feedback rows are DELETED rather than anonymized: `feedback.user_id` is a
 * NOT NULL FK with no ON DELETE SET NULL, and the admin triage view
 * inner-joins on it for the submitter's name/email — anonymizing losslessly
 * would need a migration (nullable column + join change) that's out of scope
 * here, so deletion is the simpler, fully-GDPR-clean choice for this pass.
 *
 * Every step is idempotent, so calling this again on a partially-deleted
 * account (a prior call that died mid-way) completes cleanly.
 */
export async function deleteAccount(db: D1Database, bucket: R2Bucket, userId: string): Promise<void> {
	// 1. Auth material — revoked/deleted first.
	await db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').bind(userId).run();
	await db.prepare('DELETE FROM oauth_codes WHERE user_id = ?').bind(userId).run();
	await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

	// 2. Owned trips, each fully purged (R2 + dependent rows + the trip itself).
	const owned = await db.prepare('SELECT id FROM trips WHERE owner_id = ?').bind(userId).all<{ id: string }>();
	for (const { id: tripId } of owned.results) {
		await purgeTrip(db, bucket, tripId);
	}

	// 3. Shares this user received on OTHER people's trips (shares on their OWN
	//    owned trips were already purged as part of step 2).
	await db.prepare('DELETE FROM trip_shares WHERE user_id = ?').bind(userId).run();

	// 4. Feedback (see doc comment above for the delete-vs-anonymize call).
	await db.prepare('DELETE FROM feedback WHERE user_id = ?').bind(userId).run();

	// 5. The user row, last.
	await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}
