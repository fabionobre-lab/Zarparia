import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { isAdmin } from '$lib/server/admin';
import { createFeedback, listAllFeedback, listFeedbackForUser } from '$lib/server/feedback';

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const body = (await request.json().catch(() => null)) as
		| { type?: string; message?: string; page?: string }
		| null;

	const result = await createFeedback(db, user.id, {
		type: body?.type as never,
		message: body?.message ?? '',
		page: typeof body?.page === 'string' ? body.page : null,
		locale: locals.locale
	});

	if (result.ok) return json({ id: result.id }, { status: 201 });
	if (result.reason === 'too_long') return json({ error: 'Message is too long.' }, { status: 400 });
	if (result.reason === 'bad_type') return json({ error: 'Unknown feedback type.' }, { status: 400 });
	return json({ error: 'Message is required.' }, { status: 400 });
};

export const GET: RequestHandler = async ({ platform, locals }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if (isAdmin(user, platform)) {
		return json({ admin: true, items: await listAllFeedback(db) });
	}
	return json({ admin: false, items: await listFeedbackForUser(db, user.id) });
};
