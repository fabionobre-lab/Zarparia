import type { Trip, Segment, Plan, Day, Block, Localized } from '$lib/trip-engine';

/** Empty localized object with a key per language, so inputs render. */
export function emptyLocalized(langs: string[]): Localized {
	return Object.fromEntries(langs.map((l) => [l, '']));
}

export function blankBlock(langs: string[]): Block {
	return { time: '', dotColor: '#3d5a3d', title: emptyLocalized(langs) };
}
export function blankDay(langs: string[]): Day {
	return { date: '', title: emptyLocalized(langs), blocks: [blankBlock(langs)] };
}
export function blankPlan(langs: string[], id = 'main'): Plan {
	return { id, days: [blankDay(langs)] };
}
export function blankSegment(langs: string[], id = 'segment'): Segment {
	return { id, title: emptyLocalized(langs), theme: 'navy', plans: [blankPlan(langs)] };
}
export function blankTrip(langs: string[] = ['en']): Trip {
	return {
		id: '',
		title: emptyLocalized(langs),
		languages: [...langs],
		defaultLanguage: langs[0],
		segments: [blankSegment(langs)]
	};
}

/** Smallest `${prefix}-N` (N ≥ 1) not already in `existing`, so adding items
 *  never mints a duplicate id (length-based ids collide after a remove). */
export function nextId(prefix: string, existing: string[]): string {
	const taken = new Set(existing);
	let n = 1;
	while (taken.has(`${prefix}-${n}`)) n++;
	return `${prefix}-${n}`;
}

/** Move item at index i by dir (-1 up, +1 down), in place. */
export function move<T>(arr: T[], i: number, dir: -1 | 1): void {
	const j = i + dir;
	if (j < 0 || j >= arr.length) return;
	[arr[i], arr[j]] = [arr[j], arr[i]];
}

export function removeAt<T>(arr: T[], i: number): void {
	arr.splice(i, 1);
}

/**
 * Deep-clone, dropping empty strings, empty objects and empty arrays so stored
 * docs stay clean. Numbers (incl. 0) and booleans are preserved. Required
 * fields left empty simply disappear and fail server validation, which surfaces
 * as a clear error to the user.
 */
export function pruneEmpty(value: unknown): unknown {
	if (Array.isArray(value)) {
		const out = value.map(pruneEmpty).filter((v) => v !== undefined);
		return out.length ? out : undefined;
	}
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			const p = pruneEmpty(v);
			if (p !== undefined) out[k] = p;
		}
		// Block coords is all-or-nothing (lat+lon both required by the schema);
		// a partial coords object (only one field filled in) can't validate, so
		// drop it entirely rather than surface a confusing schema error.
		if (out.coords && typeof out.coords === 'object') {
			const c = out.coords as Record<string, unknown>;
			if (typeof c.lat !== 'number' || typeof c.lon !== 'number') delete out.coords;
		}
		return Object.keys(out).length ? out : undefined;
	}
	if (value === '' || value === null) return undefined;
	return value;
}
