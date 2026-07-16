-- Phase 5.2: app-level rate limiting for public/hot surfaces. The Workers FREE
-- plan is live on a workers.dev subdomain (no custom domain yet), so
-- Cloudflare's edge WAF/rate-limiting rules are unavailable (that's Phase 7) —
-- this table is the interim, app-level substitute.
--
-- Fixed-window counters, one row per (scope, surface) key — e.g.
-- 'ip:1.2.3.4:oauth-token' or 'user:<id>:feedback'. `key` embeds both WHO is
-- being limited (ip/user) and WHAT surface they're hitting, so a single table
-- serves every call site without namespace collisions. `window_start` is the
-- current fixed window (epoch seconds, floored to the window size); a window
-- rollover resets the counter rather than carrying the old count forward. See
-- src/lib/server/ratelimit.ts for the read/increment logic and the rationale
-- for choosing a D1-backed counter over the native (unsafe, undocumented on
-- free plan, untestable under Miniflare) Workers Rate Limiting binding.
CREATE TABLE rate_limits (
	key TEXT PRIMARY KEY,           -- e.g. 'ip:1.2.3.4:oauth-token' or 'user:<id>:feedback'
	window_start INTEGER NOT NULL,  -- epoch seconds, floored to the window size
	count INTEGER NOT NULL
);
