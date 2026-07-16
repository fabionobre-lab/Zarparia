import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import {
	getPhotosToken,
	clearPhotosTokenCookie,
	getPickerSession
} from '$lib/server/googlephotos';

/** Poll a picking session: done once the user hit "Done" in Google Photos
 *  (`mediaItemsSet`). Proxied so the OAuth token never reaches the client. */
export const GET: RequestHandler = async ({ locals, cookies, params }) => {
	const user = requireUser(locals);
	const token = getPhotosToken(cookies, user.id);
	if (!token) return json({ reason: 'reconnect' }, { status: 401 });

	const res = await getPickerSession(token, params.sid);
	if (!res.ok) {
		if (res.reason === 'unauthorized') {
			clearPhotosTokenCookie(cookies);
			return json({ reason: 'reconnect' }, { status: 401 });
		}
		// Sessions expire server-side (~30 min): tell the client to start over.
		return json({ reason: 'session_gone' }, { status: 410 });
	}
	return json({ mediaItemsSet: res.value.mediaItemsSet === true });
};
