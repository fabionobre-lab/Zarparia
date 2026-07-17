// Firebase Authentication ID token verification — pure Web Crypto, no npm
// dependency. Identity (email+password, verification emails, password reset)
// is entirely delegated to the Firebase client SDK; this Worker only verifies
// the short-lived ID token the SDK hands back and then issues its own
// existing D1-backed session, exactly like the Google OAuth path.
//
// Verification is two independent steps, kept separate on purpose:
//  1. `validateIdTokenClaims` — pure, no network, fully unit-testable.
//  2. RS256 signature check against Google's published JWKS for the Secure
//     Token service, fetched once and cached in module scope for the
//     response's own Cache-Control max-age (falling back to 1 hour).
//
// `verifyFirebaseIdToken` runs the claims check first (cheap, no network) and
// only reaches for the JWKS/signature check if that passes.

export interface FirebaseClaims {
	/** Stable per-user id (the `sub` claim). */
	uid: string;
	email?: string;
	emailVerified: boolean;
	signInProvider?: string;
}

export type VerifyResult = { ok: true; claims: FirebaseClaims } | { ok: false; error: string };

interface JwtHeader {
	alg?: string;
	kid?: string;
	[key: string]: unknown;
}

interface JwtPayload {
	aud?: string;
	iss?: string;
	sub?: string;
	exp?: number;
	iat?: number;
	email?: string;
	email_verified?: boolean;
	firebase?: { sign_in_provider?: string };
	[key: string]: unknown;
}

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const DEFAULT_JWKS_MAX_AGE_SECONDS = 60 * 60; // 1 hour fallback when the response has no usable Cache-Control

function base64UrlToBytes(b64url: string): Uint8Array {
	const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
	const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
	const bin = atob(padded);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

/** Copies a Uint8Array's bytes into a plain ArrayBuffer. Some TS lib versions
 *  type `Uint8Array<ArrayBufferLike>` (as returned by `new Uint8Array(n)` /
 *  `TextEncoder#encode`) as incompatible with the `BufferSource` that
 *  `crypto.subtle.verify` expects, which wants an `ArrayBuffer` specifically
 *  — this sidesteps that mismatch instead of fighting the lib types. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.slice().buffer as ArrayBuffer;
}

function decodeJwtSegment<T>(segment: string): T {
	const bytes = base64UrlToBytes(segment);
	return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function splitToken(token: string): [string, string, string] {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('malformed token');
	return parts as [string, string, string];
}

/** Base64url-decodes the payload segment of a JWT. Does NOT verify the
 *  signature — callers must not trust the result until the signature check
 *  in `verifyFirebaseIdToken` has also passed. Throws on malformed input. */
export function decodeJwtPayload(token: string): JwtPayload {
	const [, payload] = splitToken(token);
	return decodeJwtSegment<JwtPayload>(payload);
}

function decodeJwtHeader(token: string): JwtHeader {
	const [header] = splitToken(token);
	return decodeJwtSegment<JwtHeader>(header);
}

/** Pure claims check against a Firebase project id — no network, no
 *  signature verification. Exported directly for unit testing.
 *
 *  `exp`/`iat` get a 60s grace window each way to absorb ordinary clock
 *  skew between this Worker and Google's token-issuing clock. */
export function validateIdTokenClaims(payload: JwtPayload, projectId: string, nowSec: number): VerifyResult {
	if (payload.aud !== projectId) return { ok: false, error: 'wrong_audience' };
	if (payload.iss !== `https://securetoken.google.com/${projectId}`) return { ok: false, error: 'wrong_issuer' };
	if (typeof payload.sub !== 'string' || payload.sub.length === 0) return { ok: false, error: 'missing_subject' };
	if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 60) return { ok: false, error: 'expired' };
	if (typeof payload.iat !== 'number' || payload.iat >= nowSec + 60) return { ok: false, error: 'issued_in_future' };

	const claims: FirebaseClaims = {
		uid: payload.sub,
		email: payload.email,
		emailVerified: payload.email_verified === true,
		signInProvider: payload.firebase?.sign_in_provider
	};
	return { ok: true, claims };
}

interface Jwk {
	kid?: string;
	[key: string]: unknown;
}

interface JwksCacheEntry {
	keys: Jwk[];
	expiresAtMs: number;
}

// Module-scoped cache: Workers reuse the same isolate across requests within
// its lifetime, so this avoids refetching the JWKS on every login.
let jwksCache: JwksCacheEntry | null = null;

function parseMaxAgeSeconds(cacheControl: string | null): number {
	if (!cacheControl) return DEFAULT_JWKS_MAX_AGE_SECONDS;
	const match = /max-age=(\d+)/.exec(cacheControl);
	if (!match) return DEFAULT_JWKS_MAX_AGE_SECONDS;
	const seconds = parseInt(match[1], 10);
	return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_JWKS_MAX_AGE_SECONDS;
}

async function getJwks(): Promise<Jwk[]> {
	const now = Date.now();
	if (jwksCache && jwksCache.expiresAtMs > now) return jwksCache.keys;

	const res = await fetch(JWKS_URL);
	if (!res.ok) throw new Error(`firebase jwks fetch failed: ${res.status}`);
	const body = (await res.json()) as { keys: Jwk[] };
	if (!Array.isArray(body.keys)) throw new Error('firebase jwks response missing keys array');
	const maxAgeSeconds = parseMaxAgeSeconds(res.headers.get('cache-control'));
	jwksCache = { keys: body.keys, expiresAtMs: now + maxAgeSeconds * 1000 };
	return body.keys;
}

/** Verifies the RS256 signature over `header.payload` against the JWKS,
 *  trying the key matching the token's `kid` first (then falling back to the
 *  rest — Google rotates these keys and a just-rotated cache could still hold
 *  the previous set for a moment). */
async function verifySignature(
	headerB64: string,
	payloadB64: string,
	signature: Uint8Array,
	kid: string | undefined
): Promise<boolean> {
	const keys = await getJwks();
	const matching = kid ? keys.filter((k) => k.kid === kid) : [];
	const rest = kid ? keys.filter((k) => k.kid !== kid) : keys;
	const ordered = [...matching, ...rest];

	const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

	for (const jwk of ordered) {
		try {
			const key = await crypto.subtle.importKey(
				'jwk',
				jwk as JsonWebKey,
				{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
				false,
				['verify']
			);
			const valid = await crypto.subtle.verify(
				'RSASSA-PKCS1-v1_5',
				key,
				toArrayBuffer(signature),
				toArrayBuffer(data)
			);
			if (valid) return true;
		} catch {
			// Malformed/incompatible key — try the next one.
		}
	}
	return false;
}

/** Verifies a Firebase Authentication ID token: claims first (cheap, no
 *  network), then the RS256 signature against Google's published JWKS.
 *  `nowSec` is injectable for tests; defaults to the real clock. */
export async function verifyFirebaseIdToken(
	token: string,
	projectId: string,
	nowSec: number = Math.floor(Date.now() / 1000)
): Promise<VerifyResult> {
	let payload: JwtPayload;
	let header: JwtHeader;
	try {
		payload = decodeJwtPayload(token);
		header = decodeJwtHeader(token);
	} catch {
		return { ok: false, error: 'malformed_token' };
	}

	const claimsResult = validateIdTokenClaims(payload, projectId, nowSec);
	if (!claimsResult.ok) return claimsResult;

	if (header.alg !== 'RS256' || !header.kid) return { ok: false, error: 'unsupported_algorithm' };

	// Decoded separately from (and before) the JWKS/network try-block below, so
	// a malformed signature segment is reported as invalid-signature rather
	// than misattributed to a JWKS-unavailable failure.
	const [headerB64, payloadB64, sigB64] = splitToken(token);
	let signature: Uint8Array;
	try {
		signature = base64UrlToBytes(sigB64);
	} catch {
		return { ok: false, error: 'invalid_signature' };
	}

	try {
		const validSignature = await verifySignature(headerB64, payloadB64, signature, header.kid);
		if (!validSignature) return { ok: false, error: 'invalid_signature' };
	} catch {
		return { ok: false, error: 'jwks_unavailable' };
	}

	return claimsResult;
}
