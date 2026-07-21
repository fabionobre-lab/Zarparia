-- Pending share invites: let an owner share a trip with an email that has no
-- account yet. The invite is stored keyed by (normalized) email; when that
-- person first signs in (Google/Firebase/dev), claimInvites() converts every
-- invite for their verified email into a real trip_shares row and deletes it.
-- ON DELETE CASCADE mirrors trip_shares — deleting the trip drops its invites.

CREATE TABLE trip_invites (
	trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
	email TEXT NOT NULL,                  -- normalized trimmed lowercase; no account yet
	permission TEXT NOT NULL DEFAULT 'viewer' CHECK (permission IN ('viewer', 'editor')),
	invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (trip_id, email)
);
-- Claim-on-login looks invites up by email, so index it.
CREATE INDEX idx_invites_email ON trip_invites(email);
