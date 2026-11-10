// Debounced whole-document autosave, as plain TypeScript (no Svelte runes).
//
// `autosave.svelte.ts` wraps this core and mirrors its status into `$state`.
// The core lives here so the Workers test pool, which has no Svelte plugin,
// can run it with an injected `fetch`.
//
// The API has exactly one mutation: PUT the whole trip doc, guarded by
// `x-base-updated-at` for optimistic concurrency. So every inline edit
// coalesces into one PUT ~800ms after the user stops typing, and the returned
// `updatedAt` rebases the guard for the next one.
//
// Known limitation (see the Phase 2 notes): whole-doc writes at autosave
// cadence make cross-editor conflicts likelier than the old explicit-save flow
// did. A 409 is therefore terminal here — we stop writing and surface a reload
// prompt rather than clobbering the other editor. Per-block patches are the
// real fix.
import { pruneEmpty } from '$lib/editor/factories';
import { validateTripDoc, type TripDoc } from '$lib/validateTrip';
import type { Trip } from '$lib/trip-engine';
import {
	PUT_TIMEOUT_MS,
	clearUnsaved,
	markUnsaved,
	sameDocIgnoringIds,
	type SaveStatus
} from './saveGuards';

const DEBOUNCE_MS = 800;

/**
 * Copy server-minted day/block ids back onto the live draft.
 *
 * Walked positionally against the doc we just sent, which is exactly what came
 * back — the server only adds ids, it never reorders. Only fills blanks, so an
 * id the draft already holds is never overwritten, and a structural edit made
 * while the save was in flight can at worst leave a day un-adopted until the
 * next save.
 */
function adoptEntityIds(draft: Trip, saved: Trip): void {
	saved.segments?.forEach((savedSeg, si) => {
		const seg = draft.segments?.[si];
		if (!seg) return;
		savedSeg.plans?.forEach((savedPlan, pi) => {
			const plan = seg.plans?.[pi];
			if (!plan) return;
			savedPlan.days?.forEach((savedDay, di) => {
				const day = plan.days?.[di] as { id?: string; blocks?: { id?: string }[] } | undefined;
				const src = savedDay as { id?: string; blocks?: { id?: string }[] };
				if (!day) return;
				if (!day.id && src.id) day.id = src.id;
				src.blocks?.forEach((savedBlock, bi) => {
					const block = day.blocks?.[bi];
					if (block && !block.id && savedBlock.id) block.id = savedBlock.id;
				});
			});
		});
	});
}

export interface AutosaveEnv {
	/** The `fetch` to use. Injected so tests can fake the network. */
	fetch: (input: string, init?: RequestInit) => Promise<Response>;
	/** Plain copy of the draft. The page passes `$state.snapshot`. */
	snapshot: (value: Trip) => Trip;
	/** Called after every change of status or errors. */
	onChange?: (status: SaveStatus, errors: string[]) => void;
}

export function createAutosaveCore(
	tripId: string,
	getTrip: () => Trip,
	initialUpdatedAt: string | undefined,
	env: AutosaveEnv
) {
	let status: SaveStatus = 'clean';
	let errors: string[] = [];
	let base = initialUpdatedAt;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let inFlight = false;
	// The page dropped this instance (replaced or destroyed). Nothing may run,
	// mark, or touch the page's draft after that.
	let disposed = false;
	// Identity for the module-level "unsaved edits" flag (see saveGuards.ts).
	const token = {};
	let waiters: ((s: SaveStatus) => void)[] = [];
	// Body of the last successful PUT, so an edit that leaves the document
	// unchanged doesn't cost a round trip. Container-level `input` listeners (the
	// block inspector, the settings drawer) fire for things like the place-search
	// box, which types into the UI without touching the trip.
	let lastSentBody: string | null = null;
	// An edit landed while a PUT was in flight — save again once it settles, so
	// the last keystroke is never the one that gets dropped.
	let rerun = false;
	// Body of the last PUT that failed with a network error (or hit the time
	// limit). That PUT may still have committed on the server while its response
	// was lost. If the next PUT then gets a 409, `adoptIfCommitted` tells that
	// case from a real conflict.
	let maybeLost: string | null = null;

	function setStatus(s: SaveStatus, e?: string[]): void {
		if (disposed) return;
		status = s;
		if (e) errors = e;
		markUnsaved(token, s);
		env.onChange?.(status, errors);
	}

	/** Resolve `settled()` waiters once no save is pending or running. */
	function notify(): void {
		if (status === 'pending' || status === 'saving') return;
		const w = waiters;
		waiters = [];
		w.forEach((resolve) => resolve(status));
	}

	/** After a 409: did one of our own bodies already land? If so, adopt its baseline. */
	async function adoptIfCommitted(
		current: string,
		signal: AbortSignal
	): Promise<'current' | 'lost' | null> {
		if (!maybeLost) return null;
		try {
			const res = await env.fetch(`/api/trips/${tripId}`, { signal });
			if (!res.ok || disposed) return null;
			const data = (await res.json()) as { doc?: Trip; updatedAt?: string };
			if (!data.doc || !data.updatedAt) return null;
			const which = sameDocIgnoringIds(data.doc, current)
				? 'current'
				: sameDocIgnoringIds(data.doc, maybeLost)
					? 'lost'
					: null;
			if (!which) return null;
			base = data.updatedAt;
			adoptEntityIds(getTrip(), data.doc);
			lastSentBody = which === 'current' ? current : maybeLost;
			return which;
		} catch {
			return null;
		}
	}

	async function put(): Promise<void> {
		if (disposed) return;
		if (inFlight) {
			rerun = true;
			return;
		}
		const clean = pruneEmpty(env.snapshot(getTrip())) as TripDoc | undefined;
		if (!clean) {
			setStatus('invalid', ['The trip is empty.']);
			return;
		}
		const check = validateTripDoc(clean);
		if (!check.valid) {
			// Keep the edits in the draft — the user is mid-thought (an emptied
			// required title, say). The next valid keystroke saves everything.
			setStatus('invalid', check.errors);
			return;
		}
		const body = JSON.stringify(clean);
		if (body === lastSentBody) {
			setStatus('saved');
			return;
		}
		inFlight = true;
		setStatus('saving', []);
		// A hung request (a connection that reports online but carries nothing)
		// must end as an error with Retry, not stay "Saving…" for minutes.
		const ctrl = new AbortController();
		const limit = setTimeout(() => ctrl.abort(), PUT_TIMEOUT_MS);
		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (base) headers['x-base-updated-at'] = base;
			const res = await env.fetch(`/api/trips/${tripId}`, {
				method: 'PUT',
				headers,
				body,
				signal: ctrl.signal
			});
			if (disposed) return;
			if (res.ok) {
				const data = (await res.json()) as { updatedAt?: string; doc?: Trip };
				if (disposed) return;
				if (data.updatedAt) base = data.updatedAt;
				// The server mints stable ids for any day or block lacking one
				// (lib/server/trips.ts). Adopt them, or a draft loaded before those
				// ids existed would keep sending id-less days and provoke a FRESH
				// mint on every save — breaking the photo references they exist to
				// keep stable.
				if (data.doc) adoptEntityIds(getTrip(), data.doc);
				lastSentBody = body;
				maybeLost = null;
				setStatus('saved');
			} else if (res.status === 409) {
				const adopted = await adoptIfCommitted(body, ctrl.signal);
				if (disposed) return;
				if (adopted === 'current') {
					maybeLost = null;
					setStatus('saved');
				} else if (adopted === 'lost') {
					// Our earlier PUT landed; the draft has newer edits. Send them
					// again on the new baseline.
					maybeLost = null;
					rerun = true;
				} else {
					setStatus('conflict');
					rerun = false;
				}
			} else {
				const failed = (await res.json().catch(() => ({}))) as {
					error?: string;
					details?: string[];
				};
				setStatus('error', failed.details ?? [failed.error ?? `Save failed (${res.status}).`]);
			}
		} catch {
			if (disposed) return;
			maybeLost = body;
			// No text here. The page does not render `errors` for this status, and
			// a promise like "your edits are still here" is not backed by storage.
			setStatus('error', []);
		} finally {
			clearTimeout(limit);
			inFlight = false;
			if (!disposed && rerun && status !== 'conflict') {
				rerun = false;
				schedule(0);
			}
		}
	}

	/** Run one save and tell `settled()` waiters when nothing is left to do. */
	async function run(): Promise<void> {
		try {
			await put();
		} finally {
			notify();
		}
	}

	/** Note an edit; (re)start the debounce window. */
	function schedule(delay: number = DEBOUNCE_MS): void {
		if (disposed || status === 'conflict') return; // halted until the user reloads
		setStatus('pending');
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void run();
		}, delay);
	}

	/** Save now if anything is waiting — on leaving edit mode or navigating. */
	function flush(): void {
		if (timer) {
			clearTimeout(timer);
			timer = null;
			void run();
		}
	}

	function retry(): void {
		if (status === 'conflict') return;
		schedule(0);
	}

	function cancel(): void {
		if (timer) clearTimeout(timer);
		timer = null;
	}

	/** The page drops this autosave (replaced or destroyed): stop it and clear the unsaved flag. */
	function dispose(): void {
		disposed = true;
		cancel();
		clearUnsaved(token);
		const w = waiters;
		waiters = [];
		w.forEach((resolve) => resolve(status));
	}

	/**
	 * Resolves with the status once no save is pending or running. Use it to wait
	 * for the outcome of a save that `flush()` just started.
	 */
	function settled(): Promise<SaveStatus> {
		if (status !== 'pending' && status !== 'saving') return Promise.resolve(status);
		return new Promise((resolve) => waiters.push(resolve));
	}

	return {
		get status() {
			return status;
		},
		get errors() {
			return errors;
		},
		schedule,
		flush,
		retry,
		cancel,
		dispose,
		settled
	};
}

export type AutosaveCore = ReturnType<typeof createAutosaveCore>;
