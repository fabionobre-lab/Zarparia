// Phase 2 — GDPR export + deletion. Runs against real D1 + R2 (Miniflare),
// same discipline as the other test files: no mocks, exercise actual SQL and
// actual bucket operations.
import { env } from 'cloudflare:workers';
import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { buildAccountExport, deleteAccount } from '../src/lib/server/account';
import { registerClient, createAuthCode } from '../src/lib/server/mcp/oauth';
import { issueTokenPair } from '../src/lib/server/mcp/tokens';
import { requireUser } from '../src/lib/server/guards';
import { createSession, generateSessionToken, validateSessionToken } from '../src/lib/server/session';
import { createFeedback } from '../src/lib/server/feedback';
import { createTrip } from '../src/lib/server/trips';
import { shareWithEmail } from '../src/lib/server/shares';
import { upsertShareLink } from '../src/lib/server/share-links';
import { insertTripPhoto, getPhotosBucket } from '../src/lib/server/photos';
import { upsertGoogleUser, setUserStatus } from '../src/lib/server/users';
import { GET as exportGET } from '../src/routes/api/account/export/+server';
import { DELETE as accountDELETE } from '../src/routes/api/account/+server';
import type { TripDoc } from '$lib/validateTrip';

/** Smallest doc that satisfies trip.schema.json (segments/plans/days/blocks
 *  are all minItems: 1, so a trip needs one of each all the way down). */
function minimalTripDoc(title: string): TripDoc {
	return {
		id: 'placeholder',
		title: { 'en-GB': title },
		languages: ['en-GB'],
		defaultLanguage: 'en-GB',
		segments: [
			{
				id: 'seg1',
				title: { 'en-GB': 'Segment' },
				plans: [
					{
						id: 'plan1',
						days: [
							{
								date: '2026-06-01',
								title: { 'en-GB': 'Day 1' },
								blocks: [{ time: '09:00', title: { 'en-GB': 'Breakfast' } }]
							}
						]
					}
				]
			}
		]
	} as unknown as TripDoc;
}

async function approvedUser(email: string, name = 'Test User') {
	const user = await upsertGoogleUser(env.DB, { sub: 'sub-' + email, email, name }, undefined);
	await setUserStatus(env.DB, user.id, 'approved');
	return { ...user, status: 'approved' as const };
}

function platformWith(db: D1Database, bucket?: R2Bucket) {
	return { env: { DB: db, PHOTOS: bucket ?? env.PHOTOS } } as unknown as App.Platform;
}

describe('buildAccountExport', () => {
	it('contains every section for the owner, and nothing beyond proportionate shared fields for the recipient', async () => {
		const owner = await approvedUser('export-owner@example.com', 'Owner Person');
		const friend = await approvedUser('export-friend@example.com', 'Friend Person');

		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Owner Trip'), 'export-trip');
		expect(created.ok).toBe(true);
		if (!created.ok) throw new Error('setup failed');
		const tripId = created.id;

		const shareResult = await shareWithEmail(env.DB, owner.id, tripId, friend.email, 'viewer');
		expect(shareResult.ok).toBe(true);

		const link = await upsertShareLink(env.DB, tripId, 'viewer');
		expect(link.token.length).toBeGreaterThan(8);

		const fb = await createFeedback(env.DB, owner.id, { type: 'idea', message: 'Please add maps' });
		expect(fb.ok).toBe(true);

		await insertTripPhoto(env.DB, {
			id: 'photo-1',
			tripId,
			mediaItemId: 'media-1',
			creationTime: '2026-01-01T00:00:00Z',
			width: 100,
			height: 100,
			contentType: 'image/jpeg',
			placement: null,
			addedBy: owner.id
		});

		const client = await registerClient(env.DB, {
			client_name: 'Export Test Client',
			redirect_uris: ['http://localhost/callback']
		});
		if (!client.ok || !client.client) throw new Error('client registration failed');
		await issueTokenPair(env.DB, { clientId: client.client.client_id, userId: owner.id, scope: 'trips' });

		// ── Owner's export: everything should be present ──
		const ownerExport = await buildAccountExport(env.DB, owner.id);
		expect(ownerExport).not.toBeNull();
		if (!ownerExport) throw new Error('unreachable');

		expect(ownerExport.profile.email).toBe(owner.email);
		expect(ownerExport.ownedTrips.some((t) => t.id === tripId)).toBe(true);
		expect(ownerExport.sharesGranted.some((s) => s.tripId === tripId && s.granteeEmail === friend.email)).toBe(
			true
		);
		expect(ownerExport.shareLinks.some((s) => s.tripId === tripId && s.tokenLast4 === link.token.slice(-4))).toBe(
			true
		);
		// Redacted: only the last 4 chars of the token are ever exported.
		expect(JSON.stringify(ownerExport.shareLinks)).not.toContain(link.token);
		expect(ownerExport.feedback.some((f) => f.message === 'Please add maps')).toBe(true);
		expect(ownerExport.photos.some((p) => p.id === 'photo-1' && p.tripId === tripId)).toBe(true);
		expect(ownerExport.mcpGrants.some((g) => g.clientId === client.client!.client_id && g.scope === 'trips')).toBe(
			true
		);

		// ── Friend's export: only proportionate info about the received share ──
		const friendExport = await buildAccountExport(env.DB, friend.id);
		expect(friendExport).not.toBeNull();
		if (!friendExport) throw new Error('unreachable');

		expect(friendExport.sharesReceived.some((s) => s.tripId === tripId && s.ownerName === 'Owner Person')).toBe(
			true
		);
		// Cross-user leak check: nothing from the owner's private data leaks into
		// the friend's export.
		expect(friendExport.ownedTrips).toHaveLength(0);
		expect(friendExport.feedback).toHaveLength(0);
		expect(friendExport.photos).toHaveLength(0);
		expect(friendExport.mcpGrants).toHaveLength(0);
		const friendJson = JSON.stringify(friendExport);
		expect(friendJson).not.toContain(owner.email);
	});
});

describe('deleteAccount', () => {
	it('removes every row for the deleted user across every table, leaves the other user intact, and is idempotent on retry', async () => {
		const owner = await approvedUser('del-owner@example.com', 'Delete Owner');
		const friend = await approvedUser('del-friend@example.com', 'Delete Friend');

		const created = await createTrip(env.DB, owner.id, minimalTripDoc('Delete Trip'), 'delete-trip');
		if (!created.ok) throw new Error('setup failed');
		const tripId = created.id;

		await shareWithEmail(env.DB, owner.id, tripId, friend.email, 'editor');
		await upsertShareLink(env.DB, tripId, 'viewer');
		await createFeedback(env.DB, owner.id, { type: 'bug', message: 'Something broke' });

		await insertTripPhoto(env.DB, {
			id: 'photo-del-1',
			tripId,
			mediaItemId: 'media-del-1',
			creationTime: '2026-01-01T00:00:00Z',
			width: 50,
			height: 50,
			contentType: 'image/jpeg',
			placement: null,
			addedBy: owner.id
		});
		const bucket = getPhotosBucket(platformWith(env.DB));
		await bucket.put('photos/delete-trip/photo-del-1/thumb', 'thumb-bytes');
		await bucket.put('photos/delete-trip/photo-del-1/disp', 'disp-bytes');

		const client = await registerClient(env.DB, {
			client_name: 'Delete Test Client',
			redirect_uris: ['http://localhost/callback']
		});
		if (!client.ok || !client.client) throw new Error('client registration failed');
		await issueTokenPair(env.DB, { clientId: client.client.client_id, userId: owner.id, scope: 'trips' });

		const token = generateSessionToken();
		await createSession(env.DB, token, owner.id);
		const before = await validateSessionToken(env.DB, token);
		expect(before?.user.id).toBe(owner.id);

		// Also give the FRIEND a session + a share they received elsewhere, plus
		// their own trip, to prove deleting the owner never touches them.
		const friendCreated = await createTrip(env.DB, friend.id, minimalTripDoc('Friend Own Trip'), 'friend-trip');
		if (!friendCreated.ok) throw new Error('setup failed');
		const friendToken = generateSessionToken();
		await createSession(env.DB, friendToken, friend.id);

		await deleteAccount(env.DB, bucket, owner.id);

		// User row + auth material gone.
		expect(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(owner.id).first()).toBeNull();
		expect(
			await env.DB.prepare('SELECT 1 FROM oauth_tokens WHERE user_id = ?').bind(owner.id).first()
		).toBeNull();
		expect(await env.DB.prepare('SELECT 1 FROM sessions WHERE user_id = ?').bind(owner.id).first()).toBeNull();
		// Owned trip + its dependents gone.
		expect(await env.DB.prepare('SELECT 1 FROM trips WHERE id = ?').bind(tripId).first()).toBeNull();
		expect(
			await env.DB.prepare('SELECT 1 FROM trip_shares WHERE trip_id = ?').bind(tripId).first()
		).toBeNull();
		expect(
			await env.DB.prepare('SELECT 1 FROM trip_share_links WHERE trip_id = ?').bind(tripId).first()
		).toBeNull();
		expect(
			await env.DB.prepare('SELECT 1 FROM trip_photos WHERE trip_id = ?').bind(tripId).first()
		).toBeNull();
		expect(await env.DB.prepare('SELECT 1 FROM feedback WHERE user_id = ?').bind(owner.id).first()).toBeNull();
		// R2 objects gone.
		expect(await bucket.head('photos/delete-trip/photo-del-1/thumb')).toBeNull();
		expect(await bucket.head('photos/delete-trip/photo-del-1/disp')).toBeNull();
		// The deleted user's session token no longer validates.
		expect(await validateSessionToken(env.DB, token)).toBeNull();

		// The friend's own account, trip and session are all untouched.
		const friendRow = await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(friend.id).first();
		expect(friendRow).not.toBeNull();
		const friendTripRow = await env.DB.prepare('SELECT 1 FROM trips WHERE id = ?').bind('friend-trip').first();
		expect(friendTripRow).not.toBeNull();
		expect((await validateSessionToken(env.DB, friendToken))?.user.id).toBe(friend.id);

		// Idempotent: re-running the cascade on an already-deleted account (or a
		// half-deleted one, simulated by having already removed everything above)
		// completes without throwing.
		await expect(deleteAccount(env.DB, bucket, owner.id)).resolves.toBeUndefined();
	});

	it('a retry after a partial (half-deleted) run completes cleanly', async () => {
		const user = await approvedUser('half-deleted@example.com', 'Half Deleted');
		const created = await createTrip(env.DB, user.id, minimalTripDoc('Half Trip'), 'half-trip');
		if (!created.ok) throw new Error('setup failed');
		await createFeedback(env.DB, user.id, { type: 'other', message: 'half' });
		const token = generateSessionToken();
		await createSession(env.DB, token, user.id);

		// Simulate a prior run that died after step 1 (auth material gone) but
		// before the trip/feedback/user rows were touched.
		await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();

		const bucket = getPhotosBucket(platformWith(env.DB));
		await expect(deleteAccount(env.DB, bucket, user.id)).resolves.toBeUndefined();

		expect(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(user.id).first()).toBeNull();
		expect(await env.DB.prepare('SELECT 1 FROM trips WHERE id = ?').bind('half-trip').first()).toBeNull();
		expect(await env.DB.prepare('SELECT 1 FROM feedback WHERE user_id = ?').bind(user.id).first()).toBeNull();
	});

	it('removes oauth_codes rows for the deleted user', async () => {
		const user = await approvedUser('del-oauth-code@example.com', 'Code Holder');
		const client = await registerClient(env.DB, {
			client_name: 'Delete Code Test Client',
			redirect_uris: ['http://localhost/callback']
		});
		if (!client.ok || !client.client) throw new Error('client registration failed');
		await createAuthCode(env.DB, {
			clientId: client.client.client_id,
			userId: user.id,
			redirectUri: 'http://localhost/callback',
			codeChallenge: 'challenge',
			codeChallengeMethod: 'S256',
			scope: 'trips',
			resource: null
		});
		expect(await env.DB.prepare('SELECT 1 FROM oauth_codes WHERE user_id = ?').bind(user.id).first()).not.toBeNull();

		const bucket = getPhotosBucket(platformWith(env.DB));
		await deleteAccount(env.DB, bucket, user.id);

		expect(await env.DB.prepare('SELECT 1 FROM oauth_codes WHERE user_id = ?').bind(user.id).first()).toBeNull();
	});

	it('deleting a share RECIPIENT removes only their received-share row, leaving the sharing friend and their trip untouched', async () => {
		const friend = await approvedUser('del-share-owner@example.com', 'Share Owner Friend');
		const target = await approvedUser('del-share-recipient@example.com', 'Share Recipient');

		const friendTrip = await createTrip(env.DB, friend.id, minimalTripDoc('Friend Owned Trip'), 'friend-owned-trip');
		if (!friendTrip.ok) throw new Error('setup failed');
		await shareWithEmail(env.DB, friend.id, friendTrip.id, target.email, 'viewer');
		expect(
			await env.DB
				.prepare('SELECT 1 FROM trip_shares WHERE trip_id = ? AND user_id = ?')
				.bind(friendTrip.id, target.id)
				.first()
		).not.toBeNull();

		const bucket = getPhotosBucket(platformWith(env.DB));
		await deleteAccount(env.DB, bucket, target.id);

		// The received-share row is gone...
		expect(
			await env.DB
				.prepare('SELECT 1 FROM trip_shares WHERE trip_id = ? AND user_id = ?')
				.bind(friendTrip.id, target.id)
				.first()
		).toBeNull();
		// ...but the friend's trip and their own account are entirely untouched.
		expect(await env.DB.prepare('SELECT 1 FROM trips WHERE id = ?').bind(friendTrip.id).first()).not.toBeNull();
		expect(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(friend.id).first()).not.toBeNull();
	});

	it('deleting an editor who added a photo to someone else\'s trip keeps the photo row but clears added_by', async () => {
		const friend = await approvedUser('del-photo-owner@example.com', 'Photo Trip Owner');
		const target = await approvedUser('del-photo-editor@example.com', 'Photo Editor');

		const friendTrip = await createTrip(env.DB, friend.id, minimalTripDoc('Friend Photo Trip'), 'friend-photo-trip');
		if (!friendTrip.ok) throw new Error('setup failed');
		await shareWithEmail(env.DB, friend.id, friendTrip.id, target.email, 'editor');

		await insertTripPhoto(env.DB, {
			id: 'photo-editor-1',
			tripId: friendTrip.id,
			mediaItemId: 'media-editor-1',
			creationTime: '2026-01-01T00:00:00Z',
			width: 80,
			height: 80,
			contentType: 'image/jpeg',
			placement: null,
			addedBy: target.id
		});

		const bucket = getPhotosBucket(platformWith(env.DB));
		await deleteAccount(env.DB, bucket, target.id);

		// The photo row survives — it belongs to the friend's trip, not the
		// deleted editor — but the attribution is cleared.
		const photoRow = await env.DB
			.prepare('SELECT added_by AS addedBy FROM trip_photos WHERE id = ?')
			.bind('photo-editor-1')
			.first<{ addedBy: string | null }>();
		expect(photoRow).not.toBeNull();
		expect(photoRow?.addedBy).toBeNull();
	});

	it('removes only the deleted user\'s rate_limits rows, leaving ip-keyed rows for the same surface untouched', async () => {
		const target = await approvedUser('del-ratelimit@example.com', 'Rate Limited');
		await env.DB
			.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)')
			.bind(`user:${target.id}:feedback`, 0, 1)
			.run();
		await env.DB
			.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)')
			.bind('ip:1.2.3.4:feedback', 0, 1)
			.run();

		const bucket = getPhotosBucket(platformWith(env.DB));
		await deleteAccount(env.DB, bucket, target.id);

		expect(
			await env.DB.prepare('SELECT 1 FROM rate_limits WHERE key = ?').bind(`user:${target.id}:feedback`).first()
		).toBeNull();
		expect(
			await env.DB.prepare('SELECT 1 FROM rate_limits WHERE key = ?').bind('ip:1.2.3.4:feedback').first()
		).not.toBeNull();
	});
});

describe('/api/account/export and DELETE /api/account — guarded', () => {
	it('requireUser: 401 signed out, 403 pending (shared with every /api/account route)', () => {
		expect.assertions(4);
		try {
			requireUser({ user: null } as never);
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) expect(e.status).toBe(401);
		}
		const pending = { id: 'p1', email: 'p@example.com', name: null, avatarUrl: null, status: 'pending' as const };
		try {
			requireUser({ user: pending } as never);
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) expect(e.status).toBe(403);
		}
	});

	it('GET export: 401 when signed out', async () => {
		const request = new Request('https://example.com/api/account/export');
		await expect(
			exportGET({ platform: platformWith(env.DB), locals: { user: null }, request } as never)
		).rejects.toMatchObject({ status: 401 });
	});

	it('GET export: 403 for a pending user', async () => {
		const pendingUser = await upsertGoogleUser(
			env.DB,
			{ sub: 'sub-pending-export', email: 'pending-export@example.com', name: 'Pending' },
			undefined
		);
		expect(pendingUser.status).toBe('pending');
		const request = new Request('https://example.com/api/account/export');
		await expect(
			exportGET({ platform: platformWith(env.DB), locals: { user: pendingUser }, request } as never)
		).rejects.toMatchObject({ status: 403 });
	});

	it('GET export: returns an attachment JSON download for an approved user', async () => {
		const user = await approvedUser('route-export@example.com');
		const request = new Request('https://example.com/api/account/export');
		const res = await exportGET({ platform: platformWith(env.DB), locals: { user }, request } as never);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-disposition')).toContain('attachment');
		expect(res.headers.get('content-disposition')).toContain('zarparia-export-');
		const body = (await res.json()) as { profile: { email: string } };
		expect(body.profile.email).toBe(user.email);
	});

	it('DELETE /api/account: 401 signed out, 403 pending', async () => {
		const signedOutReq = new Request('https://example.com/api/account', { method: 'DELETE' });
		await expect(
			accountDELETE({
				platform: platformWith(env.DB),
				locals: { user: null },
				request: signedOutReq,
				cookies: { delete: () => {} }
			} as never)
		).rejects.toMatchObject({ status: 401 });

		const pendingUser = await upsertGoogleUser(
			env.DB,
			{ sub: 'sub-pending-delete', email: 'pending-delete@example.com', name: 'Pending' },
			undefined
		);
		const pendingReq = new Request('https://example.com/api/account', { method: 'DELETE' });
		await expect(
			accountDELETE({
				platform: platformWith(env.DB),
				locals: { user: pendingUser },
				request: pendingReq,
				cookies: { delete: () => {} }
			} as never)
		).rejects.toMatchObject({ status: 403 });
	});

	it('DELETE /api/account: 400 without a matching type-to-confirm value, 200 + cascade with one', async () => {
		const user = await approvedUser('route-delete@example.com');

		const badReq = new Request('https://example.com/api/account', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ confirm: 'nope' })
		});
		let cookieDeleted = false;
		const badRes = await accountDELETE({
			platform: platformWith(env.DB),
			locals: { user },
			request: badReq,
			cookies: { delete: () => (cookieDeleted = true) }
		} as never);
		expect(badRes.status).toBe(400);
		expect(cookieDeleted).toBe(false);
		// Account must still exist after a rejected confirmation.
		expect(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(user.id).first()).not.toBeNull();

		const goodReq = new Request('https://example.com/api/account', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ confirm: 'DELETE' })
		});
		const goodRes = await accountDELETE({
			platform: platformWith(env.DB),
			locals: { user },
			request: goodReq,
			cookies: { delete: () => (cookieDeleted = true) }
		} as never);
		expect(goodRes.status).toBe(200);
		expect(cookieDeleted).toBe(true);
		expect(await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(user.id).first()).toBeNull();
	});
});
