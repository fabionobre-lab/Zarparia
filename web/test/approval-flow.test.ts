// Phase 3 approval gate — the end-to-end flip: a pending sign-up gains access
// the moment an admin approves it (setUserStatus, driven from the
// /admin/approvals form action), with no re-login required — requireUser
// reads locals.user.status, which is refreshed from D1 on every request via
// validateSessionToken. This test exercises that refresh directly.
import { env } from 'cloudflare:workers';
import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { requireUser } from '../src/lib/server/guards';
import { createSession, generateSessionToken, validateSessionToken } from '../src/lib/server/session';
import { listPendingUsers, setUserStatus, upsertGoogleUser } from '../src/lib/server/users';

describe('approval flip: pending → approved grants access', () => {
	it('a session resolved before approval is 403; the same session resolved after approval passes', async () => {
		const user = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-flip', email: 'flip@example.com', name: 'Flip' },
			undefined
		);
		expect(user.status).toBe('pending');

		const token = generateSessionToken();
		await createSession(env.DB, token, user.id);

		// Before approval: the session resolves to a pending user, and the guard
		// rejects with 403.
		const before = await validateSessionToken(env.DB, token);
		expect(before?.user.status).toBe('pending');
		expect(() => requireUser({ user: before?.user ?? null } as App.Locals)).toThrowError();
		try {
			requireUser({ user: before?.user ?? null } as App.Locals);
		} catch (e) {
			expect(isHttpError(e) && e.status).toBe(403);
		}

		// listPendingUsers surfaces them for the admin approvals view.
		const pending = await listPendingUsers(env.DB);
		expect(pending.some((row) => row.id === user.id)).toBe(true);

		// Admin approves — same action the /admin/approvals form triggers.
		const ok = await setUserStatus(env.DB, user.id, 'approved');
		expect(ok).toBe(true);

		// The SAME session token, re-resolved (no re-login): now approved.
		const after = await validateSessionToken(env.DB, token);
		expect(after?.user.status).toBe('approved');
		expect(requireUser({ user: after?.user ?? null } as App.Locals)).toEqual(after?.user);

		// No longer in the pending queue.
		const pendingAfter = await listPendingUsers(env.DB);
		expect(pendingAfter.some((row) => row.id === user.id)).toBe(false);
	});

	it('setUserStatus is idempotent', async () => {
		const user = await upsertGoogleUser(
			env.DB,
			{ sub: 'google-sub-idempotent', email: 'idempotent@example.com', name: 'I' },
			undefined
		);
		expect(await setUserStatus(env.DB, user.id, 'approved')).toBe(true);
		expect(await setUserStatus(env.DB, user.id, 'approved')).toBe(true);
	});

	it('setUserStatus on an unknown id is a no-op false', async () => {
		expect(await setUserStatus(env.DB, 'no-such-user-id', 'approved')).toBe(false);
	});
});
