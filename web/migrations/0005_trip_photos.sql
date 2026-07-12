-- Google Photos linked to a trip. Image bytes live in R2 (keys derived from
-- the row id: photos/<trip_id>/<id>/thumb|disp); this table is the index that
-- maps each photo onto the itinerary.
--
-- Placement columns (segment_id/plan_id/day_date/block_index) are computed at
-- import time from the photo's capture timestamp against the trip doc (the
-- Google Photos APIs deliberately never expose GPS, so time is the join key).
-- They are all nullable: a photo whose capture date matches no itinerary day
-- imports as "unmatched" and can be placed by hand (manual_override = 1, which
-- re-imports must never clobber). block_index addresses into the day's blocks
-- array — blocks have no ids in the trip schema — so an edited itinerary can
-- leave it dangling; readers must treat an out-of-range index as day-level.
CREATE TABLE trip_photos (
	id TEXT PRIMARY KEY,                 -- uuid; also the R2 key component
	trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
	media_item_id TEXT NOT NULL,         -- Google Photos media item id
	creation_time TEXT NOT NULL,         -- capture time, ISO 8601 UTC (from Google)
	width INTEGER,
	height INTEGER,
	content_type TEXT,                   -- of the cached R2 copies
	segment_id TEXT,
	plan_id TEXT,
	day_date TEXT,                       -- YYYY-MM-DD of the matched itinerary day
	block_index INTEGER,
	manual_override INTEGER NOT NULL DEFAULT 0,
	added_by TEXT REFERENCES users(id) ON DELETE SET NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	UNIQUE (trip_id, media_item_id)      -- re-picking the same photo is a no-op
);
CREATE INDEX idx_trip_photos_trip ON trip_photos(trip_id);
