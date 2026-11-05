import type { TripDoc } from '$lib/validateTrip';

/** Map of block id → guide object, or null to remove that block's guide. */
export type StopGuidePatch = Record<string, Record<string, unknown> | null>;

export type ApplyStopGuidesResult =
	| { ok: true; doc: TripDoc; applied: string[] }
	| { ok: false; missing: string[]; invalid: string[] };

/**
 * Set (or remove) the `guide` on blocks found by id, anywhere in the trip.
 * Returns a new doc and leaves the input untouched. Nothing is applied when
 * any id is missing or any value is not an object or null, so a typo in one
 * id never leaves a half-written batch. Schema validation of the guides
 * themselves happens later, in updateTrip.
 */
export function applyStopGuides(doc: TripDoc, patch: StopGuidePatch): ApplyStopGuidesResult {
	const next = structuredClone(doc) as TripDoc;
	const ids = Object.keys(patch);
	const invalid = ids.filter((id) => {
		const v = patch[id];
		return v !== null && (typeof v !== 'object' || Array.isArray(v));
	});

	type Node = Record<string, unknown>;
	const list = (v: unknown): Node[] => (Array.isArray(v) ? (v as Node[]) : []);
	const byId = new Map<string, Node>();
	for (const segment of list((next as unknown as Node).segments)) {
		for (const plan of list(segment.plans)) {
			for (const day of list(plan.days)) {
				for (const b of list(day.blocks)) {
					if (typeof b.id === 'string') byId.set(b.id, b);
				}
			}
		}
	}

	const missing = ids.filter((id) => !byId.has(id));
	if (missing.length || invalid.length) return { ok: false, missing, invalid };

	for (const id of ids) {
		const block = byId.get(id)!;
		const guide = patch[id];
		if (guide === null) delete block.guide;
		else block.guide = guide;
	}
	return { ok: true, doc: next, applied: ids };
}
