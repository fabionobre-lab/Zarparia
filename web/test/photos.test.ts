// Phase 6 item 1b (photo-delete Undo): DELETE soft-deletes trip_photos
// instead of purging immediately, a restore sub-route clears deleted_at, and
// every read path filters deleted_at IS NULL. Real D1 + R2 (Miniflare), same
// discipline as public-share.test.ts.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createTrip } from '../src/lib/server/trips';
import { shareWithEmail } from '../src/lib/server/shares';
import { insertTripPhoto, getPhotosBucket, photoR2Key, purgeExpiredPhotos } from '../src/lib/server/photos';
import { upsertGoogleUser, setUserStatus } from '../src/lib/server/users';
import { GET as photosGET } from '../src/routes/api/trips/[id]/photos/+server';
import { DELETE as photoDELETE } from '../src/routes/api/trips/[id]/photos/[photoId]/+server';
import { POST as photoRESTORE } from '../src/routes/api/trips/[id]/photos/[photoId]/restore/+server';
import type { TripDoc } from '$lib/validateTrip';

function minimalTripDoc(title: string): TripDoc {
	return {
		id: 'placeholder',
		title: { 'en-GB': title },
		languages: ['en-GB'],
		defaultLanguage: 'en-GB',
		segments: [
			{
				id: 'seg1',
				title: { 'en-GB': 'Segment' },
				plans: [
					{
						id: 'plan1',
						days: [
							{
								date: '2026-06-01',
								title: { 'en-GB': 'Day 1' },
								blocks: [{ time: '09:00', title: { 'en-GB': 'Breakfast' } }]
							}
						]
					}
				]
			}
		]
	} as unknown as TripDoc;
}

async function approvedUser(email: string, name = 'Test User') {
	const user = await upsertGoogleUser(env.DB, { sub: 'sub-' + email, email, name }, undefined);
	await setUserStatus(env.DB, user.id, 'approved');
	return { ...user, status: 'approved' as const };
}

function platformWith(db: D1Database, bucket?: R2Bucket) {
	return { env: { DB: db, PHOTOS: bucket ?? env.PHOTOS } } as unknown as App.Platform;
}

async function seedPhoto(tripId: string, photoId: string, ownerId: string, mediaItemId = `media-${photoId}`) {
	await insertTripPhoto(env.DB, {
		id: photoId,
		tripId,
		mediaItemId,
		creationTime: '2026-06-01T00:00:00Z',
		width: 100,
		height: 100,
		contentType: 'image/jpeg',
		placement: null,
		addedBy: ownerId
	});
	const bucket = getPhotosBucket(platformWith(env.DB));
	await bucket.put(photoR2Key(tripId, photoId, 'thumb'), 'thumb-bytes', {
		httpMetadata: { contentType: 'image/jpeg' }
	});
	await bucket.put(photoR2Key(tripId, photoId, 'disp'), 'disp-bytes', {
		httpMetadata: { contentType: 'image/jpeg' }
	});
	return bucket;
}

async function rawDeletedAt(photoId: string): Promise<string | null> {
	const row = await env.DB.prepare('SELECT deleted_at AS deletedAt FROM trip_photos WHERE id = ?')
		.bind(photoId)
		.first<{ deletedAt: string | null }>();
	return row?.deletedAt ?? null;
}

describe('DELETE /api/trips/[id]/photos/[photoId] — soft delete', () => {
	it('marks deleted_at instead of removing the D1 row or the R2 objects', async () => {
		const owner = await approvedUser('sd-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('SD Trip'), 'sd-trip');
		if (!created.ok) throw new Error('setup failed');
		const bucket = await seedPhoto(created.id, 'sd-photo-1', owner.id);

		expect(await rawDeletedAt('sd-photo-1')).toBeNull();

		const platform = platformWith(env.DB, bucket);
		const res = await photoDELETE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'sd-photo-1' }
		} as never);
		expect(res.status).toBe(200);

		// The row still exists — just stamped, not removed.
		expect(await rawDeletedAt('sd-photo-1')).not.toBeNull();

		// R2 objects are untouched at delete time (deferred purge, not
		// immediate) — both renditions must still be fetchable.
		expect(await bucket.get(photoR2Key(created.id, 'sd-photo-1', 'thumb'))).not.toBeNull();
		expect(await bucket.get(photoR2Key(created.id, 'sd-photo-1', 'disp'))).not.toBeNull();
	});

	it('deleting an already-deleted photo is a no-op (404), not a clock reset', async () => {
		const owner = await approvedUser('sd-twice@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('SD Twice Trip'), 'sd-twice-trip');
		if (!created.ok) throw new Error('setup failed');
		await seedPhoto(created.id, 'sd-photo-2', owner.id);

		const platform = platformWith(env.DB);
		const first = await photoDELETE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'sd-photo-2' }
		} as never);
		expect(first.status).toBe(200);

		const second = await photoDELETE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'sd-photo-2' }
		} as never);
		expect(second.status).toBe(404);
	});

	it('a viewer cannot delete (403)', async () => {
		const owner = await approvedUser('sd-viewer-owner@example.com');
		const viewer = await approvedUser('sd-viewer@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('SD Viewer Trip'), 'sd-viewer-trip');
		if (!created.ok) throw new Error('setup failed');
		await shareWithEmail(env.DB, owner.id, created.id, viewer.email, 'viewer');
		await seedPhoto(created.id, 'sd-photo-3', owner.id);

		const platform = platformWith(env.DB);
		const res = await photoDELETE({
			locals: { user: viewer },
			platform,
			params: { id: created.id, photoId: 'sd-photo-3' }
		} as never);
		expect(res.status).toBe(403);
		expect(await rawDeletedAt('sd-photo-3')).toBeNull();
	});
});

describe('POST /api/trips/[id]/photos/[photoId]/restore — undo a delete', () => {
	it('clears deleted_at, and the photo reappears in the listing', async () => {
		const owner = await approvedUser('restore-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Restore Trip'), 'restore-trip');
		if (!created.ok) throw new Error('setup failed');
		await seedPhoto(created.id, 'restore-photo-1', owner.id);

		const platform = platformWith(env.DB);
		const delRes = await photoDELETE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'restore-photo-1' }
		} as never);
		expect(delRes.status).toBe(200);

		const listUrl = new URL(`https://example.com/api/trips/${created.id}/photos`);
		const afterDelete = await photosGET({
			locals: { user: owner },
			platform,
			params: { id: created.id },
			url: listUrl
		} as never);
		const afterDeleteBody = (await afterDelete.json()) as { photos: { id: string }[] };
		expect(afterDeleteBody.photos.some((p) => p.id === 'restore-photo-1')).toBe(false);

		const restoreRes = await photoRESTORE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'restore-photo-1' }
		} as never);
		expect(restoreRes.status).toBe(200);
		expect(await rawDeletedAt('restore-photo-1')).toBeNull();

		const afterRestore = await photosGET({
			locals: { user: owner },
			platform,
			params: { id: created.id },
			url: listUrl
		} as never);
		const afterRestoreBody = (await afterRestore.json()) as { photos: { id: string }[] };
		expect(afterRestoreBody.photos.some((p) => p.id === 'restore-photo-1')).toBe(true);
	});

	it('restoring a photo that was never deleted is a harmless no-op (200)', async () => {
		const owner = await approvedUser('restore-noop-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Restore Noop Trip'), 'restore-noop-trip');
		if (!created.ok) throw new Error('setup failed');
		await seedPhoto(created.id, 'restore-photo-2', owner.id);

		const platform = platformWith(env.DB);
		const res = await photoRESTORE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'restore-photo-2' }
		} as never);
		expect(res.status).toBe(200);
		expect(await rawDeletedAt('restore-photo-2')).toBeNull();
	});

	it('a viewer cannot restore (403)', async () => {
		const owner = await approvedUser('restore-viewer-owner@example.com');
		const viewer = await approvedUser('restore-viewer@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Restore Viewer Trip'), 'restore-viewer-trip');
		if (!created.ok) throw new Error('setup failed');
		await shareWithEmail(env.DB, owner.id, created.id, viewer.email, 'viewer');
		await seedPhoto(created.id, 'restore-photo-3', owner.id);

		const platform = platformWith(env.DB);
		await photoDELETE({ locals: { user: owner }, platform, params: { id: created.id, photoId: 'restore-photo-3' } } as never);

		const res = await photoRESTORE({
			locals: { user: viewer },
			platform,
			params: { id: created.id, photoId: 'restore-photo-3' }
		} as never);
		expect(res.status).toBe(403);
		expect(await rawDeletedAt('restore-photo-3')).not.toBeNull();
	});

	it('404s for a photo id that does not exist at all', async () => {
		const owner = await approvedUser('restore-missing-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Restore Missing Trip'), 'restore-missing-trip');
		if (!created.ok) throw new Error('setup failed');

		const platform = platformWith(env.DB);
		const res = await photoRESTORE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'does-not-exist' }
		} as never);
		expect(res.status).toBe(404);
	});
});

describe('GET /api/trips/[id]/photos — listing excludes soft-deleted photos', () => {
	it('a soft-deleted photo is absent from the list for owner, editor, and the public-token path alike', async () => {
		const owner = await approvedUser('list-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('List Trip'), 'list-trip');
		if (!created.ok) throw new Error('setup failed');
		await seedPhoto(created.id, 'list-photo-active', owner.id, 'media-active');
		await seedPhoto(created.id, 'list-photo-deleted', owner.id, 'media-deleted');

		const platform = platformWith(env.DB);
		const delRes = await photoDELETE({
			locals: { user: owner },
			platform,
			params: { id: created.id, photoId: 'list-photo-deleted' }
		} as never);
		expect(delRes.status).toBe(200);

		const url = new URL(`https://example.com/api/trips/${created.id}/photos`);
		const res = await photosGET({ locals: { user: owner }, platform, params: { id: created.id }, url } as never);
		const body = (await res.json()) as { photos: { id: string }[] };
		expect(body.photos.some((p) => p.id === 'list-photo-active')).toBe(true);
		expect(body.photos.some((p) => p.id === 'list-photo-deleted')).toBe(false);
	});
});

describe('purgeExpiredPhotos — the lazy purge mechanism', () => {
	it('leaves a recently soft-deleted photo alone (D1 row + R2 objects survive)', async () => {
		const owner = await approvedUser('purge-recent-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Purge Recent Trip'), 'purge-recent-trip');
		if (!created.ok) throw new Error('setup failed');
		const bucket = await seedPhoto(created.id, 'purge-photo-recent', owner.id);
		await env.DB.prepare(`UPDATE trip_photos SET deleted_at = datetime('now') WHERE id = ?`)
			.bind('purge-photo-recent')
			.run();

		await purgeExpiredPhotos(env.DB, bucket, created.id);

		expect(await rawDeletedAt('purge-photo-recent')).not.toBeNull();
		expect(await bucket.get(photoR2Key(created.id, 'purge-photo-recent', 'thumb'))).not.toBeNull();
	});

	it('reaps a photo soft-deleted more than 7 days ago: D1 row gone, both R2 renditions gone', async () => {
		const owner = await approvedUser('purge-old-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Purge Old Trip'), 'purge-old-trip');
		if (!created.ok) throw new Error('setup failed');
		const bucket = await seedPhoto(created.id, 'purge-photo-old', owner.id);
		await env.DB.prepare(`UPDATE trip_photos SET deleted_at = datetime('now', '-8 days') WHERE id = ?`)
			.bind('purge-photo-old')
			.run();

		await purgeExpiredPhotos(env.DB, bucket, created.id);

		expect(await rawDeletedAt('purge-photo-old')).toBeNull(); // row itself is gone; raw select returns no row
		const stillThere = await env.DB.prepare('SELECT 1 FROM trip_photos WHERE id = ?').bind('purge-photo-old').first();
		expect(stillThere).toBeNull();
		expect(await bucket.get(photoR2Key(created.id, 'purge-photo-old', 'thumb'))).toBeNull();
		expect(await bucket.get(photoR2Key(created.id, 'purge-photo-old', 'disp'))).toBeNull();
	});
});
