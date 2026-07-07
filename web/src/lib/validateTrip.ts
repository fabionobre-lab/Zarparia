import { Validator } from '@cfworker/json-schema';
import schema from '$lib/trip.schema.json';

// Single compiled validator (no eval — safe on Workers).
const validator = new Validator(schema as object, '2020-12');

/** Minimal shape the server relies on; full validation is the JSON Schema. */
export interface TripDoc {
	id: string;
	title: Record<string, string>;
	defaultLanguage: string;
	languages: string[];
	segments: Array<{ plans: Array<{ days: Array<{ date: string }> }> }>;
	[key: string]: unknown;
}

export function validateTripDoc(doc: unknown): { valid: boolean; errors: string[] } {
	const result = validator.validate(doc);
	if (result.valid) return { valid: true, errors: [] };
	return {
		valid: false,
		errors: result.errors.map((e) => `${e.instanceLocation || '/'}: ${e.error}`)
	};
}
