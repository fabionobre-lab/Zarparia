/**
 * Shared segment-theme → color palette, used anywhere a trip's theme needs to
 * be rendered outside TripView.svelte (which sets the same bases via its
 * `.shell.theme-*` CSS rules). Each theme is ONE base colour (the `bg`/`accent`,
 * which are identical) plus its gold `eyebrow` — the single-base house model
 * (see docs/DESIGN_SYSTEM.md). The base hex IS the light-mode identity.
 *
 * Consumers should emit only the BASE colour inline and let the mode-aware
 * tints derive in CSS (tokens.css / the home card band derive an OKLCH-lightened
 * band in dark), rather than hard-coding a light tint that can't adapt. The
 * light values here match the CSS bases exactly.
 */
import type { ThemeColors } from './trip-engine';

export interface ThemePalette {
	bg: string;
	eyebrow: string;
	accent: string;
}

export const THEME_COLORS: Record<string, ThemePalette> = {
	tartan: { bg: '#2b4a2b', eyebrow: '#e8c84a', accent: '#2b4a2b' },
	navy: { bg: '#1e3054', eyebrow: '#c17817', accent: '#1e3054' },
	terracotta: { bg: '#7c3a29', eyebrow: '#e6b566', accent: '#7c3a29' },
	olive: { bg: '#4a5324', eyebrow: '#d9c46a', accent: '#4a5324' },
	azure: { bg: '#17456b', eyebrow: '#e0a24a', accent: '#17456b' },
	sand: { bg: '#5b4a30', eyebrow: '#e8cf8a', accent: '#5b4a30' }
};

/** Resolve a segment/trip's palette: explicit per-trip `themeColors` override
 *  first, falling back to the named theme's defaults (tartan if unknown/absent). */
export function paletteFor(theme: string | undefined, overrides?: ThemeColors): ThemePalette {
	const base = THEME_COLORS[theme || 'tartan'] ?? THEME_COLORS.tartan;
	return {
		bg: overrides?.heroBg || base.bg,
		eyebrow: overrides?.eyebrow || base.eyebrow,
		accent: overrides?.accent || base.accent
	};
}
