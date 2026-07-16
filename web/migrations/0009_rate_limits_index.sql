-- Phase 5.2 follow-up: index the column the opportunistic cleanup filters on.
-- rate_limits only has PRIMARY KEY(key) (see 0008_rate_limits.sql), so the
-- `DELETE FROM rate_limits WHERE window_start < ?` sweep in
-- src/lib/server/ratelimit.ts (runs on ~1% of rate-limited calls) was doing a
-- full table scan to find stale rows. As the table grows (many keys across
-- ip/user x surface), that scan gets more expensive on every triggering call.
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);
