import {
	FEEDBACK_MAX_LEN,
	isFeedbackStatus,
	isFeedbackType,
	type FeedbackAdminRow,
	type FeedbackInput,
	type FeedbackRow,
	type FeedbackStatus
} from '$lib/feedback';

// Re-export the shared types/constants so server callers can keep importing
// everything from one place.
export * from '$lib/feedback';

export type CreateFeedbackResult =
	| { ok: true; id: string }
	| { ok: false; reason: 'empty' | 'too_long' | 'bad_type' };

/** Store a new submission. Message is trimmed and capped at 2000 chars; longer
 *  messages (and unknown types / empty messages) are rejected. */
export async function createFeedback(
	db: D1Database,
	userId: string,
	input: FeedbackInput
): Promise<CreateFeedbackResult> {
	if (!isFeedbackType(input.type)) return { ok: false, reason: 'bad_type' };
	const message = (input.message ?? '').trim();
	if (!message) return { ok: false, reason: 'empty' };
	if (message.length > FEEDBACK_MAX_LEN) return { ok: false, reason: 'too_long' };

	const id = crypto.randomUUID();
	const now = Date.now();
	await db
		.prepare(
			`INSERT INTO feedback (id, user_id, type, message, page, locale, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)`
		)
		.bind(id, userId, input.type, message, input.page ?? null, input.locale ?? null, now, now)
		.run();
	return { ok: true, id };
}

/** A user's own submissions, newest first. */
export async function listFeedbackForUser(db: D1Database, userId: string): Promise<FeedbackRow[]> {
	const rows = await db
		.prepare(
			`SELECT id, type, message, page, locale, status,
			        created_at AS createdAt, updated_at AS updatedAt
			 FROM feedback WHERE user_id = ? ORDER BY created_at DESC`
		)
		.bind(userId)
		.all<FeedbackRow>();
	return rows.results;
}

/** All submissions joined with submitter name/email, newest first (admin). */
export async function listAllFeedback(db: D1Database): Promise<FeedbackAdminRow[]> {
	const rows = await db
		.prepare(
			`SELECT f.id, f.type, f.message, f.page, f.locale, f.status,
			        f.created_at AS createdAt, f.updated_at AS updatedAt,
			        f.user_id AS userId, u.name AS userName, u.email AS userEmail
			 FROM feedback f JOIN users u ON u.id = f.user_id
			 ORDER BY f.created_at DESC`
		)
		.all<FeedbackAdminRow>();
	return rows.results;
}

/** Set a submission's status (admin). Returns false for an unknown status. */
export async function updateFeedbackStatus(
	db: D1Database,
	id: string,
	status: FeedbackStatus
): Promise<boolean> {
	if (!isFeedbackStatus(status)) return false;
	await db
		.prepare('UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?')
		.bind(status, Date.now(), id)
		.run();
	return true;
}
