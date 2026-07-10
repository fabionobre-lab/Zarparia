-- In-app feedback / feature requests. One row per submission.
-- created_at / updated_at are epoch milliseconds (Date.now()), matching the
-- share-links table's convention.
CREATE TABLE feedback (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id),
	type TEXT NOT NULL CHECK (type IN ('bug', 'idea', 'other')),
	message TEXT NOT NULL,
	page TEXT,
	locale TEXT,
	status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'planned', 'done', 'dismissed')),
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_created ON feedback(created_at);
