import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { getPhotosToken } from '$lib/server/googlephotos';

/** Whether this browser currently holds a usable Google Photos Picker token.
 *  (The cookie's maxAge tracks the token's expiry, so presence ≈ validity;
 *  a revoked-but-unexpired token surfaces later as a reconnect error.) */
export const GET: RequestHandler = async ({ locals, cookies }) => {
	const user = requireUser(locals);
	return json({ connected: getPhotosToken(cookies, user.id) !== null });
};
