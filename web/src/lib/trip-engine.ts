/**
 * Pure rendering helpers, ported from the vanilla static engine (assets/app.js).
 * No DOM here — TripView.svelte consumes these. All user strings are rendered
 * as escaped text by Svelte, not innerHTML, so shared trips can't inject markup.
 */

export type Localized = Record<string, string>;

export interface PhotoSpot {
	name: string;
	mapsUrl: string;
	wiki?: string;
	fallbackImg?: string;
}
export interface Waypoint {
	query: string;
	name: Localized;
}
export interface Block {
	time: string;
	dotColor?: string;
	title: Localized;
	tags?: string[];
	description?: Localized;
	mapsUrl?: string;
	km?: number;
	warning?: Localized;
	note?: Localized;
	waypoints?: Waypoint[];
	photoSpots?: PhotoSpot[];
	diff?: { kind: 'added' | 'changed' | 'kept'; reason: Localized };
}
export interface Day {
	date: string;
	title: Localized;
	note?: Localized;
	routeMode?: string;
	banner?: Localized;
	kmTotal?: number;
	staticWeather?: { hi: number; lo: number; emoji?: string };
	blocks: Block[];
}
export interface Plan {
	id: string;
	label?: Localized;
	diffLabels?: Partial<Record<'added' | 'changed' | 'kept', Localized>>;
	days: Day[];
}
export interface Segment {
	id: string;
	title: Localized;
	subtitle?: Localized;
	theme?: string;
	weather?: { lat: number; lon: number; granularity: 'hourly' | 'daily'; timezone?: string };
	footer?: Localized;
	defaultPlan?: string;
	plans: Plan[];
}
export interface Trip {
	id: string;
	title: Localized;
	eyebrow?: Localized;
	languages: string[];
	defaultLanguage: string;
	locales?: Record<string, string>;
	tags?: Record<string, { label: Localized; style?: string }>;
	segments: Segment[];
}

export function loc(trip: Trip, obj: Localized | undefined, lang: string): string {
	if (!obj) return '';
	return obj[lang] !== undefined ? obj[lang] : (obj[trip.defaultLanguage] ?? '');
}

export function localeFor(trip: Trip, lang: string): string {
	return trip.locales?.[lang] ?? lang;
}

function dateUTC(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}
function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Friday, 10 April" / "Sexta-feira, 10 de abril" — weekday + ', ' + rest. */
export function dayLabel(iso: string, locale: string): string {
	const parts = new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC'
	}).formatToParts(dateUTC(iso));
	const wd = parts.findIndex((p) => p.type === 'weekday');
	if (wd === -1) return cap(parts.map((p) => p.value).join(''));
	let rest = parts.slice(wd + 1);
	if (rest.length && rest[0].type === 'literal') rest = rest.slice(1);
	return cap(parts[wd].value) + ', ' + rest.map((p) => p.value).join('');
}

export function dowShort(iso: string, locale: string): string {
	const wd = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(dateUTC(iso));
	return cap(wd.slice(0, 3));
}

export function dayNum(iso: string): string {
	return String(Number(iso.slice(8, 10)));
}

export function wxEmoji(code: number): string {
	if (code === 0) return '☀️';
	if (code <= 2) return '🌤️';
	if (code === 3) return '☁️';
	if (code <= 48) return '🌫️';
	if (code <= 55) return '🌦️';
	if (code <= 65) return '🌧️';
	if (code <= 77) return '❄️';
	if (code <= 82) return '🌦️';
	return '⛈️';
}

/** True when the trip's last day is before today (skip live weather). */
export function tripIsPast(trip: Trip): boolean {
	let last = '';
	for (const s of trip.segments)
		for (const p of s.plans) for (const d of p.days) if (d.date > last) last = d.date;
	return last !== '' && last < new Date().toISOString().slice(0, 10);
}

export interface RoutePlace {
	q: string;
	name: string;
}
export function routePlaces(trip: Trip, blocks: Block[], lang: string): RoutePlace[] {
	const places: RoutePlace[] = [];
	for (const b of blocks) {
		if (b.mapsUrl) {
			const m = b.mapsUrl.match(/[?&]q=([^&]+)/);
			if (m) places.push({ q: m[1], name: loc(trip, b.title, lang) });
		}
		for (const w of b.waypoints ?? []) places.push({ q: w.query, name: loc(trip, w.name, lang) });
	}
	return places;
}

export function routeUrl(places: RoutePlace[], routeMode?: string): string {
	let url = 'https://www.google.com/maps/dir/' + places.map((p) => p.q).join('/') + '/';
	if (routeMode) url += '?travelmode=' + routeMode;
	return url;
}

export function truncStop(name: string): string {
	return name.length > 20 ? name.substring(0, 18) + '…' : name;
}

export function dayKmTotal(day: Day): number {
	return day.kmTotal || day.blocks.reduce((s, b) => s + (b.km || 0), 0);
}

// ── Weather fetch (client-side; network-first) ────────────────────────────
export interface SegWeather {
	hourly?: Record<string, { temp: number; code: number }>;
	daily?: Record<string, { hi: number; lo: number; emoji: string }>;
}

interface HourlyResponse {
	hourly: { time: string[]; temperature_2m: number[]; weathercode: number[] };
}
interface DailyResponse {
	daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weathercode: number[] };
}

export async function fetchSegmentWeather(seg: Segment): Promise<SegWeather | null> {
	const w = seg.weather;
	if (!w) return null;
	const days = seg.plans[0].days;
	const start = days[0].date;
	const end = days[days.length - 1].date;
	const tz = encodeURIComponent(w.timezone || 'UTC');
	try {
		if (w.granularity === 'hourly') {
			const r = await fetch(
				`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&hourly=temperature_2m,weathercode&timezone=${tz}&start_date=${start}&end_date=${end}`
			);
			const d = (await r.json()) as HourlyResponse;
			const hourly: Record<string, { temp: number; code: number }> = {};
			d.hourly.time.forEach((t, i) => {
				hourly[t.slice(0, 10) + '-' + t.slice(11, 13)] = {
					temp: d.hourly.temperature_2m[i],
					code: d.hourly.weathercode[i]
				};
			});
			return { hourly };
		}
		const r = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=${tz}&start_date=${start}&end_date=${end}`
		);
		const d = (await r.json()) as DailyResponse;
		const daily: Record<string, { hi: number; lo: number; emoji: string }> = {};
		d.daily.time.forEach((t, i) => {
			daily[t] = {
				hi: Math.round(d.daily.temperature_2m_max[i]),
				lo: Math.round(d.daily.temperature_2m_min[i]),
				emoji: wxEmoji(d.daily.weathercode[i])
			};
		});
		return { daily };
	} catch {
		return null; // offline / out of range → staticWeather fallback applies
	}
}
