import type { SessionUser } from '$lib/types';
import type { GoogleProfile } from './oauth';

/** Find-or-create a user from a Google profile, keyed on the stable `sub`.
 *  Refreshes email/name/avatar on every login. */
export async function upsertGoogleUser(db: D1Database, profile: GoogleProfile): Promise<SessionUser> {
	const name = profile.name ?? null;
	const avatar = profile.picture ?? null;

	const existing = await db
		.prepare('SELECT id FROM users WHERE provider = ? AND provider_user_id = ?')
		.bind('google', profile.sub)
		.first<{ id: string }>();

	if (existing) {
		await db
			.prepare('UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?')
			.bind(profile.email, name, avatar, existing.id)
			.run();
		return { id: existing.id, email: profile.email, name, avatarUrl: avatar };
	}

	const id = crypto.randomUUID();
	await db
		.prepare(
			'INSERT INTO users (id, email, name, avatar_url, provider, provider_user_id) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(id, profile.email, name, avatar, 'google', profile.sub)
		.run();
	return { id, email: profile.email, name, avatarUrl: avatar };
}
