import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { roleFor } from '$lib/server/trips';
import { listShares, shareWithEmail, type SharePermission } from '$lib/server/shares';

export const GET: RequestHandler = async ({ platform, locals, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if ((await roleFor(db, user.id, params.id)) !== 'owner') {
		return json({ error: 'Only the owner can view sharing.' }, { status: 403 });
	}
	return json({ shares: await listShares(db, params.id) });
};

export const POST: RequestHandler = async ({ platform, locals, params, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const body = (await request.json().catch(() => null)) as { email?: string; permission?: string } | null;
	const email = body?.email?.trim();
	const permission: SharePermission = body?.permission === 'editor' ? 'editor' : 'viewer';
	if (!email) return json({ error: 'Email is required.' }, { status: 400 });

	const result = await shareWithEmail(db, user.id, params.id, email, permission);
	if (result.ok) return json({ share: result.share }, { status: 201 });
	if (result.reason === 'not_owner') return json({ error: 'Only the owner can share.' }, { status: 403 });
	if (result.reason === 'self') return json({ error: 'You already own this trip.' }, { status: 400 });
	return json(
		{ error: 'No account found for that email. They need to sign in once before you can share with them.' },
		{ status: 404 }
	);
};
