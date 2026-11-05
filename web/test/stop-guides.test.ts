// set_stop_guides: add per-stop reading guides without resending the whole
// trip. A trip with dozens of guides is too large to pass through update_trip
// in one tool call, so guides go in by block id, a few per call.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { registerClient } from '../src/lib/server/mcp/oauth';
import { issueTokenPair } from '../src/lib/server/mcp/tokens';
import { applyStopGuides } from '../src/lib/server/mcp/stopGuides';
import { createTrip, getTripForUser } from '../src/lib/server/trips';
import { upsertGoogleUser, setUserStatus } from '../src/lib/server/users';
import type { TripDoc } from '../src/lib/validateTrip';
import { POST } from '../src/routes/mcp/+server';

function sampleDoc(id: string): TripDoc {
	return {
		id,
		title: { en: 'Guide test' },
		languages: ['en'],
		defaultLanguage: 'en',
		segments: [
			{
				id: 'seg',
				title: { en: 'Seg' },
				plans: [
					{
						id: 'main',
						days: [
							{
								date: '2026-11-05',
								title: { en: 'Day' },
								blocks: [
									{ id: 'blockaaaa1', time: '09:00', title: { en: 'Museum' } },
									{
										id: 'blockbbbb2',
										time: '12:00',
										title: { en: 'Lunch' },
										guide: { why: { en: 'Old guide' } }
									}
								]
							}
						]
					}
				]
			}
		]
	} as unknown as TripDoc;
}

const GUIDE = {
	why: { en: 'It matters.' },
	dontMiss: [{ name: { en: 'Dome' }, text: { en: 'Look up.' }, image: { file: 'Dome.jpg', license: 'CC BY 2.0' } }]
};

function blocks(doc: TripDoc) {
	return doc.segments[0].plans[0].days[0].blocks as unknown as Record<string, unknown>[];
}

describe('applyStopGuides', () => {
	it('sets and removes guides by block id without touching the input doc', () => {
		const doc = sampleDoc('t1');
		const res = applyStopGuides(doc, { blockaaaa1: GUIDE, blockbbbb2: null });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(blocks(res.doc)[0].guide).toEqual(GUIDE);
		expect('guide' in blocks(res.doc)[1]).toBe(false);
		expect(blocks(doc)[0].guide).toBeUndefined();
		expect(blocks(doc)[1].guide).toEqual({ why: { en: 'Old guide' } });
	});

	it('applies nothing when an id is unknown or a value is not an object', () => {
		const res = applyStopGuides(sampleDoc('t2'), {
			blockaaaa1: GUIDE,
			nosuchblock: GUIDE,
			blockbbbb2: 'text' as never
		});
		expect(res).toEqual({ ok: false, missing: ['nosuchblock'], invalid: ['blockbbbb2'] });
	});
});

async function approvedToken(email: string) {
	const user = await upsertGoogleUser(env.DB, { sub: 'google-sub-' + email, email, name: 'Guide User' }, undefined);
	await setUserStatus(env.DB, user.id, 'approved');
	const client = await registerClient(env.DB, {
		client_name: 'Guide Client',
		redirect_uris: ['http://localhost/callback']
	});
	if (!client.ok || !client.client) throw new Error('client registration failed in test setup');
	const tokens = await issueTokenPair(env.DB, { clientId: client.client.client_id, userId: user.id, scope: 'trips' });
	return { user, accessToken: tokens.accessToken };
}

async function callTool(accessToken: string, name: string, args: Record<string, unknown>) {
	const platform = { env: { DB: env.DB } } as unknown as App.Platform;
	const request = new Request('https://example.com/mcp', {
		method: 'POST',
		headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
		body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
	});
	const res = await POST({ request, platform, url: new URL(request.url) } as never);
	const body = (await res.json()) as { result: { content: { text: string }[]; isError?: boolean } };
	return { isError: body.result.isError === true, text: body.result.content[0].text };
}

describe('POST /mcp — set_stop_guides', () => {
	it('writes guides into the stored trip and returns the new updatedAt', async () => {
		const { user, accessToken } = await approvedToken('guides-ok@example.com');
		const created = await createTrip(env.DB, user.id, sampleDoc('guide-ok-trip'), 'guide-ok-trip');
		expect(created.ok).toBe(true);

		const out = await callTool(accessToken, 'set_stop_guides', {
			trip_id: 'guide-ok-trip',
			guides: { blockaaaa1: GUIDE }
		});
		expect(out.isError).toBe(false);
		const parsed = JSON.parse(out.text) as { ok: boolean; updatedAt: string; updated: string[] };
		expect(parsed.updated).toEqual(['blockaaaa1']);

		const stored = await getTripForUser(env.DB, user.id, 'guide-ok-trip');
		expect(blocks(stored!.doc)[0].guide).toEqual(GUIDE);
		expect(blocks(stored!.doc)[1].guide).toEqual({ why: { en: 'Old guide' } });
		expect(stored!.updatedAt).toBe(parsed.updatedAt);
	});

	it('writes nothing for an unknown block id, an invalid guide, or a stale base_updated_at', async () => {
		const { user, accessToken } = await approvedToken('guides-bad@example.com');
		await createTrip(env.DB, user.id, sampleDoc('guide-bad-trip'), 'guide-bad-trip');
		const before = await getTripForUser(env.DB, user.id, 'guide-bad-trip');

		const unknown = await callTool(accessToken, 'set_stop_guides', {
			trip_id: 'guide-bad-trip',
			guides: { blockaaaa1: GUIDE, nosuchblock: GUIDE }
		});
		expect(unknown.isError).toBe(true);
		expect(unknown.text).toContain('nosuchblock');

		const invalid = await callTool(accessToken, 'set_stop_guides', {
			trip_id: 'guide-bad-trip',
			guides: { blockaaaa1: { why: { en: 'ok' }, notAField: true } }
		});
		expect(invalid.isError).toBe(true);
		expect(invalid.text).toContain('failed validation');

		const stale = await callTool(accessToken, 'set_stop_guides', {
			trip_id: 'guide-bad-trip',
			guides: { blockaaaa1: GUIDE },
			base_updated_at: '2000-01-01T00:00:00.000Z'
		});
		expect(stale.isError).toBe(true);
		expect(stale.text).toContain('Conflict');

		const after = await getTripForUser(env.DB, user.id, 'guide-bad-trip');
		expect(after!.updatedAt).toBe(before!.updatedAt);
		expect(blocks(after!.doc)[0].guide).toBeUndefined();
	});

	it('refuses a user without access to the trip', async () => {
		const owner = await approvedToken('guides-owner@example.com');
		await createTrip(env.DB, owner.user.id, sampleDoc('guide-private-trip'), 'guide-private-trip');
		const stranger = await approvedToken('guides-stranger@example.com');
		const out = await callTool(stranger.accessToken, 'set_stop_guides', {
			trip_id: 'guide-private-trip',
			guides: { blockaaaa1: GUIDE }
		});
		expect(out.isError).toBe(true);
		expect(out.text).toContain('No trip');
	});
});
