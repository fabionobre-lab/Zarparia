import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { listTripsForUser, createTrip } from '$lib/server/trips';
import type { TripDoc } from '$lib/server/validateTrip';

export const GET: RequestHandler = async ({ platform, locals }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	return json({ trips: await listTripsForUser(db, user.id) });
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const body = (await request.json().catch(() => null)) as TripDoc | null;
	if (!body || typeof body !== 'object') {
		return json({ error: 'Request body must be a trip JSON object.' }, { status: 400 });
	}
	const result = await createTrip(db, user.id, body);
	if (!result.ok) {
		const details = result.reason === 'invalid' ? result.errors : undefined;
		return json({ error: 'Trip failed validation.', details }, { status: 422 });
	}
	return json({ id: result.id, doc: result.doc }, { status: 201 });
};
