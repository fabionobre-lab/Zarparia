import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { validateTripDoc } from '$lib/validateTrip';
import { loc, type Trip } from '$lib/trip-engine';
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
export const load: PageServerLoad = async ({ url }) => {
	const result = validateTripDoc(demoTrip);
	if (!result.valid) {
		console.error('demo-trip.json failed schema validation:', result.errors);
		throw error(500, 'Demo trip is misconfigured');
	}
	// The only route today that can carry per-route OG for real: /trips/[id]
	// is auth-gated (redirects anonymous visitors, see +page.server.ts:10) so
	// crawlers never see it — see DESIGN-CONSISTENCY-PLAN-R2.md Phase 6 item 1.
	// EN title regardless of visitor locale: OG consumers (crawlers, chat
	// unfurls) don't carry an Accept-Language a `loc()` call could honour.
	const title = loc(demoTrip as unknown as Trip, demoTrip.title, 'en');
	return {
		trip: demoTrip,
		role: 'viewer' as const,
		photos: [],
		og: {
			title: `${title} — Zarparia`,
			description:
				'A sample trip, fully interactive — see how Zarparia plans a real itinerary. Nothing is saved.',
			url: `${url.origin}/demo`
		}
	};
};
