// Phase 5.5 — public health endpoint. Runs against real D1 (Miniflare), same
// discipline as the other test files: no mocks.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { GET as healthGET } from '../src/routes/api/health/+server';

function platformWith(db: D1Database) {
	return { env: { DB: db } } as unknown as App.Platform;
}

function requestFrom(ip: string) {
	return new Request('https://example.com/api/health', { headers: { 'cf-connecting-ip': ip } });
}

describe('GET /api/health', () => {
	it('is unauthenticated — no locals.user needed — and returns a bare ok:true after a D1 ping', async () => {
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const res = await healthGET({ request: requestFrom(ip), platform: platformWith(env.DB) } as never);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ ok: true });
	});

	it('returns 503 with ok:false when the D1 ping fails', async () => {
		const throwingDb = {
			prepare() {
				return {
					bind() {
						return this;
					},
					first() {
						throw new Error('boom');
					},
					run() {
						throw new Error('boom');
					}
				};
			}
		} as unknown as D1Database;
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const res = await healthGET({ request: requestFrom(ip), platform: platformWith(throwingDb) } as never);
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body).toEqual({ ok: false });
	});

	it('rate-limits after 30 requests/min from the same IP, then 429s', async () => {
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		for (let i = 0; i < 30; i++) {
			const res = await healthGET({ request: requestFrom(ip), platform: platformWith(env.DB) } as never);
			expect(res.status).toBe(200);
		}
		const res31 = await healthGET({ request: requestFrom(ip), platform: platformWith(env.DB) } as never);
		expect(res31.status).toBe(429);
		expect(res31.headers.get('Retry-After')).toBeTruthy();
	});

	it('does not require an approved user (no auth at all)', async () => {
		// No locals/user in the event object passed to the handler at all —
		// if the handler accidentally depended on requireUser() this would throw.
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const res = await healthGET({ request: requestFrom(ip), platform: platformWith(env.DB) } as never);
		expect(res.status).toBe(200);
	});
});
