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

export interface FirebaseProfile {
	uid: string;
	email: string;
	name?: string | null;
}

/** Find-or-create a user from a verified Firebase ID token, keyed on the
 *  stable `uid` (the token's `sub` claim). Same approval-status rules as
 *  upsertGoogleUser: a brand-new sign-up starts 'pending' EXCEPT when the
 *  email matches the platform admin, which is auto-approved. Callers must
 *  have already confirmed `email_verified` on the token before calling this
 *  — it is not re-checked here.
 *
 *  Account linking: if no row is keyed by this Firebase uid yet, but a row
 *  already exists with the same (normalized) email under a different
 *  provider — e.g. that address signed in with Google before — that existing
 *  row is returned AS-IS, without touching its provider/provider_user_id.
 *  Because the caller only reaches this path with a verified email, this is
 *  "same person, different sign-in method reaching the same account," not an
 *  account-takeover surface: the email column is UNIQUE, so only whoever
 *  proved control of that address (via Firebase's own verification email)
 *  gets in this way. */
export async function upsertFirebaseUser(
	db: D1Database,
	profile: FirebaseProfile,
	platform: App.Platform | undefined
): Promise<SessionUser> {
	const email = profile.email.trim().toLowerCase();
	const name = profile.name ?? null;

	const existing = await db
		.prepare('SELECT id, status FROM users WHERE provider = ? AND provider_user_id = ?')
		.bind('firebase', profile.uid)
		.first<{ id: string; status: UserStatus }>();

	if (existing) {
		try {
			await db.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, existing.id).run();
			return { id: existing.id, email, name, avatarUrl: null, status: existing.status };
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
			// Another account already claims this email — keep the stored email.
			const row = await db
				.prepare('SELECT email, name, avatar_url AS avatarUrl FROM users WHERE id = ?')
				.bind(existing.id)
				.first<{ email: string; name: string | null; avatarUrl: string | null }>();
			return {
				id: existing.id,
				email: row?.email ?? email,
				name: row?.name ?? name,
				avatarUrl: row?.avatarUrl ?? null,
				status: existing.status
			};
		}
	}

	const byEmail = await db
		.prepare('SELECT id, email, name, avatar_url AS avatarUrl, status FROM users WHERE email = ?')
		.bind(email)
		.first<{ id: string; email: string; name: string | null; avatarUrl: string | null; status: UserStatus }>();
	if (byEmail) {
		// Link by verified email — the row (and its existing provider) is
		// returned unchanged; this login just reaches the same account.
		return { id: byEmail.id, email: byEmail.email, name: byEmail.name, avatarUrl: byEmail.avatarUrl, status: byEmail.status };
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
			.bind(id, email, name, null, 'firebase', profile.uid, status, approvedAt)
			.run();
	} catch (e) {
		if (isUniqueViolation(e)) throw error(409, 'Another account already uses this email address.');
		throw e;
	}
	return { id, email, name, avatarUrl: null, status };
}

/** Convert any pending trip invites addressed to this (verified) email into
 *  real trip_shares rows, then delete them. Called on every successful sign-in
 *  so an invite created before the person had an account takes effect the
 *  first time they log in. A no-op (single indexed lookup) when there are none.
 *
 *  Safe to run on every login: invites only exist for emails with no account,
 *  so once claimed here they're gone. The INSERT is idempotent (ON CONFLICT) in
 *  case a share already exists, and skips the trip the user now owns via the
 *  WHERE guard so an owner never gets a redundant self-share. */
export async function claimInvites(db: D1Database, userId: string, email: string): Promise<void> {
	const normalizedEmail = email.trim().toLowerCase();
	const pending = await db
		.prepare('SELECT trip_id AS tripId, permission FROM trip_invites WHERE email = ?')
		.bind(normalizedEmail)
		.all<{ tripId: string; permission: string }>();
	if (pending.results.length === 0) return;

	const statements = pending.results.map((invite) =>
		db
			.prepare(
				`INSERT INTO trip_shares (trip_id, user_id, permission)
				 SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM trips WHERE id = ?1 AND owner_id = ?2)
				 ON CONFLICT (trip_id, user_id) DO UPDATE SET permission = excluded.permission`
			)
			.bind(invite.tripId, userId, invite.permission)
	);
	statements.push(db.prepare('DELETE FROM trip_invites WHERE email = ?').bind(normalizedEmail));
	await db.batch(statements);
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

/** Pending sign-ups awaiting a decision, oldest first (first-come, first-approved).
 *  Bounded like listRecentlyDecidedUsers below — an unbounded queue is a launch-
 *  time nicety, not a promise: a spam/bot wave against sign-up would otherwise
 *  make this a full unindexed-by-limit scan returned in one admin page load. */
export async function listPendingUsers(db: D1Database, limit = 200): Promise<AdminUserRow[]> {
	const rows = await db
		.prepare(`SELECT ${ADMIN_USER_COLUMNS} FROM users WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`)
		.bind(limit)
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
