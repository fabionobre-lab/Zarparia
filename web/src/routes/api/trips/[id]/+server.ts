import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { getTripForUser, updateTrip, deleteTrip } from '$lib/server/trips';
import type { TripDoc } from '$lib/server/validateTrip';

export const GET: RequestHandler = async ({ platform, locals, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const trip = await getTripForUser(db, user.id, params.id);
	if (!trip) return json({ error: 'Trip not found.' }, { status: 404 });
	return json(trip);
};

export const PUT: RequestHandler = async ({ platform, locals, params, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const body = (await request.json().catch(() => null)) as TripDoc | null;
	if (!body || typeof body !== 'object') {
		return json({ error: 'Request body must be a trip JSON object.' }, { status: 400 });
	}
	const result = await updateTrip(db, user.id, params.id, body);
	if (result.ok) return json({ id: result.id, doc: result.doc });
	if (result.reason === 'not_found') return json({ error: 'Trip not found.' }, { status: 404 });
	if (result.reason === 'forbidden') return json({ error: 'You cannot edit this trip.' }, { status: 403 });
	return json({ error: 'Trip failed validation.', details: result.errors }, { status: 422 });
	// (result.reason === 'invalid' narrows to include errors here)
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const result = await deleteTrip(db, user.id, params.id);
	if (result.ok) return new Response(null, { status: 204 });
	if (result.reason === 'not_found') return json({ error: 'Trip not found.' }, { status: 404 });
	return json({ error: 'Only the owner can delete this trip.' }, { status: 403 });
};
