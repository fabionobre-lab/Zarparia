/**
 * trip_photos persistence + the R2 layout for cached image bytes.
 *
 * Two renditions per photo are cached at import time (picker baseUrls die
 * within the hour, so bytes must be copied to be viewable later):
 *   photos/<tripId>/<photoId>/thumb — ≤360px, for strips and map markers
 *   photos/<tripId>/<photoId>/disp  — ≤1600px, for the lightbox
 */
import { error } from '@sveltejs/kit';
import type { PhotoPlacement } from '$lib/photo-mapping';
import type { TripPhoto } from '$lib/photos';

export type { TripPhoto };
export type PhotoSize = 'thumb' | 'disp';
export const PHOTO_SIZES: Record<PhotoSize, number> = { thumb: 360, disp: 1600 };

export function getPhotosBucket(platform: App.Platform | undefined): R2Bucket {
	const bucket = platform?.env?.PHOTOS;
	if (!bucket) throw error(503, 'Photo storage binding unavailable');
	return bucket;
}

export function photoR2Key(tripId: string, photoId: string, size: PhotoSize): string {
	return `photos/${tripId}/${photoId}/${size}`;
}

interface PhotoRow {
	id: string;
	trip_id: string;
	creation_time: string;
	width: number | null;
	height: number | null;
	content_type: string | null;
	segment_id: string | null;
	plan_id: string | null;
	day_date: string | null;
	block_index: number | null;
	manual_override: number;
}

function toTripPhoto(r: PhotoRow): TripPhoto {
	return {
		id: r.id,
		creationTime: r.creation_time,
		width: r.width,
		height: r.height,
		segmentId: r.segment_id,
		planId: r.plan_id,
		dayDate: r.day_date,
		blockIndex: r.block_index,
		manualOverride: r.manual_override === 1
	};
}

export async function listTripPhotos(db: D1Database, tripId: string): Promise<TripPhoto[]> {
	const rows = await db
		.prepare(
			`SELECT id, trip_id, creation_time, width, height, content_type,
			        segment_id, plan_id, day_date, block_index, manual_override
			 FROM trip_photos WHERE trip_id = ? AND deleted_at IS NULL ORDER BY creation_time, id`
		)
		.bind(tripId)
		.all<PhotoRow>();
	return rows.results.map(toTripPhoto);
}

export async function getTripPhoto(
	db: D1Database,
	tripId: string,
	photoId: string
): Promise<(TripPhoto & { contentType: string | null }) | null> {
	const row = await db
		.prepare(
			`SELECT id, trip_id, creation_time, width, height, content_type,
			        segment_id, plan_id, day_date, block_index, manual_override
			 FROM trip_photos WHERE id = ? AND trip_id = ? AND deleted_at IS NULL`
		)
		.bind(photoId, tripId)
		.first<PhotoRow>();
	return row ? { ...toTripPhoto(row), contentType: row.content_type } : null;
}

/** True when this media item is already linked to the trip (re-picking the
 *  same photo must be a cheap no-op, before any bytes are downloaded).
 *
 *  Deliberately NOT filtered by deleted_at: (trip_id, media_item_id) is
 *  UNIQUE, so a soft-deleted row for this media item still occupies that
 *  slot until the lazy purge removes it. If this counted only *visible*
 *  rows as "existing", re-picking a photo deleted less than 7 days ago
 *  would re-download its bytes and then fail on that UNIQUE constraint (or,
 *  worse, resurrect it under a fresh id/R2 keys and orphan the original R2
 *  objects, since the purge sweep finds rows by id). Treating any row —
 *  deleted or not — as "existing" keeps re-picking a cheap no-op either way;
 *  once the purge clears the old row (see purgeExpiredPhotos), re-picking
 *  the same photo naturally goes through as a fresh import again. */
export async function photoExists(db: D1Database, tripId: string, mediaItemId: string): Promise<boolean> {
	const row = await db
		.prepare('SELECT 1 FROM trip_photos WHERE trip_id = ? AND media_item_id = ?')
		.bind(tripId, mediaItemId)
		.first();
	return row !== null;
}

export async function insertTripPhoto(
	db: D1Database,
	args: {
		id: string;
		tripId: string;
		mediaItemId: string;
		creationTime: string;
		width: number | null;
		height: number | null;
		contentType: string | null;
		placement: PhotoPlacement | null;
		addedBy: string;
	}
): Promise<void> {
	const p = args.placement;
	await db
		.prepare(
			`INSERT INTO trip_photos
			 (id, trip_id, media_item_id, creation_time, width, height, content_type,
			  segment_id, plan_id, day_date, block_index, manual_override, added_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
		)
		.bind(
			args.id,
			args.tripId,
			args.mediaItemId,
			args.creationTime,
			args.width,
			args.height,
			args.contentType,
			p?.segmentId ?? null,
			p?.planId ?? null,
			p?.dayDate ?? null,
			p?.blockIndex ?? null,
			args.addedBy
		)
		.run();
}

/** Manual placement from the correction UI. Marks the row manual so a future
 *  re-import/re-map never silently undoes the user's choice. */
export async function reassignTripPhoto(
	db: D1Database,
	tripId: string,
	photoId: string,
	placement: PhotoPlacement | null
): Promise<boolean> {
	const res = await db
		.prepare(
			`UPDATE trip_photos
			 SET segment_id = ?, plan_id = ?, day_date = ?, block_index = ?, manual_override = 1
			 WHERE id = ? AND trip_id = ?`
		)
		.bind(
			placement?.segmentId ?? null,
			placement?.planId ?? null,
			placement?.dayDate ?? null,
			placement?.blockIndex ?? null,
			photoId,
			tripId
		)
		.run();
	return res.meta.changes > 0;
}

/** Soft-delete: stamp deleted_at instead of removing the row, and leave the
 *  R2 objects in place. This is what makes Undo possible — the row (and its
 *  cached bytes) still exist for up to 7 days, until purgeExpiredPhotos
 *  reaps it. Guarded by `deleted_at IS NULL` so deleting an already-deleted
 *  photo is a no-op (false), not a clock reset. */
export async function deleteTripPhoto(db: D1Database, tripId: string, photoId: string): Promise<boolean> {
	const res = await db
		.prepare(`UPDATE trip_photos SET deleted_at = datetime('now') WHERE id = ? AND trip_id = ? AND deleted_at IS NULL`)
		.bind(photoId, tripId)
		.run();
	return res.meta.changes > 0;
}

/** Undo a soft delete: clear deleted_at so the photo is visible/servable
 *  again. Idempotent — restoring an already-active photo is a harmless
 *  no-op change, matching this codebase's other soft-delete restores
 *  (e.g. public-links.ts's enable/revoke). Returns false only when no row
 *  matches this id/tripId at all (e.g. it was already purged). */
export async function restoreTripPhoto(db: D1Database, tripId: string, photoId: string): Promise<boolean> {
	const res = await db
		.prepare('UPDATE trip_photos SET deleted_at = NULL WHERE id = ? AND trip_id = ?')
		.bind(photoId, tripId)
		.run();
	return res.meta.changes > 0;
}

/**
 * Lazy/on-mutation purge for soft-deleted photos older than 7 days.
 *
 * There is deliberately no wrangler cron trigger for this: adapter-cloudflare
 * builds this SvelteKit app down to a `_worker.js` that only exports
 * `{ fetch }` — there's no clean `scheduled` event hook to wire a cron
 * handler into without invasive build changes. Instead, this runs as a
 * best-effort sweep on paths that already touch a trip's photos (the photo
 * import POST and the photo DELETE handler): find this trip's photos
 * soft-deleted more than 7 days ago, delete both their R2 renditions, then
 * delete their D1 rows. A trip that never gets touched again after a delete
 * will keep an ephemeral R2/D1 tail past 7 days, but any further activity on
 * it — including the next delete — sweeps it.
 */
export async function purgeExpiredPhotos(db: D1Database, bucket: R2Bucket, tripId: string): Promise<void> {
	const expired = await db
		.prepare(
			`SELECT id FROM trip_photos
			 WHERE trip_id = ? AND deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days')`
		)
		.bind(tripId)
		.all<{ id: string }>();
	if (expired.results.length === 0) return;

	const keys = expired.results.flatMap((p) => [
		photoR2Key(tripId, p.id, 'thumb'),
		photoR2Key(tripId, p.id, 'disp')
	]);
	// R2 delete() caps a single call's key list; this trip's expired batch is
	// small in practice (per-mutation sweep, not a global cron), but chunk
	// defensively the same way account.ts's purgeTrip does.
	for (let i = 0; i < keys.length; i += 1000) {
		await bucket.delete(keys.slice(i, i + 1000));
	}

	const placeholders = expired.results.map(() => '?').join(',');
	await db
		.prepare(`DELETE FROM trip_photos WHERE trip_id = ? AND id IN (${placeholders})`)
		.bind(tripId, ...expired.results.map((p) => p.id))
		.run();
}
