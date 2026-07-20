import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getTripIdForPublicToken } from '$lib/server/public-links';
import { getTripDocById } from '$lib/server/trips';
import { loc, type Trip } from '$lib/trip-engine';

/**
 * Public, anonymous, read-only trip view (docs/public-share-route-spec.md).
 * Deliberately NOT nested under /trips — this route never inherits
 * /trips/[id]'s auth-gated layout logic, and reads unambiguously as "public"
 * in server logs/analytics.
 *
 * Lookup is token → trip_id only (same query shape as share-links.ts's
 * getShareLink), no session involved at all.
 */
export const load: PageServerLoad = async ({ params, platform, url }) => {
	const db = getDb(platform);
	const tripId = await getTripIdForPublicToken(db, params.token);
	// Miss/revoked → 404, not a redirect: unlike /trips/[id]'s redirect to '/',
	// there's no "sign in and it'll appear" story for an anonymous visitor.
	if (!tripId) throw error(404, 'Trip not found');
	const doc = await getTripDocById(db, tripId);
	if (!doc) throw error(404, 'Trip not found'); // trip deleted out from under a live token

	// Strip the owner's home (name/postcode/coords) before it leaves the
	// server: it's where the owner LIVES — a different sensitivity class from
	// the itinerary's destination coords (spec, "Privacy"). `home` is optional
	// in the Trip type, so the view degrades gracefully without it.
	const { home: _home, ...publicDoc } = doc;

	// EN title regardless of visitor locale — OG consumers (crawlers, chat
	// unfurls) don't carry an Accept-Language a `loc()` call could honour.
	// Description is a fixed generic line, not synthesized from trip content
	// (spec: "do not synthesize destination/date-range copy ... without a
	// design pass"). image is omitted so the root layout's static Zarparia
	// card is used (spec's OG option (a) — no per-trip image yet).
	const title = loc(doc as unknown as Trip, doc.title, 'en');
	return {
		trip: publicDoc,
		role: 'viewer' as const,
		token: params.token,
		og: {
			title: `${title} — Zarparia`,
			description: 'A shared travel itinerary on Zarparia.',
			url: `${url.origin}/s/${params.token}`
		}
	};
};
