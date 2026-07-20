-- Public share route (docs/public-share-route-spec.md): an anonymous,
-- read-only link for a trip, deliberately a SEPARATE table from
-- trip_share_links (0003) — that one is a collaborator invite (redeeming it
-- requires sign-in and grants a trip_shares row); this one never grants any
-- account access, so enabling public sharing can never be confused with
-- granting collaborator access.
--
-- One row per trip (PK), same one-link-per-trip shape as trip_share_links.
-- No role column: this table is read-only, always. revoked_at is a soft
-- delete (not a hard DELETE) so "was this trip ever made public" survives a
-- revoke, for an audit trail. The row existing at all — with revoked_at NULL
-- — IS the opt-in; there is no default-on migration path for existing trips.
CREATE TABLE trip_public_links (
	trip_id TEXT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
	token TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	revoked_at INTEGER
);
