import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/admin';
import { listAllFeedback, listFeedbackForUser } from '$lib/server/feedback';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user || locals.user.status !== 'approved') throw redirect(302, '/');
	const db = getDb(platform);
	const admin = isAdmin(locals.user, platform);
	const items = admin
		? await listAllFeedback(db)
		: await listFeedbackForUser(db, locals.user.id);
	return { admin, items };
};
