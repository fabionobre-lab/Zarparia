import type { LayoutServerLoad } from './$types';
import { isAdmin } from '$lib/server/admin';

export const load: LayoutServerLoad = async ({ locals, platform }) => {
	return {
		user: locals.user,
		locale: locals.locale,
		theme: locals.theme,
		// Lets the nav chrome (Sidebar / BottomBar More sheet) show the
		// admin-only Approvals entry. Display-only: every admin route still
		// re-checks isAdmin server-side on load and on every action.
		admin: isAdmin(locals.user, platform)
	};
};
