// Server-safe theme helpers (no runes; importable from hooks / +layout.server).
// The reactive store lives in ./store.svelte so it can use $state. This module
// only holds the shared constants + pure resolver, mirroring the i18n split.

/** The three selectable colour modes. `system` follows prefers-color-scheme. */
export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODES: ThemeMode[] = ['system', 'dark', 'light'];
export const DEFAULT_THEME: ThemeMode = 'system';

/** Cookie holding the chosen theme (client-writable, so NOT httpOnly). Read on
 *  the server to stamp `data-theme` into the first byte of HTML (no flash). */
export const THEME_COOKIE = 'trips-theme';
/** localStorage key — the belt-and-braces client copy read by the inline
 *  bootstrap script in app.html for cached/prerendered pages. */
export const THEME_STORAGE_KEY = 'trips.theme';
/** One year, in seconds. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isThemeMode(v: string | null | undefined): v is ThemeMode {
	return v === 'light' || v === 'dark' || v === 'system';
}

/** Resolve the effective mode for a request from the cookie (else `system`). */
export function resolveTheme(cookieValue: string | null | undefined): ThemeMode {
	return isThemeMode(cookieValue) ? cookieValue : DEFAULT_THEME;
}

/** The `data-theme` attribute string to stamp on <html> for an explicit mode.
 *  `system` yields '' so @media (prefers-color-scheme) governs the tokens. */
export function themeAttr(mode: ThemeMode): string {
	return mode === 'light' || mode === 'dark' ? ` data-theme="${mode}"` : '';
}
