import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { getAuthEnv } from '$lib/server/authenv';
import { setReturnTo } from '$lib/server/returnto';
import { redeemShareLink } from '$lib/server/share-links';
import { limit, clientIp, ipKey } from '$lib/server/ratelimit';

export const load: PageServerLoad = async ({ params, locals, platform, cookies, request }) => {
	const db = getDb(platform);
	const rl = await limit(db, ipKey(clientIp(request), 'join-token'), { max: 30, windowSeconds: 60 });
	if (!rl.allowed) throw error(429, 'Too many requests. Please slow down.');

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

	// A pending/rejected user is signed in but must not redeem a share (that
	// would grant trip access before the account itself is trusted). Send them
	// to '/', which renders the pending screen instead of the invite.
	if (locals.user.status !== 'approved') throw redirect(302, '/');

	const result = await redeemShareLink(db, params.token, locals.user.id);
	if (!result) return { state: 'invalid' as const };
	throw redirect(303, `/trips/${result.tripId}`);
};
