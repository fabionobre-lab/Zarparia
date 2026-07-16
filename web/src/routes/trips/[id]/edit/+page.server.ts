import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getTripForUser } from '$lib/server/trips';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	if (!locals.user || locals.user.status !== 'approved') throw redirect(302, '/');
	const db = getDb(platform);
	const trip = await getTripForUser(db, locals.user.id, params.id);
	if (!trip) throw error(404, 'Trip not found');
	if (trip.role === 'viewer') throw error(403, 'You have view-only access to this trip');
	return { trip: trip.doc, tripId: params.id, updatedAt: trip.updatedAt };
};
