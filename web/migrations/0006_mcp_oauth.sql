-- Remote MCP server: OAuth 2.1 authorization-server state.
-- All clients are PUBLIC (PKCE, token_endpoint_auth_method='none') — no secrets.
-- Codes and tokens are stored as SHA-256 hashes, never in the clear, so a DB
-- leak cannot be replayed (same discipline as the sessions table).

-- One row per dynamically-registered client (RFC 7591 open registration).
CREATE TABLE oauth_clients (
	client_id TEXT PRIMARY KEY,           -- uuid issued at registration
	client_name TEXT,
	redirect_uris TEXT NOT NULL,          -- JSON array of exact-match redirect URIs
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Short-lived authorization codes. Single-use: consumed by DELETE ... RETURNING
-- at the token endpoint so a code can never be exchanged twice.
CREATE TABLE oauth_codes (
	code_hash TEXT PRIMARY KEY,           -- SHA-256 of the raw code
	client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	redirect_uri TEXT NOT NULL,
	code_challenge TEXT NOT NULL,
	code_challenge_method TEXT NOT NULL,  -- always 'S256' (OAuth 2.1)
	scope TEXT NOT NULL,
	resource TEXT,                        -- RFC 8707 resource indicator, if sent
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_oauth_codes_expires ON oauth_codes(expires_at);

-- Access + refresh tokens. Refresh tokens rotate on every use; family_id ties a
-- refresh lineage together so that presenting an already-rotated (replaced)
-- refresh token revokes the entire family — classic reuse detection.
CREATE TABLE oauth_tokens (
	token_hash TEXT PRIMARY KEY,          -- SHA-256 of the raw token (incl. prefix)
	kind TEXT NOT NULL CHECK (kind IN ('access', 'refresh')),
	client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	scope TEXT NOT NULL,
	family_id TEXT,                       -- refresh lineage id (null for access tokens)
	replaced_by TEXT,                     -- next token_hash after rotation (null while current)
	revoked INTEGER NOT NULL DEFAULT 0,   -- 0 | 1
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX idx_oauth_tokens_family ON oauth_tokens(family_id);
