import type { PageServerLoad } from './$types';
import { listTripsForUser, type TripListItem } from '$lib/server/trips';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) return { trips: [] as TripListItem[] };
	// Phase 3 approval gate: a pending/rejected user is signed in, but no trip
	// data may load behind that state — the page renders a pending/rejected
	// screen instead (see +page.svelte). `gateStatus` carries just enough for
	// that screen; trips are never fetched for a non-approved user.
	if (locals.user.status !== 'approved') {
		return { trips: [] as TripListItem[], gateStatus: locals.user.status };
	}
	const db = platform?.env?.DB;
	if (!db) return { trips: [] as TripListItem[] };
	return { trips: await listTripsForUser(db, locals.user.id) };
};
