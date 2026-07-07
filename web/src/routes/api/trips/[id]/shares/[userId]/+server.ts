import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { removeShare } from '$lib/server/shares';

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const result = await removeShare(db, user.id, params.id, params.userId);
	if (result.ok) return new Response(null, { status: 204 });
	return json({ error: 'Only the owner can change sharing.' }, { status: 403 });
};
