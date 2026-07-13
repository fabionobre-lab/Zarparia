import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getTripForUser } from '$lib/server/trips';

export const load: PageServerLoad = async ({ locals, platform, params }) => {
	if (!locals.user) throw redirect(302, '/');
	const db = getDb(platform);
	const trip = await getTripForUser(db, locals.user.id, params.id);
	if (!trip) throw error(404, 'Trip not found');
	// Photos are deliberately NOT loaded here: server-rendering hundreds of
	// photo strips blew the Workers free-plan CPU limit (error 1102) on a
	// 700-photo trip. The client fetches /api/trips/[id]/photos after mount.
	return { trip: trip.doc, role: trip.role };
};
