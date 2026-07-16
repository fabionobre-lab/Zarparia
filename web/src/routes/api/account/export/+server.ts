import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { buildAccountExport } from '$lib/server/account';

/** GDPR Art. 20 data export — a single JSON download of everything this app
 *  holds about the requesting user (see buildAccountExport for the exact
 *  contents/redaction rules). requireUser() is the only guard: no admin
 *  bypass, no cross-user reads. */
export const GET: RequestHandler = async ({ platform, locals }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const data = await buildAccountExport(db, user.id);
	// requireUser already proves the row existed when the session was
	// resolved; a null export here would mean the account vanished between
	// that check and this query (e.g. a concurrent deletion) — treat it as
	// "no longer here" rather than crashing.
	if (!data) return new Response(JSON.stringify({ error: 'Account not found.' }), { status: 404 });

	const date = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="zarparia-export-${date}.json"`
		}
	});
};
