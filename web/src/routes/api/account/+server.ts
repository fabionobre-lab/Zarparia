import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPhotosBucket } from '$lib/server/photos';
import { requireUser } from '$lib/server/guards';
import { deleteAccount } from '$lib/server/account';
import { deleteSessionCookie } from '$lib/server/session';

/** GDPR erasure — full cascade delete of the requesting user's account (see
 *  deleteAccount for the exact order/idempotency guarantees). Requires a
 *  type-to-confirm value in the body (the literal "DELETE" or the account's
 *  own email) so a stray/scripted DELETE call can't wipe an account without
 *  the deliberate confirmation the UI collects. */
export const DELETE: RequestHandler = async ({ platform, locals, request, cookies }) => {
	const user = requireUser(locals);

	const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
	const confirm = typeof body?.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';
	const expectedEmail = user.email.trim().toLowerCase();
	if (confirm !== 'delete' && confirm !== expectedEmail) {
		return json({ error: 'Type DELETE or your account email to confirm.' }, { status: 400 });
	}

	const db = getDb(platform);
	const bucket = getPhotosBucket(platform);
	await deleteAccount(db, bucket, user.id);

	// The cascade already deleted every session row (incl. this one) from D1;
	// this clears the browser's cookie too so the client doesn't keep sending
	// a now-meaningless token.
	deleteSessionCookie(cookies);

	return json({ ok: true });
};
