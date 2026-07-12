import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { getDb } from '$lib/server/db';
import { getTripForUser } from '$lib/server/trips';
import { getPhotosBucket, reassignTripPhoto, deleteTripPhoto } from '$lib/server/photos';
import type { PhotoPlacement } from '$lib/photo-mapping';
import type { Trip } from '$lib/trip-engine';

interface ReassignBody {
	/** Target itinerary day, or null to unassign the photo entirely. */
	dayDate?: string | null;
	/** Optional block within that day; omitted/null = day-level strip. */
	blockIndex?: number | null;
}

/** Manually move a photo to another day/block (or unassign it). Records the
 *  placement as a manual override so auto-mapping never undoes it. */
export const PATCH: RequestHandler = async ({ locals, platform, params, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const trip = await getTripForUser(db, user.id, params.id);
	if (!trip) return json({ error: 'not_found' }, { status: 404 });
	if (trip.role === 'viewer') return json({ error: 'forbidden' }, { status: 403 });

	let body: ReassignBody;
	try {
		body = (await request.json()) as ReassignBody;
	} catch {
		return json({ error: 'bad_request' }, { status: 400 });
	}

	let placement: PhotoPlacement | null = null;
	if (body.dayDate != null) {
		if (typeof body.dayDate !== 'string') return json({ error: 'bad_request' }, { status: 400 });
		placement = placementForDay(trip.doc as unknown as Trip, body.dayDate, body.blockIndex ?? null);
		if (!placement) return json({ error: 'unknown_day' }, { status: 400 });
	}

	const ok = await reassignTripPhoto(db, params.id, params.photoId, placement);
	if (!ok) return json({ error: 'not_found' }, { status: 404 });
	return json({ ok: true, placement });
};

export const DELETE: RequestHandler = async ({ locals, platform, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const trip = await getTripForUser(db, user.id, params.id);
	if (!trip) return json({ error: 'not_found' }, { status: 404 });
	if (trip.role === 'viewer') return json({ error: 'forbidden' }, { status: 403 });

	const ok = await deleteTripPhoto(db, getPhotosBucket(platform), params.id, params.photoId);
	if (!ok) return json({ error: 'not_found' }, { status: 404 });
	return json({ ok: true });
};

/** Resolve a user-chosen day date to a full placement, validating that the
 *  day exists (in some segment's default plan) and clamping the block index
 *  to that day. */
function placementForDay(trip: Trip, dayDate: string, blockIndex: number | null): PhotoPlacement | null {
	for (const seg of trip.segments ?? []) {
		const plan = seg.plans.find((p) => p.id === seg.defaultPlan) ?? seg.plans[0];
		if (!plan) continue;
		for (const day of plan.days ?? []) {
			if (day.date !== dayDate) continue;
			const validBlock =
				blockIndex != null && Number.isInteger(blockIndex) && blockIndex >= 0 && blockIndex < (day.blocks?.length ?? 0)
					? blockIndex
					: null;
			return { segmentId: seg.id, planId: plan.id, dayDate, blockIndex: validBlock };
		}
	}
	return null;
}
