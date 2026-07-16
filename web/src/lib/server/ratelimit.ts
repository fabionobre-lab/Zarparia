// Phase 5.2: app-level rate limiting for public/hot surfaces.
//
// Why D1-backed fixed-window counters instead of the native Workers Rate
// Limiting binding:
//  - The native binding is configured via `unsafe.bindings[].type=ratelimit`
//    in wrangler config — an explicitly "unsafe" (non-stable) binding type,
//    absent from Cloudflare's main wrangler configuration reference docs.
//  - Free-plan availability is undocumented (Cloudflare's pricing page and
//    the binding's own docs are both silent on plan restrictions) — too
//    risky to anchor a launch-blocking abuse control on undocumented plan
//    behavior.
//  - Cloudflare's own docs describe it as "eventually consistent...
//    intentionally designed to not be used as an accurate accounting
//    system," with counters "local to the Cloudflare location that your
//    Worker runs in" — not deterministic enough for a hard per-user daily
//    cap.
//  - Critically, there is no documented way to exercise it under
//    @cloudflare/vitest-pool-workers/Miniflare, which this repo's entire
//    test suite depends on. A D1-backed counter reuses the exact same DB
//    binding and test harness already used for every other server module
//    (real D1 via Miniflare — see test/apply-migrations.ts) — deterministic,
//    zero new test infra, and testable exactly like guards.ts.
//
// Design: one row per (scope, surface) key in the `rate_limits` table
// (migrations/0008_rate_limits.sql). Fixed window: the current window is
// `now` floored to `windowSeconds`. A single atomic UPSERT does the
// read-modify-write in one round trip — same window means "add cost to the
// existing count," a stale window means "reset to cost." This trades a
// little precision at window boundaries (a burst can span two windows) for
// simplicity and zero extra infra; that's an acceptable trade for an abuse
// control, not a billing meter.
//
// Fails open: any D1 error is logged and treated as "allowed." Availability
// of the app matters more than strict enforcement of the limit.

export interface RateLimitOptions {
	max: number;
	windowSeconds: number;
	/** How many units this call consumes. Default 1. Lets a single call (e.g. a
	 *  photo-import batch) consume more than one unit of the budget. */
	cost?: number;
}

export interface RateLimitResult {
	allowed: boolean;
	/** Seconds until the caller may retry. 0 when allowed. */
	retryAfterSeconds: number;
}

/** Check-and-increment a fixed-window counter for `key`. Fails open on any
 *  D1 error (returns allowed: true) — see module header for rationale. */
export async function limit(db: D1Database, key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
	const cost = opts.cost ?? 1;
	try {
		const nowSec = Math.floor(Date.now() / 1000);
		const windowStart = nowSec - (nowSec % opts.windowSeconds);

		const row = await db
			.prepare(
				`INSERT INTO rate_limits (key, window_start, count)
				 VALUES (?, ?, ?)
				 ON CONFLICT(key) DO UPDATE SET
				   count = CASE
				     WHEN excluded.window_start = rate_limits.window_start THEN rate_limits.count + excluded.count
				     ELSE excluded.count
				   END,
				   window_start = excluded.window_start
				 RETURNING count, window_start`
			)
			.bind(key, windowStart, cost)
			.first<{ count: number; window_start: number }>();

		// Opportunistic cleanup — best-effort, never allowed to affect the result.
		// The DELETE is global (every key, every surface), so the staleness
		// threshold must be safe for the LARGEST window in use across the app
		// (currently 86400s for the photo-import daily cap), not this call's own
		// windowSeconds. Basing it on the caller's window was a real bug: a
		// frequent 60s-window hit (e.g. /oauth/token) could run cleanup with a
		// ~600s threshold and delete a same-day, still-live 86400s counter row,
		// silently resetting the daily cap to 0 multiple times a day. Use a
		// fixed constant well beyond the largest window instead.
		const CLEANUP_STALE_SECONDS = 2 * 86400; // 2 days — safely beyond the largest window (86400s) in use
		if (Math.random() < 0.01) {
			// Awaited (not fire-and-forget): it's only ~1% of calls, the extra
			// round trip is negligible on average, and awaiting makes cleanup
			// deterministically testable instead of racing the response.
			try {
				const staleBefore = nowSec - CLEANUP_STALE_SECONDS;
				await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(staleBefore).run();
			} catch (cleanupError) {
				console.error('rate limit cleanup failed', cleanupError);
			}
		}

		if (!row) {
			console.error('rate limit check failed', new Error('UPSERT returned no row'));
			return { allowed: true, retryAfterSeconds: 0 };
		}

		const allowed = row.count <= opts.max;
		const retryAfterSeconds = allowed ? 0 : Math.max(1, windowStart + opts.windowSeconds - nowSec);
		return { allowed, retryAfterSeconds };
	} catch (error) {
		console.error('rate limit check failed', error);
		return { allowed: true, retryAfterSeconds: 0 };
	}
}

/** cf-connecting-ip only — never trust x-forwarded-for on Workers
 *  (spoofable/absent). Falls back to 'unknown' rather than throwing, so a
 *  missing header degrades to one shared bucket instead of breaking the
 *  request. */
export function clientIp(request: Request): string {
	return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

export function ipKey(ip: string, surface: string): string {
	return `ip:${ip}:${surface}`;
}

export function userKey(userId: string, surface: string): string {
	return `user:${userId}:${surface}`;
}

/** Standard 429 response for a denied check outside the JSON-RPC (/mcp) path. */
export function tooManyRequests(result: RateLimitResult, message = 'Too many requests. Please slow down.'): Response {
	return new Response(message, { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } });
}
