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
			 FROM trip_photos WHERE trip_id = ? ORDER BY creation_time, id`
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
			 FROM trip_photos WHERE id = ? AND trip_id = ?`
		)
		.bind(photoId, tripId)
		.first<PhotoRow>();
	return row ? { ...toTripPhoto(row), contentType: row.content_type } : null;
}

/** True when this media item is already linked to the trip (re-picking the
 *  same photo must be a cheap no-op, before any bytes are downloaded). */
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

export async function deleteTripPhoto(
	db: D1Database,
	bucket: R2Bucket,
	tripId: string,
	photoId: string
): Promise<boolean> {
	const res = await db
		.prepare('DELETE FROM trip_photos WHERE id = ? AND trip_id = ?')
		.bind(photoId, tripId)
		.run();
	if (res.meta.changes === 0) return false;
	await bucket.delete([photoR2Key(tripId, photoId, 'thumb'), photoR2Key(tripId, photoId, 'disp')]);
	return true;
}
