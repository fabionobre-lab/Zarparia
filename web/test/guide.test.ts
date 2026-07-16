// Phase 4 — user guide (LAUNCH_PLAN.md 4.1). Same rationale as
// test/legal.test.ts: no SvelteKit request pipeline is spun up for a plain
// +page.svelte, so this asserts the thing most likely to silently drift —
// that the bilingual content module stays in lockstep (same group/entry ids,
// same order, nothing present in one locale and missing in the other) — plus
// that every entry id is unique, since entry ids double as public #anchors
// (e.g. /guide#share-trip) that other pages may deep-link to.
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../src/lib/i18n';
import { guide } from '../src/lib/guide/content';
import type { GuideCatalog, GuideDoc } from '../src/lib/guide/types';

function groupIds(doc: GuideDoc): string[] {
	return doc.groups.map((g) => g.id);
}

function entryIds(doc: GuideDoc): string[] {
	return doc.groups.flatMap((g) => g.entries.map((e) => e.id));
}

describe('user guide content', () => {
	it('has a complete, matching set of groups and entries in every locale', () => {
		expect(Object.keys(guide as GuideCatalog).sort()).toEqual([...LOCALES].sort());

		const [first, ...rest] = LOCALES;
		const referenceGroups = groupIds(guide[first]);
		const referenceEntries = entryIds(guide[first]);

		for (const locale of rest) {
			const doc = guide[locale];
			expect(doc.intro.trim().length, `${locale} intro`).toBeGreaterThan(0);
			expect(groupIds(doc), `${locale} group ids`).toEqual(referenceGroups);
			expect(entryIds(doc), `${locale} entry ids`).toEqual(referenceEntries);
		}
	});

	it('gives every entry a non-empty title and body, in every locale', () => {
		for (const locale of LOCALES) {
			const doc = guide[locale];
			for (const group of doc.groups) {
				expect(group.heading.trim().length, `${locale} ${group.id} heading`).toBeGreaterThan(0);
				for (const entry of group.entries) {
					expect(entry.title.trim().length, `${locale} ${entry.id} title`).toBeGreaterThan(0);
					expect(entry.body.length, `${locale} ${entry.id} body`).toBeGreaterThan(0);
					for (const p of entry.body) expect(p.trim().length).toBeGreaterThan(0);
				}
			}
		}
	});

	it('has unique entry ids across the whole document (they double as #anchors)', () => {
		for (const locale of LOCALES) {
			const ids = entryIds(guide[locale]);
			expect(new Set(ids).size, `${locale} unique entry ids`).toBe(ids.length);
		}
	});

	it('covers the required groups from LAUNCH_PLAN.md 4.1', () => {
		expect(groupIds(guide['en-GB'])).toEqual(['getting-started', 'screens', 'how-do-i', 'glossary']);
	});

	it('includes a share-trip entry so /guide#share-trip is a stable deep link', () => {
		expect(entryIds(guide['en-GB'])).toContain('share-trip');
	});
});
