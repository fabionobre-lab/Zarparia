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

/** Semantic checks the JSON Schema can't express: ids must be unique so the
 *  editor and renderer (which key on them) don't collide or clobber. */
function idErrors(doc: unknown): string[] {
	const errors: string[] = [];
	const d = doc as { segments?: Array<{ id?: string; plans?: Array<{ id?: string }> }> };
	const segSeen = new Set<string>();
	(d.segments ?? []).forEach((seg, si) => {
		const sid = seg?.id;
		if (typeof sid === 'string') {
			if (segSeen.has(sid)) errors.push(`/segments/${si}/id: duplicate segment id "${sid}"`);
			segSeen.add(sid);
		}
		const planSeen = new Set<string>();
		(seg?.plans ?? []).forEach((plan, pi) => {
			const pid = plan?.id;
			if (typeof pid === 'string') {
				if (planSeen.has(pid))
					errors.push(`/segments/${si}/plans/${pi}/id: duplicate plan id "${pid}"`);
				planSeen.add(pid);
			}
		});
	});
	return errors;
}

export function validateTripDoc(doc: unknown): { valid: boolean; errors: string[] } {
	const result = validator.validate(doc);
	if (!result.valid) {
		return {
			valid: false,
			errors: result.errors.map((e) => `${e.instanceLocation || '/'}: ${e.error}`)
		};
	}
	const semantic = idErrors(doc);
	if (semantic.length) return { valid: false, errors: semantic };
	return { valid: true, errors: [] };
}
