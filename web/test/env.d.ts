// Extends the wrangler-generated Cloudflare.Env (worker-configuration.d.ts,
// which already declares DB/PHOTOS/ASSETS) with the test-only migrations
// binding wired up in vitest.config.ts.
declare namespace Cloudflare {
	interface Env {
		TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
	}
}
