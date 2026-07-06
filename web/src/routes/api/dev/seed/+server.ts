import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAuthEnv } from '$lib/server/authenv';
import { requireUser } from '$lib/server/guards';
import { createTrip } from '$lib/server/trips';
import type { TripDoc } from '$lib/server/validateTrip';
import uk from '$lib/seed/uk-spring-2026.json';
import rome from '$lib/seed/rome-2026.json';

/**
 * DEV ONLY (gated on DEV_AUTH). Seeds the bundled example trips into the
 * signed-in user's account, keeping their original ids when free. Idempotent.
 */
export const POST: RequestHandler = async ({ platform, locals }) => {
	if (!getAuthEnv(platform).devAuth) throw error(404, 'Not found');
	const user = requireUser(locals);
	const db = getDb(platform);

	const seeds = [uk, rome] as unknown as TripDoc[];
	const created: string[] = [];
	const skipped: string[] = [];
	for (const seed of seeds) {
		const desiredId = seed.id;
		const owned = await db
			.prepare('SELECT 1 FROM trips WHERE id = ? AND owner_id = ?')
			.bind(desiredId, user.id)
			.first();
		if (owned) {
			skipped.push(desiredId);
			continue;
		}
		const result = await createTrip(db, user.id, structuredClone(seed), desiredId);
		if (result.ok) created.push(result.id);
	}
	return json({ created, skipped });
};
