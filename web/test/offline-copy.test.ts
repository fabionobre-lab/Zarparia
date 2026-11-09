// zarparia-U4-04 Stage 1 / family theme T3: no text may claim that offline
// edits sync or are safe, because no code stores or replays them.
import { describe, expect, it } from 'vitest';
import { guide } from '../src/lib/guide/content';
import { catalogs, LOCALES } from '../src/lib/i18n/messages';
import { tripChrome } from '../src/lib/i18n/tripChrome';

const BANNED =
	/sync|sincroniz|will save|still here|nothing (was )?lost|nada (foi )?perdido|são salvas quando/i;
// Strings that match BANNED but are true: the draft saves by itself once a
// validation error is fixed, while the page stays open.
const ALLOWED = new Set(['Finish this edit and it will save automatically:']);

function texts(): string[] {
	const out: string[] = [];
	for (const doc of Object.values(guide)) {
		for (const g of doc.groups) {
			for (const e of g.entries) out.push(e.title, ...e.body);
		}
	}
	for (const c of Object.values(catalogs)) out.push(...Object.values(c));
	for (const c of Object.values(tripChrome)) {
		out.push(...Object.values(c).filter((v): v is string => typeof v === 'string'));
	}
	return out;
}

describe('offline copy', () => {
	it('guide entry "offline" says edits need a connection, in both languages', () => {
		const en = guide['en-GB'].groups.flatMap((g) => g.entries).find((e) => e.id === 'offline');
		const pt = guide['pt-BR'].groups.flatMap((g) => g.entries).find((e) => e.id === 'offline');
		expect(en?.body.join(' ')).toContain('Edits need a connection.');
		expect(pt?.body.join(' ')).toContain('Para editar, é preciso ter conexão.');
	});

	it('no guide or catalog text promises offline sync or saved edits', () => {
		const hits = texts().filter((s) => BANNED.test(s) && !ALLOWED.has(s));
		expect(hits).toEqual([]);
	});

	it('new keys exist and are non-empty in both languages', () => {
		for (const loc of LOCALES) {
			for (const k of [
				'save.offline',
				'offline.bar',
				'leave.title',
				'leave.body',
				'leave.confirm',
				'leave.stay'
			] as const) {
				expect(catalogs[loc][k].trim().length).toBeGreaterThan(0);
			}
		}
	});
});
