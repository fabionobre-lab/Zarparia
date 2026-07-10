// Reactive UI-locale store + translation/formatting helpers for Svelte 5 runes.
//
// A single module-level $state holds the active locale. It is seeded from
// layout data (which comes from the cookie / Accept-Language on the server) at
// the top of the root +layout.svelte, synchronously, BEFORE any child renders —
// so SSR and hydration agree and there is no flash of the wrong language.
//
// Reading `active` inside `t()`/`formatDate()` from a component template
// registers a reactive dependency, so switching locale re-renders the chrome
// immediately without a full page reload.
import { catalogs, DEFAULT_LOCALE, type Locale, type Messages } from './messages';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from './index';

let active = $state<Locale>(DEFAULT_LOCALE);

/** Seed the active locale (called once from the root layout, both SSR + client). */
export function initLocale(locale: Locale): void {
	active = locale;
}

/** The currently active UI locale (reactive when read in a component/derived). */
export function locale(): Locale {
	return active;
}

/** Switch locale on the client: update state (immediate UI update), persist the
 *  cookie for the next SSR render, and sync <html lang>. */
export function setLocale(locale: Locale): void {
	active = locale;
	if (typeof document !== 'undefined') {
		document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
		document.documentElement.lang = locale;
	}
}

type Params = Record<string, string | number>;

/** Translate a key with optional {placeholder} interpolation. */
export function t(key: keyof Messages, params?: Params): string {
	let out: string = catalogs[active][key];
	if (params) {
		for (const name in params) {
			out = out.replaceAll(`{${name}}`, String(params[name]));
		}
	}
	return out;
}

/** Format an ISO date (YYYY-MM-DD) in the active UI locale.
 *  en-GB → "9 Oct 2026"; pt-BR → "9 de out. de 2026". */
export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
	if (!iso) return '';
	const opts: Intl.DateTimeFormatOptions = options ?? {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	};
	return new Intl.DateTimeFormat(active, opts).format(new Date(iso + 'T00:00:00Z'));
}

/** Format an inclusive date range in the active UI locale ("9 – 16 Oct 2026"). */
export function formatDateRange(start: string | null, end: string | null): string {
	if (!start || !end) return '';
	return `${formatDate(start)} – ${formatDate(end)}`;
}
