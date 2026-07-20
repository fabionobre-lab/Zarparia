import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getTripIdForPublicToken } from '$lib/server/public-links';
import { getTripDocById } from '$lib/server/trips';

// Print-optimised whole-trip document for the public, anonymous share route.
// Same token → trip lookup and same `home` strip as the sibling /s/[token]
// page, so the owner's address never leaves the server here either.
export const load: PageServerLoad = async ({ params, platform, url }) => {
	const db = getDb(platform);
	const tripId = await getTripIdForPublicToken(db, params.token);
	if (!tripId) throw error(404, 'Trip not found');
	const doc = await getTripDocById(db, tripId);
	if (!doc) throw error(404, 'Trip not found');

	const { home: _home, ...publicDoc } = doc;
	return {
		trip: publicDoc,
		token: params.token,
		lang: url.searchParams.get('lang') ?? undefined
	};
};
