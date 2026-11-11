// zarparia-U4-04 Stage 1: the pure guards behind the honest offline-save UI.
// Plain TypeScript only. The Workers test pool has no Svelte plugin, so the
// rune-based autosave module and the page listeners cannot be imported here.
// Those parts are covered by the live check, not by this file.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	chipKey,
	clearUnsaved,
	createReconnectRetry,
	hasUnsavedEdits,
	isUnsaved,
	markUnsaved,
	retryDelays,
	sameDocIgnoringIds,
	shouldRetryOnReconnect,
	type SaveStatus
} from '../src/lib/trip/saveGuards';

const ALL: SaveStatus[] = ['clean', 'pending', 'saving', 'saved', 'invalid', 'error', 'conflict'];

describe('isUnsaved', () => {
	it('is true only for pending, saving, error and invalid', () => {
		const unsaved = ALL.filter(isUnsaved).sort();
		expect(unsaved).toEqual(['error', 'invalid', 'pending', 'saving']);
	});
});

describe('shouldRetryOnReconnect', () => {
	it('is true only for error', () => {
		expect(ALL.filter(shouldRetryOnReconnect)).toEqual(['error']);
	});
});

describe('chipKey', () => {
	it('shows the offline chip for error while offline', () => {
		expect(chipKey('error', false)).toBe('save.offline');
	});
	it('keeps "Not saved" for error while the browser reports online', () => {
		expect(chipKey('error', true)).toBe('save.error');
	});
	it('has no chip for clean and a key for every other status', () => {
		expect(chipKey('clean', true)).toBeNull();
		for (const s of ALL.filter((x) => x !== 'clean' && x !== 'error')) {
			expect(chipKey(s, true)).toBe(`save.${s}`);
		}
	});
});

describe('retryDelays', () => {
	it('is short and ends (no unbounded retry)', () => {
		expect(retryDelays.length).toBeLessThanOrEqual(3);
		expect(retryDelays[0]).toBe(0);
		expect(Math.max(...retryDelays)).toBeLessThanOrEqual(15000);
	});
});

describe('createReconnectRetry', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('retries at most once per delay while the save keeps failing', () => {
		const a = { status: 'error' as SaveStatus, retry: vi.fn() };
		const r = createReconnectRetry(() => a);
		r.trigger();
		r.trigger(); // a second signal during the run adds nothing
		vi.advanceTimersByTime(60_000);
		expect(a.retry).toHaveBeenCalledTimes(retryDelays.length);
		vi.advanceTimersByTime(600_000);
		expect(a.retry).toHaveBeenCalledTimes(retryDelays.length);
	});

	it('does nothing unless the status is error', () => {
		for (const s of ALL.filter((x) => x !== 'error')) {
			const a = { status: s, retry: vi.fn() };
			createReconnectRetry(() => a).trigger();
			vi.advanceTimersByTime(60_000);
			expect(a.retry).not.toHaveBeenCalled();
		}
	});

	it('stops as soon as the save succeeds', () => {
		const a = { status: 'error' as SaveStatus, retry: vi.fn(() => (a.status = 'saved')) };
		createReconnectRetry(() => a).trigger();
		vi.advanceTimersByTime(60_000);
		expect(a.retry).toHaveBeenCalledTimes(1);
	});

	it('skips a step while a save is under way, then retries if it failed', () => {
		const a = { status: 'error' as SaveStatus, retry: vi.fn(() => (a.status = 'saving')) };
		createReconnectRetry(() => a).trigger();
		vi.advanceTimersByTime(0);
		expect(a.retry).toHaveBeenCalledTimes(1);
		a.status = 'error'; // that attempt failed before the next step
		vi.advanceTimersByTime(3000);
		expect(a.retry).toHaveBeenCalledTimes(2);
	});

	it('reads the current object, and cancel() stops pending steps', () => {
		let a = { status: 'error' as SaveStatus, retry: vi.fn() };
		const r = createReconnectRetry(() => a);
		r.trigger();
		vi.advanceTimersByTime(0);
		const b = { status: 'error' as SaveStatus, retry: vi.fn() };
		a = b; // the page replaced its autosave
		vi.advanceTimersByTime(3000);
		expect(b.retry).toHaveBeenCalledTimes(1);
		r.cancel();
		vi.advanceTimersByTime(60_000);
		expect(b.retry).toHaveBeenCalledTimes(1);
	});
});

describe('unsaved flag', () => {
	it('is set while any instance is unsaved and cleared on save or dispose', () => {
		const t1 = {};
		const t2 = {};
		expect(hasUnsavedEdits()).toBe(false);
		markUnsaved(t1, 'error');
		markUnsaved(t2, 'saving');
		expect(hasUnsavedEdits()).toBe(true);
		markUnsaved(t1, 'saved');
		expect(hasUnsavedEdits()).toBe(true);
		clearUnsaved(t2);
		expect(hasUnsavedEdits()).toBe(false);
	});
});

describe('sameDocIgnoringIds', () => {
	const sent = JSON.stringify({ id: 't', title: 'A', days: [{ n: 1, blocks: [{ x: 1 }] }] });
	it('matches a server doc that only differs by minted ids', () => {
		const server = { id: 't', title: 'A', days: [{ id: 'd1', n: 1, blocks: [{ id: 'b1', x: 1 }] }] };
		expect(sameDocIgnoringIds(server, sent)).toBe(true);
	});
	it('does not match when content differs', () => {
		const server = { id: 't', title: 'B', days: [{ n: 1, blocks: [{ x: 1 }] }] };
		expect(sameDocIgnoringIds(server, sent)).toBe(false);
	});
	it('returns false for a body that is not JSON', () => {
		expect(sameDocIgnoringIds({}, 'not json')).toBe(false);
	});
});
