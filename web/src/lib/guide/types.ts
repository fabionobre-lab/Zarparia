// Shared shape for the user guide (Phase 4, LAUNCH_PLAN.md). Kept out of
// lib/i18n/messages.ts on purpose, same reasoning as lib/legal/types.ts:
// this is paragraph-scale explanatory copy the owner edits as prose, not
// short UI chrome strings.
import type { Locale } from '$lib/i18n';

export interface GuideEntry {
	/** Stable id — also the #anchor (e.g. /guide#share-trip) and asserted
	 *  unique across the whole doc in tests. Edit with care: other pages may
	 *  link to it. */
	id: string;
	/** Entry heading, e.g. "Share a trip" or "Trip" (glossary term). */
	title: string;
	/** 1+ short paragraphs — plain language, 2-6 sentences total. */
	body: string[];
}

export interface GuideGroup {
	/** Stable identifier — asserted in tests to match across locales. */
	id: string;
	heading: string;
	entries: GuideEntry[];
}

export interface GuideDoc {
	intro: string;
	groups: GuideGroup[];
}

export type GuideCatalog = Record<Locale, GuideDoc>;
