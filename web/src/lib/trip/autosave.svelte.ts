// Svelte wrapper for the autosave core (see autosaveCore.ts for the design and
// the known limitations). It mirrors the core's status and errors into `$state`
// so the trip page re-renders, and nothing else. All save logic lives in the
// core so that plain Vitest can test it.
import type { Trip } from '$lib/trip-engine';
import { createAutosaveCore } from './autosaveCore';
import { isUnsaved, type SaveStatus } from './saveGuards';

export type { SaveStatus };

export function createAutosave(
	tripId: string,
	getTrip: () => Trip,
	initialUpdatedAt: string | undefined
) {
	let status = $state<SaveStatus>('clean');
	let errors = $state<string[]>([]);
	const core = createAutosaveCore(tripId, getTrip, initialUpdatedAt, {
		fetch: (input, init) => fetch(input, init),
		snapshot: (v) => $state.snapshot(v) as Trip,
		onChange: (s, e) => {
			status = s;
			errors = e;
		}
	});

	return {
		get status() {
			return status;
		},
		get errors() {
			return errors;
		},
		/** Work is outstanding — used to guard navigation away from the page. */
		get busy() {
			return isUnsaved(status);
		},
		schedule: core.schedule,
		flush: core.flush,
		retry: core.retry,
		cancel: core.cancel,
		dispose: core.dispose,
		settled: core.settled
	};
}

export type Autosave = ReturnType<typeof createAutosave>;
