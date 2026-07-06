import { error } from '@sveltejs/kit';

/** Get the D1 binding from the request platform, or fail with 503. */
export function getDb(platform: App.Platform | undefined): D1Database {
	const db = platform?.env?.DB;
	if (!db) throw error(503, 'Database binding unavailable');
	return db;
}
