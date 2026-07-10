import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { isAdmin } from '$lib/server/admin';
import { isFeedbackStatus, updateFeedbackStatus } from '$lib/server/feedback';

export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if (!isAdmin(user, platform)) return json({ error: 'Admins only.' }, { status: 403 });

	const body = (await request.json().catch(() => null)) as { status?: string } | null;
	const status = body?.status;
	if (!isFeedbackStatus(status)) return json({ error: 'Invalid status.' }, { status: 400 });

	await updateFeedbackStatus(db, params.id, status);
	return json({ ok: true });
};
