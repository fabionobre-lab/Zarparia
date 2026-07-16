import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { limit, clientIp, ipKey, tooManyRequests } from '$lib/server/ratelimit';

// Phase 5.5 — public health endpoint for uptime monitors (e.g. UptimeRobot).
// Deliberately unauthenticated: an external monitor has no session and
// nothing here needs one. Response is intentionally minimal — { ok: true },
// nothing beyond it: no table names, no version info, no user data.
//
// Rate-limit reasoning: limit() always performs one D1 UPSERT per call —
// whether the call ends up allowed or denied — because the counter has to be
// incremented before its new value can be compared against `max` (see
// ratelimit.ts). So the limiter is itself a D1-write cost, layered on top of
// the SELECT 1 ping below. Two things bound the damage:
//  1. The limiter check runs BEFORE the ping, so a client already over
//     budget gets a fast 429 without touching D1 a second time for the ping
//     itself — only the one counter write happens, not counter+ping.
//  2. windowSeconds does NOT change how many writes happen per call (this
//     key has exactly one row, upserted in place, regardless of window
//     size) — what actually bounds sustained per-IP write volume is
//     max/windowSeconds together. 30/60s caps a single IP at 30 counter
//     writes/min worst case (everything past the first 30 still costs one
//     write to get denied) plus up to 30 cheap SELECT 1 reads/min for the
//     allowed ones. That's trivial against D1's free-tier write allotment,
//     and far looser than any real uptime monitor's polling interval
//     (typically 1-5 min), so legitimate monitoring is never affected.
// A coarser (longer) window with the same max would lower the sustained
// writes/sec further, but 60s matches every other IP-scoped surface in this
// file's callers (oauth/token, oauth/authorize, join/[token]) and keeps the
// behaviour easy to reason about alongside them — not worth diverging for a
// GET that's already this cheap per call.
export const GET: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform);

	const rl = await limit(db, ipKey(clientIp(request), 'health'), { max: 30, windowSeconds: 60 });
	if (!rl.allowed) return tooManyRequests(rl);

	try {
		await db.prepare('SELECT 1').first();
		return json({ ok: true });
	} catch (err) {
		console.error('health check: D1 ping failed', err);
		return json({ ok: false }, { status: 503 });
	}
};
