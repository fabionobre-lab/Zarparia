// Phase 1 — legal pack (LAUNCH_PLAN.md). Route-level HTTP tests aren't
// practical here: this suite runs against server modules imported directly
// inside the Workers runtime (see the other test/*.test.ts files, which all
// import a `+server.ts` GET/DELETE/etc and call it with a hand-built
// RequestEvent) — there's no SvelteKit request pipeline spun up to hit a
// plain `+page.svelte` route over HTTP. /privacy and /terms have no
// `+page.server.ts` (they don't need one — no auth, no data load), so there's
// no server function to import either.
//
// Instead this asserts the thing most likely to silently drift: that the
// bilingual content modules stay in lockstep — same section ids, same order,
// nothing present in one locale and missing in the other — plus that the
// facts the launch plan requires (cookie names, governing law, retention
// window) are actually present in the text.
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../src/lib/i18n';
import { privacy } from '../src/lib/legal/privacy';
import { terms } from '../src/lib/legal/terms';
import type { LegalCatalog, LegalDoc } from '../src/lib/legal/types';

const REQUIRED_PRIVACY_SECTIONS = [
	'what-we-store',
	'where-it-lives',
	'cookies',
	'google-photos',
	'mcp-connector',
	'sharing',
	'your-rights',
	'approval-gate',
	'backups',
	'contact',
	'changes'
];

const REQUIRED_TERMS_SECTIONS = [
	'early-access',
	'the-service',
	'acceptable-use',
	'sharing-responsibilities',
	'not-advice',
	'availability',
	'termination',
	'governing-law',
	'support',
	'changes'
];

function sectionIds(doc: LegalDoc): string[] {
	return doc.sections.map((s) => s.id);
}

function assertLocalesComplete(catalog: LegalCatalog, requiredSections: string[]) {
	expect(Object.keys(catalog).sort()).toEqual([...LOCALES].sort());

	const [first, ...rest] = LOCALES;
	const referenceIds = sectionIds(catalog[first]);
	expect(referenceIds).toEqual(requiredSections);

	for (const locale of rest) {
		const doc = catalog[locale];
		expect(doc.title.trim().length).toBeGreaterThan(0);
		expect(doc.intro.length).toBeGreaterThan(0);
		for (const p of doc.intro) expect(p.trim().length).toBeGreaterThan(0);
		// Same section ids, same order, in every locale.
		expect(sectionIds(doc)).toEqual(referenceIds);
	}

	for (const locale of LOCALES) {
		const doc = catalog[locale];
		for (const section of doc.sections) {
			expect(section.heading.trim().length, `${locale} ${section.id} heading`).toBeGreaterThan(0);
			expect(section.paragraphs.length, `${locale} ${section.id} paragraphs`).toBeGreaterThan(0);
			for (const p of section.paragraphs) expect(p.trim().length).toBeGreaterThan(0);
			if (section.bullets) {
				expect(section.bullets.length).toBeGreaterThan(0);
				for (const b of section.bullets) expect(b.trim().length).toBeGreaterThan(0);
			}
		}
	}
}

describe('privacy policy content', () => {
	it('has a complete, matching set of sections in every locale', () => {
		assertLocalesComplete(privacy, REQUIRED_PRIVACY_SECTIONS);
	});

	it('discloses exactly the three real cookie names', () => {
		for (const locale of LOCALES) {
			const cookies = privacy[locale].sections.find((s) => s.id === 'cookies');
			expect(cookies, `${locale} cookies section`).toBeDefined();
			const text = (cookies!.bullets ?? []).join(' ');
			expect(text).toContain('session');
			expect(text).toContain('ui-locale');
			expect(text).toContain('trips-theme');
		}
	});

	it('states the 35-day backup retention window', () => {
		for (const locale of LOCALES) {
			const backups = privacy[locale].sections.find((s) => s.id === 'backups');
			expect(backups, `${locale} backups section`).toBeDefined();
			expect(backups!.paragraphs.join(' ')).toContain('35');
		}
	});
});

describe('terms of service content', () => {
	it('has a complete, matching set of sections in every locale', () => {
		assertLocalesComplete(terms, REQUIRED_TERMS_SECTIONS);
	});

	it('names England and Wales as the governing law, in each locale', () => {
		// Localised country names, not a literal English string — pt-BR says
		// "Inglaterra" / "País de Gales", not "England" / "Wales".
		const EXPECTED: Record<string, [RegExp, RegExp]> = {
			'en-GB': [/England/, /Wales/],
			'pt-BR': [/Inglaterra/, /Gales/]
		};
		for (const locale of LOCALES) {
			const law = terms[locale].sections.find((s) => s.id === 'governing-law');
			expect(law, `${locale} governing-law section`).toBeDefined();
			const text = law!.paragraphs.join(' ');
			const [country, nation] = EXPECTED[locale];
			expect(text).toMatch(country);
			expect(text).toMatch(nation);
		}
	});
});
