-- Phase 6 item 1b (photo-delete Undo): trip_photos delete becomes a soft
-- delete instead of an immediate D1+R2 purge, so the UI can offer an Undo
-- affordance after the fact. deleted_at uses the SAME type/convention as
-- created_at (TEXT, SQLite's datetime('now') — UTC "YYYY-MM-DD HH:MM:SS",
-- lexicographically sortable so age comparisons can stay plain string/date
-- comparisons). NULL = active/visible; non-NULL = soft-deleted, awaiting the
-- lazy purge (see purgeExpiredPhotos in src/lib/server/photos.ts) once it's
-- older than 7 days.
ALTER TABLE trip_photos ADD COLUMN deleted_at TEXT;

-- Speeds up both the "is this soft-deleted" filter added to every read path
-- and the lazy purge's per-trip sweep for stale (deleted_at < cutoff) rows.
CREATE INDEX idx_trip_photos_deleted_at ON trip_photos(trip_id, deleted_at);
