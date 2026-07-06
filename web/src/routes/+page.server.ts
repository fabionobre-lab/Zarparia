import type { PageServerLoad } from './$types';
import { listTripsForUser, type TripListItem } from '$lib/server/trips';

export const load: PageServerLoad = async ({ locals, platform }) => {
	const db = platform?.env?.DB;
	if (!locals.user || !db) return { trips: [] as TripListItem[] };
	return { trips: await listTripsForUser(db, locals.user.id) };
};
