import { error } from '@sveltejs/kit';
import type { SessionUser } from '$lib/types';

/** Require an authenticated, APPROVED user in a load/endpoint. Fails with 401
 *  when signed out, 403 when signed in but not yet (or no longer) approved
 *  (Phase 3 approval gate). This is the single choke point for every data
 *  endpoint — /api/*, photo, share, trip, feedback and the /mcp bearer path
 *  (via validateAccessToken's status check) all flow through the same rule. */
export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) throw error(401, 'Sign in required.');
	if (locals.user.status !== 'approved') throw error(403, 'Account pending approval.');
	return locals.user;
}

/** Require only an authenticated user, any approval status. For the narrow set
 *  of surfaces a pending/rejected user must still be able to reach: whoami
 *  (/api/me), logout, and the pending/rejected screen itself. Never use this
 *  for anything that reads or writes trip/photo/share/feedback data. */
export function requireUserAnyStatus(locals: App.Locals): SessionUser {
	if (!locals.user) throw error(401, 'Sign in required.');
	return locals.user;
}
