import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { removeInvite } from '$lib/server/shares';

/** Withdraw a pending invite (owner-only). The email is the [email] path
 *  segment — SvelteKit URL-decodes it for us. */
export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const result = await removeInvite(db, user.id, params.id, params.email);
	if (result.ok) return new Response(null, { status: 204 });
	return json({ error: 'Only the owner can change sharing.' }, { status: 403 });
};
