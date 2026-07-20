// Reactive online/offline signal for Svelte 5 runes.
//
// `navigator.onLine` is a one-shot read — fine for the single check
// +layout.svelte does on mount to retrigger service-worker cache warming, but
// not for UI that needs to react live to connectivity changes (e.g.
// TripView's offline-stale-weather hint, Phase 6 item 5). This is a minimal
// wrapper, not a general network-status library: one module-level $state,
// kept in sync via the browser's `online`/`offline` events.
//
// SSR guard follows the same `typeof window === 'undefined'` convention as
// lib/now.ts (rather than importing $app/environment's `browser`), so this
// module has zero side effects when evaluated on the server.
let online = $state(typeof window === 'undefined' ? true : navigator.onLine);

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => (online = true));
	window.addEventListener('offline', () => (online = false));
}

/** Whether the browser currently reports a network connection (reactive). */
export function isOnline(): boolean {
	return online;
}
