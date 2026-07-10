import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAuthEnv } from '$lib/server/authenv';
import { setReturnTo } from '$lib/server/returnto';
import { redeemShareLink } from '$lib/server/share-links';

export const load: PageServerLoad = async ({ params, locals, platform, cookies }) => {
	const returnTo = `/join/${params.token}`;

	// Unauthenticated visitors are sent to sign-in and returned here afterwards.
	// We never look up the token before the visitor is known, so an anonymous
	// request can't learn whether a token exists.
	if (!locals.user) {
		if (getAuthEnv(platform).devAuth) {
			// Minimal dev page with a sign-in link that preserves the return path.
			return {
				state: 'dev-login' as const,
				devLoginUrl: `/auth/dev-login?returnTo=${encodeURIComponent(returnTo)}`
			};
		}
		setReturnTo(cookies, returnTo);
		throw redirect(302, '/auth/login/google');
	}

	const db = getDb(platform);
	const result = await redeemShareLink(db, params.token, locals.user.id);
	if (!result) return { state: 'invalid' as const };
	throw redirect(303, `/trips/${result.tripId}`);
};
