/** Approval-gate state (Phase 3). New sign-ins start 'pending'; only
 *  'approved' users may reach app data (enforced in guards.ts). */
export type UserStatus = 'pending' | 'approved' | 'rejected';

/** A signed-in user, attached to event.locals by hooks.server.ts. */
export interface SessionUser {
	id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
	status: UserStatus;
}
