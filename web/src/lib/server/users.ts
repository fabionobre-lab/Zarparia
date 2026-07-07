import { error } from '@sveltejs/kit';
import type { SessionUser } from '$lib/types';
import type { GoogleProfile } from './oauth';

/** D1 surfaces constraint failures as errors whose message contains 'UNIQUE'. */
function isUniqueViolation(e: unknown): boolean {
	return e instanceof Error && /UNIQUE/i.test(e.message);
}

/** Find-or-create a user from a Google profile, keyed on the stable `sub`.
 *  Refreshes email/name/avatar on every login. Email is normalized to
 *  trimmed lowercase so lookups (e.g. sharing) match reliably. */
export async function upsertGoogleUser(db: D1Database, profile: GoogleProfile): Promise<SessionUser> {
	const email = profile.email.trim().toLowerCase();
	const name = profile.name ?? null;
	const avatar = profile.picture ?? null;

	const existing = await db
		.prepare('SELECT id FROM users WHERE provider = ? AND provider_user_id = ?')
		.bind('google', profile.sub)
		.first<{ id: string }>();

	if (existing) {
		try {
			await db
				.prepare('UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?')
				.bind(email, name, avatar, existing.id)
				.run();
			return { id: existing.id, email, name, avatarUrl: avatar };
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
			return { id: existing.id, email: row?.email ?? email, name, avatarUrl: avatar };
		}
	}

	const id = crypto.randomUUID();
	try {
		await db
			.prepare(
				'INSERT INTO users (id, email, name, avatar_url, provider, provider_user_id) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.bind(id, email, name, avatar, 'google', profile.sub)
			.run();
	} catch (e) {
		if (isUniqueViolation(e)) throw error(409, 'Another account already uses this email address.');
		throw e;
	}
	return { id, email, name, avatarUrl: avatar };
}
