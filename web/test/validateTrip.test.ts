// Schema validation for the packing/pre-trip "checklist" block field
// (Phase 6 item 2, Tripsy pattern) — title + items[{text, done}], usable on
// any block. Guards both the happy path and the malformed shapes that
// additionalProperties:false / required should reject.
import { describe, expect, it } from 'vitest';
import { validateTripDoc } from '../src/lib/validateTrip';
import demoTrip from '../src/lib/seed/demo-trip.json';

function baseTrip(blockOverrides: Record<string, unknown> = {}) {
	return {
		id: 'test-trip',
		title: { en: 'Test Trip' },
		languages: ['en'],
		defaultLanguage: 'en',
		segments: [
			{
				id: 'seg',
				title: { en: 'Segment' },
				plans: [
					{
						id: 'main',
						days: [
							{
								date: '2026-01-01',
								title: { en: 'Day 1' },
								blocks: [
									{
										time: '09:00',
										title: { en: 'Block' },
										...blockOverrides
									}
								]
							}
						]
					}
				]
			}
		]
	};
}

describe('validateTripDoc — checklist block', () => {
	it('a trip document without any checklist still validates (backward compatible)', () => {
		expect(validateTripDoc(baseTrip()).valid).toBe(true);
	});

	it('accepts a block with a well-formed checklist', () => {
		const doc = baseTrip({
			checklist: {
				title: { en: 'Packing' },
				items: [
					{ text: { en: 'Passport' }, done: true },
					{ text: { en: 'Charger' }, done: false }
				]
			}
		});
		const result = validateTripDoc(doc);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('rejects a checklist item missing the done flag', () => {
		const doc = baseTrip({
			checklist: { title: { en: 'Packing' }, items: [{ text: { en: 'Passport' } }] }
		});
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects a checklist item missing text', () => {
		const doc = baseTrip({
			checklist: { title: { en: 'Packing' }, items: [{ done: false }] }
		});
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects a checklist item carrying an unknown extra property', () => {
		const doc = baseTrip({
			checklist: {
				title: { en: 'Packing' },
				items: [{ text: { en: 'Passport' }, done: false, notes: 'extra' }]
			}
		});
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects a checklist with an empty items array', () => {
		const doc = baseTrip({ checklist: { title: { en: 'Packing' }, items: [] } });
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects a checklist missing a title', () => {
		const doc = baseTrip({
			checklist: { items: [{ text: { en: 'Passport' }, done: false }] }
		});
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects a block whose checklist is not an object', () => {
		expect(validateTripDoc(baseTrip({ checklist: 'Packing' })).valid).toBe(false);
	});

	it('the /demo seed trip (now carrying a packing checklist block) still validates', () => {
		const result = validateTripDoc(demoTrip);
		expect(result.errors).toEqual([]);
		expect(result.valid).toBe(true);
	});
});
