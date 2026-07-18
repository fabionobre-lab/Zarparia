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

// Canonical --an-bg pair (design/aria-nobre-tokens.css) — the browser-chrome
// color per theme. Must match the static meta[name="theme-color"] contents in
// app.html and the pre-paint stamp there.
const THEME_COLOR = { light: '#F5F2EC', dark: '#141B28' } as const;

/**
 * `theme-color` must track the pinned theme (DESIGN.md Conventions): the
 * media-filtered meta pair in app.html only covers system mode, so when the
 * user pins light/dark we overwrite BOTH metas with the pinned value; on
 * 'system' we restore each meta's per-media original. app.html's pre-paint
 * script performs the same stamp before first paint.
 */
function applyThemeColor(mode: ThemeMode): void {
	const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
	for (const meta of metas) {
		if (mode === 'light' || mode === 'dark') meta.content = THEME_COLOR[mode];
		else meta.content = meta.media.includes('dark') ? THEME_COLOR.dark : THEME_COLOR.light;
	}
}

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
	applyThemeColor(mode);
}

/** Cycle order shown in the header toggle: system → dark → light → system. */
export function nextTheme(mode: ThemeMode): ThemeMode {
	return mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system';
}
