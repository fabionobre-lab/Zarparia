import { Google } from 'arctic';
import { error } from '@sveltejs/kit';
import { getAuthEnv } from './authenv';

/** Redirect URI must exactly match one registered in the Google OAuth client.
 *  Derived from the request origin so localhost and prod both work. */
export function googleRedirectUri(origin: string): string {
	return origin + '/auth/callback/google';
}

export function getGoogle(platform: App.Platform | undefined, origin: string): Google {
	const { googleClientId, googleClientSecret } = getAuthEnv(platform);
	if (!googleClientId || !googleClientSecret) {
		throw error(500, 'Google sign-in is not configured on this server.');
	}
	return new Google(googleClientId, googleClientSecret, googleRedirectUri(origin));
}

export interface GoogleProfile {
	sub: string;
	email: string;
	name?: string;
	picture?: string;
	email_verified?: boolean;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
	const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw error(502, 'Failed to fetch Google profile.');
	return (await res.json()) as GoogleProfile;
}
