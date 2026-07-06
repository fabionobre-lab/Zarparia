/** Reads auth-related runtime config from the Worker env (secrets + vars).
 *  These are not part of the wrangler-generated `Env` type (secrets aren't in
 *  wrangler.jsonc), so we read them through a narrow cast here. */
interface AuthEnvVars {
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	DEV_AUTH?: string;
}

export interface AuthEnv {
	googleClientId: string;
	googleClientSecret: string;
	/** When true, the dev-only /auth/dev-login route is enabled. Never set in production. */
	devAuth: boolean;
}

export function getAuthEnv(platform: App.Platform | undefined): AuthEnv {
	const env = (platform?.env ?? {}) as unknown as AuthEnvVars;
	return {
		googleClientId: env.GOOGLE_CLIENT_ID ?? '',
		googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
		devAuth: env.DEV_AUTH === '1'
	};
}
