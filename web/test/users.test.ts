// Phase 3 approval gate — sign-up status assignment.
// Runs against a real (Miniflare-backed) D1 binding with migrations applied
// (see vitest.config.ts / test/apply-migrations.ts), not a mock.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { upsertGoogleUser } from '../src/lib/server/users';

describe('upsertGoogleUser — approval status', () => {
	it('a brand-new sign-up starts pending', async () => {
		const user = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-newbie', email: 'newbie@example.com', name: 'New Bie' },
			undefined
		);
		expect(user.status).toBe('pending');
		expect(user.email).toBe('newbie@example.com');
	});

	it('a sign-up matching the default admin email is auto-approved', async () => {
		const user = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-admin', email: 'fabionobre.ai@gmail.com', name: 'Owner' },
			undefined // no platform.env.ADMIN_EMAIL override → falls back to the default
		);
		expect(user.status).toBe('approved');
	});

	it('a sign-up matching a platform-configured ADMIN_EMAIL (any case) is auto-approved', async () => {
		const platform = { env: { ADMIN_EMAIL: 'Boss@Example.com' } } as unknown as App.Platform;
		const user = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-boss', email: 'boss@example.com', name: 'Boss' },
			platform
		);
		expect(user.status).toBe('approved');
	});

	it('re-login for an existing user refreshes profile fields but never touches status', async () => {
		const first = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-repeat', email: 'repeat@example.com', name: 'First Name' },
			undefined
		);
		expect(first.status).toBe('pending');

		const second = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-repeat', email: 'repeat@example.com', name: 'Second Name' },
			undefined
		);
		expect(second.status).toBe('pending');
		expect(second.name).toBe('Second Name');
		expect(second.id).toBe(first.id);
	});
});
