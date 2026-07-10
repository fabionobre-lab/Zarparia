import type { Trip, Segment, Plan, Day, Block, Localized } from '$lib/trip-engine';

/** Named themes offered in the editor and cycled by the creation wizard.
 *  Order matters: the wizard assigns themes to segments by cycling this list. */
export const THEME_NAMES = ['tartan', 'navy', 'terracotta', 'olive', 'azure', 'sand'] as const;

/** URL-safe slug of a label, mirroring the server's slugify (a-z0-9, dash-joined,
 *  trimmed, ≤40 chars). Returns '' for input with no usable characters. */
export function slugifyId(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

/** iso date (YYYY-MM-DD) + n calendar days, via real UTC date arithmetic. '' for
 *  an unparseable input so callers can leave the field blank. */
export function isoAddDays(iso: string, n: number): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
	if (!m) return '';
	const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
	if (Number.isNaN(dt.getTime())) return '';
	return dt.toISOString().slice(0, 10);
}

/** Empty localized object with a key per language, so inputs render. */
export function emptyLocalized(langs: string[]): Localized {
	return Object.fromEntries(langs.map((l) => [l, '']));
}

/** Localized object with `text` on the default language, other languages empty. */
export function localizedWith(langs: string[], defaultLang: string, text: string): Localized {
	const out = emptyLocalized(langs);
	out[defaultLang] = text;
	return out;
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
 * docs stay clean. Numbers (incl. 0) and booleans are preserved.
 *
 * Exception (`keepEmptyStr`): required fields that the schema demands but that a
 * scaffolded-yet-unfilled day/block legitimately leaves blank — a day's `title`
 * and a block's `time`/`title` — keep their empty strings so the doc still
 * validates (the schema requires these keys; an empty string is a valid value).
 * Without this, the creation wizard's blank days/blocks would be unsavable.
 * Optional empty fields are still pruned.
 */
export function pruneEmpty(value: unknown, keepEmptyStr = false): unknown {
	if (Array.isArray(value)) {
		const out = value.map((v) => pruneEmpty(v, keepEmptyStr)).filter((v) => v !== undefined);
		return out.length ? out : undefined;
	}
	if (value && typeof value === 'object') {
		const v = value as Record<string, unknown>;
		const isDay = Array.isArray(v.blocks);
		const isBlock = 'time' in v && 'title' in v && !('blocks' in v) && !('days' in v);
		const out: Record<string, unknown> = {};
		for (const [k, val] of Object.entries(v)) {
			// Preserve empties for required scaffolding fields, and propagate the
			// flag into their localized child objects (so {en:''} survives).
			const keepChild =
				keepEmptyStr || (isDay && k === 'title') || (isBlock && (k === 'title' || k === 'time'));
			const p = pruneEmpty(val, keepChild);
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
	if (value === '') return keepEmptyStr ? '' : undefined;
	if (value === null) return undefined;
	return value;
}

// ── Creation wizard scaffolding ────────────────────────────────────────────

export interface WizardStop {
	name: string;
	nights: number;
}
export interface WizardInput {
	title: string;
	startDate: string;
	languages: string[];
	defaultLanguage: string;
	timezone: string;
	homeName?: string;
	stops: WizardStop[];
}

/** Total trip length in days for a set of stops: sum of nights + 1 departure day. */
export function totalDays(stops: WizardStop[]): number {
	return stops.reduce((s, st) => s + Math.max(1, st.nights || 0), 0) + 1;
}

/**
 * Build an unsaved draft Trip from the wizard input: one segment per stop, days
 * auto-dated sequentially (each stop spans its nights; the trailing departure
 * day joins the last segment), the first day of every following segment titled
 * "Travel to <stop>", one empty block per day, weather enabled per segment with
 * the chosen timezone (lat/lon 0 until geocoded), themes cycled. `id` stays ''
 * (derived on save from the title).
 */
export function scaffoldTrip(input: WizardInput): Trip {
	const langs = input.languages.length ? input.languages : ['en'];
	const dflt = input.defaultLanguage || langs[0];
	const stops = input.stops
		.map((s) => ({ name: s.name.trim(), nights: Math.max(1, Math.floor(s.nights) || 1) }))
		.filter((s) => s.name !== '');

	const total = stops.reduce((s, st) => s + st.nights, 0);
	const dates = Array.from({ length: total + 1 }, (_, k) => isoAddDays(input.startDate, k));

	const usedIds = new Set<string>();
	const uniqueSegId = (name: string): string => {
		const base = slugifyId(name) || 'segment';
		let id = base;
		let n = 1;
		while (usedIds.has(id)) id = `${base}-${++n}`;
		usedIds.add(id);
		return id;
	};

	let idx = 0;
	const segments: Segment[] = stops.map((stop, i) => {
		const isLast = i === stops.length - 1;
		const count = stop.nights + (isLast ? 1 : 0);
		const days: Day[] = [];
		for (let k = 0; k < count; k++) {
			const following = i > 0 && k === 0;
			days.push({
				date: dates[idx + k] ?? '',
				title: following ? localizedWith(langs, dflt, `Travel to ${stop.name}`) : emptyLocalized(langs),
				blocks: [blankBlock(langs)]
			});
		}
		idx += count;
		return {
			id: uniqueSegId(stop.name),
			title: localizedWith(langs, dflt, stop.name),
			theme: THEME_NAMES[i % THEME_NAMES.length],
			weather: { lat: 0, lon: 0, granularity: 'daily', timezone: input.timezone },
			plans: [{ id: 'main', days }]
		};
	});

	const trip: Trip = {
		id: '',
		title: localizedWith(langs, dflt, input.title.trim()),
		languages: [...langs],
		defaultLanguage: dflt,
		segments: segments.length ? segments : [blankSegment(langs)]
	};
	if (input.homeName && input.homeName.trim()) trip.home = { name: input.homeName.trim() };
	return trip;
}
