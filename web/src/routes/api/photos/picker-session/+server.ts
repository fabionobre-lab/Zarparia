import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import {
	getPhotosToken,
	clearPhotosTokenCookie,
	createPickerSession,
	pollIntervalMs
} from '$lib/server/googlephotos';

/** Open a Google Photos picking session. The client sends the user to
 *  `pickerUri` (Google's own UI) and polls the session until they finish. */
export const POST: RequestHandler = async ({ locals, cookies }) => {
	requireUser(locals);
	const token = getPhotosToken(cookies);
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
