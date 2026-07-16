// TRIGGER_TOKEN is a Worker secret (set via `wrangler secret put TRIGGER_TOKEN`),
// so it isn't part of the wrangler.jsonc bindings and doesn't appear in the
// `wrangler types`-generated worker-configuration.d.ts. This file is an
// ambient script (no import/export), so `interface Env` here merges with the
// generated global `interface Env` — same convention as
// web/src/lib/server/authenv.ts / admin.ts, just via declaration merging
// instead of a narrow cast, since this worker's Env is the whole surface.
interface Env {
	TRIGGER_TOKEN: string;
}
