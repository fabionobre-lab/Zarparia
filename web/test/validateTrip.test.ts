// Schema validation for the packing/pre-trip "checklist" block field
// (Phase 6 item 2, Tripsy pattern) — title + items[{text, done}], usable on
// any block. Guards both the happy path and the malformed shapes that
// additionalProperties:false / required should reject.
import { describe, expect, it } from 'vitest';
import { validateTripDoc } from '../src/lib/validateTrip';
import { loc, type Trip } from '../src/lib/trip-engine';
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

// PhotoSpot.name switched from a plain string to Localized|string so photo
// captions translate with the rest of the trip content; the schema and the
// loc() helper both have to keep accepting the plain-string shape so trips
// stored before this change still validate and render.
describe('validateTripDoc — photoSpot name (Localized | string back-compat)', () => {
	it('accepts a plain-string photoSpot name (legacy shape)', () => {
		const doc = baseTrip({
			photoSpots: [{ name: 'Castle view', mapsUrl: 'https://maps.google.com/?q=Castle' }]
		});
		const result = validateTripDoc(doc);
		expect(result.errors).toEqual([]);
		expect(result.valid).toBe(true);
	});

	it('accepts a localized-object photoSpot name', () => {
		const doc = baseTrip({
			photoSpots: [
				{
					name: { en: 'Castle view', pt: 'Vista do castelo' },
					mapsUrl: 'https://maps.google.com/?q=Castle'
				}
			]
		});
		const result = validateTripDoc(doc);
		expect(result.errors).toEqual([]);
		expect(result.valid).toBe(true);
	});

	it('rejects a photoSpot name that is neither a string nor a localized object', () => {
		const doc = baseTrip({ photoSpots: [{ name: 42, mapsUrl: 'https://maps.google.com/?q=Castle' }] });
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects an empty-object photoSpot name (localized requires at least one language)', () => {
		const doc = baseTrip({ photoSpots: [{ name: {}, mapsUrl: 'https://maps.google.com/?q=Castle' }] });
		expect(validateTripDoc(doc).valid).toBe(false);
	});
});

describe('validateTripDoc — block guide (stop guide)', () => {
	it('accepts a block with an empty guide object', () => {
		const doc = baseTrip({ guide: {} });
		const result = validateTripDoc(doc);
		expect(result.errors).toEqual([]);
		expect(result.valid).toBe(true);
	});

	it('accepts a block with a full guide', () => {
		const doc = baseTrip({
			guide: {
				why: { en: 'Why this stop matters.' },
				before: { en: 'Book ahead; queues form early.' },
				dontMiss: [
					{ name: { en: 'The nave' }, text: { en: 'Look up at the ceiling.' } },
					{ name: { en: 'The cloister' }, text: { en: 'Quiet corner, few visitors.' } }
				],
				story: { en: 'Built in the 12th century.\n\nRestored after the fire.' },
				closer: { en: 'The worn step by the north door.' }
			}
		});
		const result = validateTripDoc(doc);
		expect(result.errors).toEqual([]);
		expect(result.valid).toBe(true);
	});

	it('rejects a guide with an unknown key', () => {
		const doc = baseTrip({ guide: { why: { en: 'Why' }, extra: 'nope' } });
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects a dontMiss item missing text', () => {
		const doc = baseTrip({ guide: { dontMiss: [{ name: { en: 'The nave' } }] } });
		expect(validateTripDoc(doc).valid).toBe(false);
	});

	it('rejects a dontMiss item with an unknown extra property', () => {
		const doc = baseTrip({
			guide: { dontMiss: [{ name: { en: 'N' }, text: { en: 'T' }, extra: 'nope' }] }
		});
		expect(validateTripDoc(doc).valid).toBe(false);
	});
});

describe('loc() — plain-string passthrough', () => {
	const trip: Trip = {
		id: 't',
		title: { en: 'T' },
		languages: ['en', 'pt'],
		defaultLanguage: 'en',
		segments: []
	};

	it('returns a plain string unchanged regardless of the requested language', () => {
		expect(loc(trip, 'Castle Esplanade approach', 'en')).toBe('Castle Esplanade approach');
		expect(loc(trip, 'Castle Esplanade approach', 'pt')).toBe('Castle Esplanade approach');
	});

	it('still resolves a Localized object as before', () => {
		expect(loc(trip, { en: 'Castle', pt: 'Castelo' }, 'pt')).toBe('Castelo');
	});

	it('returns "" for undefined', () => {
		expect(loc(trip, undefined, 'en')).toBe('');
	});
});
