/** A signed-in user, attached to event.locals by hooks.server.ts. */
export interface SessionUser {
	id: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
}
