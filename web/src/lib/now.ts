/**
 * Shared, testable "current time" source. All time-dependent UI (today
 * auto-focus, the timeline "now" marker, the home-page active-trip hero)
 * should read the clock through this function rather than calling
 * `new Date()` directly, so the whole deployed app can be exercised at an
 * arbitrary instant via `?now=<ISO datetime>` in the URL — e.g.
 * `?now=2026-04-12T14:30:00` — without needing to change the system clock.
 *
 * Server-side (SSR) and any non-browser context always get the real time:
 * only `window.location.search` is consulted, and only when present.
 */
export function getNow(): Date {
	if (typeof window !== 'undefined' && window.location?.search) {
		try {
			const raw = new URLSearchParams(window.location.search).get('now');
			if (raw) {
				const d = new Date(raw);
				if (!Number.isNaN(d.getTime())) return d;
			}
		} catch {
			// Malformed query string — fall through to the real clock.
		}
	}
	return new Date();
}
