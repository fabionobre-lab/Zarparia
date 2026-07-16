/**
 * Phase 5.4 — client-side error monitoring, DORMANT scaffold.
 *
 * The proven pattern (♻️ sibling app): build the scrubber before the DSN exists,
 * so PII can never leak — there is no window where the SDK ships events
 * without this filter already wired in. `initSentryIfConfigured()` is a
 * complete no-op (no import, no network, no bundle weight beyond this tiny
 * module) until `PUBLIC_SENTRY_DSN` is set in the deployment's environment.
 *
 * Package choice: @sentry/browser, not @sentry/sveltekit. @sentry/sveltekit
 * adds server-side request instrumentation and a build-time source-map-
 * upload Vite plugin — neither wanted here (Cloudflare observability already
 * covers the Worker; LAUNCH_PLAN.md 5.4 says "wire nothing server-side"),
 * and the build plugin is one more thing that could fight the Workers build.
 * @sentry/browser is the plain client SDK: init() + beforeSend, nothing else,
 * dynamically imported so it never touches the entry bundle.
 *
 * Wiring: call `initSentryIfConfigured(dsn)` from the root layout's onMount,
 * on idle/post-first-paint (see +layout.svelte) — never on the critical path.
 *
 * The DSN is passed in rather than read from `$env/dynamic/public` here,
 * deliberately: this file is imported directly by vitest under
 * @cloudflare/vitest-pool-workers (see test/sentry-scrub.test.ts), which runs
 * outside SvelteKit's own Vite plugin and can't resolve `$env/*` virtual
 * modules — the same reason userCacheReset.ts takes `caches`/`storage` as
 * params instead of reading `window.caches`/`localStorage` itself. Keeping
 * SvelteKit-environment access in the .svelte file and framework-agnostic
 * logic here is the established split in this codebase.
 */
// ErrorEvent, not the broader Event: Sentry's `beforeSend` option is typed
// specifically as (event: ErrorEvent, hint: EventHint) => ... — the general
// Event type also covers transaction/profile/replay events with a narrower
// `type` field that beforeSend's signature doesn't accept.
import type { Breadcrumb, ErrorEvent as SentryEvent, EventHint } from '@sentry/browser';

/** Paths that carry trip/photo/account/feedback content — the parts of this
 *  app where a URL or breadcrumb message could carry a user's travel data,
 *  as opposed to generic chrome (auth, static assets, health checks). */
const CONTENT_PATH_PATTERN = /\/(api\/)?(trips|photos|account|feedback)(\/|$|\?)/i;

/** Breadcrumb categories whose payload routinely carries a request/response
 *  body or logged arguments — exactly where trip content would leak through
 *  if `data` weren't already being dropped unconditionally below. Belt and
 *  braces: also drop `message` for these categories. */
const RISKY_BREADCRUMB_CATEGORIES = new Set(['xhr', 'fetch', 'console', 'ui.input']);

/** Keep the path, drop everything after `?` — query strings on this app's
 *  routes can carry share tokens, OAuth codes/state, and search terms. */
function stripQueryString(url: string | undefined): string | undefined {
	if (!url) return url;
	const qIndex = url.indexOf('?');
	return qIndex === -1 ? url : url.slice(0, qIndex);
}

/** `data` is where fetch/xhr breadcrumbs carry request/response bodies and
 *  full URLs (incl. query strings), and where console breadcrumbs carry
 *  logged arguments — trip content routinely ends up here. Drop it
 *  unconditionally, for every breadcrumb, regardless of category. */
function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
	const scrubbed: Breadcrumb = {
		type: breadcrumb.type,
		level: breadcrumb.level,
		category: breadcrumb.category,
		timestamp: breadcrumb.timestamp
		// data intentionally omitted — see doc comment above.
	};
	if (breadcrumb.message) {
		const risky =
			RISKY_BREADCRUMB_CATEGORIES.has(breadcrumb.category ?? '') ||
			CONTENT_PATH_PATTERN.test(breadcrumb.message);
		if (!risky) scrubbed.message = stripQueryString(breadcrumb.message);
	}
	return scrubbed;
}

/**
 * `beforeSend` hook: the last checkpoint before an event leaves the browser.
 * A pure function (event/hint in, event/null out) — unit-testable without a
 * live Sentry SDK, a DSN, or a network call.
 *
 * Strips:
 *  - request/response bodies (`request.data`) and anything else on
 *    `request` besides a query-string-free `url` (drops cookies/headers too
 *    — a future SDK field we haven't audited defaults to gone, not kept)
 *  - breadcrumbs that touch trip/photo/account/feedback content, or whose
 *    category routinely carries a request/response/console payload
 *  - the user object down to a bare id — no email/username/ip_address/geo
 *  - `extra` and `contexts.state` — the general-purpose grab bags a future
 *    integration could use to attach localStorage-derived data
 * Keeps: exception type/message/stack (`event.exception`), breadcrumb
 * category/level/type/timestamp, tags, release/environment metadata.
 */
export function scrubSentryEvent(event: SentryEvent, _hint?: EventHint): SentryEvent | null {
	const scrubbed: SentryEvent = { ...event };

	if (scrubbed.request) {
		scrubbed.request = { url: stripQueryString(scrubbed.request.url) };
	}

	if (scrubbed.breadcrumbs) {
		scrubbed.breadcrumbs = scrubbed.breadcrumbs.map(scrubBreadcrumb);
	}

	if (scrubbed.user) {
		scrubbed.user = scrubbed.user.id !== undefined ? { id: scrubbed.user.id } : undefined;
	}

	delete scrubbed.extra;

	if (scrubbed.contexts && 'state' in scrubbed.contexts) {
		const contexts = { ...scrubbed.contexts };
		delete contexts.state;
		scrubbed.contexts = contexts;
	}

	return scrubbed;
}

let initPromise: Promise<void> | null = null;

/**
 * Lazily loads and initializes @sentry/browser — ONLY when a truthy `dsn` is
 * passed (the caller reads `PUBLIC_SENTRY_DSN` from `$env/dynamic/public`;
 * see +layout.svelte). Dormant (resolves immediately, no import, no network)
 * when `dsn` is falsy. Safe to call more than once; the SDK is loaded and
 * initialized at most once per page load.
 */
export function initSentryIfConfigured(dsn: string | undefined): Promise<void> {
	if (initPromise) return initPromise;

	if (!dsn) {
		initPromise = Promise.resolve();
		return initPromise;
	}

	initPromise = import('@sentry/browser')
		.then((Sentry) => {
			Sentry.init({
				dsn,
				// This app never opts into Sentry's default PII collection (IP,
				// cookies, etc.) — the scrubber is the backstop, this is the
				// front door being closed too.
				sendDefaultPii: false,
				beforeSend: scrubSentryEvent
			});
		})
		.catch((err) => {
			// Monitoring must never break the app it's monitoring.
			console.error('Sentry init failed', err);
		});
	return initPromise;
}
