// Server-safe i18n helpers (no runes; importable from hooks / +layout.server).
// The reactive store, `t`, and `formatDate` live in ./store.svelte so they can
// use $state; this module only holds pure helpers + shared constants.
import { DEFAULT_LOCALE, LOCALES, type Locale } from './messages';

export { LOCALES, DEFAULT_LOCALE, LOCALE_SHORT } from './messages';
export type { Locale, Messages } from './messages';
export { catalogs } from './messages';

/** Cookie holding the chosen UI locale (client-writable, so NOT httpOnly).
    Named per the Aria Nobre storage-key convention — cookie twin naming
    follows `zarparia-theme` (round-2 sweep, 2026-07-17). */
export const LOCALE_COOKIE = 'zarparia-lang';
/** Pre-convention name; read once as a fallback in hooks.server and
    re-issued under LOCALE_COOKIE, mirroring the theme-cookie migration. */
export const LEGACY_LOCALE_COOKIE = 'ui-locale';
/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(v: string | null | undefined): v is Locale {
	return v === 'en-GB' || v === 'pt-BR';
}

/** Derive a locale from an Accept-Language header: pt* → pt-BR, else the default. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
	if (!header) return DEFAULT_LOCALE;
	// First language tag wins; "pt", "pt-BR", "pt-PT" all map to pt-BR here.
	for (const part of header.split(',')) {
		const tag = part.split(';')[0].trim().toLowerCase();
		if (!tag) continue;
		if (tag.startsWith('pt')) return 'pt-BR';
		if (tag.startsWith('en')) return 'en-GB';
	}
	return DEFAULT_LOCALE;
}

/** Resolve the effective locale for a request: cookie first, else Accept-Language. */
export function resolveLocale(
	cookieValue: string | null | undefined,
	acceptLanguage: string | null | undefined
): Locale {
	if (isLocale(cookieValue)) return cookieValue;
	return localeFromAcceptLanguage(acceptLanguage);
}

export { LOCALES as ALL_LOCALES };
