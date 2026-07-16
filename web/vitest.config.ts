// Phase 3 test setup: real D1 (via Miniflare/workerd), not a mock — the same
// binding + migrations the Worker uses in dev/prod, so approval-gate tests
// exercise actual SQL, not an approximation of it. Test files run inside the
// Workers runtime itself (not Node), so they import server modules directly
// rather than going through SvelteKit's dev server/adapter.
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
	const migrationsPath = path.join(__dirname, 'migrations');
	const migrations = await readD1Migrations(migrationsPath);

	return {
		// SvelteKit normally resolves the `$lib` alias itself; here we're testing
		// server modules (incl. a route handler) directly under plain Vite, so it
		// needs to be declared explicitly — same target SvelteKit uses (src/lib).
		resolve: {
			alias: { $lib: path.resolve(__dirname, 'src/lib') }
		},
		plugins: [
			cloudflareTest({
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					// Test-only binding so the setup file can apply migrations before
					// each test file runs (see test/apply-migrations.ts).
					bindings: { TEST_MIGRATIONS: migrations }
				}
			})
		],
		test: {
			include: ['test/**/*.test.ts'],
			setupFiles: ['./test/apply-migrations.ts']
		}
	};
});
