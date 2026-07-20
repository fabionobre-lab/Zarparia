import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getTripForUser } from '$lib/server/trips';

// Standalone, print-optimised whole-trip document (rendered by TripPrint.svelte).
// Auth mirrors the sibling /trips/[id] route exactly: a signed-out or
// unapproved visitor is redirected to '/', an unknown/unshared trip 404s.
export const load: PageServerLoad = async ({ locals, platform, params, url }) => {
	if (!locals.user || locals.user.status !== 'approved') throw redirect(302, '/');
	const db = getDb(platform);
	const trip = await getTripForUser(db, locals.user.id, params.id);
	if (!trip) throw error(404, 'Trip not found');
	// `lang` is the trip-content language the viewer had selected; the component
	// falls back to the trip default when it's absent or unknown.
	return { trip: trip.doc, lang: url.searchParams.get('lang') ?? undefined };
};
