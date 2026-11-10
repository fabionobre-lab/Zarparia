// Plain-TypeScript helpers for the trip autosave guards. No Svelte runes live
// here on purpose: the test pool (Workers runtime, no Svelte plugin) can import
// this file, but it cannot compile a `.svelte.ts` module.

export type SaveStatus =
	/** No edits since the last successful save (or since load). */
	| 'clean'
	/** Edited; a save is scheduled but hasn't fired. */
	| 'pending'
	| 'saving'
	| 'saved'
	/** The draft doesn't satisfy the trip schema — nothing was sent. */
	| 'invalid'
	/** Network/server failure; retryable. */
	| 'error'
	/** Someone else wrote to this trip; writing is halted until reload. */
	| 'conflict';

export type SaveChipKey =
	| 'save.pending'
	| 'save.saving'
	| 'save.saved'
	| 'save.invalid'
	| 'save.error'
	| 'save.conflict'
	| 'save.offline';

/**
 * True while the draft holds edits that the server does not have. `error` and
 * `invalid` count: both keep the edits in page memory only. `conflict` does not,
 * because the page already tells the user to copy their text and reload.
 */
export function isUnsaved(status: SaveStatus): boolean {
	return status === 'pending' || status === 'saving' || status === 'error' || status === 'invalid';
}

/** Chip text key for a status, or null when no chip is shown. */
export function chipKey(status: SaveStatus, online: boolean): SaveChipKey | null {
	switch (status) {
		case 'clean':
			return null;
		case 'error':
			// `online` false is reliable. `true` is not, so this never claims online.
			return online ? 'save.error' : 'save.offline';
		default:
			return `save.${status}` as SaveChipKey;
	}
}

/** Delays (ms after the reconnect signal) of the bounded retry. The list ends: no loop. */
export const retryDelays: readonly number[] = [0, 3000, 15000];

/** Time limit for one save request. A hung request then ends as `error`, with Retry. */
export const PUT_TIMEOUT_MS = 15000;

/** Only a network or server error is worth an automatic retry. */
export function shouldRetryOnReconnect(status: SaveStatus): boolean {
	return status === 'error';
}

/**
 * Bounded retry after the browser reports a connection. At each step it reads
 * the CURRENT status through `get()`, so a replaced autosave object is handled.
 * - `error`: call `retry()`.
 * - `pending` or `saving`: a save is under way. Skip this step, try the next.
 * - any other status: stop.
 * There is no reactive effect here. A device that reports online while the PUT
 * keeps failing therefore makes at most `delays.length` attempts per signal.
 */
export function createReconnectRetry(
	get: () => { status: SaveStatus; retry: () => void },
	delays: readonly number[] = retryDelays
) {
	let timers: ReturnType<typeof setTimeout>[] = [];
	function cancel(): void {
		timers.forEach(clearTimeout);
		timers = [];
	}
	function trigger(): void {
		if (timers.length) return; // a run is already in progress
		if (!shouldRetryOnReconnect(get().status)) return;
		delays.forEach((ms, i) => {
			timers.push(
				setTimeout(() => {
					const a = get();
					if (a.status === 'error') a.retry();
					else if (a.status !== 'pending' && a.status !== 'saving') cancel();
					if (i === delays.length - 1) timers = [];
				}, ms)
			);
		});
	}
	return { trigger, cancel };
}

// ── Unsaved-edits flag for code outside the trip page (service-worker reload) ──
const unsavedTokens = new Set<object>();

/** Record, for one autosave instance, whether it holds unsaved edits. */
export function markUnsaved(token: object, status: SaveStatus): void {
	if (isUnsaved(status)) unsavedTokens.add(token);
	else unsavedTokens.delete(token);
}

/** Forget an autosave instance (page replaced it or was destroyed). */
export function clearUnsaved(token: object): void {
	unsavedTokens.delete(token);
}

/** True while any trip page holds unsaved edits. */
export function hasUnsavedEdits(): boolean {
	return unsavedTokens.size > 0;
}

// ── Lost-response check ──
function stripIds(v: unknown): unknown {
	if (Array.isArray(v)) return v.map(stripIds);
	if (v && typeof v === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
			if (k === 'id') continue;
			out[k] = stripIds(val);
		}
		return out;
	}
	return v;
}

/**
 * Whether the stored trip equals what this page last sent, ignoring `id`
 * fields (the server mints day and block ids). Used after a 409 that follows a
 * network error: a PUT can commit while its response is lost.
 */
export function sameDocIgnoringIds(serverDoc: unknown, sentBody: string): boolean {
	try {
		return JSON.stringify(stripIds(serverDoc)) === JSON.stringify(stripIds(JSON.parse(sentBody)));
	} catch {
		return false;
	}
}
