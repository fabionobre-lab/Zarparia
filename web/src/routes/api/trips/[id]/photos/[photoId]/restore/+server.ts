import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { getDb } from '$lib/server/db';
import { getTripForUser } from '$lib/server/trips';
import { restoreTripPhoto } from '$lib/server/photos';

/** Undo a photo delete: clear deleted_at so the photo is visible/servable
 *  again (as long as the 7-day lazy purge hasn't already reaped it — see
 *  photos.ts's purgeExpiredPhotos). A dedicated sub-route rather than a PATCH
 *  discriminator: PATCH on this resource already has one job (placement
 *  reassignment via {dayDate, blockIndex}), and DELETE already owns removal;
 *  "undo the removal" reads more clearly as its own action route than as a
 *  third body shape bolted onto PATCH. Same authz as DELETE — owner/editor,
 *  not viewer — since this reverses a DELETE and must be gated the same way. */
export const POST: RequestHandler = async ({ locals, platform, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const trip = await getTripForUser(db, user.id, params.id);
	if (!trip) return json({ error: 'not_found' }, { status: 404 });
	if (trip.role === 'viewer') return json({ error: 'forbidden' }, { status: 403 });

	const ok = await restoreTripPhoto(db, params.id, params.photoId);
	if (!ok) return json({ error: 'not_found' }, { status: 404 });
	return json({ ok: true });
};
