import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/admin';
import { listPendingUsers, listRecentlyDecidedUsers, setUserStatus } from '$lib/server/users';
import type { UserStatus } from '$lib/types';

const DECIDABLE_STATUSES: UserStatus[] = ['approved', 'rejected', 'pending'];

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) throw redirect(302, '/');
	// Non-admins get a 404, not a redirect: this route's existence (and that an
	// approval queue exists at all) isn't information a regular user needs.
	if (!isAdmin(locals.user, platform)) throw error(404, 'Not found');
	const db = getDb(platform);
	const [pending, recent] = await Promise.all([listPendingUsers(db), listRecentlyDecidedUsers(db)]);
	return { pending, recent };
};

export const actions: Actions = {
	// Single action for approve/reject/revert-to-pending ("undo"): all three are
	// the same idempotent status write, guarded by isAdmin server-side (never
	// trust the form — anyone signed in could otherwise POST here directly).
	decide: async ({ request, locals, platform }) => {
		if (!locals.user) throw error(401, 'Sign in required.');
		if (!isAdmin(locals.user, platform)) throw error(404, 'Not found');
		const db = getDb(platform);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const status = String(form.get('status') ?? '') as UserStatus;
		if (!userId || !DECIDABLE_STATUSES.includes(status)) {
			return fail(400, { error: 'Invalid approval action.' });
		}
		const ok = await setUserStatus(db, userId, status);
		if (!ok) return fail(404, { error: 'User not found.' });
		return { ok: true };
	}
};
