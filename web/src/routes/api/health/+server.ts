import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

// Smoke check: confirms the D1 binding works and lists the migrated tables.
export const GET: RequestHandler = async ({ platform }) => {
	const db = getDb(platform);
	const tables = await db
		.prepare(
			"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name"
		)
		.all<{ name: string }>();
	return json({ ok: true, tables: tables.results.map((t) => t.name) });
};
