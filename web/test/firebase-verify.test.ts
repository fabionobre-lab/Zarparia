// Firebase ID token claims verification — pure function, no network. The
// JWKS fetch + RS256 signature check in verifyFirebaseIdToken deliberately
// isn't exercised here (that would require a live network call or a mocked
// fetch/crypto stack out of proportion to what this file is testing); this
// covers exactly the claims contract validateIdTokenClaims promises.
//
// The two cases below ARE run through verifyFirebaseIdToken itself (not just
// validateIdTokenClaims) because they're rejected on the header alone, before
// verifyFirebaseIdToken ever reaches the JWKS fetch — so they stay offline
// without any network/crypto mocking.
import { describe, expect, it } from 'vitest';
import { validateIdTokenClaims, verifyFirebaseIdToken } from '../src/lib/server/firebase';

const PROJECT_ID = 'zarparia-test';
const NOW = 1_700_000_000;

function basePayload(overrides: Record<string, unknown> = {}) {
	return {
		aud: PROJECT_ID,
		iss: `https://securetoken.google.com/${PROJECT_ID}`,
		sub: 'firebase-uid-123',
		exp: NOW + 3600,
		iat: NOW - 10,
		email: 'person@example.com',
		email_verified: true,
		firebase: { sign_in_provider: 'password' },
		...overrides
	};
}

describe('validateIdTokenClaims', () => {
	it('accepts a well-formed, unexpired token and extracts claims', () => {
		const result = validateIdTokenClaims(basePayload(), PROJECT_ID, NOW);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.claims).toEqual({
				uid: 'firebase-uid-123',
				email: 'person@example.com',
				emailVerified: true,
				signInProvider: 'password'
			});
		}
	});

	it('extracts emailVerified: false when the token says so', () => {
		const result = validateIdTokenClaims(basePayload({ email_verified: false }), PROJECT_ID, NOW);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.claims.emailVerified).toBe(false);
	});

	it('rejects a token issued for a different Firebase project (wrong aud)', () => {
		const result = validateIdTokenClaims(basePayload({ aud: 'some-other-project' }), PROJECT_ID, NOW);
		expect(result).toEqual({ ok: false, error: 'wrong_audience' });
	});

	it('rejects a token with the wrong issuer', () => {
		const result = validateIdTokenClaims(
			basePayload({ iss: 'https://securetoken.google.com/some-other-project' }),
			PROJECT_ID,
			NOW
		);
		expect(result).toEqual({ ok: false, error: 'wrong_issuer' });
	});

	it('rejects a token missing the sub (uid) claim', () => {
		const { sub: _sub, ...withoutSub } = basePayload();
		const result = validateIdTokenClaims(withoutSub, PROJECT_ID, NOW);
		expect(result).toEqual({ ok: false, error: 'missing_subject' });
	});

	it('rejects a token with an empty-string sub', () => {
		const result = validateIdTokenClaims(basePayload({ sub: '' }), PROJECT_ID, NOW);
		expect(result).toEqual({ ok: false, error: 'missing_subject' });
	});

	it('rejects an expired token (exp more than 60s in the past)', () => {
		const result = validateIdTokenClaims(basePayload({ exp: NOW - 120 }), PROJECT_ID, NOW);
		expect(result).toEqual({ ok: false, error: 'expired' });
	});

	it('tolerates a token that expired less than 60s ago (clock-skew grace)', () => {
		const result = validateIdTokenClaims(basePayload({ exp: NOW - 30 }), PROJECT_ID, NOW);
		expect(result.ok).toBe(true);
	});

	it('rejects a token issued too far in the future (iat more than 60s ahead)', () => {
		const result = validateIdTokenClaims(basePayload({ iat: NOW + 120 }), PROJECT_ID, NOW);
		expect(result).toEqual({ ok: false, error: 'issued_in_future' });
	});

	it('tolerates an iat less than 60s in the future (clock-skew grace)', () => {
		const result = validateIdTokenClaims(basePayload({ iat: NOW + 30 }), PROJECT_ID, NOW);
		expect(result.ok).toBe(true);
	});
});

function base64UrlEncode(value: unknown): string {
	const b64 = btoa(JSON.stringify(value));
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds a syntactically valid three-segment JWT string (header.payload.signature)
 *  without signing anything — good enough to exercise the header-only rejections
 *  below, which never look at the signature bytes' validity. */
function makeToken(header: unknown, payload: unknown, signature = ''): string {
	return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.${signature}`;
}

describe('verifyFirebaseIdToken — pre-network header rejections', () => {
	it('rejects a token with fully valid claims but alg:none (no signature) as unsupported_algorithm', async () => {
		const token = makeToken({ alg: 'none' }, basePayload());
		const result = await verifyFirebaseIdToken(token, PROJECT_ID, NOW);
		expect(result).toEqual({ ok: false, error: 'unsupported_algorithm' });
	});

	it('rejects a token with fully valid claims and alg:RS256 but no kid as unsupported_algorithm', async () => {
		const token = makeToken({ alg: 'RS256' }, basePayload());
		const result = await verifyFirebaseIdToken(token, PROJECT_ID, NOW);
		expect(result).toEqual({ ok: false, error: 'unsupported_algorithm' });
	});
});
