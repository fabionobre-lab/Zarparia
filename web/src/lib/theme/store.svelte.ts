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
	isDarkTheme,
	manifestHref,
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

/**
 * Point `<link rel="manifest">` at the light or dark manifest. Android 3-button
 * navigation takes the system bar colour from the manifest, and a manifest
 * holds one colour, so the link must follow the theme in use. Chrome reads the
 * manifest at install and at its update checks. A no-op when there is no link
 * (or no document). app.html's pre-paint script does the same before first
 * paint.
 */
function syncManifestLink(mode: ThemeMode): void {
	if (typeof document === 'undefined') return;
	const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
	if (!link) return;
	const systemDark =
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-color-scheme: dark)').matches;
	const href = manifestHref(isDarkTheme(mode, systemDark));
	if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

/** Seed the active mode (called once from the root layout, both SSR + client). */
export function initTheme(mode: ThemeMode): void {
	active = mode;
	registerSystemModeRepair();
	syncManifestLink(mode);
}

/**
 * Suppress all CSS transitions on <html> and its descendants for one paint
 * cycle while `apply` runs, then restore them. Works around a Chromium bug
 * (through v148) where a transitioned property (color, border-color,
 * background) keeps rendering the OLD theme's resolved value when the
 * custom property feeding it changes on a `data-theme` swap — several
 * scoped component styles transition these (BottomBar, Sidebar, TripBlock,
 * TripDay, TripView, ThemeToggle, +page.svelte) and would otherwise freeze
 * mid-swap. See the `[data-theme-swap]` kill-switch in src/styles/tokens.css.
 * `apply` may be a no-op — the system-mode repair below has nothing to set
 * but still needs the freeze/reflow cycle to run so frozen properties
 * re-resolve. SSR-safe: falls back to just running `apply` when there's no
 * `document`.
 */
function swapColorScheme(apply: () => void): void {
	if (typeof document === 'undefined') {
		apply();
		return;
	}
	const root = document.documentElement;
	root.setAttribute('data-theme-swap', '');
	void root.offsetWidth; // forced reflow: suppression active before the change
	apply();
	void root.offsetWidth; // forced reflow: properties re-resolve while suppressed
	root.removeAttribute('data-theme-swap');
}

let mediaListenerRegistered = false;

/**
 * System-mode repair: on 'system' no `data-theme` attribute is ever written
 * — CSS follows `prefers-color-scheme` directly via media query, and no JS
 * runs when the OS flips light/dark, so the freeze bug above would go
 * unrepaired. This listens for the OS-level scheme change and runs the same
 * suppressed-transition cycle as a repair, with a no-op `apply` (nothing to
 * set; the point is just to force the freeze/reflow cycle so already-frozen
 * properties re-resolve). Runs twice per event: once synchronously (hidden/
 * background tabs never get an animation frame, so an rAF-only repair could
 * sit pending forever) and once on the next rAF (the 'change' event can fire
 * before the new color-scheme has actually propagated to style resolution,
 * so an early-only flush could re-commit the OLD values). The cycle is
 * idempotent, so running it twice is safe. Note: this won't visibly fire
 * under DevTools "emulate CSS media" — it needs a real OS-level scheme
 * change to trigger matchMedia's 'change' event.
 */
function registerSystemModeRepair(): void {
	if (mediaListenerRegistered) return;
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
	mediaListenerRegistered = true;
	const mql = window.matchMedia('(prefers-color-scheme: dark)');
	mql.addEventListener('change', () => {
		if (active !== 'system') return;
		syncManifestLink(active);
		swapColorScheme(() => {});
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				if (active !== 'system') return;
				swapColorScheme(() => {});
			});
		}
	});
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
	swapColorScheme(() => {
		const el = document.documentElement;
		if (mode === 'light' || mode === 'dark') el.setAttribute('data-theme', mode);
		else el.removeAttribute('data-theme');
	});
	applyThemeColor(mode);
	syncManifestLink(mode);
}

/** Cycle order shown in the header toggle: system → dark → light → system. */
export function nextTheme(mode: ThemeMode): ThemeMode {
	return mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system';
}
