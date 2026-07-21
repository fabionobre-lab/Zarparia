// Pending share invites (0012_trip_invites): sharing to an email with no
// account records an invite that is claimed on that person's first sign-in.
// Runs against a real (Miniflare-backed) D1 binding with migrations applied.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { upsertGoogleUser, claimInvites } from '../src/lib/server/users';
import { createTrip, roleFor } from '../src/lib/server/trips';
import { shareWithEmail, listShares, listInvites, removeInvite } from '../src/lib/server/shares';
import type { TripDoc } from '../src/lib/validateTrip';

const DOC = {
	id: 'x',
	title: { en: 'Trip' },
	languages: ['en'],
	defaultLanguage: 'en',
	segments: [
		{
			id: 'main',
			title: { en: 'Main' },
			plans: [{ id: 'main', days: [{ date: '2026-05-01', title: { en: 'D1' }, blocks: [{ time: '09:00', title: { en: 'Go' } }] }] }]
		}
	]
} as unknown as TripDoc;

async function makeOwnerAndTrip(ownerEmail: string) {
	const owner = await upsertGoogleUser(env.DB, { sub: 'sub-' + ownerEmail, email: ownerEmail, name: 'Owner' }, undefined);
	const res = await createTrip(env.DB, owner.id, structuredClone(DOC));
	if (!res.ok) throw new Error('trip create failed');
	return { owner, tripId: res.id };
}

describe('pending share invites', () => {
	it('sharing to an email with no account records a pending invite (not an error)', async () => {
		const { owner, tripId } = await makeOwnerAndTrip('owner-a@example.com');
		const result = await shareWithEmail(env.DB, owner.id, tripId, 'Nobody@Example.com', 'editor');
		expect(result.ok).toBe(true);
		expect('invite' in result && result.invite.email).toBe('nobody@example.com'); // normalized
		const invites = await listInvites(env.DB, tripId);
		expect(invites).toEqual([{ email: 'nobody@example.com', permission: 'editor' }]);
		expect(await listShares(env.DB, tripId)).toHaveLength(0);
	});

	it('the invite becomes a real share when that person first signs in', async () => {
		const { owner, tripId } = await makeOwnerAndTrip('owner-b@example.com');
		await shareWithEmail(env.DB, owner.id, tripId, 'invitee-b@example.com', 'editor');

		// Invitee signs in for the first time → claim runs (as the login routes do).
		const invitee = await upsertGoogleUser(env.DB, { sub: 'sub-invitee-b', email: 'invitee-b@example.com', name: 'Bee' }, undefined);
		await claimInvites(env.DB, invitee.id, invitee.email);

		expect(await roleFor(env.DB, invitee.id, tripId)).toBe('editor');
		expect(await listInvites(env.DB, tripId)).toHaveLength(0);
		const shares = await listShares(env.DB, tripId);
		expect(shares).toEqual([{ userId: invitee.id, email: 'invitee-b@example.com', name: 'Bee', permission: 'editor' }]);
	});

	it('sharing to an email that already has an account writes a direct share (no invite)', async () => {
		const { owner, tripId } = await makeOwnerAndTrip('owner-c@example.com');
		const existing = await upsertGoogleUser(env.DB, { sub: 'sub-existing-c', email: 'existing-c@example.com', name: 'Cee' }, undefined);
		const result = await shareWithEmail(env.DB, owner.id, tripId, 'existing-c@example.com', 'viewer');
		expect('share' in result && result.share.userId).toBe(existing.id);
		expect(await listInvites(env.DB, tripId)).toHaveLength(0);
		expect(await roleFor(env.DB, existing.id, tripId)).toBe('viewer');
	});

	it('re-inviting the same email updates the pending permission', async () => {
		const { owner, tripId } = await makeOwnerAndTrip('owner-d@example.com');
		await shareWithEmail(env.DB, owner.id, tripId, 'dupe-d@example.com', 'viewer');
		await shareWithEmail(env.DB, owner.id, tripId, 'dupe-d@example.com', 'editor');
		expect(await listInvites(env.DB, tripId)).toEqual([{ email: 'dupe-d@example.com', permission: 'editor' }]);
	});

	it('removeInvite withdraws a pending invite (owner only)', async () => {
		const { owner, tripId } = await makeOwnerAndTrip('owner-e@example.com');
		await shareWithEmail(env.DB, owner.id, tripId, 'gone-e@example.com', 'viewer');
		const stranger = await upsertGoogleUser(env.DB, { sub: 'sub-stranger-e', email: 'stranger-e@example.com', name: 'X' }, undefined);
		expect(await removeInvite(env.DB, stranger.id, tripId, 'gone-e@example.com')).toEqual({ ok: false, reason: 'not_owner' });
		expect(await listInvites(env.DB, tripId)).toHaveLength(1);
		expect(await removeInvite(env.DB, owner.id, tripId, 'Gone-E@example.com')).toEqual({ ok: true }); // case-insensitive
		expect(await listInvites(env.DB, tripId)).toHaveLength(0);
	});

	it('claiming never gives an owner a redundant self-share on their own trip', async () => {
		// Edge: an invite exists for an email that later becomes the trip owner's.
		const { owner, tripId } = await makeOwnerAndTrip('owner-f@example.com');
		// Manually seed an invite addressed to the owner's own email.
		await env.DB.prepare('INSERT INTO trip_invites (trip_id, email, permission, invited_by) VALUES (?, ?, ?, ?)')
			.bind(tripId, 'owner-f@example.com', 'viewer', owner.id)
			.run();
		await claimInvites(env.DB, owner.id, 'owner-f@example.com');
		expect(await listShares(env.DB, tripId)).toHaveLength(0); // no self-share
		expect(await roleFor(env.DB, owner.id, tripId)).toBe('owner'); // still owner
		expect(await listInvites(env.DB, tripId)).toHaveLength(0); // invite consumed
	});
});
