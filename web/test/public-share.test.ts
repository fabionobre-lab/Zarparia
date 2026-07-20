// Public share route (docs/public-share-route-spec.md) — the trip_public_links
// table, its owner-facing API, the anonymous /s/[token] load, and the
// public-token grant threaded into the photo endpoints. Real D1 + R2
// (Miniflare), same discipline as the rest of test/.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
	getPublicLink,
	enablePublicLink,
	revokePublicLink,
	getTripIdForPublicToken
} from '../src/lib/server/public-links';
import { createTrip } from '../src/lib/server/trips';
import { shareWithEmail } from '../src/lib/server/shares';
import { insertTripPhoto, getPhotosBucket } from '../src/lib/server/photos';
import { upsertGoogleUser, setUserStatus } from '../src/lib/server/users';
import { GET as linkGET, PUT as linkPUT, DELETE as linkDELETE } from '../src/routes/api/trips/[id]/public-link/+server';
import { GET as photosGET } from '../src/routes/api/trips/[id]/photos/+server';
import { GET as photoByteGET } from '../src/routes/api/trips/[id]/photos/[photoId]/[size]/+server';
import { load } from '../src/routes/s/[token]/+page.server';
import type { TripDoc } from '$lib/validateTrip';

/** Smallest doc that satisfies trip.schema.json. */
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

describe('public-links.ts', () => {
	it('getPublicLink is null until enabled, then returns the minted token', async () => {
		const owner = await approvedUser('pl-basic@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Basic Trip'), 'pl-basic-trip');
		if (!created.ok) throw new Error('setup failed');

		expect(await getPublicLink(env.DB, created.id)).toBeNull();

		const link = await enablePublicLink(env.DB, created.id);
		expect(link.token.length).toBeGreaterThan(20);
		expect(await getPublicLink(env.DB, created.id)).toEqual(link);
	});

	it('enablePublicLink is idempotent while active — same token, URL keeps working', async () => {
		const owner = await approvedUser('pl-idempotent@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Idempotent Trip'), 'pl-idempotent-trip');
		if (!created.ok) throw new Error('setup failed');

		const first = await enablePublicLink(env.DB, created.id);
		const second = await enablePublicLink(env.DB, created.id);
		expect(second.token).toBe(first.token);
	});

	it('revoke takes effect immediately: the token no longer resolves, and re-enabling mints a DIFFERENT token', async () => {
		const owner = await approvedUser('pl-rotate@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Rotate Trip'), 'pl-rotate-trip');
		if (!created.ok) throw new Error('setup failed');

		const first = await enablePublicLink(env.DB, created.id);
		expect(await getTripIdForPublicToken(env.DB, first.token)).toBe(created.id);

		await revokePublicLink(env.DB, created.id);
		expect(await getTripIdForPublicToken(env.DB, first.token)).toBeNull();
		expect(await getPublicLink(env.DB, created.id)).toBeNull();

		// A revoked (potentially leaked) token must never come back to life —
		// re-enabling mints a fresh one, not the old value.
		const second = await enablePublicLink(env.DB, created.id);
		expect(second.token).not.toBe(first.token);
		expect(await getTripIdForPublicToken(env.DB, second.token)).toBe(created.id);
	});

	it('revoke is a no-op (not an error) when there is no active link', async () => {
		const owner = await approvedUser('pl-revoke-noop@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('No Link Trip'), 'pl-revoke-noop-trip');
		if (!created.ok) throw new Error('setup failed');
		await expect(revokePublicLink(env.DB, created.id)).resolves.toBeUndefined();
	});

	it('getTripIdForPublicToken is null for a token that never existed', async () => {
		expect(await getTripIdForPublicToken(env.DB, 'no-such-token')).toBeNull();
	});
});

describe('/api/trips/[id]/public-link — owner-only create/copy/revoke', () => {
	it('GET/PUT/DELETE are all 403 for a non-owner (editor via a collaborator share)', async () => {
		const owner = await approvedUser('api-owner@example.com');
		const editor = await approvedUser('api-editor@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Owner Trip'), 'api-owner-trip');
		if (!created.ok) throw new Error('setup failed');
		await shareWithEmail(env.DB, owner.id, created.id, editor.email, 'editor');

		const platform = platformWith(env.DB);
		const url = new URL(`https://example.com/api/trips/${created.id}/public-link`);

		const getRes = await linkGET({ platform, locals: { user: editor }, params: { id: created.id }, url } as never);
		expect(getRes.status).toBe(403);
		const putRes = await linkPUT({ platform, locals: { user: editor }, params: { id: created.id }, url } as never);
		expect(putRes.status).toBe(403);
		const delRes = await linkDELETE({
			platform,
			locals: { user: editor },
			params: { id: created.id }
		} as never);
		expect(delRes.status).toBe(403);

		// Untouched by the rejected attempts.
		expect(await getPublicLink(env.DB, created.id)).toBeNull();
	});

	it('owner: GET starts null, PUT creates (idempotent on retry), GET reflects it, DELETE revokes, GET goes back to null', async () => {
		const owner = await approvedUser('api-owner-flow@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Flow Trip'), 'api-owner-flow-trip');
		if (!created.ok) throw new Error('setup failed');

		const platform = platformWith(env.DB);
		const url = new URL(`https://example.com/api/trips/${created.id}/public-link`);
		const event = { platform, locals: { user: owner }, params: { id: created.id }, url };

		const initial = await linkGET(event as never);
		expect((await initial.json()) as { link: unknown }).toEqual({ link: null });

		const putRes = await linkPUT(event as never);
		expect(putRes.status).toBe(200);
		const putBody = (await putRes.json()) as { link: { url: string } };
		expect(putBody.link.url).toMatch(new RegExp(`^https://example\\.com/s/[\\w-]+$`));

		// Idempotent retry: same URL back.
		const putAgain = await linkPUT(event as never);
		const putAgainBody = (await putAgain.json()) as { link: { url: string } };
		expect(putAgainBody.link.url).toBe(putBody.link.url);

		const afterCreate = await linkGET(event as never);
		expect((await afterCreate.json()) as { link: { url: string } }).toEqual(putBody);

		const delRes = await linkDELETE(event as never);
		expect(delRes.status).toBe(204);

		const afterRevoke = await linkGET(event as never);
		expect((await afterRevoke.json()) as { link: unknown }).toEqual({ link: null });
	});

	it('401 signed out on every verb (requireUser)', async () => {
		const platform = platformWith(env.DB);
		const url = new URL('https://example.com/api/trips/some-trip/public-link');
		await expect(
			linkGET({ platform, locals: { user: null }, params: { id: 'some-trip' }, url } as never)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			linkPUT({ platform, locals: { user: null }, params: { id: 'some-trip' }, url } as never)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			linkDELETE({ platform, locals: { user: null }, params: { id: 'some-trip' } } as never)
		).rejects.toMatchObject({ status: 401 });
	});
});

describe('/s/[token] load — public, anonymous, read-only', () => {
	it('valid token: returns the trip doc, role viewer, the token, and per-trip OG', async () => {
		const owner = await approvedUser('route-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Route Trip'), 'route-trip');
		if (!created.ok) throw new Error('setup failed');
		const link = await enablePublicLink(env.DB, created.id);

		const platform = platformWith(env.DB);
		const url = new URL(`https://example.com/s/${link.token}`);
		const result = await load({ params: { token: link.token }, platform, url } as never);

		expect(result.role).toBe('viewer');
		expect(result.token).toBe(link.token);
		expect((result.trip as TripDoc).id).toBe(created.id);
		expect(result.og).toEqual({
			title: 'Route Trip — Zarparia',
			description: 'A shared travel itinerary on Zarparia.',
			url: `https://example.com/s/${link.token}`
		});
	});

	it('strips the owner home (postcode/coords) from the public payload', async () => {
		const owner = await approvedUser('route-home@example.com');
		const doc = {
			...minimalTripDoc('Home Trip'),
			home: { name: 'Home', postcode: 'SW1A 1AA', lat: 51.5, lon: -0.14 }
		};
		const created = await createTrip(env.DB, owner.id, doc, 'route-home-trip');
		if (!created.ok) throw new Error('setup failed');
		const link = await enablePublicLink(env.DB, created.id);

		const platform = platformWith(env.DB);
		const url = new URL(`https://example.com/s/${link.token}`);
		const result = await load({ params: { token: link.token }, platform, url } as never);
		expect('home' in (result.trip as Record<string, unknown>)).toBe(false);
	});

	it('revoked token: 404, not a redirect', async () => {
		const owner = await approvedUser('route-revoked@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Revoked Trip'), 'route-revoked-trip');
		if (!created.ok) throw new Error('setup failed');
		const link = await enablePublicLink(env.DB, created.id);
		await revokePublicLink(env.DB, created.id);

		const platform = platformWith(env.DB);
		const url = new URL(`https://example.com/s/${link.token}`);
		await expect(load({ params: { token: link.token }, platform, url } as never)).rejects.toMatchObject({
			status: 404
		});
	});

	it('unknown token: 404', async () => {
		const platform = platformWith(env.DB);
		const url = new URL('https://example.com/s/does-not-exist');
		await expect(
			load({ params: { token: 'does-not-exist' }, platform, url } as never)
		).rejects.toMatchObject({ status: 404 });
	});
});

describe('public-token grant on the photo endpoints — /s/[token] must not silently 401 on photos', () => {
	it('GET .../photos: an active public token for the trip returns its photos with no session', async () => {
		const owner = await approvedUser('photos-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Photo Trip'), 'photo-trip');
		if (!created.ok) throw new Error('setup failed');
		const link = await enablePublicLink(env.DB, created.id);
		await insertTripPhoto(env.DB, {
			id: 'pub-photo-1',
			tripId: created.id,
			mediaItemId: 'media-1',
			creationTime: '2026-06-01T00:00:00Z',
			width: 100,
			height: 100,
			contentType: 'image/jpeg',
			placement: null,
			addedBy: owner.id
		});

		const platform = platformWith(env.DB);
		const url = new URL(`https://example.com/api/trips/${created.id}/photos?token=${link.token}`);
		const res = await photosGET({ locals: { user: null }, platform, params: { id: created.id }, url } as never);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { photos: { id: string }[] };
		expect(body.photos.some((p) => p.id === 'pub-photo-1')).toBe(true);
	});

	it('GET .../photos: a token that belongs to a DIFFERENT trip is rejected (404), not honoured', async () => {
		const owner = await approvedUser('photos-cross@example.com');
		const tripA = await createTrip(env.DB, owner.id, minimalTripDoc('Trip A'), 'photo-trip-a');
		const tripB = await createTrip(env.DB, owner.id, minimalTripDoc('Trip B'), 'photo-trip-b');
		if (!tripA.ok || !tripB.ok) throw new Error('setup failed');
		const linkA = await enablePublicLink(env.DB, tripA.id);

		const platform = platformWith(env.DB);
		// linkA's token, but requesting tripB's photos.
		const url = new URL(`https://example.com/api/trips/${tripB.id}/photos?token=${linkA.token}`);
		const res = await photosGET({ locals: { user: null }, platform, params: { id: tripB.id }, url } as never);
		expect(res.status).toBe(404);
	});

	it('GET .../photos: no token and no session falls through to requireUser (401)', async () => {
		const platform = platformWith(env.DB);
		const url = new URL('https://example.com/api/trips/some-trip/photos');
		await expect(
			photosGET({ locals: { user: null }, platform, params: { id: 'some-trip' }, url } as never)
		).rejects.toMatchObject({ status: 401 });
	});

	it('GET .../photos/[photoId]/[size]: an active public token serves the cached R2 bytes', async () => {
		const owner = await approvedUser('photo-bytes-owner@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Photo Bytes Trip'), 'photo-bytes-trip');
		if (!created.ok) throw new Error('setup failed');
		const link = await enablePublicLink(env.DB, created.id);
		await insertTripPhoto(env.DB, {
			id: 'pub-photo-bytes-1',
			tripId: created.id,
			mediaItemId: 'media-bytes-1',
			creationTime: '2026-06-01T00:00:00Z',
			width: 100,
			height: 100,
			contentType: 'image/jpeg',
			placement: null,
			addedBy: owner.id
		});
		const bucket = getPhotosBucket(platformWith(env.DB));
		await bucket.put('photos/photo-bytes-trip/pub-photo-bytes-1/thumb', 'thumb-bytes', {
			httpMetadata: { contentType: 'image/jpeg' }
		});

		const platform = platformWith(env.DB, bucket);
		const url = new URL(
			`https://example.com/api/trips/${created.id}/photos/pub-photo-bytes-1/thumb?token=${link.token}`
		);
		const request = new Request(url);
		const res = await photoByteGET({
			locals: { user: null },
			platform,
			params: { id: created.id, photoId: 'pub-photo-bytes-1', size: 'thumb' },
			request,
			url,
			setHeaders: () => {}
		} as never);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe('thumb-bytes');
	});

	it('GET .../photos/[photoId]/[size]: a revoked token is rejected (404)', async () => {
		const owner = await approvedUser('photo-bytes-revoked@example.com');
		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Photo Bytes Revoked'), 'photo-bytes-revoked');
		if (!created.ok) throw new Error('setup failed');
		const link = await enablePublicLink(env.DB, created.id);
		await revokePublicLink(env.DB, created.id);

		const platform = platformWith(env.DB);
		const url = new URL(
			`https://example.com/api/trips/${created.id}/photos/whatever/thumb?token=${link.token}`
		);
		const request = new Request(url);
		await expect(
			photoByteGET({
				locals: { user: null },
				platform,
				params: { id: created.id, photoId: 'whatever', size: 'thumb' },
				request,
				url,
				setHeaders: () => {}
			} as never)
		).rejects.toMatchObject({ status: 404 });
	});
});
