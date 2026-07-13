// Access + refresh token issuing, validation, and rotation for the MCP server.
// Tokens are opaque random strings with a recognisable prefix; only their
// SHA-256 hash is persisted. Refresh tokens rotate on every use and carry a
// family id so that reuse of a rotated token revokes the whole family.

import { randomHex, sha256Hex } from './oauth';

const ACCESS_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export const ACCESS_PREFIX = 'gna_';
export const REFRESH_PREFIX = 'gnr_';

export interface IssuedTokens {
	accessToken: string;
	refreshToken: string;
	expiresInSeconds: number;
	scope: string;
}

/** Issue a fresh access+refresh pair. Pass an existing familyId when rotating so
 *  the new refresh token stays in the same lineage; omit it for a first issue. */
export async function issueTokenPair(
	db: D1Database,
	opts: { clientId: string; userId: string; scope: string; familyId?: string }
): Promise<IssuedTokens> {
	const familyId = opts.familyId ?? crypto.randomUUID();
	const now = Date.now();

	const accessToken = ACCESS_PREFIX + randomHex(32);
	const refreshToken = REFRESH_PREFIX + randomHex(32);
	const accessHash = await sha256Hex(accessToken);
	const refreshHash = await sha256Hex(refreshToken);
	const nowIso = new Date(now).toISOString();
	const accessExp = new Date(now + ACCESS_TTL_MS).toISOString();
	const refreshExp = new Date(now + REFRESH_TTL_MS).toISOString();

	await db.batch([
		db
			.prepare(
				`INSERT INTO oauth_tokens (token_hash, kind, client_id, user_id, scope, family_id, expires_at, created_at)
				 VALUES (?, 'access', ?, ?, ?, NULL, ?, ?)`
			)
			.bind(accessHash, opts.clientId, opts.userId, opts.scope, accessExp, nowIso),
		db
			.prepare(
				`INSERT INTO oauth_tokens (token_hash, kind, client_id, user_id, scope, family_id, expires_at, created_at)
				 VALUES (?, 'refresh', ?, ?, ?, ?, ?, ?)`
			)
			.bind(refreshHash, opts.clientId, opts.userId, opts.scope, familyId, refreshExp, nowIso)
	]);

	return {
		accessToken,
		refreshToken,
		expiresInSeconds: Math.floor(ACCESS_TTL_MS / 1000),
		scope: opts.scope
	};
}

export interface AccessContext {
	userId: string;
	clientId: string;
	scope: string;
}

/** Resolve a bearer access token to its owner, or null if missing/invalid/
 *  expired/revoked. */
export async function validateAccessToken(
	db: D1Database,
	token: string
): Promise<AccessContext | null> {
	if (!token.startsWith(ACCESS_PREFIX)) return null;
	const hash = await sha256Hex(token);
	const row = await db
		.prepare(
			`SELECT user_id AS userId, client_id AS clientId, scope, expires_at AS expiresAt, revoked
			 FROM oauth_tokens WHERE token_hash = ? AND kind = 'access'`
		)
		.bind(hash)
		.first<{ userId: string; clientId: string; scope: string; expiresAt: string; revoked: number }>();
	if (!row) return null;
	if (row.revoked) return null;
	if (Date.now() >= new Date(row.expiresAt).getTime()) return null;
	return { userId: row.userId, clientId: row.clientId, scope: row.scope };
}

export type RefreshOutcome =
	| { ok: true; tokens: IssuedTokens }
	| { ok: false; reason: 'invalid' | 'expired' | 'reuse' | 'client_mismatch' };

/** Validate a refresh token and rotate it. On success the old refresh token is
 *  marked revoked+replaced and a new pair (same family) is issued. Presenting a
 *  refresh token that was already rotated (replaced_by set) or revoked is
 *  treated as reuse and revokes the entire family. */
export async function rotateRefreshToken(
	db: D1Database,
	token: string,
	presentedClientId: string
): Promise<RefreshOutcome> {
	if (!token.startsWith(REFRESH_PREFIX)) return { ok: false, reason: 'invalid' };
	const hash = await sha256Hex(token);
	const row = await db
		.prepare(
			`SELECT client_id AS clientId, user_id AS userId, scope, family_id AS familyId,
			        replaced_by AS replacedBy, revoked, expires_at AS expiresAt
			 FROM oauth_tokens WHERE token_hash = ? AND kind = 'refresh'`
		)
		.bind(hash)
		.first<{
			clientId: string;
			userId: string;
			scope: string;
			familyId: string | null;
			replacedBy: string | null;
			revoked: number;
			expiresAt: string;
		}>();
	if (!row) return { ok: false, reason: 'invalid' };

	// Reuse detection: a rotated-out or revoked refresh token being presented
	// again means the lineage is compromised — burn the whole family.
	if (row.revoked || row.replacedBy) {
		if (row.familyId) {
			await db
				.prepare('UPDATE oauth_tokens SET revoked = 1 WHERE family_id = ?')
				.bind(row.familyId)
				.run();
		}
		return { ok: false, reason: 'reuse' };
	}
	if (row.clientId !== presentedClientId) return { ok: false, reason: 'client_mismatch' };
	if (Date.now() >= new Date(row.expiresAt).getTime()) {
		await db.prepare('UPDATE oauth_tokens SET revoked = 1 WHERE token_hash = ?').bind(hash).run();
		return { ok: false, reason: 'expired' };
	}

	const tokens = await issueTokenPair(db, {
		clientId: row.clientId,
		userId: row.userId,
		scope: row.scope,
		familyId: row.familyId ?? undefined
	});
	const newRefreshHash = await sha256Hex(tokens.refreshToken);
	await db
		.prepare('UPDATE oauth_tokens SET revoked = 1, replaced_by = ? WHERE token_hash = ?')
		.bind(newRefreshHash, hash)
		.run();
	return { ok: true, tokens };
}
