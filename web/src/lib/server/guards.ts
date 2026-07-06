import { error } from '@sveltejs/kit';
import type { SessionUser } from '$lib/types';

/** Require an authenticated user in a load/endpoint, or fail with 401. */
export function requireUser(locals: App.Locals): SessionUser {
	if (!locals.user) throw error(401, 'Sign in required.');
	return locals.user;
}
