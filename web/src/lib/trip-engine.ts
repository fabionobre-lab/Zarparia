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
export interface ThemeColors {
	heroBg?: string;
	accent?: string;
	eyebrow?: string;
}
export interface Segment {
	id: string;
	title: Localized;
	subtitle?: Localized;
	theme?: string;
	themeColors?: ThemeColors;
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
	home?: { name: string; postcode?: string; lat?: number; lon?: number };
	tags?: Record<string, { label: Localized; style?: string }>;
	/** Optional emoji shown on the trip picker card (parity with the static app's manifest "cover"). */
	cover?: string;
	segments: Segment[];
}

/** Defense-in-depth: only pass through http(s) URLs for hrefs/srcs derived
 *  from trip data, so a stored `javascript:` URL can't execute even if it
 *  slipped past schema validation. */
export function safeUrl(u: string | undefined): string | undefined {
	return u && /^https?:\/\//i.test(u) ? u : undefined;
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
function isValidDate(iso: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(dateUTC(iso).getTime());
}
function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Friday, 10 April" / "Sexta-feira, 10 de abril" — weekday + ', ' + rest. */
export function dayLabel(iso: string, locale: string): string {
	if (!isValidDate(iso)) return iso || '';
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
	if (!isValidDate(iso)) return '';
	const wd = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(dateUTC(iso));
	return cap(wd.slice(0, 3));
}

export function dayNum(iso: string): string {
	const n = Number(iso.slice(8, 10));
	return Number.isNaN(n) ? '–' : String(n);
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
	const days = seg.plans[0]?.days ?? [];
	if (days.length === 0 || !days[0].date) return null;
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

// ── Calendar export (.ics, RFC 5545) ───────────────────────────────────────

function pad2(n: number): string {
	return n < 10 ? '0' + n : String(n);
}

function isoParts(iso: string): { y: number; mo: number; d: number } {
	const [y, mo, d] = iso.split('-').map(Number);
	return { y, mo, d };
}

function isoToBasicDate(iso: string): string {
	const { y, mo, d } = isoParts(iso);
	return `${y}${pad2(mo)}${pad2(d)}`;
}

/** iso date + 1 calendar day (real date arithmetic; handles month/year rollover). */
function isoPlusOneDay(iso: string): string {
	const { y, mo, d } = isoParts(iso);
	const dt = new Date(Date.UTC(y, mo - 1, d + 1));
	return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}`;
}

/** Floating (no Z/TZID) local date-time = iso date @ h:m, plus optional minute offset
 *  (real date arithmetic, so an offset that crosses midnight rolls the date forward). */
function floatingDateTime(iso: string, h: number, m: number, addMin = 0): string {
	const { y, mo, d } = isoParts(iso);
	const dt = new Date(Date.UTC(y, mo - 1, d, h, m + addMin, 0));
	return (
		`${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}` +
		`T${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}00`
	);
}

/** RFC 5545 §3.8.1 TEXT escaping (SUMMARY/DESCRIPTION/LOCATION values only). */
function icsEscapeText(s: string): string {
	return s
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\r|\n/g, '\\n');
}

/** RFC 5545 §3.1 line folding, byte-safe against multi-byte UTF-8 octets. */
function foldLine(line: string): string {
	const bytes = new TextEncoder().encode(line);
	if (bytes.length <= 75) return line;
	const dec = new TextDecoder();
	const chunks: string[] = [];
	let offset = 0;
	let limit = 75;
	while (offset < bytes.length) {
		let end = Math.min(offset + limit, bytes.length);
		// Never split a multi-byte UTF-8 sequence: back off while the next
		// byte is a continuation byte (10xxxxxx).
		while (end > offset && (bytes[end] & 0xc0) === 0x80) end--;
		chunks.push(dec.decode(bytes.subarray(offset, end)));
		offset = end;
		limit = 74;
	}
	return chunks.join('\r\n ');
}

/** Selected plan for a segment: planBySeg override → segment default → first plan. */
function selectedPlan(seg: Segment, planBySeg: Record<string, string>): Plan {
	const id = planBySeg[seg.id] ?? seg.defaultPlan ?? seg.plans[0].id;
	return seg.plans.find((p) => p.id === id) ?? seg.plans[0];
}

/** Pure .ics (RFC 5545) builder for the whole trip — no DOM access, so it's
 *  directly importable/unit-testable from Node. */
export function buildIcs(trip: Trip, lang: string, planBySeg: Record<string, string>): string {
	const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Trips//Trip Engine//EN', 'CALSCALE:GREGORIAN'];

	// Fixed, deterministic DTSTAMP for the whole export — not wall-clock.
	let dtstamp = '';
	if (trip.segments.length > 0) {
		const firstPlan = selectedPlan(trip.segments[0], planBySeg);
		const firstDate = firstPlan.days[0]?.date;
		if (firstDate) dtstamp = `${isoToBasicDate(firstDate)}T000000Z`;
	}

	for (const seg of trip.segments) {
		const plan = selectedPlan(seg, planBySeg);
		for (const day of plan.days) {
			const parsed: { blockIndex: number; h: number; m: number }[] = [];
			day.blocks.forEach((b, blockIndex) => {
				const stripped = b.time.replace(/^~/, '');
				const match = /^(\d{1,2}):(\d{2})$/.exec(stripped);
				if (match) parsed.push({ blockIndex, h: Number(match[1]), m: Number(match[2]) });
			});

			if (parsed.length === 0) {
				lines.push('BEGIN:VEVENT');
				lines.push(foldLine(`UID:${trip.id}-${seg.id}-${day.date}-day@trips`));
				lines.push(foldLine(`DTSTAMP:${dtstamp}`));
				lines.push(foldLine(`DTSTART;VALUE=DATE:${isoToBasicDate(day.date)}`));
				lines.push(foldLine(`DTEND;VALUE=DATE:${isoPlusOneDay(day.date)}`));
				lines.push(foldLine(`SUMMARY:${icsEscapeText(loc(trip, day.title, lang))}`));
				lines.push('END:VEVENT');
				continue;
			}

			parsed.forEach((p, i) => {
				const block = day.blocks[p.blockIndex];
				const next = parsed[i + 1];
				const dtstart = floatingDateTime(day.date, p.h, p.m);
				const dtend = next
					? floatingDateTime(day.date, next.h, next.m)
					: floatingDateTime(day.date, p.h, p.m, 60);

				lines.push('BEGIN:VEVENT');
				lines.push(foldLine(`UID:${trip.id}-${seg.id}-${day.date}-${p.blockIndex}@trips`));
				lines.push(foldLine(`DTSTAMP:${dtstamp}`));
				lines.push(foldLine(`DTSTART:${dtstart}`));
				lines.push(foldLine(`DTEND:${dtend}`));
				lines.push(foldLine(`SUMMARY:${icsEscapeText(loc(trip, block.title, lang))}`));
				if (block.description || block.mapsUrl) {
					const desc = block.description ? loc(trip, block.description, lang) : '';
					const descVal = block.description && block.mapsUrl ? desc + '\n' + block.mapsUrl : desc || block.mapsUrl || '';
					lines.push(foldLine(`DESCRIPTION:${icsEscapeText(descVal)}`));
				}
				lines.push(foldLine(`LOCATION:${icsEscapeText(loc(trip, block.title, lang))}`));
				lines.push('END:VEVENT');
			});
		}
	}

	lines.push('END:VCALENDAR');
	return lines.join('\r\n') + '\r\n';
}
