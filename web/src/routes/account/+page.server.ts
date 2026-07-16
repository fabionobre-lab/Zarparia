import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Matches the trips/new and trips/[id] convention: redirect (not
	// requireUser's raw 401/403) so a signed-out or pending/rejected user
	// lands back on '/', which renders the sign-in card or the pending screen.
	if (!locals.user || locals.user.status !== 'approved') throw redirect(302, '/');
	return { user: locals.user };
};
