// Phase 3 approval gate — guards.ts is the single choke point every data
// endpoint flows through. Pure-function tests: no D1 needed (locals.user is
// already resolved by hooks.server.ts by the time a route sees it).
import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { requireUser, requireUserAnyStatus } from '../src/lib/server/guards';
import type { SessionUser } from '../src/lib/types';

function localsWith(user: SessionUser | null): App.Locals {
	return { user, locale: 'en-GB', theme: 'system' } as App.Locals;
}

const approvedUser: SessionUser = {
	id: 'u1',
	email: 'ok@example.com',
	name: 'OK',
	avatarUrl: null,
	status: 'approved'
};
const pendingUser: SessionUser = { ...approvedUser, id: 'u2', status: 'pending' };
const rejectedUser: SessionUser = { ...approvedUser, id: 'u3', status: 'rejected' };

describe('requireUser', () => {
	it('throws 401 when signed out', () => {
		expect.assertions(2);
		try {
			requireUser(localsWith(null));
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) expect(e.status).toBe(401);
		}
	});

	it('throws 403 for a pending user', () => {
		expect.assertions(2);
		try {
			requireUser(localsWith(pendingUser));
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) expect(e.status).toBe(403);
		}
	});

	it('throws 403 for a rejected user', () => {
		expect.assertions(2);
		try {
			requireUser(localsWith(rejectedUser));
		} catch (e) {
			expect(isHttpError(e)).toBe(true);
			if (isHttpError(e)) expect(e.status).toBe(403);
		}
	});

	it('returns the user for an approved account', () => {
		expect(requireUser(localsWith(approvedUser))).toEqual(approvedUser);
	});
});

describe('requireUserAnyStatus', () => {
	it('throws 401 when signed out', () => {
		expect.assertions(1);
		try {
			requireUserAnyStatus(localsWith(null));
		} catch (e) {
			expect(isHttpError(e) && e.status).toBe(401);
		}
	});

	it('passes a pending user through (whoami/logout/pending-screen surfaces)', () => {
		expect(requireUserAnyStatus(localsWith(pendingUser))).toEqual(pendingUser);
	});

	it('passes an approved user through', () => {
		expect(requireUserAnyStatus(localsWith(approvedUser))).toEqual(approvedUser);
	});
});
