// OAuth 2.1 authorization-server primitives for the remote MCP server.
// Dynamic client registration, authorization-code issue/consume, PKCE, and the
// discovery-document builders live here. Token issuing/rotation is in tokens.ts.
//
// Security notes:
//  - All clients are PUBLIC: PKCE (S256) is mandatory, no client secret.
//  - Codes are stored as SHA-256 hashes and are single-use (DELETE ... RETURNING).
//  - redirect_uri is matched EXACTLY against the registered set (no prefix match).

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const SUPPORTED_SCOPE = 'trips';

function toHex(bytes: Uint8Array): string {
	let out = '';
	for (const b of bytes) out += b.toString(16).padStart(2, '0');
	return out;
}

export function randomHex(nBytes: number): string {
	const bytes = new Uint8Array(nBytes);
	crypto.getRandomValues(bytes);
	return toHex(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return toHex(new Uint8Array(digest));
}

/** Base64url of a SHA-256 digest, per RFC 7636 (PKCE code_challenge). */
async function sha256Base64Url(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	let bin = '';
	for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time-ish string compare (short, fixed-charset inputs). */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Verify a PKCE code_verifier against a stored S256 code_challenge. */
export async function verifyPkceS256(verifier: string, challenge: string): Promise<boolean> {
	// RFC 7636: verifier is 43–128 chars from the unreserved set.
	if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
	const computed = await sha256Base64Url(verifier);
	return timingSafeEqual(computed, challenge);
}

// ── Discovery documents ────────────────────────────────────────────────────

export function authServerMetadata(origin: string) {
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/oauth/token`,
		registration_endpoint: `${origin}/oauth/register`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none'],
		scopes_supported: [SUPPORTED_SCOPE]
	};
}

export function protectedResourceMetadata(origin: string) {
	return {
		resource: `${origin}/mcp`,
		authorization_servers: [origin],
		scopes_supported: [SUPPORTED_SCOPE],
		bearer_methods_supported: ['header']
	};
}

// ── Dynamic client registration (RFC 7591) ─────────────────────────────────

export interface OAuthClient {
	client_id: string;
	client_name: string | null;
	redirect_uris: string[];
}

/** A redirect URI is acceptable if it is https, or http://localhost / 127.0.0.1
 *  (loopback, for local dev clients). Everything else is rejected. */
export function isAllowedRedirectUri(uri: string): boolean {
	let u: URL;
	try {
		u = new URL(uri);
	} catch {
		return false;
	}
	if (u.protocol === 'https:') return true;
	if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))
		return true;
	return false;
}

export interface RegisterResult {
	ok: boolean;
	error?: string;
	error_description?: string;
	client?: OAuthClient;
	client_id_issued_at?: number;
}

export async function registerClient(
	db: D1Database,
	body: { client_name?: unknown; redirect_uris?: unknown }
): Promise<RegisterResult> {
	const uris = body.redirect_uris;
	if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === 'string')) {
		return {
			ok: false,
			error: 'invalid_redirect_uri',
			error_description: 'redirect_uris must be a non-empty array of strings.'
		};
	}
	for (const uri of uris as string[]) {
		if (!isAllowedRedirectUri(uri)) {
			return {
				ok: false,
				error: 'invalid_redirect_uri',
				error_description: `redirect_uri not allowed: ${uri} (must be https or http://localhost).`
			};
		}
	}
	const clientName =
		typeof body.client_name === 'string' && body.client_name.trim()
			? body.client_name.trim().slice(0, 200)
			: null;
	const clientId = crypto.randomUUID();
	const issuedAt = Math.floor(Date.now() / 1000);
	await db
		.prepare(
			'INSERT INTO oauth_clients (client_id, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?)'
		)
		.bind(clientId, clientName, JSON.stringify(uris), new Date().toISOString())
		.run();
	return {
		ok: true,
		client: { client_id: clientId, client_name: clientName, redirect_uris: uris as string[] },
		client_id_issued_at: issuedAt
	};
}

export async function getClient(db: D1Database, clientId: string): Promise<OAuthClient | null> {
	const row = await db
		.prepare('SELECT client_id, client_name, redirect_uris FROM oauth_clients WHERE client_id = ?')
		.bind(clientId)
		.first<{ client_id: string; client_name: string | null; redirect_uris: string }>();
	if (!row) return null;
	let redirect_uris: string[] = [];
	try {
		redirect_uris = JSON.parse(row.redirect_uris) as string[];
	} catch {
		redirect_uris = [];
	}
	return { client_id: row.client_id, client_name: row.client_name, redirect_uris };
}

// ── Authorization codes ────────────────────────────────────────────────────

export interface NewAuthCode {
	clientId: string;
	userId: string;
	redirectUri: string;
	codeChallenge: string;
	codeChallengeMethod: string;
	scope: string;
	resource: string | null;
}

/** Create a single-use authorization code; returns the RAW code (only the hash
 *  is stored). Caller redirects it back to the client with the state. */
export async function createAuthCode(db: D1Database, input: NewAuthCode): Promise<string> {
	const code = randomHex(24);
	const codeHash = await sha256Hex(code);
	const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
	await db
		.prepare(
			`INSERT INTO oauth_codes
			 (code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			codeHash,
			input.clientId,
			input.userId,
			input.redirectUri,
			input.codeChallenge,
			input.codeChallengeMethod,
			input.scope,
			input.resource,
			expiresAt,
			new Date().toISOString()
		)
		.run();
	return code;
}

export interface ConsumedCode {
	clientId: string;
	userId: string;
	redirectUri: string;
	codeChallenge: string;
	codeChallengeMethod: string;
	scope: string;
	resource: string | null;
	expired: boolean;
}

/** Atomically consume (delete) a code by its raw value. Returns null if the code
 *  never existed or was already used; otherwise the row (with an `expired` flag
 *  the caller must check). DELETE ... RETURNING guarantees single-use. */
export async function consumeAuthCode(db: D1Database, code: string): Promise<ConsumedCode | null> {
	const codeHash = await sha256Hex(code);
	const row = await db
		.prepare(
			`DELETE FROM oauth_codes WHERE code_hash = ?
			 RETURNING client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, expires_at`
		)
		.bind(codeHash)
		.first<{
			client_id: string;
			user_id: string;
			redirect_uri: string;
			code_challenge: string;
			code_challenge_method: string;
			scope: string;
			resource: string | null;
			expires_at: string;
		}>();
	if (!row) return null;
	return {
		clientId: row.client_id,
		userId: row.user_id,
		redirectUri: row.redirect_uri,
		codeChallenge: row.code_challenge,
		codeChallengeMethod: row.code_challenge_method,
		scope: row.scope,
		resource: row.resource,
		expired: Date.now() >= new Date(row.expires_at).getTime()
	};
}
