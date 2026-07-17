/** Reads auth-related runtime config from the Worker env (secrets + vars).
 *  These are not part of the wrangler-generated `Env` type (secrets aren't in
 *  wrangler.jsonc), so we read them through a narrow cast here. */
interface AuthEnvVars {
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	DEV_AUTH?: string;
	FIREBASE_PROJECT_ID?: string;
}

export interface AuthEnv {
	googleClientId: string;
	googleClientSecret: string;
	/** When true, the dev-only /auth/dev-login route is enabled. Never set in production. */
	devAuth: boolean;
	/** Firebase project id (wrangler.jsonc `vars.FIREBASE_PROJECT_ID`, a public
	 *  value — Firebase project ids aren't secrets). Empty until Fabio
	 *  provisions the Firebase project; email+password sign-in stays disabled
	 *  (404 at /auth/login/firebase) until it's set. */
	firebaseProjectId: string;
}

export function getAuthEnv(platform: App.Platform | undefined): AuthEnv {
	const env = (platform?.env ?? {}) as unknown as AuthEnvVars;
	return {
		googleClientId: env.GOOGLE_CLIENT_ID ?? '',
		googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
		devAuth: env.DEV_AUTH === '1',
		firebaseProjectId: env.FIREBASE_PROJECT_ID ?? ''
	};
}
