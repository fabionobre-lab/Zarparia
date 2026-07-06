import type { Handle } from '@sveltejs/kit';

// Phase B replaces this stub: read the session cookie, look it up in D1,
// and attach the user (or null) to event.locals.
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	return resolve(event);
};
