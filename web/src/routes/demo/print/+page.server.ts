import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { validateTripDoc } from '$lib/validateTrip';
import demoTrip from '$lib/seed/demo-trip.json';

// Print-optimised whole-trip document for the public demo trip — no auth, no
// DB, same bundled fictional trip as /demo. Validated at load time for the
// same reason /demo does (a schema-breaking edit fails loudly here).
export const load: PageServerLoad = async ({ url }) => {
	const result = validateTripDoc(demoTrip);
	if (!result.valid) {
		console.error('demo-trip.json failed schema validation:', result.errors);
		throw error(500, 'Demo trip is misconfigured');
	}
	return { trip: demoTrip, lang: url.searchParams.get('lang') ?? undefined };
};
