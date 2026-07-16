import { error } from '@sveltejs/kit';
import type { SessionUser, UserStatus } from '$lib/types';
import type { GoogleProfile } from './oauth';
import { getAdminEmail } from './admin';

/** D1 surfaces constraint failures as errors whose message contains 'UNIQUE'. */
function isUniqueViolation(e: unknown): boolean {
	return e instanceof Error && /UNIQUE/i.test(e.message);
}

/** Find-or-create a user from a Google profile, keyed on the stable `sub`.
 *  Refreshes email/name/avatar on every login; status is untouched for
 *  existing users. A brand-new user starts 'pending' (Phase 3 approval gate)
 *  EXCEPT when their email matches the platform admin — auto-approved so the
 *  owner can never be locked out of their own app. Email is normalized to
 *  trimmed lowercase so lookups (e.g. sharing) match reliably. */
export async function upsertGoogleUser(
	db: D1Database,
	profile: GoogleProfile,
	platform: App.Platform | undefined
): Promise<SessionUser> {
	const email = profile.email.trim().toLowerCase();
	const name = profile.name ?? null;
	const avatar = profile.picture ?? null;

	const existing = await db
		.prepare('SELECT id, status FROM users WHERE provider = ? AND provider_user_id = ?')
		.bind('google', profile.sub)
		.first<{ id: string; status: UserStatus }>();

	if (existing) {
		try {
			await db
				.prepare('UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?')
				.bind(email, name, avatar, existing.id)
				.run();
			return { id: existing.id, email, name, avatarUrl: avatar, status: existing.status };
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
			// Another account already claims this email — keep the user's stored
			// email and just refresh name/avatar so login still succeeds.
			await db
				.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?')
				.bind(name, avatar, existing.id)
				.run();
			const row = await db
				.prepare('SELECT email FROM users WHERE id = ?')
				.bind(existing.id)
				.first<{ email: string }>();
			return { id: existing.id, email: row?.email ?? email, name, avatarUrl: avatar, status: existing.status };
		}
	}

	const isAdminEmail = email === getAdminEmail(platform);
	const status: UserStatus = isAdminEmail ? 'approved' : 'pending';
	const approvedAt = isAdminEmail ? new Date().toISOString() : null;

	const id = crypto.randomUUID();
	try {
		await db
			.prepare(
				`INSERT INTO users (id, email, name, avatar_url, provider, provider_user_id, status, approved_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(id, email, name, avatar, 'google', profile.sub, status, approvedAt)
			.run();
	} catch (e) {
		if (isUniqueViolation(e)) throw error(409, 'Another account already uses this email address.');
		throw e;
	}
	return { id, email, name, avatarUrl: avatar, status };
}

// ── Admin: approval queue (web/src/routes/admin/approvals) ────────────────

export interface AdminUserRow {
	id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
	status: UserStatus;
	createdAt: string;
	approvedAt: string | null;
}

const ADMIN_USER_COLUMNS =
	'id, email, name, avatar_url AS avatarUrl, status, created_at AS createdAt, approved_at AS approvedAt';

/** Pending sign-ups awaiting a decision, oldest first (first-come, first-approved). */
export async function listPendingUsers(db: D1Database): Promise<AdminUserRow[]> {
	const rows = await db
		.prepare(`SELECT ${ADMIN_USER_COLUMNS} FROM users WHERE status = 'pending' ORDER BY created_at ASC`)
		.all<AdminUserRow>();
	return rows.results;
}

/** Already-decided users (approved or rejected), most recently decided first —
 *  the undo list. `approved_at` doubles as "decided at" for rejections too
 *  (set on both actions; see setUserStatus). */
export async function listRecentlyDecidedUsers(db: D1Database, limit = 20): Promise<AdminUserRow[]> {
	const rows = await db
		.prepare(
			`SELECT ${ADMIN_USER_COLUMNS} FROM users
			 WHERE status IN ('approved', 'rejected') AND approved_at IS NOT NULL
			 ORDER BY approved_at DESC LIMIT ?`
		)
		.bind(limit)
		.all<AdminUserRow>();
	return rows.results;
}

/** Set a user's approval status (admin). Idempotent — re-applying the same
 *  status is a harmless no-op write. `approved_at` is stamped for every
 *  decision (approve/reject/revert-to-pending) so the admin UI can sort and
 *  show "decided at", not just for literal approvals. */
export async function setUserStatus(db: D1Database, userId: string, status: UserStatus): Promise<boolean> {
	const approvedAt = status === 'pending' ? null : new Date().toISOString();
	const result = await db
		.prepare('UPDATE users SET status = ?, approved_at = ? WHERE id = ?')
		.bind(status, approvedAt, userId)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}
