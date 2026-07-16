import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { getDb } from '$lib/server/db';
import { limit, userKey, tooManyRequests } from '$lib/server/ratelimit';
import {
	getPhotosToken,
	clearPhotosTokenCookie,
	createPickerSession,
	pollIntervalMs
} from '$lib/server/googlephotos';

/** Open a Google Photos picking session. The client sends the user to
 *  `pickerUri` (Google's own UI) and polls the session until they finish. */
export const POST: RequestHandler = async ({ locals, cookies, platform }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	const rl = await limit(db, userKey(user.id, 'photo-picker'), { max: 30, windowSeconds: 60 });
	if (!rl.allowed) return tooManyRequests(rl);
	const token = getPhotosToken(cookies, user.id);
	if (!token) return json({ reason: 'reconnect' }, { status: 401 });

	const res = await createPickerSession(token);
	if (!res.ok) {
		if (res.reason === 'unauthorized') {
			clearPhotosTokenCookie(cookies);
			return json({ reason: 'reconnect' }, { status: 401 });
		}
		return json({ reason: 'picker_error' }, { status: 502 });
	}
	return json({
		sessionId: res.value.id,
		pickerUri: res.value.pickerUri,
		pollIntervalMs: pollIntervalMs(res.value)
	});
};
