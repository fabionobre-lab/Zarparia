// Reactive theme-mode store for Svelte 5 runes.
//
// A single module-level $state holds the active mode. It is seeded from layout
// data (which comes from the `zarparia-theme` cookie on the server, falling
// back to the legacy `trips-theme` cookie once — see hooks.server.ts) at the
// top of the root +layout.svelte, synchronously, BEFORE any child renders —
// so SSR and hydration agree and there is no flash of the wrong theme.
//
// Applying a mode does two things: writes the persistence (cookie for the next
// SSR render + localStorage for the inline bootstrap on cached pages) and
// stamps/clears `data-theme` on <html>. `system` clears the attribute so the
// @media (prefers-color-scheme) rules in tokens.css take over.
import {
	DEFAULT_THEME,
	THEME_COOKIE,
	THEME_COOKIE_MAX_AGE,
	THEME_STORAGE_KEY,
	type ThemeMode
} from './index';

let active = $state<ThemeMode>(DEFAULT_THEME);

/** Seed the active mode (called once from the root layout, both SSR + client). */
export function initTheme(mode: ThemeMode): void {
	active = mode;
}

/** The currently active theme mode (reactive when read in a component). */
export function theme(): ThemeMode {
	return active;
}

/** Apply a mode on the client: update state, persist, and reflect on <html>. */
export function setTheme(mode: ThemeMode): void {
	active = mode;
	if (typeof document === 'undefined') return;
	document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
	try {
		localStorage.setItem(THEME_STORAGE_KEY, mode);
	} catch {
		// Private-mode / storage-disabled: the cookie still carries SSR state.
	}
	const el = document.documentElement;
	if (mode === 'light' || mode === 'dark') el.setAttribute('data-theme', mode);
	else el.removeAttribute('data-theme');
}

/** Cycle order shown in the header toggle: system → dark → light → system. */
export function nextTheme(mode: ThemeMode): ThemeMode {
	return mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system';
}
