// Phase 3 approval gate — sign-up status assignment.
// Runs against a real (Miniflare-backed) D1 binding with migrations applied
// (see vitest.config.ts / test/apply-migrations.ts), not a mock.
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { listPendingUsers, upsertGoogleUser } from '../src/lib/server/users';

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

describe('listPendingUsers — bounded query', () => {
	it('caps the result to the requested limit when more pending rows exist', async () => {
		// D1 storage is shared across tests within this file (not per-test
		// isolated — see the "respects an explicit limit" failure this test
		// replaced), so measure the baseline rather than assuming a clean table.
		const before = await listPendingUsers(env.DB);
		const marker = 'limit-test-' + crypto.randomUUID();
		for (let i = 0; i < 5; i++) {
			await upsertGoogleUser(
				env.DB,
				{ sub: `google-sub-${marker}-${i}`, email: `${marker}-${i}@example.com`, name: 'Pending' },
				undefined
			);
		}
		const totalNow = before.length + 5;
		const tightLimit = Math.max(1, totalNow - 3); // strictly less than the total, so LIMIT must bind
		const limited = await listPendingUsers(env.DB, tightLimit);
		expect(limited.length).toBe(tightLimit);

		const unlimited = await listPendingUsers(env.DB, totalNow + 100);
		expect(unlimited.length).toBe(totalNow);
	});

	it('defaults to a limit of 200 when none is passed', async () => {
		const rows = await listPendingUsers(env.DB);
		expect(rows.length).toBeLessThanOrEqual(200);
	});
});
