// Phase 5.2 — app-level rate limiting. Same discipline as the other test
// files: real D1 (via Miniflare), no mocks, exercise the actual SQL.
import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { limit, clientIp, ipKey, userKey, tooManyRequests } from '../src/lib/server/ratelimit';
import { POST as registerPOST } from '../src/routes/oauth/register/+server';

function platformWith(db: D1Database) {
	return { env: { DB: db } } as unknown as App.Platform;
}

describe('limit()', () => {
	it('allows requests under max and denies the one that pushes count over max', async () => {
		const key = 'test:under-over-' + crypto.randomUUID();
		const opts = { max: 3, windowSeconds: 60 };
		expect((await limit(env.DB, key, opts)).allowed).toBe(true); // count 1
		expect((await limit(env.DB, key, opts)).allowed).toBe(true); // count 2
		expect((await limit(env.DB, key, opts)).allowed).toBe(true); // count 3 == max
		const fourth = await limit(env.DB, key, opts);
		expect(fourth.allowed).toBe(false); // count 4 > max
	});

	it('resets rather than carrying the old count forward when the stored window is stale', async () => {
		const key = 'test:stale-window-' + crypto.randomUUID();
		const windowSeconds = 60;
		const nowSec = Math.floor(Date.now() / 1000);
		const staleWindowStart = nowSec - (nowSec % windowSeconds) - 10 * windowSeconds;
		// Seed a stale row already over max.
		await env.DB.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)')
			.bind(key, staleWindowStart, 999)
			.run();

		const result = await limit(env.DB, key, { max: 3, windowSeconds });
		expect(result.allowed).toBe(true);
	});

	it('retryAfterSeconds is a sane positive number when denied, and 0 when allowed', async () => {
		const key = 'test:retry-after-' + crypto.randomUUID();
		const windowSeconds = 60;
		const opts = { max: 1, windowSeconds };
		const first = await limit(env.DB, key, opts);
		expect(first.allowed).toBe(true);
		expect(first.retryAfterSeconds).toBe(0);
		const second = await limit(env.DB, key, opts);
		expect(second.allowed).toBe(false);
		expect(second.retryAfterSeconds).toBeGreaterThan(0);
		expect(second.retryAfterSeconds).toBeLessThanOrEqual(windowSeconds);
	});

	it('cost > 1 increments correctly: two calls with cost 3 and max 5 denies the second', async () => {
		const key = 'test:cost-' + crypto.randomUUID();
		const opts = { max: 5, windowSeconds: 60, cost: 3 };
		const first = await limit(env.DB, key, opts); // count 3
		expect(first.allowed).toBe(true);
		const second = await limit(env.DB, key, opts); // count 6 > 5
		expect(second.allowed).toBe(false);
	});

	it('opportunistic cleanup never deletes a live long-window row, even when triggered by a short-window call', async () => {
		// Regression test: cleanup is a single global DELETE across every key, so
		// its staleness threshold must not be derived from the triggering call's
		// own windowSeconds — a frequent 60s-window hit could otherwise delete a
		// same-day, still-live 86400s (daily cap) row and silently reset it.
		const dailyKey = 'test:daily-live-' + crypto.randomUUID();
		const nowSec = Math.floor(Date.now() / 1000);
		const dayWindowStart = nowSec - (nowSec % 86400);
		await env.DB.prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)')
			.bind(dailyKey, dayWindowStart, 150)
			.run();

		// Force the 1%-chance cleanup branch to run on an unrelated 60s-window call.
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
		try {
			await limit(env.DB, 'test:short-' + crypto.randomUUID(), { max: 100, windowSeconds: 60 });
		} finally {
			randomSpy.mockRestore();
		}

		const row = await env.DB
			.prepare('SELECT count FROM rate_limits WHERE key = ?')
			.bind(dailyKey)
			.first<{ count: number }>();
		expect(row?.count).toBe(150); // still there — cleanup must not have touched it
	});

	it('fails open on a D1 error: still resolves allowed:true and logs via console.error', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const throwingDb = {
			prepare() {
				throw new Error('boom');
			}
		} as unknown as D1Database;

		const result = await limit(throwingDb, 'test:fail-open', { max: 1, windowSeconds: 60 });
		expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});
});

describe('helpers', () => {
	it('clientIp reads only cf-connecting-ip, never x-forwarded-for', () => {
		const withCf = new Request('https://example.com', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
		expect(clientIp(withCf)).toBe('1.2.3.4');
		const withXff = new Request('https://example.com', { headers: { 'x-forwarded-for': '9.9.9.9' } });
		expect(clientIp(withXff)).toBe('unknown');
	});

	it('ipKey and userKey embed scope and surface', () => {
		expect(ipKey('1.2.3.4', 'oauth-token')).toBe('ip:1.2.3.4:oauth-token');
		expect(userKey('u1', 'feedback')).toBe('user:u1:feedback');
	});

	it('tooManyRequests returns 429 with a Retry-After header', () => {
		const res = tooManyRequests({ allowed: false, retryAfterSeconds: 42 });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('42');
	});
});

describe('POST /oauth/register — rate limited end to end', () => {
	// Chosen as the integration target because it needs no auth/OAuth-client
	// setup to call directly — just a JSON body — unlike every other wired
	// route, which requires a session user or a pre-registered OAuth client.
	it('allows 5 registrations per minute per IP, then 429s with Retry-After on the 6th', async () => {
		const ip = '203.0.113.' + Math.floor(Math.random() * 254 + 1); // isolate this test's bucket
		const makeRequest = () =>
			new Request('https://example.com/oauth/register', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
				body: JSON.stringify({ client_name: 'Rate Limit Test', redirect_uris: ['http://localhost/callback'] })
			});

		for (let i = 0; i < 5; i++) {
			const res = await registerPOST({ request: makeRequest(), platform: platformWith(env.DB) } as never);
			expect(res.status).toBe(201);
		}

		const sixth = await registerPOST({ request: makeRequest(), platform: platformWith(env.DB) } as never);
		expect(sixth.status).toBe(429);
		expect(sixth.headers.get('Retry-After')).toBeTruthy();
		const body = (await sixth.json()) as { error: string };
		expect(body.error).toBe('rate_limited');
	});
});
