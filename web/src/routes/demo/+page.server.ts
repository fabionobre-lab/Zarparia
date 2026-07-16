import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { validateTripDoc } from '$lib/validateTrip';
import demoTrip from '$lib/seed/demo-trip.json';

/**
 * Public demo trip — no auth, no DB. Anyone can browse the real TripView
 * against a bundled fictional trip. Validated against the schema at load
 * time (not just at authoring time) so a future edit to demo-trip.json that
 * breaks the schema fails loudly here instead of rendering a broken viewer.
 *
 * Shape mirrors src/routes/trips/[id]/+page.server.ts: `{ trip, role }`, plus
 * `photos: []` since TripView expects that prop directly (real trip pages
 * fetch photos client-side; the demo has none and photosEditable stays false).
 */
export const load: PageServerLoad = async () => {
	const result = validateTripDoc(demoTrip);
	if (!result.valid) {
		console.error('demo-trip.json failed schema validation:', result.errors);
		throw error(500, 'Demo trip is misconfigured');
	}
	return { trip: demoTrip, role: 'viewer' as const, photos: [] };
};
