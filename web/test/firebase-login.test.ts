// POST /auth/login/firebase — the parts testable without a real Firebase
// project or a signed token: the provisioning gate, invalid-token handling,
// and the rate limiter. A bogus/malformed idToken fails claims validation
// (wrong/missing aud) before verifyFirebaseIdToken ever reaches the network
// JWKS fetch, so these run fully offline — same discipline as
// test/ratelimit.test.ts's POST /oauth/register integration test.
//
// The provisioning gate and the rate limiter both `throw error(...)` (mirroring
// /auth/login/google exactly), which — called directly rather than through
// the full SvelteKit request pipeline — surfaces as a thrown HttpError, not a
// returned Response. Same pattern as test/guards.test.ts: catch it and assert
// on isHttpError(e)/e.status.
import { isHttpError } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../src/routes/auth/login/firebase/+server';
import * as firebaseVerifier from '../src/lib/server/firebase';

function platformWith(vars: Record<string, string>) {
	return { env: { DB: env.DB, ...vars } } as unknown as App.Platform;
}

function makeRequest(ip: string, idToken: unknown = 'not-a-real-token') {
	return new Request('https://example.com/auth/login/firebase', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
		body: JSON.stringify({ idToken })
	});
}

describe('POST /auth/login/firebase — provisioning gate', () => {
	it('404s when FIREBASE_PROJECT_ID is unset (feature not provisioned)', async () => {
		expect.assertions(2);
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		try {
			await POST({ request: makeRequest(ip), platform: platformWith({}), cookies: {} as never } as never);
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) expect(e.status).toBe(404);
		}
	});
});

describe('POST /auth/login/firebase — invalid token handling', () => {
	it('401s with invalid_token for a malformed idToken', async () => {
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const res = await POST({
			request: makeRequest(ip, 'not-a-real-token'),
			platform: platformWith({ FIREBASE_PROJECT_ID: 'zarparia-test' }),
			cookies: {} as never
		} as never);
		expect(res.status).toBe(401);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('invalid_token');
	});

	it('401s with invalid_token when idToken is missing entirely', async () => {
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const req = new Request('https://example.com/auth/login/firebase', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
			body: JSON.stringify({})
		});
		const res = await POST({
			request: req,
			platform: platformWith({ FIREBASE_PROJECT_ID: 'zarparia-test' }),
			cookies: {} as never
		} as never);
		expect(res.status).toBe(401);
	});
});

describe('POST /auth/login/firebase — post-verification gates', () => {
	// The 403 gates below (unverified email, non-password provider) only fire
	// after verifyFirebaseIdToken returns ok:true with specific claims, which
	// requires a genuinely signed Firebase token — not reproducible offline.
	// Stubbing the verifier module is the least-invasive way to reach that
	// branch without a live Firebase project or a mocked JWKS/crypto stack.
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('403s with email_unverified when the token reports an unverified email', async () => {
		vi.spyOn(firebaseVerifier, 'verifyFirebaseIdToken').mockResolvedValue({
			ok: true,
			claims: { uid: 'uid-unverified', email: 'person@example.com', emailVerified: false, signInProvider: 'password' }
		});
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const res = await POST({
			request: makeRequest(ip, 'irrelevant-because-mocked'),
			platform: platformWith({ FIREBASE_PROJECT_ID: 'zarparia-test' }),
			cookies: {} as never
		} as never);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('email_unverified');
	});

	it('403s with invalid_provider for a verified email signed in via a non-password provider', async () => {
		vi.spyOn(firebaseVerifier, 'verifyFirebaseIdToken').mockResolvedValue({
			ok: true,
			claims: { uid: 'uid-google', email: 'person@example.com', emailVerified: true, signInProvider: 'google.com' }
		});
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const res = await POST({
			request: makeRequest(ip, 'irrelevant-because-mocked'),
			platform: platformWith({ FIREBASE_PROJECT_ID: 'zarparia-test' }),
			cookies: {} as never
		} as never);
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe('invalid_provider');
	});
});

describe('POST /auth/login/firebase — rate limited end to end', () => {
	it('allows 20 requests per minute per IP, then 429s on the 21st', async () => {
		expect.assertions(21);
		const ip = '198.51.100.' + Math.floor(Math.random() * 254 + 1);
		const platform = platformWith({ FIREBASE_PROJECT_ID: 'zarparia-test' });

		for (let i = 0; i < 20; i++) {
			const res = await POST({ request: makeRequest(ip), platform, cookies: {} as never } as never);
			expect(res.status).toBe(401); // invalid token, but not rate-limited yet
		}

		try {
			await POST({ request: makeRequest(ip), platform, cookies: {} as never } as never);
			throw new Error('expected the 21st call to throw a 429');
		} catch (e) {
			if (isHttpError(e)) expect(e.status).toBe(429);
			else throw e;
		}
	});
});
