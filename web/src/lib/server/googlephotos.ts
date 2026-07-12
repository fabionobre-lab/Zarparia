/**
 * Google Photos Picker API client + access-token cookie.
 *
 * The Picker API (photospicker.googleapis.com) is the only sanctioned way to
 * reach a user's own photo library since the 2025 Library API restrictions:
 * the app opens a Google-hosted picker, the user selects photos there, and
 * the app may then list ONLY what was picked.
 *
 * The OAuth access token (scope photospicker.mediaitems.readonly) is kept in
 * a short-lived httpOnly cookie rather than in D1: it expires within the
 * hour, so nothing long-lived sits at rest, and re-connecting is a silent
 * redirect once consent has been granted. Picker baseUrls require this same
 * bearer token when fetching the actual bytes.
 */
import type { Cookies } from '@sveltejs/kit';

export const PHOTOS_TOKEN_COOKIE = 'gp_access';
export const PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

const PICKER_BASE = 'https://photospicker.googleapis.com/v1';

export function setPhotosTokenCookie(cookies: Cookies, token: string, expiresAt: Date): void {
	// 60s safety margin so the cookie never outlives the token.
	const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000) - 60);
	cookies.set(PHOTOS_TOKEN_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge
	});
}

export function getPhotosToken(cookies: Cookies): string | null {
	return cookies.get(PHOTOS_TOKEN_COOKIE) ?? null;
}

export function clearPhotosTokenCookie(cookies: Cookies): void {
	cookies.delete(PHOTOS_TOKEN_COOKIE, { path: '/' });
}

// ── Picker API shapes (subset we consume) ──────────────────────────────────

export interface PickerSession {
	id: string;
	pickerUri: string;
	mediaItemsSet?: boolean;
	pollingConfig?: { pollInterval?: string; timeoutIn?: string };
	expireTime?: string;
}

export interface PickedMediaItem {
	id: string;
	createTime: string; // ISO 8601, UTC
	type: 'PHOTO' | 'VIDEO' | 'TYPE_UNSPECIFIED';
	mediaFile?: {
		baseUrl: string;
		mimeType?: string;
		filename?: string;
		mediaFileMetadata?: { width?: number; height?: number };
	};
}

export interface PickedMediaItemsPage {
	mediaItems?: PickedMediaItem[];
	nextPageToken?: string;
}

/** Typed failure instead of a thrown 502, so routes can turn an expired /
 *  revoked token into a "reconnect" response the UI understands. */
export type PickerResult<T> =
	| { ok: true; value: T }
	| { ok: false; status: number; reason: 'unauthorized' | 'error' };

async function pickerFetch<T>(token: string, path: string, init?: RequestInit): Promise<PickerResult<T>> {
	const res = await fetch(PICKER_BASE + path, {
		...init,
		headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) }
	});
	if (res.status === 401 || res.status === 403) {
		return { ok: false, status: res.status, reason: 'unauthorized' };
	}
	if (!res.ok) return { ok: false, status: res.status, reason: 'error' };
	// DELETE returns an empty body.
	const text = await res.text();
	return { ok: true, value: (text ? JSON.parse(text) : {}) as T };
}

export function createPickerSession(token: string): Promise<PickerResult<PickerSession>> {
	return pickerFetch<PickerSession>(token, '/sessions', { method: 'POST' });
}

export function getPickerSession(token: string, sessionId: string): Promise<PickerResult<PickerSession>> {
	return pickerFetch<PickerSession>(token, `/sessions/${encodeURIComponent(sessionId)}`);
}

export function deletePickerSession(token: string, sessionId: string): Promise<PickerResult<unknown>> {
	return pickerFetch(token, `/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export function listPickedMediaItems(
	token: string,
	sessionId: string,
	pageSize: number,
	pageToken?: string
): Promise<PickerResult<PickedMediaItemsPage>> {
	const params = new URLSearchParams({ sessionId, pageSize: String(pageSize) });
	if (pageToken) params.set('pageToken', pageToken);
	return pickerFetch<PickedMediaItemsPage>(token, `/mediaItems?${params}`);
}

/** Fetch one rendition of a picked photo. Picker baseUrls are short-lived
 *  (~1h) and require the bearer token; `=w{n}-h{n}` bounds the size while
 *  preserving aspect ratio. */
export async function fetchPhotoBytes(
	token: string,
	baseUrl: string,
	maxPx: number
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
	const res = await fetch(`${baseUrl}=w${maxPx}-h${maxPx}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) return null;
	return {
		bytes: await res.arrayBuffer(),
		contentType: res.headers.get('content-type') ?? 'image/jpeg'
	};
}

/** "5s" / "5.5s" → milliseconds (Picker pollingConfig durations). */
export function pollIntervalMs(session: PickerSession): number {
	const raw = session.pollingConfig?.pollInterval ?? '';
	const m = /^([\d.]+)s$/.exec(raw);
	const ms = m ? Math.round(Number(m[1]) * 1000) : NaN;
	return Number.isFinite(ms) && ms >= 1000 ? ms : 5000;
}
