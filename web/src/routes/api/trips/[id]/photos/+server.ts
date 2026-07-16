import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { getDb } from '$lib/server/db';
import { getTripForUser, roleFor } from '$lib/server/trips';
import {
	getPhotosToken,
	clearPhotosTokenCookie,
	listPickedMediaItems,
	deletePickerSession,
	fetchPhotoBytes,
	type PickedMediaItem
} from '$lib/server/googlephotos';
import {
	getPhotosBucket,
	listTripPhotos,
	photoExists,
	insertTripPhoto,
	photoR2Key,
	PHOTO_SIZES
} from '$lib/server/photos';
import { mapPhotoToTrip } from '$lib/photo-mapping';
import type { Trip } from '$lib/trip-engine';
import { limit, userKey } from '$lib/server/ratelimit';

/** All photos linked to the trip (any role that can see the trip). */
export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const role = await roleFor(db, user.id, params.id);
	if (!role) return json({ error: 'not_found' }, { status: 404 });
	return json({ photos: await listTripPhotos(db, params.id) });
};

// Photos ingested per request. Each costs up to 4 subrequests (2 downloads +
// 2 R2 puts) beyond the page list and D1 writes, and the whole batch must fit
// the Workers subrequest budget — the client loops with `nextPageToken` until
// `done`, so small pages just mean a few more round-trips.
const PAGE_SIZE = 5;

interface ImportBody {
	sessionId?: string;
	pageToken?: string;
}

/** Ingest one page of a completed picking session into this trip:
 *  map by capture time, cache thumb+display bytes in R2, insert rows. */
export const POST: RequestHandler = async ({ locals, platform, params, cookies, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const bucket = getPhotosBucket(platform);

	// Fail fast, before the trip/token lookups: 30/min-per-user budget shared
	// with picker-session creation (surface 'photo-picker').
	const rl = await limit(db, userKey(user.id, 'photo-picker'), { max: 30, windowSeconds: 60 });
	if (!rl.allowed) {
		return json({ reason: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } });
	}

	const trip = await getTripForUser(db, user.id, params.id);
	if (!trip) return json({ error: 'not_found' }, { status: 404 });
	if (trip.role === 'viewer') return json({ error: 'forbidden' }, { status: 403 });

	const token = getPhotosToken(cookies, user.id);
	if (!token) return json({ reason: 'reconnect' }, { status: 401 });

	let body: ImportBody;
	try {
		body = (await request.json()) as ImportBody;
	} catch {
		return json({ error: 'bad_request' }, { status: 400 });
	}
	if (!body.sessionId || typeof body.sessionId !== 'string') {
		return json({ error: 'bad_request' }, { status: 400 });
	}

	const page = await listPickedMediaItems(token, body.sessionId, PAGE_SIZE, body.pageToken);
	if (!page.ok) {
		if (page.reason === 'unauthorized') {
			clearPhotosTokenCookie(cookies);
			return json({ reason: 'reconnect' }, { status: 401 });
		}
		return json({ reason: 'session_gone' }, { status: 410 });
	}

	// Daily R2-storage cap, separate from the per-minute budget above: 200
	// imports/day/user. The exact number of R2 writes this call will cause isn't
	// known until the page resolves (some items turn out 'existing'/'skipped'
	// and never write to R2), so we use the page's item count as a conservative
	// upper-bound cost estimate — a generous safety net, not precise billing.
	const DAILY_MAX = 200;
	const pageItemCount = (page.value.mediaItems ?? []).length;

	// A single batch bigger than the whole daily budget can never fit, no
	// matter what's already been charged today. Reject it up front WITHOUT
	// touching the counter — the client should split the selection into
	// smaller pages and retry. (If this charged the counter like a normal
	// denial does, it would poison the day's budget: a lone 250-photo
	// selection would set count to 250 > 200, and every later import that
	// day — including a retry of a properly-sized batch — would be denied
	// too.)
	if (pageItemCount > DAILY_MAX) {
		return json({ reason: 'selection_too_large', max: DAILY_MAX }, { status: 413 });
	}

	// For a batch that fits within DAILY_MAX on its own, the charge must still
	// be conditional on the *remaining* budget for the day: chargeOnDeny:false
	// makes the increment atomic-and-guarded in the same UPSERT (see
	// ratelimit.ts) — a batch that would push today's count over DAILY_MAX is
	// denied without recording its cost, so a same-day retry of a smaller
	// selection (or of this same batch, once other imports free up under the
	// cap in a later window) can still succeed.
	const dailyRl = await limit(db, userKey(user.id, 'photo-import:day'), {
		max: DAILY_MAX,
		windowSeconds: 86400,
		cost: pageItemCount,
		chargeOnDeny: false
	});
	if (!dailyRl.allowed) {
		return json(
			{ reason: 'daily_cap_exceeded' },
			{ status: 429, headers: { 'Retry-After': String(dailyRl.retryAfterSeconds) } }
		);
	}

	const tripDoc = trip.doc as unknown as Trip;
	let imported = 0;
	let unmatched = 0;
	let skippedExisting = 0;
	let skippedOther = 0; // videos, and items whose bytes couldn't be fetched

	for (const item of page.value.mediaItems ?? []) {
		const outcome = await importOne(db, bucket, token, params.id, user.id, tripDoc, item);
		if (outcome === 'imported') imported++;
		else if (outcome === 'unmatched') unmatched++;
		else if (outcome === 'existing') skippedExisting++;
		else skippedOther++;
	}

	const nextPageToken = page.value.nextPageToken ?? null;
	if (!nextPageToken) {
		// Best-effort cleanup; sessions expire on their own if this fails.
		await deletePickerSession(token, body.sessionId).catch(() => {});
	}
	return json({ imported, unmatched, skippedExisting, skippedOther, nextPageToken, done: !nextPageToken });
};

async function importOne(
	db: D1Database,
	bucket: R2Bucket,
	token: string,
	tripId: string,
	userId: string,
	tripDoc: Trip,
	item: PickedMediaItem
): Promise<'imported' | 'unmatched' | 'existing' | 'skipped'> {
	// v1 is photos-only: a video's poster frame in a strip reads as a broken
	// photo, and its bytes need a different (much larger) download path.
	if (item.type !== 'PHOTO' || !item.mediaFile?.baseUrl || !item.createTime) return 'skipped';
	if (await photoExists(db, tripId, item.id)) return 'existing';

	const [thumb, disp] = await Promise.all([
		fetchPhotoBytes(token, item.mediaFile.baseUrl, PHOTO_SIZES.thumb),
		fetchPhotoBytes(token, item.mediaFile.baseUrl, PHOTO_SIZES.disp)
	]);
	if (!thumb || !disp) return 'skipped';

	const id = crypto.randomUUID();
	await Promise.all([
		bucket.put(photoR2Key(tripId, id, 'thumb'), thumb.bytes, {
			httpMetadata: { contentType: thumb.contentType }
		}),
		bucket.put(photoR2Key(tripId, id, 'disp'), disp.bytes, {
			httpMetadata: { contentType: disp.contentType }
		})
	]);

	const placement = mapPhotoToTrip(tripDoc, item.createTime);
	const meta = item.mediaFile.mediaFileMetadata;
	await insertTripPhoto(db, {
		id,
		tripId,
		mediaItemId: item.id,
		creationTime: item.createTime,
		width: meta?.width ?? null,
		height: meta?.height ?? null,
		contentType: disp.contentType,
		placement,
		addedBy: userId
	});
	return placement ? 'imported' : 'unmatched';
}
