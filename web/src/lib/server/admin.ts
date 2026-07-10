import type { SessionUser } from '$lib/types';

/** Fallback admin identity when ADMIN_EMAIL is not set in the Worker env. */
const DEFAULT_ADMIN_EMAIL = 'fabionobre.ai@gmail.com';

/** ADMIN_EMAIL is a plain Worker var (like DEV_AUTH), so it isn't in the
 *  wrangler-generated `Env` type — read it through a narrow cast. */
interface AdminEnvVars {
	ADMIN_EMAIL?: string;
}

/** The email that grants admin (feedback triage) access, normalized to
 *  trimmed lowercase to match the stored user email. */
export function getAdminEmail(platform: App.Platform | undefined): string {
	const env = (platform?.env ?? {}) as unknown as AdminEnvVars;
	return (env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

/** True when the given user is the platform admin. */
export function isAdmin(user: SessionUser | null | undefined, platform: App.Platform | undefined): boolean {
	if (!user) return false;
	return user.email.trim().toLowerCase() === getAdminEmail(platform);
}
