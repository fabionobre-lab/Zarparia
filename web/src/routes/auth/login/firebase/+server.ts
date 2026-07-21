import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getAuthEnv } from '$lib/server/authenv';
import { verifyFirebaseIdToken } from '$lib/server/firebase';
import { upsertFirebaseUser, claimInvites } from '$lib/server/users';
import { generateSessionToken, createSession, setSessionCookie } from '$lib/server/session';
import { limit, clientIp, ipKey } from '$lib/server/ratelimit';

/** Exchanges a Firebase ID token (from the client SDK's email+password sign-in)
 *  for this app's own D1-backed session — the same session mechanism as the
 *  Google OAuth callback, just fed by a different identity provider. */
export const POST: RequestHandler = async ({ request, platform, cookies }) => {
	const { firebaseProjectId } = getAuthEnv(platform);
	if (!firebaseProjectId) throw error(404, 'Not found');

	// Same 20/min-per-IP budget and shape as /auth/login/google — this
	// endpoint has no separate redirect leg to share it with.
	const db = getDb(platform);
	const rl = await limit(db, ipKey(clientIp(request), 'auth-firebase'), { max: 20, windowSeconds: 60 });
	if (!rl.allowed) throw error(429, 'Too many requests. Please slow down.');

	const body = await request.json().catch(() => null) as { idToken?: unknown } | null;
	const idToken = typeof body?.idToken === 'string' ? body.idToken : '';

	const result = await verifyFirebaseIdToken(idToken, firebaseProjectId);
	if (!result.ok) return json({ error: 'invalid_token' }, { status: 401 });

	const { claims } = result;
	if (claims.emailVerified !== true) return json({ error: 'email_unverified' }, { status: 403 });
	if (claims.signInProvider !== 'password') return json({ error: 'invalid_provider' }, { status: 403 });
	if (!claims.email) return json({ error: 'invalid_token' }, { status: 401 });

	const user = await upsertFirebaseUser(db, { uid: claims.uid, email: claims.email, name: null }, platform);
	// email_verified was asserted above, so pending invites for it are now theirs.
	await claimInvites(db, user.id, user.email);
	const token = generateSessionToken();
	await createSession(db, token, user.id);
	setSessionCookie(cookies, token);

	return json({ ok: true });
};
