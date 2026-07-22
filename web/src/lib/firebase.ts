// Client-side Firebase config for email+password sign-in. Identity only —
// the Worker never talks to Firebase directly; it verifies the ID token this
// SDK produces (see src/lib/server/firebase.ts) and issues its own session.
//
// The firebase/app and firebase/auth packages are only ever reached through
// the dynamic import() in getFirebaseAuth() below, so the SDK never lands in
// the main bundle for the (majority of) signed-out visitors who use Google
// sign-in instead.
// Public web-app config (these values ship in every client bundle — not secret).
// Firebase project "zarparia", provisioned 2026-07-21.
const firebaseConfig = {
	apiKey: 'AIzaSyDb0vuDZ2KPyPOkrmM6LD_lhILLw9VKbO4',
	authDomain: 'zarparia.firebaseapp.com',
	projectId: 'zarparia',
	appId: '1:121048535951:web:700bf2f8b6a03e0b45b1fa'
};

/** False until firebaseConfig is filled in — gates the email/password UI so a
 *  not-yet-provisioned deploy shows only the Google button, never a form that
 *  can't actually work. Mirrors the server-side firebaseProjectId gate in
 *  src/lib/server/authenv.ts. */
export const firebaseEnabled = firebaseConfig.projectId !== '';

let authPromise: Promise<import('firebase/auth').Auth> | null = null;

/** Lazily initializes the Firebase app + Auth instance, once. */
export function getFirebaseAuth(): Promise<import('firebase/auth').Auth> {
	if (!authPromise) {
		authPromise = (async () => {
			const { initializeApp, getApps, getApp } = await import('firebase/app');
			const { getAuth } = await import('firebase/auth');
			const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
			return getAuth(app);
		})();
	}
	return authPromise;
}
