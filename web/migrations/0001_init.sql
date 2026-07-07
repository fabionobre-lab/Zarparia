-- Multi-tenant schema for the Trips app.
-- Dates/times are ISO 8601 TEXT (SQLite has no native date type).

-- One row per authenticated person (Google OAuth).
CREATE TABLE users (
	id TEXT PRIMARY KEY,                 -- app user id (uuid)
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	avatar_url TEXT,
	provider TEXT NOT NULL DEFAULT 'google',
	provider_user_id TEXT NOT NULL,      -- 'sub' claim from the provider
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (provider, provider_user_id)
);

-- Server-side sessions. id is a hash of the session token (never store the raw token).
CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- One row per trip. doc is the JSON conforming to schema/trip.schema.json;
-- the scalar columns are denormalized from doc for cheap listing/sorting.
CREATE TABLE trips (
	id TEXT PRIMARY KEY,                 -- slug used in URLs
	owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	doc TEXT NOT NULL,
	title TEXT,
	status TEXT NOT NULL DEFAULT 'upcoming',
	start_date TEXT,
	end_date TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_trips_owner ON trips(owner_id);

-- Grants another user access to a trip they do not own.
CREATE TABLE trip_shares (
	trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	permission TEXT NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer', 'editor')),
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (trip_id, user_id)
);
CREATE INDEX idx_shares_user ON trip_shares(user_id);
