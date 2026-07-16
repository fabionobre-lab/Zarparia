// Shared shape for the long-form legal documents (Privacy Policy, Terms of
// Service). Kept out of lib/i18n/messages.ts on purpose — that catalog is for
// short UI chrome strings, while this is paragraph-scale legal copy that the
// owner reviews/edits as prose, not as translation-table rows.
import type { Locale } from '$lib/i18n';

export interface LegalSection {
	/** Stable identifier — also asserted in tests to match across locales. */
	id: string;
	heading: string;
	paragraphs: string[];
	/** Optional bullet list rendered after the paragraphs. */
	bullets?: string[];
}

export interface LegalDoc {
	/** Document title, e.g. "Privacy Policy" — used as the page <h1>. */
	title: string;
	/** Lead-in paragraph(s) shown above the section list. */
	intro: string[];
	sections: LegalSection[];
}

export type LegalCatalog = Record<Locale, LegalDoc>;
