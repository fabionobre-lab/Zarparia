// zarparia-U4-04 Stage 1, round 2: the autosave core with a fake network.
// The core is plain TypeScript (the Svelte wrapper only mirrors its state), so
// the Workers test pool can run it. The page wiring (beforeNavigate, listeners)
// still has no automatic test: the live check covers it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosaveCore } from '../src/lib/trip/autosaveCore';
import { PUT_TIMEOUT_MS, hasUnsavedEdits } from '../src/lib/trip/saveGuards';
import type { Trip } from '../src/lib/trip-engine';

function makeTrip(title = 'Test Trip'): Trip {
	return {
		id: 'test-trip',
		title: { en: title },
		languages: ['en'],
		defaultLanguage: 'en',
		segments: [
			{
				id: 'seg',
				title: { en: 'Segment' },
				plans: [
					{
						id: 'main',
						days: [
							{
								date: '2026-01-01',
								title: { en: 'Day 1' },
								blocks: [{ time: '09:00', title: { en: 'Block' } }]
							}
						]
					}
				]
			}
		]
	} as unknown as Trip;
}

type Call = { url: string; init?: RequestInit };
const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function setup(handler: (call: Call, n: number) => Promise<Response>, trip = makeTrip()) {
	const calls: Call[] = [];
	const core = createAutosaveCore('test-trip', () => trip, 'U0', {
		fetch: (url, init) => {
			const call = { url, init };
			calls.push(call);
			return handler(call, calls.length);
		},
		snapshot: (v) => structuredClone(v)
	});
	return { core, calls, trip };
}

const puts = (calls: Call[]) => calls.filter((c) => c.init?.method === 'PUT');
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

describe('autosave core', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('saves, adopts the new baseline and sends it on the next save', async () => {
		const { core, calls, trip } = setup(async (_c, n) => json({ updatedAt: `U${n}` }));
		core.schedule(0);
		await tick();
		expect(core.status).toBe('saved');
		trip.title = { en: 'Changed' };
		core.schedule(0);
		await tick();
		const second = puts(calls)[1].init!.headers as Record<string, string>;
		expect(second['x-base-updated-at']).toBe('U1');
		core.dispose();
	});

	it('gives each PUT a time limit and ends a hung save as error', async () => {
		const { core, calls } = setup(
			(call) =>
				new Promise((_resolve, reject) => {
					call.init!.signal!.addEventListener('abort', () => reject(new Error('aborted')));
				})
		);
		core.schedule(0);
		await tick();
		expect(core.status).toBe('saving');
		await tick(PUT_TIMEOUT_MS - 1);
		expect(core.status).toBe('saving');
		await tick(1);
		expect(core.status).toBe('error');
		expect(calls[0].init!.signal).toBeInstanceOf(AbortSignal);
		core.dispose();
	});

	describe('settled()', () => {
		it('resolves at once when nothing is pending', async () => {
			const { core } = setup(async () => json({}));
			await expect(core.settled()).resolves.toBe('clean');
		});

		it('waits for a flushed save and resolves with the result', async () => {
			let release!: (r: Response) => void;
			const { core } = setup(() => new Promise((r) => (release = r)));
			core.schedule();
			core.flush();
			const p = core.settled();
			let done = false;
			void p.then(() => (done = true));
			await tick();
			expect(done).toBe(false);
			release(json({ updatedAt: 'U1' }));
			await expect(p).resolves.toBe('saved');
			core.dispose();
		});

		it('resolves with error when the save fails', async () => {
			const { core } = setup(async () => {
				throw new TypeError('network');
			});
			core.schedule();
			core.flush();
			await expect(core.settled()).resolves.toBe('error');
			core.dispose();
		});

		it('does not resolve while an edit made during the save is still to be sent', async () => {
			const releases: ((r: Response) => void)[] = [];
			const { core, trip } = setup(() => new Promise((r) => releases.push(r)));
			core.schedule(0);
			await tick();
			trip.title = { en: 'Edited while saving' };
			core.schedule(0);
			await tick(); // timer fires while the first PUT is in flight: rerun is set
			const p = core.settled();
			let result: string | null = null;
			void p.then((s) => (result = s));
			releases[0](json({ updatedAt: 'U1' }));
			await tick();
			expect(result).toBeNull(); // the second PUT has not finished
			await tick();
			releases[1](json({ updatedAt: 'U2' }));
			await expect(p).resolves.toBe('saved');
			expect(releases).toHaveLength(2);
			core.dispose();
		});
	});

	describe('dispose', () => {
		it('stops a disposed instance: no status change, no unsaved flag, no new timer', async () => {
			let fail!: () => void;
			const { core, calls } = setup(
				() => new Promise((_r, reject) => (fail = () => reject(new TypeError('network'))))
			);
			core.schedule(0);
			await tick();
			expect(hasUnsavedEdits()).toBe(true);
			core.dispose();
			expect(hasUnsavedEdits()).toBe(false);
			fail();
			await tick(60_000);
			expect(core.status).toBe('saving'); // frozen at dispose
			expect(hasUnsavedEdits()).toBe(false);
			core.schedule(0);
			await tick(60_000);
			expect(calls).toHaveLength(1);
		});

		it('does not touch the draft with ids from a response that arrives after dispose', async () => {
			let release!: (r: Response) => void;
			const { core, trip } = setup(() => new Promise((r) => (release = r)));
			core.schedule(0);
			await tick();
			core.dispose();
			const withIds = makeTrip();
			(withIds.segments[0].plans[0].days[0] as { id?: string }).id = 'minted';
			release(json({ updatedAt: 'U1', doc: withIds }));
			await tick();
			expect((trip.segments[0].plans[0].days[0] as { id?: string }).id).toBeUndefined();
		});

		it('resolves waiters when disposed', async () => {
			const { core } = setup(() => new Promise(() => {}));
			core.schedule(0);
			await tick();
			const p = core.settled();
			core.dispose();
			await expect(p).resolves.toBe('saving');
		});
	});

	describe('409 after a lost response', () => {
		function lostThenConflict(getDoc: (sentBodies: string[]) => unknown, edit?: (t: Trip) => void) {
			const sent: string[] = [];
			const { core, calls, trip } = setup(async (call, n) => {
				if (call.init?.method === 'PUT') {
					sent.push(call.init.body as string);
					if (n === 1) throw new TypeError('response lost');
					if (n === 2) return json({ error: 'changed' }, 409);
					return json({ updatedAt: 'U3' });
				}
				return json({ doc: getDoc(sent), updatedAt: 'U2' });
			});
			return { core, calls, trip, sent, edit };
		}

		it('adopts the stored doc when it equals the retried body', async () => {
			const t = lostThenConflict((sent) => JSON.parse(sent[0]));
			t.core.schedule(0);
			await tick();
			expect(t.core.status).toBe('error');
			t.core.retry();
			await tick();
			expect(t.core.status).toBe('saved');
			expect(puts(t.calls)).toHaveLength(2);
			t.core.dispose();
		});

		it('adopts the baseline and re-sends newer edits when the lost PUT had landed', async () => {
			const t = lostThenConflict((sent) => JSON.parse(sent[0]));
			t.core.schedule(0);
			await tick();
			t.trip.title = { en: 'Newer edit' };
			t.core.retry();
			await tick(); // PUT2 -> 409 -> GET -> lost -> rerun is scheduled
			await tick(10); // the rerun timer fires: PUT3
			expect(t.core.status).toBe('saved');
			const third = puts(t.calls)[2];
			expect((third.init!.headers as Record<string, string>)['x-base-updated-at']).toBe('U2');
			expect(JSON.parse(third.init!.body as string).title.en).toBe('Newer edit');
			t.core.dispose();
		});

		it('reports a conflict when the stored doc matches neither body', async () => {
			const t = lostThenConflict(() => ({ ...makeTrip('Someone else wrote this') }));
			t.core.schedule(0);
			await tick();
			t.core.retry();
			await tick();
			expect(t.core.status).toBe('conflict');
			t.core.dispose();
		});

		it('reports a conflict on a 409 when no earlier PUT was lost', async () => {
			const { core, calls } = setup(async () => json({ error: 'changed' }, 409));
			core.schedule(0);
			await tick();
			expect(core.status).toBe('conflict');
			expect(calls.filter((c) => !c.init?.method || c.init.method === 'GET')).toHaveLength(0);
			core.dispose();
		});
	});
});
