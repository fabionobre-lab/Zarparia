-- Share-by-link: one re-copyable invite link per trip.
-- Tokens are stored in plaintext (deliberate: the link must stay re-copyable and
-- the resource is low-stakes). Lookup is by the UNIQUE index on token.
CREATE TABLE trip_share_links (
	trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
	token TEXT NOT NULL UNIQUE,
	role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
	created_at INTEGER NOT NULL
);
