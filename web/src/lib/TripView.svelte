<script lang="ts">
	import { untrack, onDestroy } from 'svelte';
	import { fly, slide } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		type Trip,
		type Segment,
		type Plan,
		type Day,
		type SegWeather,
		loc,
		localeFor,
		dayLabel,
		dowShort,
		dayNum,
		wxEmoji,
		tripIsPast,
		routePlaces,
		routeUrl,
		dayKmTotal,
		fetchSegmentWeather,
		safeUrl,
		buildIcs,
		tripTimezone,
		isoDateInTZ,
		hhmmInTZ,
		minutesSinceMidnightInTZ,
		parseBlockTimeMinutes
	} from './trip-engine';
	import DayMap, { type MapStop, type PhotoStop } from './DayMap.svelte';
	import PhotoLightbox from './PhotoLightbox.svelte';
	import { tripChrome } from './i18n/tripChrome';
	import { photoUrl, type TripPhoto } from './photos';
	import { getNow } from './now';
	import { setTripNav, type TripNavVM } from './nav/tripNav.svelte';

	// trip is fixed for the lifetime of a mounted TripView (the page remounts
	// per trip id), so these initial reads are intentionally non-reactive.
	let {
		trip,
		lang = $bindable(untrack(() => trip.defaultLanguage || trip.languages[0])),
		photos = [],
		photosEditable = false,
		photoToken,
		onphotoschanged
	}: {
		trip: Trip;
		lang?: string;
		/** Google Photos linked to this trip (omitted in editor previews). */
		photos?: TripPhoto[];
		photosEditable?: boolean;
		/** Public-link token (public-share-route-spec.md) — set only on the
		 *  /s/[token] route, where photo requests have no session to authorize
		 *  with instead. Threaded into every photoUrl() call below. */
		photoToken?: string;
		/** Called after a photo was moved/deleted from the lightbox, so the
		 *  owner of `photos` can refetch. */
		onphotoschanged?: () => void;
	} = $props();
	let planBySeg = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(trip.segments.map((s) => [s.id, s.defaultPlan ?? s.plans[0].id])))
	);
	let wxBySeg = $state<Record<string, SegWeather | null>>({});
	let wikiImgs = $state<Record<string, string | null>>({});

	const isPast = untrack(() => tripIsPast(trip));
	const L = (obj: Parameters<typeof loc>[1]) => loc(trip, obj, lang);
	const planOf = (seg: Segment): Plan =>
		seg.plans.find((p) => p.id === planBySeg[seg.id]) ?? seg.plans[0];

	interface FlatDay {
		seg: Segment;
		plan: Plan;
		day: Day;
	}
	function computeFlatDays(planSel: Record<string, string>): FlatDay[] {
		const out: FlatDay[] = [];
		for (const seg of trip.segments) {
			const plan = seg.plans.find((p) => p.id === planSel[seg.id]) ?? seg.plans[0];
			for (const day of plan.days) out.push({ seg, plan, day });
		}
		return out;
	}

	// ── Today auto-focus ──
	// "Today" is resolved through the shared clock (`getNow()`, which honors
	// `?now=<ISO datetime>` for testing) and the trip's own timezone (first
	// segment carrying `weather.timezone` — the creation wizard applies one
	// zone to every stop), not the browser's ambient locale/zone.
	const tz = untrack(() => tripTimezone(trip));
	/** Day index to open on: today's day if the trip is currently active
	 *  (today between the first and last day, inclusive), landing on the next
	 *  planned day when today itself is an unplanned gap date. Past/upcoming
	 *  trips (today outside that range) keep the existing default of day 0. */
	function initialDayIndex(days: FlatDay[]): number {
		if (days.length === 0) return 0;
		const first = days[0].day.date;
		const last = days[days.length - 1].day.date;
		const today = isoDateInTZ(getNow(), tz);
		if (today < first || today > last) return 0;
		const exact = days.findIndex((f) => f.day.date === today);
		if (exact !== -1) return exact;
		const next = days.findIndex((f) => f.day.date > today);
		return next !== -1 ? next : days.length - 1;
	}

	let dayIdx = $state(untrack(() => initialDayIndex(computeFlatDays(planBySeg))));

	const flatDays = $derived.by<FlatDay[]>(() => computeFlatDays(planBySeg));
	const clampedIdx = $derived(Math.min(dayIdx, flatDays.length - 1));
	const current = $derived(flatDays[clampedIdx]);

	// ── Day rail source (desktop sidebar, ≥960px) ──
	// Groups the trip's days by segment (in trip order, using each segment's
	// currently-selected plan) and carries the global flat-day index `gi` on every
	// row, so a rail click reuses the exact same `dayIdx` state the horizontal
	// `.daynav` sets. The loop mirrors computeFlatDays() one-for-one, so `gi` stays
	// aligned with `flatDays`/`clampedIdx`. This structure is reshaped into the
	// tripNav view-model below and rendered by the desktop Sidebar (the in-view
	// rail moved out of TripView into the persistent sidebar).
	interface RailDay {
		day: Day;
		gi: number;
	}
	interface RailSeg {
		seg: Segment;
		days: RailDay[];
	}
	const railSegments = $derived.by<RailSeg[]>(() => {
		const groups: RailSeg[] = [];
		let gi = 0;
		for (const seg of trip.segments) {
			const plan = seg.plans.find((p) => p.id === planBySeg[seg.id]) ?? seg.plans[0];
			const days: RailDay[] = plan.days.map((day) => ({ day, gi: gi++ }));
			groups.push({ seg, days });
		}
		return groups;
	});

	// ── Day nav: every calendar date from the trip's first to last day across
	// ALL segments (mirrors calendarDays() in the static engine, assets/app.js),
	// so free days between segments also render as muted, non-interactive pips. ──
	function isValidISODate(iso: string): boolean {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
		const [y, m, d] = iso.split('-').map(Number);
		return !Number.isNaN(new Date(Date.UTC(y, m - 1, d)).getTime());
	}
	function addDaysISO(iso: string, n: number): string {
		const [y, m, d] = iso.split('-').map(Number);
		const dt = new Date(Date.UTC(y, m - 1, d));
		dt.setUTCDate(dt.getUTCDate() + n);
		return dt.toISOString().slice(0, 10);
	}
	interface NavDay {
		kind: 'day';
		day: Day;
		gi: number;
		/** True when this planned day starts a new segment (renders a separator before it). */
		sep: boolean;
	}
	interface NavGap {
		kind: 'gap';
		date: string;
	}
	type NavEntry = NavDay | NavGap;
	const navEntries = $derived.by<NavEntry[]>(() => {
		const days = flatDays;
		if (days.length === 0) return [];
		// Draft data (e.g. a brand-new unsaved day in the editor's live preview)
		// can have empty/invalid or out-of-order dates — skip gap synthesis and
		// show the planned days as-is rather than doing date arithmetic on garbage.
		const canFillGaps =
			days.every((f) => isValidISODate(f.day.date)) &&
			days.every((f, i) => i === 0 || days[i - 1].day.date <= f.day.date);
		const entries: NavEntry[] = [];
		let lastSeg: Segment | null = null;
		const pushDay = (f: FlatDay, gi: number) => {
			entries.push({ kind: 'day', day: f.day, gi, sep: lastSeg !== null && f.seg !== lastSeg });
			lastSeg = f.seg;
		};
		if (canFillGaps) {
			const end = days[days.length - 1].day.date;
			let cursor = days[0].day.date;
			let gi = 0;
			while (cursor <= end) {
				if (gi < days.length && days[gi].day.date === cursor) {
					pushDay(days[gi], gi);
					gi++;
				} else {
					entries.push({ kind: 'gap', date: cursor });
				}
				cursor = addDaysISO(cursor, 1);
			}
		} else {
			days.forEach((f, gi) => pushDay(f, gi));
		}
		return entries;
	});

	// Keep the active day pip in view: on mount and whenever the selected day
	// changes. The initial mount scroll always uses 'auto' (no animation, so
	// page load doesn't visibly scroll); subsequent day switches scroll
	// 'smooth' — but only when the visitor hasn't asked for reduced motion.
	let dayBtnEls: (HTMLButtonElement | null)[] = [];
	let daynavMounted = false;
	$effect(() => {
		const el = dayBtnEls[clampedIdx];
		if (!el) return;
		const behavior = daynavMounted && !prefersReducedMotion.current ? 'smooth' : 'auto';
		el.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
		daynavMounted = true;
	});

	// ── Sticky day nav: shadow only once it's actually pinned to the top ──
	// A 1px sentinel sits just above the nav; once it scrolls out of view the
	// nav has reached position:sticky's `top: 0` and is "stuck".
	let sentinelEl: HTMLDivElement | null = null;
	let daynavStuck = $state(false);
	$effect(() => {
		if (!sentinelEl || typeof IntersectionObserver === 'undefined') return;
		const obs = new IntersectionObserver(([entry]) => (daynavStuck = !entry.isIntersecting), {
			threshold: 0
		});
		obs.observe(sentinelEl);
		return () => obs.disconnect();
	});
	// Short label for the second line shown inside the day nav once it's stuck:
	// "Mon 20 · Arrival & the Old Town" (weekday + day number · day title).
	const stuckDayLabel = $derived(
		current
			? `${dowShort(current.day.date, localeFor(trip, lang))} ${dayNum(current.day.date)} · ${L(current.day.title)}`
			: ''
	);

	// ── "Now" marker on the timeline ──
	// Ticks once a minute; a frozen `?now=` (see ./now) simply repeats the same
	// instant on every tick, which is fine — the marker just stays put.
	let nowTick = $state(untrack(() => getNow()));
	$effect(() => {
		const id = setInterval(() => (nowTick = getNow()), 60_000);
		return () => clearInterval(id);
	});
	const todayISO = $derived(isoDateInTZ(nowTick, tz));
	const isToday = $derived(!!current && current.day.date === todayISO);
	const nowMinutesToday = $derived(minutesSinceMidnightInTZ(nowTick, tz));
	const nowLabel = $derived(hhmmInTZ(nowTick, tz));
	/** Index of the next upcoming block for "today", or `blocks.length` when
	 *  every timed block has already started (marker renders after the last
	 *  one), or `null` when today isn't the selected day / has no blocks.
	 *  Blocks with an unparseable time never count as "the next one" — the
	 *  marker skips past them to the next block that does have a time. */
	const nowMarkerIdx = $derived.by<number | null>(() => {
		if (!isToday || !current || current.day.blocks.length === 0) return null;
		const blocks = current.day.blocks;
		for (let i = 0; i < blocks.length; i++) {
			const mins = parseBlockTimeMinutes(blocks[i].time);
			if (mins !== null && mins > nowMinutesToday) return i;
		}
		return blocks.length;
	});
	// Scroll the now-marker into view (centered) whenever the selected day
	// becomes today's day, instead of leaving the visitor at the top.
	let nowMarkerEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		clampedIdx;
		if (isToday && nowMarkerEl) {
			nowMarkerEl.scrollIntoView({ behavior: 'auto', block: 'center' });
		}
	});

	/* Trip-chrome strings follow the TRIP CONTENT language (the per-trip EN|PT
	   hero toggle), not the UI locale — hence the typed tripChrome catalog
	   instead of t(). See lib/i18n/tripChrome.ts. */
	const uiText = $derived(tripChrome[lang === 'pt' ? 'pt' : 'en']);

	function setLang(l: string) {
		lang = l;
	}
	function setPlan(seg: Segment, planId: string) {
		planBySeg = { ...planBySeg, [seg.id]: planId };
	}

	function downloadIcs() {
		const text = buildIcs(trip, lang, planBySeg);
		const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${trip.id}.ics`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	}

	// ── Weather (client-side, skipped for past trips) ──
	// Cache keyed by (segment id + coords + granularity) so changing coordinates
	// in the editor refetches instead of reusing a stale (e.g. 0/0) result.
	// A `null` entry marks an in-flight request so we don't refetch it while
	// pending — the O(N²) refetch storm this $effect used to cause.
	function wxKey(seg: Segment): string | null {
		const w = seg.weather;
		return w ? `${seg.id}|${w.lat}|${w.lon}|${w.granularity}` : null;
	}
	$effect(() => {
		if (isPast) return;
		for (const seg of trip.segments) {
			const key = wxKey(seg);
			if (!key || wxBySeg[key] !== undefined) continue;
			wxBySeg = { ...wxBySeg, [key]: null }; // mark in-flight
			fetchSegmentWeather(seg).then((w) => {
				if (w) wxBySeg = { ...wxBySeg, [key]: w };
			});
		}
	});

	interface DayWx {
		emoji: string;
		hi: number;
		lo: number;
	}
	function daySummary(seg: Segment, day: Day): DayWx | null {
		const key = wxKey(seg);
		const w = key ? wxBySeg[key] : null;
		if (w?.hourly) {
			const temps: number[] = [];
			const codes: number[] = [];
			for (let h = 7; h <= 22; h++) {
				const hw = w.hourly[day.date + '-' + String(h).padStart(2, '0')];
				if (hw) {
					temps.push(hw.temp);
					codes.push(hw.code);
				}
			}
			if (temps.length) {
				const freq: Record<number, number> = {};
				codes.forEach((c) => (freq[c] = (freq[c] || 0) + 1));
				const dom = Number(Object.keys(freq).reduce((a, b) => (freq[+a] > freq[+b] ? a : b)));
				return {
					emoji: wxEmoji(dom),
					hi: Math.round(Math.max(...temps)),
					lo: Math.round(Math.min(...temps))
				};
			}
			return null;
		}
		const d = w?.daily?.[day.date] ?? day.staticWeather;
		return d ? { emoji: d.emoji ?? '', hi: Math.round(d.hi), lo: Math.round(d.lo) } : null;
	}

	function blockBadge(seg: Segment, day: Day, time: string): { emoji: string; temp: number } | null {
		const key = wxKey(seg);
		const w = key ? wxBySeg[key] : null;
		if (w?.hourly) {
			const clean = time.replace(/[^0-9:]/g, '');
			const p = clean.split(':');
			if (!p[0]) return null;
			let h = parseInt(p[0], 10);
			const m = p[1] ? parseInt(p[1], 10) : 0;
			if (m >= 30) h = Math.min(h + 1, 23);
			const hw = w.hourly[day.date + '-' + String(h).padStart(2, '0')];
			return hw ? { emoji: wxEmoji(hw.code), temp: Math.round(hw.temp) } : null;
		}
		const d = w?.daily?.[day.date] ?? day.staticWeather;
		return d ? { emoji: d.emoji ?? '', temp: Math.round(d.hi) } : null;
	}

	// ── Wikipedia thumbnails for the current day's photo spots ──
	function spotKey(sp: { name: string; wiki?: string; fallbackImg?: string }): string | null {
		return sp.wiki ? sp.wiki : sp.fallbackImg ? 'img:' + sp.name : null;
	}
	$effect(() => {
		const day = current?.day;
		if (!day) return;
		for (const b of day.blocks) {
			for (const sp of b.photoSpots ?? []) {
				if (!sp.wiki && sp.fallbackImg) {
					const k = 'img:' + sp.name;
					if (wikiImgs[k] === undefined) wikiImgs = { ...wikiImgs, [k]: sp.fallbackImg };
					continue;
				}
				if (!sp.wiki || wikiImgs[sp.wiki] !== undefined) continue;
				const wiki = sp.wiki;
				const fallback = sp.fallbackImg ?? null;
				wikiImgs = { ...wikiImgs, [wiki]: fallback }; // mark pending with fallback
				fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(wiki))
					.then((r) => r.json() as Promise<{ thumbnail?: { source?: string } }>)
					.then((d) => {
						const src = d?.thumbnail?.source ?? fallback;
						wikiImgs = { ...wikiImgs, [wiki]: src };
					})
					.catch(() => {});
			}
		}
	});

	// Inline CSS-variable overrides from a segment's custom themeColors.
	const themeStyle = $derived.by(() => {
		const c = current?.seg.themeColors;
		if (!c) return '';
		const parts: string[] = [];
		if (c.heroBg) parts.push(`--hero-bg:${c.heroBg}`);
		if (c.accent) parts.push(`--accent:${c.accent}`);
		if (c.eyebrow) parts.push(`--hero-eyebrow:${c.eyebrow}`);
		return parts.join(';');
	});

	// Route places for the current day
	const routeForDay = $derived.by(() => {
		if (!current) return null;
		const places = routePlaces(trip, current.day.blocks, lang);
		if (places.length < 2) return null;
		return { url: routeUrl(places, current.day.routeMode), places };
	});

	// ── Day map stops ──
	// The current day's coord-bearing blocks, numbered in time order (blocks are
	// stored in time order, so array order is time order). Popup title is
	// localized for the active language, so switching languages re-renders them.
	const dayMapStops = $derived.by<MapStop[]>(() => {
		if (!current) return [];
		const out: MapStop[] = [];
		let n = 0;
		for (const b of current.day.blocks) {
			if (b.coords) {
				n++;
				out.push({ lat: b.coords.lat, lon: b.coords.lon, n, popup: `${b.time} — ${L(b.title)}` });
			}
		}
		return out;
	});
	const mapAriaLabel = $derived(
		lang === 'pt'
			? `Mapa do dia, ${dayMapStops.length} paradas`
			: `Day map, ${dayMapStops.length} stops`
	);

	// ── Linked Google Photos ──
	// Photos come pre-placed (segment/plan/day/block) by capture time; this
	// component only groups them onto the selected day. The segment guard
	// covers the rare case of two segments containing the same calendar date.
	const dayPhotos = $derived.by<TripPhoto[]>(() => {
		if (!current) return [];
		return photos.filter(
			(p) => p.dayDate === current.day.date && (!p.segmentId || p.segmentId === current.seg.id)
		);
	});
	/** blockIndex → photos, counting only indexes that are valid for the plan
	 *  being viewed (a stale index after an itinerary edit, or a placement
	 *  computed against another plan, degrades to the day-level strip). */
	const photosByBlock = $derived.by<Map<number, TripPhoto[]>>(() => {
		const m = new Map<number, TripPhoto[]>();
		if (!current) return m;
		for (const p of dayPhotos) {
			if (p.blockIndex == null) continue;
			if (p.planId && p.planId !== current.plan.id) continue;
			if (p.blockIndex < 0 || p.blockIndex >= current.day.blocks.length) continue;
			const arr = m.get(p.blockIndex);
			if (arr) arr.push(p);
			else m.set(p.blockIndex, [p]);
		}
		return m;
	});
	const dayLevelPhotos = $derived(
		dayPhotos.filter((p) => {
			if (p.blockIndex == null || !current) return true;
			if (p.planId && p.planId !== current.plan.id) return true;
			return p.blockIndex < 0 || p.blockIndex >= current.day.blocks.length;
		})
	);
	/** Photos whose capture date matched no itinerary day (or were unassigned
	 *  by hand) — surfaced at the end of the trip so they can be placed. */
	const unmatchedPhotos = $derived(photos.filter((p) => p.dayDate == null));

	// Photo clusters on the day map, anchored at their block's coordinates.
	const photoMapStops = $derived.by<PhotoStop[]>(() => {
		if (!current) return [];
		const out: PhotoStop[] = [];
		for (const [bi, list] of photosByBlock) {
			const b = current.day.blocks[bi];
			if (!b?.coords) continue;
			out.push({
				lat: b.coords.lat,
				lon: b.coords.lon,
				thumbUrl: photoUrl(trip.id, list[0].id, 'thumb', photoToken),
				count: list.length,
				blockIndex: bi
			});
		}
		return out.sort((a, b) => a.blockIndex - b.blockIndex);
	});

	// Lightbox: a snapshot list + cursor. Closed (and re-seeded from fresh
	// props) after any mutation, so it never renders stale placements.
	let lbList = $state<TripPhoto[] | null>(null);
	let lbIdx = $state(0);
	function openLightbox(list: TripPhoto[], idx: number) {
		lbList = list;
		lbIdx = idx;
	}
	function openBlockPhotos(blockIndex: number) {
		const list = photosByBlock.get(blockIndex);
		if (list?.length) openLightbox(list, 0);
	}
	const lightboxDayOptions = $derived(
		flatDays.map((f) => ({
			date: f.day.date,
			label: `${dayLabel(f.day.date, localeFor(trip, lang))} — ${L(f.day.title)}`
		}))
	);
	function photoCaption(p: TripPhoto): string {
		const instant = new Date(p.creationTime);
		if (Number.isNaN(instant.getTime())) return '';
		return `${dayLabel(isoDateInTZ(instant, tz), localeFor(trip, lang))} · ${hhmmInTZ(instant, tz)}`;
	}

	// ── Publish the day rail to the desktop sidebar (≥960px) ──
	// TripView stays the single source of truth for day + plan selection; it hands
	// the sidebar a snapshot view-model (built from `railSegments` — no duplicated
	// flat-day logic) plus callbacks that drive its own state. Re-published on every
	// selection/language/"today" change; cleared on destroy so the sidebar drops the
	// trip zone when the trip unmounts. Harmless below 960px (the sidebar is hidden).
	$effect(() => {
		const vm: TripNavVM = {
			label: lang === 'pt' ? 'Dias da viagem' : 'Trip days',
			segments: railSegments.map((group) => ({
				id: group.seg.id,
				title: L(group.seg.title),
				subtitle: L(group.seg.subtitle),
				pills:
					group.seg.plans.length > 1
						? group.seg.plans.map((p) => ({
								id: p.id,
								label: L(p.label) || p.id,
								on: p.id === planOf(group.seg).id
							}))
						: [],
				days: group.days.map(({ day, gi }) => ({
					gi,
					dateLabel: `${dowShort(day.date, localeFor(trip, lang))} ${dayNum(day.date)}`,
					title: L(day.title),
					today: day.date === todayISO,
					active: gi === clampedIdx
				}))
			})),
			selectDay: (gi: number) => {
				dayIdx = gi;
			},
			selectPlan: (segId: string, planId: string) => {
				const seg = trip.segments.find((s) => s.id === segId);
				if (seg) setPlan(seg, planId);
			}
		};
		setTripNav(vm);
	});
	onDestroy(() => setTripNav(null));
</script>

<div class="shell theme-{current?.seg.theme || 'tartan'}" style={themeStyle}>
	<div class="hero">
		<div class="hero-inner">
			<div class="hero-row1">
				<div class="trip-eyebrow">{L(trip.eyebrow)}</div>
				<div class="hero-actions">
					<button class="ics-btn" onclick={downloadIcs} aria-label={uiText.addToCalendar}>
						<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
						{uiText.addToCalendar}
					</button>
					{#if trip.languages.length > 1}
						<div class="lang-toggle">
							{#each trip.languages as l (l)}
								<button class="lang-btn" class:on={l === lang} aria-pressed={l === lang} onclick={() => setLang(l)}>
									{l.toUpperCase()}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
			<div class="trip-title">{L(current?.seg.title)}</div>
			<div class="trip-sub">{L(current?.seg.subtitle)}</div>
			{#if current && current.seg.plans.length > 1}
				<div class="vtabs">
					{#each current.seg.plans as p (p.id)}
						{@const on = p.id === planOf(current.seg).id}
						<button class="vtab" class:on aria-pressed={on} onclick={() => setPlan(current.seg, p.id)}>
							{L(p.label) || p.id}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="daynav-sentinel" bind:this={sentinelEl} aria-hidden="true"></div>
	<nav class="daynav" class:stuck={daynavStuck} aria-label="Days">
		<div class="daynav-scroll">
			{#each navEntries as entry (entry.kind === 'day' ? entry.day : entry.date)}
				{#if entry.kind === 'day'}
					{@const day = entry.day}
					{@const gi = entry.gi}
					{@const on = gi === clampedIdx}
					{@const label = dayLabel(day.date, localeFor(trip, lang))}
					{#if entry.sep}<div class="daybtn-separator"></div>{/if}
					<button
						class="daybtn"
						class:on
						class:has-bday={!!L(day.banner)}
						aria-current={on ? 'date' : undefined}
						aria-label={label}
						onclick={() => (dayIdx = gi)}
						bind:this={dayBtnEls[gi]}
					>
						<span class="dow">{dowShort(day.date, localeFor(trip, lang))}</span>
						<span class="dnum">{dayNum(day.date)}</span>
						<span class="bday-pip"></span>
					</button>
				{:else}
					<div class="daybtn daybtn-gap">
						<span class="dow" aria-hidden="true">{dowShort(entry.date, localeFor(trip, lang))}</span>
						<span class="dnum" aria-hidden="true">{dayNum(entry.date)}</span>
						<span class="sr-only">Free day</span>
					</div>
				{/if}
			{/each}
		</div>
		{#if daynavStuck && current}
			<div
				class="daynav-context"
				transition:slide={{ duration: prefersReducedMotion.current ? 0 : 180 }}
			>
				{stuckDayLabel}
			</div>
		{/if}
	</nav>

	<div class="scroll-area">
		{#if current}
			{@const seg = current.seg}
			{@const plan = current.plan}
			{@const day = current.day}
			{@const wx = daySummary(seg, day)}
			{@const km = dayKmTotal(day)}
			{#key clampedIdx}
				<div
					class="day-content"
					in:fly={{
						y: prefersReducedMotion.current ? 0 : 8,
						duration: prefersReducedMotion.current ? 0 : 180
					}}
				>
					<div class="day-hdr">
						<div class="dh-in">
							<div class="dh-eye">{dayLabel(day.date, localeFor(trip, lang))}</div>
							<div class="dh-title">{L(day.title)}</div>
							{#if L(day.note)}<div class="dh-note">{L(day.note)}</div>{/if}
							{#if wx || km}
								<div class="wx-hdr">
									{#if wx}
										<div class="wx-hdr-item" aria-hidden="true">{wx.emoji}</div>
										<div class="wx-hdr-item">↑{wx.hi}°C</div>
										<div class="wx-hdr-item">↓{wx.lo}°C</div>
									{/if}
									{#if km}<div class="wx-hdr-item wx-km">🦶 ~{km.toFixed(1)} km</div>{/if}
								</div>
							{/if}
							{#if L(day.banner)}<div class="bday-strip">{L(day.banner)}</div>{/if}
						</div>
					</div>

					<aside class="day-aside">
						{#if dayMapStops.length >= 2}
							<DayMap
								stops={dayMapStops}
								ariaLabel={mapAriaLabel}
								photoStops={photoMapStops}
								onphotostopclick={openBlockPhotos}
							/>
						{/if}

						{#if routeForDay}
							<!-- Mobile-only compact stand-in for the (hidden) route stepper:
							     preserves the one thing the card uniquely offers, the Maps link. -->
							<a href={routeForDay.url} target="_blank" rel="noopener noreferrer" class="maps-link-btn">
								<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
								{uiText.openRoute}
							</a>

							<!-- Full Day-Route stepper: desktop only (hidden on mobile). -->
							<a href={routeForDay.url} target="_blank" rel="noopener noreferrer" class="route-card">
								<div class="route-hdr">
									<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>
									{uiText.dayRoute}
								</div>
								<div class="route-stops">
									{#each routeForDay.places as p, i (i)}
										{#if i > 0}<div class="route-connector"></div>{/if}
										<div class="route-stop">
											<div class="route-num">{i + 1}</div>
											<div class="route-name">{p.name}</div>
										</div>
									{/each}
								</div>
								<div class="route-open">
									<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
									{uiText.openRoute}
								</div>
							</a>
						{/if}
					</aside>

					<div class="tl">
						{#each day.blocks as b, bi (bi)}
							{@const badge = blockBadge(seg, day, b.time)}
							{@const isNext = isToday && nowMarkerIdx === bi}
							{#if isToday && nowMarkerIdx === bi}
								<div class="tb tb-now" aria-hidden="true" bind:this={nowMarkerEl}>
									<div class="tb-left"></div>
									<div class="tb-body tb-now-body">
										<div class="tb-now-dot"></div>
										<div class="tb-now-line"></div>
										<span class="tb-now-label">{uiText.now} · {nowLabel}</span>
									</div>
								</div>
							{/if}
							<div class="tb">
								<div class="tb-left">
									<div class="tb-time">
										{b.time}
										{#if badge && !isPast}
											<div class="wx"><span aria-hidden="true">{badge.emoji}</span> {badge.temp}°C</div>
										{/if}
									</div>
									<div class="tb-dot-col">
										<div class="tb-dot" class:tb-dot-next={isNext} style="background:{b.dotColor || 'var(--text-muted)'}"></div>
										{#if bi < day.blocks.length - 1}<div class="tb-line"></div>{/if}
									</div>
								</div>
								<div class="tb-body">
									<div class="tb-title-row">
										<div class="tb-title" class:tb-title-next={isNext}>{L(b.title)}</div>
										{#if b.mapsUrl}
											<a
												class="map-icon-btn"
												href={safeUrl(b.mapsUrl)}
												target="_blank"
												rel="noopener noreferrer"
												aria-label={uiText.maps}
												title={uiText.maps}
											>
												<span class="map-icon-circle">
													<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
												</span>
											</a>
										{/if}
									</div>
									{#if b.tags?.length}
										<div class="tb-tags">
											{#each b.tags as key (key)}
												{@const tag = trip.tags?.[key]}
												{#if tag}<span class="tb-tag {tag.style ?? 'logistics'}">{L(tag.label)}</span>{/if}
											{/each}
										</div>
									{/if}
									{#if L(b.description)}<div class="tb-meta">{L(b.description)}</div>{/if}
									{#if b.km}<div class="km-tag">🚶 ~{b.km} km</div>{/if}
									{#if L(b.warning)}<div class="tb-warn">{L(b.warning)}</div>{/if}
									{#if L(b.note)}<div class="tb-note">{L(b.note)}</div>{/if}
									{#if b.photoSpots?.length}
										<div class="tb-photos">
											{#each b.photoSpots as sp (sp)}
												{@const key = spotKey(sp)}
												<a href={safeUrl(sp.mapsUrl)} target="_blank" rel="noopener noreferrer" class="ps-card">
													{#if key && safeUrl(wikiImgs[key] ?? undefined)}
														<img src={safeUrl(wikiImgs[key] ?? undefined)} class="ps-thumb" alt={sp.name} />
													{:else}
														<div class="ps-thumb ps-placeholder" aria-hidden="true"></div>
													{/if}
													<span class="ps-label">{sp.name}</span>
												</a>
											{/each}
										</div>
									{/if}
									{#if b.diff && plan.diffLabels?.[b.diff.kind]}
										<div class="diff-{b.diff.kind}">{L(plan.diffLabels[b.diff.kind])}{L(b.diff.reason)}</div>
									{/if}
									{#if photosByBlock.get(bi)?.length}
										{@const bp = photosByBlock.get(bi) ?? []}
										<div class="ph-strip">
											{#each bp as p, pi (p.id)}
												<button class="ph-thumb" onclick={() => openLightbox(bp, pi)} aria-label={uiText.openPhoto}>
													<img src={photoUrl(trip.id, p.id, 'thumb', photoToken)} alt="" loading="lazy" />
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/each}
						{#if isToday && day.blocks.length > 0 && nowMarkerIdx === day.blocks.length}
							<div class="tb tb-now tb-now-end" aria-hidden="true" bind:this={nowMarkerEl}>
								<div class="tb-left"></div>
								<div class="tb-body tb-now-body">
									<div class="tb-now-dot"></div>
									<div class="tb-now-line"></div>
									<span class="tb-now-label">{uiText.now} · {nowLabel}</span>
								</div>
							</div>
						{/if}
					</div>
					{#if dayLevelPhotos.length}
						<div class="day-photos">
							<div class="dp-title">{uiText.photos}</div>
							<div class="ph-strip">
								{#each dayLevelPhotos as p, pi (p.id)}
									<button class="ph-thumb" onclick={() => openLightbox(dayLevelPhotos, pi)} aria-label={uiText.openPhoto}>
										<img src={photoUrl(trip.id, p.id, 'thumb', photoToken)} alt="" loading="lazy" />
									</button>
								{/each}
							</div>
						</div>
					{/if}
					{#if L(seg.footer)}<div class="footer">{L(seg.footer)}</div>{/if}
				</div>
			{/key}
		{/if}
		{#if unmatchedPhotos.length && photosEditable}
			<div class="day-photos day-photos-unmatched">
				<div class="dp-title">{uiText.unmatchedPhotos}</div>
				<div class="ph-strip">
					{#each unmatchedPhotos as p, pi (p.id)}
						<button class="ph-thumb" onclick={() => openLightbox(unmatchedPhotos, pi)} aria-label={uiText.openPhoto}>
							<img src={photoUrl(trip.id, p.id, 'thumb', photoToken)} alt="" loading="lazy" />
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if lbList}
	<PhotoLightbox
		tripId={trip.id}
		photos={lbList}
		bind:index={lbIdx}
		canEdit={photosEditable}
		{photoToken}
		dayOptions={lightboxDayOptions}
		captionFor={photoCaption}
		onclose={() => (lbList = null)}
		onchanged={() => {
			lbList = null;
			onphotoschanged?.();
		}}
	/>
{/if}

<style>
	.shell {
		max-width: 430px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		/* Trip theme = ONE base colour + its gold eyebrow. Light values ARE the
		   current identity. hero-bg/accent derive from the base; --accent-text is
		   the text-level accent (equals the base in light; lightened via OKLCH in
		   the dark block below so it reads on dark surfaces). Neutrals (--text/
		   --text-muted/--hairline-strong) are intentionally NOT redefined here —
		   they inherit the global tokens.css definitions so they flip light↔dark. */
		--theme-base: #2b4a2b;
		--theme-eyebrow: #e8c84a;
		--hero-bg: var(--theme-base);
		--hero-eyebrow: var(--theme-eyebrow);
		--accent: var(--theme-base);
		--accent-text: var(--theme-base);
		/* Trip-specific accent hues (outside the global system) */
		--heather: #7b4f7a;
		--gold: #b8860b;
		--moss: #3d5a3d;
		--loch: #1e3a5f;
		/* Category chips + note strips — light values keep the current identity;
		   dark flips them to translucent fills with lighter text via light-dark()
		   (color-scheme is declared in the canon token file, keyed on data-theme,
		   so these follow explicit AND system dark automatically). Only the four
		   non-<color> / cache-sensitive tokens still need the dual dark blocks
		   below. --chip-logistics-fg and --note-fg are single-valued: both modes
		   resolve to var(--text-muted), which is already theme-aware. */
		--chip-sight-bg: light-dark(#dce8f5, rgba(120, 160, 210, 0.2));
		--chip-sight-fg: light-dark(var(--loch), #bcd4f0);
		--chip-food-bg: light-dark(#daf0e5, rgba(90, 170, 120, 0.2));
		--chip-food-fg: light-dark(var(--moss), #a9d9bf);
		--chip-logistics-bg: light-dark(#ede8e0, rgba(180, 168, 148, 0.16));
		--chip-logistics-fg: var(--text-muted);
		--chip-booking-bg: light-dark(#f5edd5, rgba(200, 170, 90, 0.18));
		--chip-booking-fg: light-dark(#7a5a10, #e0c987);
		--chip-fullday-bg: light-dark(#ede0f0, rgba(160, 120, 170, 0.22));
		--chip-fullday-fg: light-dark(var(--heather), #d3b0dd);
		--chip-bday-grad: linear-gradient(120deg, #f2d2f0, #dfd0f2);
		--chip-bday-fg: light-dark(#5a2a78, #e6c8f0);
		--note-bg: light-dark(#f0ece4, rgba(236, 228, 212, 0.06));
		--note-fg: var(--text-muted);
		--warn-bg: light-dark(#fdf0ee, rgba(200, 64, 64, 0.14));
		--warn-fg: light-dark(#7a2020, #e8a99f);
		--warn-bar: light-dark(#c84040, #c85a4a);
		--add-bg: light-dark(#e5f5e8, rgba(90, 170, 110, 0.14));
		--add-fg: light-dark(#1a3a1a, #a9d9b5);
		--chg-bg: light-dark(#fef6de, rgba(200, 170, 80, 0.14));
		--chg-fg: light-dark(#5a3a00, #e0c987);
		--photo-filter: none;
		--map-filter: none;
		font-family: 'Source Serif 4', Georgia, serif;
		color: var(--text);
		border-radius: var(--radius-lg);
		/* `clip`, not `hidden`: still clips content to the rounded corners, but
		   (unlike `hidden`) doesn't turn .shell into a scroll container — which
		   would otherwise become the sticky day nav's containing block and
		   break position: sticky, since .shell itself never actually scrolls
		   (the page does). */
		overflow: clip;
		box-shadow: var(--elevation-2);
	}
	.shell.theme-navy {
		--theme-base: #1e3054;
		--theme-eyebrow: #c17817;
	}
	.shell.theme-terracotta {
		--theme-base: #7c3a29;
		--theme-eyebrow: #e6b566;
	}
	.shell.theme-olive {
		--theme-base: #4a5324;
		--theme-eyebrow: #d9c46a;
	}
	.shell.theme-azure {
		--theme-base: #17456b;
		--theme-eyebrow: #e0a24a;
	}
	.shell.theme-sand {
		--theme-base: #5b4a30;
		--theme-eyebrow: #e8cf8a;
	}
	/* ── Dark mode — the four tokens light-dark() CANNOT carry (everything else
	   above collapsed into light-dark() at its definition site):
	   - --accent-text: lifts the text-level accent off the (dark) theme base via
	     OKLCH relative-colour syntax (same hue/chroma, forced light). Kept
	     attribute/media-keyed because Chromium caches relative-colour resolution
	     and goes stale on live theme flips (see the @property registration in
	     tokens.css) — the keyed blocks re-trigger it reliably.
	   - --chip-bday-grad: a gradient — light-dark() only returns <color>, not
	     an <image>.
	   - --photo-filter / --map-filter: filter lists, likewise not <color>.
	   Both blocks (explicit data-theme='dark' + system-dark with no attribute)
	   must stay byte-identical — same 4 declarations each.
	   The saturated --accent (fills with white text) and --hero-bg stay put in
	   both modes: the hero colours are already dark enough to keep. ── */
	:global(html[data-theme='dark']) .shell {
		--accent-text: oklch(from var(--theme-base) 0.82 calc(c * 0.9) h);
		--chip-bday-grad: linear-gradient(120deg, rgba(200, 130, 190, 0.22), rgba(170, 140, 210, 0.22));
		--photo-filter: brightness(0.9);
		--map-filter: brightness(0.72) contrast(1.05) saturate(0.85);
	}
	@media (prefers-color-scheme: dark) {
		:global(html:not([data-theme])) .shell {
			--accent-text: oklch(from var(--theme-base) 0.82 calc(c * 0.9) h);
			--chip-bday-grad: linear-gradient(120deg, rgba(200, 130, 190, 0.22), rgba(170, 140, 210, 0.22));
			--photo-filter: brightness(0.9);
			--map-filter: brightness(0.72) contrast(1.05) saturate(0.85);
		}
	}
	.hero {
		background: var(--hero-bg);
		padding: 14px 16px 0;
		position: relative;
		overflow: hidden;
	}
	.hero-inner {
		position: relative;
		z-index: 1;
	}
	.hero-row1 {
		display: flex;
		/* Allow the actions to wrap onto their own line under the eyebrow when the
		   two can't share one row (very narrow phones / wider system fonts). This
		   is what keeps the EN|PT toggle from ever being clipped by the right edge:
		   rather than overflow, the block reflows below and right-aligns. */
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		margin-bottom: 5px;
	}
	.trip-eyebrow {
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--hero-eyebrow);
		opacity: 0.75;
		/* Take the row's slack and shrink first, so the actions keep their size. */
		flex: 1 1 auto;
		min-width: 0;
	}
	.hero-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		/* Hold together and stay pinned right, whether on the eyebrow's line or
		   wrapped below it; never compress the ics button or the language pill. */
		flex-shrink: 0;
		margin-left: auto;
	}
	.ics-btn,
	.lang-toggle {
		flex-shrink: 0;
	}
	.ics-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		min-height: 44px;
		box-sizing: border-box;
		border-radius: var(--radius-button);
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(0, 0, 0, 0.2);
		color: rgba(255, 255, 255, 0.75);
		font-size: 11px;
		font-family: inherit;
		letter-spacing: 0.02em;
		cursor: pointer;
	}
	@media (hover: hover) {
		.ics-btn:hover {
			background: rgba(0, 0, 0, 0.3);
			color: #fff;
		}
	}
	.lang-toggle {
		display: flex;
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.18);
	}
	.lang-btn {
		padding: 4px 12px;
		min-height: 44px;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: rgba(0, 0, 0, 0.2);
		cursor: pointer;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
		font-family: inherit;
		letter-spacing: 0.06em;
	}
	.lang-btn.on {
		background: rgba(255, 255, 255, 0.18);
		color: #fff;
		font-weight: 500;
	}
	@media (hover: hover) {
		.lang-btn:not(.on):hover {
			background: rgba(0, 0, 0, 0.28);
			color: rgba(255, 255, 255, 0.75);
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.ics-btn,
		.lang-btn {
			transition:
				background 0.15s ease,
				color 0.15s ease,
				transform 0.1s ease;
		}
		.ics-btn:active,
		.lang-btn:active {
			transform: scale(0.96);
		}
	}
	.trip-title {
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 25px;
		font-weight: 700;
		color: #fff;
		line-height: 1.05;
	}
	.trip-sub {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
		margin-bottom: 10px;
	}
	.vtabs {
		display: flex;
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		overflow: hidden;
		gap: 1px;
		background: rgba(0, 0, 0, 0.2);
	}
	.vtab {
		flex: 1;
		padding: 8px 6px;
		min-height: 44px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		cursor: pointer;
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.55);
		font-family: inherit;
		font-size: 11.5px;
	}
	.vtab.on {
		background: var(--surface);
		color: var(--text);
		font-weight: 500;
	}
	@media (hover: hover) {
		.vtab:not(.on):hover {
			background: rgba(255, 255, 255, 0.16);
			color: rgba(255, 255, 255, 0.8);
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.vtab {
			transition:
				background 0.15s ease,
				color 0.15s ease,
				transform 0.1s ease;
		}
		.vtab:active {
			transform: scale(0.97);
		}
	}
	.daynav-sentinel {
		/* Zero footprint (height cancelled by the negative margin) — exists only
		   so an IntersectionObserver can detect the moment the day nav below it
		   becomes pinned to the top of the viewport. */
		height: 1px;
		margin-bottom: -1px;
	}
	.daynav {
		background: var(--surface);
		border-bottom: 1px solid var(--hairline-strong);
		/* Sticks to the top of the trip shell as the page scrolls; the plan
		   tabs and hero above it scroll away normally. z-index is set well
		   above Leaflet's internal panes (tilePane 200 … popupPane 700) so the
		   day-map never paints over it. */
		position: sticky;
		top: 0;
		z-index: 1000;
		transition: box-shadow 0.15s ease;
	}
	.daynav.stuck {
		box-shadow: var(--elevation-1);
	}
	.daynav-scroll {
		display: flex;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 0 4px;
		min-width: 0;
		/* The day pills' total intrinsic width exceeds the shell on narrow
		   viewports. `overflow-x: auto` scrolls them, but its scrollable overflow
		   still propagates up and leaks a phantom horizontal page scroll (overflow
		   clipping on ancestors does not stop it in this flex/scroll case).
		   Paint containment keeps that scroll overflow inside the strip. */
		contain: paint;
	}
	.daynav-scroll::-webkit-scrollbar {
		display: none;
	}
	/* Second line inside the day nav, revealed only once the nav is stuck to the
	   top: the active day's weekday + title, ellipsized to a single line. Eyebrow
	   styling, theme-tinted via --accent-text. Its slide/fade is reduced-motion
	   gated in the markup (transition duration → 0). */
	.daynav-context {
		padding: 3px 12px 4px;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
		border-top: 1px solid var(--hairline);
	}
	.daybtn {
		flex: 1 0 auto;
		min-width: 44px;
		min-height: 44px;
		box-sizing: border-box;
		padding: 7px 3px 5px;
		border: none;
		background: none;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		border-bottom: 2.5px solid transparent;
	}
	.daybtn.on {
		border-bottom-color: var(--accent-text);
	}
	@media (hover: hover) {
		.daybtn:not(.on):not(.daybtn-gap):hover {
			background: rgba(0, 0, 0, 0.03);
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.daybtn {
			transition:
				background 0.15s ease,
				transform 0.1s ease;
		}
		.daybtn:not(.daybtn-gap):active {
			transform: scale(0.96);
		}
	}
	.daybtn-gap {
		cursor: default;
		opacity: 0.4;
	}
	.daybtn-gap .dow,
	.daybtn-gap .dnum {
		font-weight: 400;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.daybtn .dow {
		font-size: 9px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.daybtn .dnum {
		font-size: 15px;
		font-weight: 500;
		color: var(--text-muted);
		font-family: 'Source Serif 4', serif;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.daybtn.on .dow,
	.daybtn.on .dnum {
		color: var(--accent-text);
	}
	.bday-pip {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--heather);
		margin-top: 1px;
		opacity: 0;
	}
	.daybtn.has-bday .bday-pip {
		opacity: 1;
	}
	.daybtn-separator {
		width: 1px;
		background: var(--hairline-strong);
		margin: 4px 0;
		flex-shrink: 0;
	}
	.scroll-area {
		padding-bottom: 20px;
	}
	.day-hdr {
		margin: 10px 13px 0;
		background: var(--hero-bg);
		border-radius: var(--radius-lg);
		/* Slimmed: tighter padding + smaller title + a single compact weather row
		   trims the header from ~107px toward ~80px, so more of the timeline is
		   visible on first paint. Keeps the theme colour band identity. */
		padding: 8px 14px 8px;
	}
	.dh-eye {
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--hero-eyebrow);
		opacity: 0.7;
		margin-bottom: 1px;
	}
	.dh-title {
		font-family: 'Source Serif 4', serif;
		font-size: 16px;
		color: #fff;
		font-weight: 700;
		line-height: 1.15;
	}
	.dh-note {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.55);
		margin-top: 3px;
		line-height: 1.4;
	}
	.bday-strip {
		background: var(--heather);
		border-radius: var(--radius-md);
		padding: 6px 11px;
		margin-top: 8px;
		font-family: 'Source Serif 4', serif;
		font-style: italic;
		font-size: 12px;
		color: #fff;
		line-height: 1.3;
	}
	.wx-hdr {
		display: flex;
		gap: 8px;
		flex-wrap: nowrap;
		padding: 0;
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.85);
		margin-top: 4px;
	}
	.wx-hdr-item {
		display: flex;
		align-items: center;
		gap: 3px;
	}
	.wx-km {
		color: #cfe0b8;
		font-weight: 600;
		padding-left: 8px;
		border-left: 1px solid rgba(255, 255, 255, 0.25);
	}
	.tl {
		padding: 2px 13px 0;
	}
	.tb {
		display: flex;
	}
	.tb-left {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 50px;
		flex-shrink: 0;
		padding-top: 12px;
	}
	.tb-time {
		font-size: 10px;
		font-weight: 500;
		color: var(--text-muted);
		text-align: center;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}
	.tb-dot-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 4px;
		flex: 1;
	}
	.tb-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		border: 2px solid var(--surface);
		box-shadow: 0 0 0 1px var(--hairline);
	}
	.tb-line {
		width: 1.5px;
		flex: 1;
		min-height: 14px;
		background: var(--hairline-strong);
		margin-top: 2px;
	}
	.tb-dot-next {
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--accent-text) 25%, transparent),
			0 0 0 1px var(--accent-text);
	}
	/* The "now" row: a quiet accent rule across the timeline with a small dot
	   on the rail and a tiny HH:MM label, sitting between the last started
	   block and the next upcoming one. */
	.tb-now .tb-left {
		width: 50px;
		flex-shrink: 0;
	}
	.tb-now-body {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 0 0 0 5px;
		min-height: 16px;
		border-bottom: none;
	}
	.tb-now-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--accent-text);
		flex-shrink: 0;
		box-shadow: 0 0 0 2px var(--surface);
	}
	.tb-now-line {
		flex: 1;
		height: 1.5px;
		background: var(--accent-text);
		opacity: 0.55;
		margin: 0 6px;
	}
	.tb-now-label {
		font-size: 9px;
		letter-spacing: 0.03em;
		color: var(--accent-text);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
	.tb-body {
		flex: 1;
		padding: 11px 0 11px 9px;
		border-bottom: 1px solid var(--hairline-strong);
	}
	.tb:last-child .tb-body {
		border-bottom: none;
	}
	.tb-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.tb-title {
		font-family: 'Source Serif 4', serif;
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		line-height: 1.3;
	}
	.tb-title-next {
		color: var(--accent-text);
		font-weight: 700;
	}
	/* Quiet "open in maps" affordance: a small stone-colored ghost circle on
	   the block's title row. The anchor itself is the full 44px touch target
	   (padding, not visual size) — the visible circle inside it is smaller. */
	.map-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		color: var(--text-muted);
		text-decoration: none;
	}
	.map-icon-circle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid var(--hairline-strong);
		background: transparent;
	}
	.map-icon-btn:hover .map-icon-circle,
	.map-icon-btn:focus-visible .map-icon-circle {
		border-color: var(--accent-text);
		color: var(--accent-text);
		background: color-mix(in srgb, var(--accent-text) 8%, transparent);
	}
	@media (prefers-reduced-motion: no-preference) {
		.map-icon-circle {
			transition:
				border-color 0.15s ease,
				background 0.15s ease,
				color 0.15s ease,
				transform 0.1s ease;
		}
		.map-icon-btn:active .map-icon-circle {
			transform: scale(0.9);
		}
	}
	.tb-tags {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		margin: 4px 0 3px;
	}
	.tb-tag {
		font-size: 10px;
		padding: 2px 7px;
		border-radius: var(--radius-pill);
		white-space: nowrap;
	}
	.tb-tag.sight {
		background: var(--chip-sight-bg);
		color: var(--chip-sight-fg);
	}
	.tb-tag.food {
		background: var(--chip-food-bg);
		color: var(--chip-food-fg);
	}
	.tb-tag.logistics {
		background: var(--chip-logistics-bg);
		color: var(--chip-logistics-fg);
	}
	.tb-tag.booking {
		background: var(--chip-booking-bg);
		color: var(--chip-booking-fg);
	}
	.tb-tag.fullday {
		background: var(--chip-fullday-bg);
		color: var(--chip-fullday-fg);
	}
	.tb-tag.birthday {
		background: var(--chip-bday-grad);
		color: var(--chip-bday-fg);
		font-weight: 500;
	}
	.tb-meta {
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.55;
		margin-top: 2px;
	}
	.tb-warn {
		background: var(--warn-bg);
		border-left: 2.5px solid var(--warn-bar);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 5px;
		font-size: 11px;
		color: var(--warn-fg);
		line-height: 1.45;
	}
	.tb-note {
		background: var(--note-bg);
		border-radius: var(--radius-md);
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--note-fg);
		line-height: 1.45;
	}
	.diff-added {
		background: var(--add-bg);
		border-left: 2.5px solid var(--moss);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--add-fg);
		line-height: 1.45;
	}
	.diff-changed {
		background: var(--chg-bg);
		border-left: 2.5px solid var(--gold);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--chg-fg);
		line-height: 1.45;
	}
	.diff-kept {
		background: var(--note-bg);
		border-left: 2.5px solid var(--accent-text);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--note-fg);
		line-height: 1.45;
	}
	.footer {
		text-align: center;
		padding: 10px 0 3px;
		font-size: 10px;
		color: var(--text-muted);
		opacity: 0.7;
		font-family: 'Source Serif 4', serif;
		font-style: italic;
		letter-spacing: 0.05em;
	}
	/* Mobile: the Day-Route stepper is hidden (its Maps link survives as the
	   compact .maps-link-btn under the map). It returns on desktop (see the
	   ≥960px block), where it sits in the sticky right column beneath the map. */
	.route-card {
		display: none;
		margin: 10px 13px 4px;
		background: var(--surface-sunken);
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-lg);
		padding: 12px 14px 10px;
		text-decoration: none;
		color: var(--text);
	}
	/* Compact full-width quiet button that replaces the stepper on mobile — the
	   route card's one unique affordance (open the whole day's route in Maps),
	   kept at ≥44px tall. Hidden on desktop where the full card is back. */
	.maps-link-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin: 4px 13px 2px;
		min-height: 44px;
		box-sizing: border-box;
		padding: 6px 12px;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-button);
		background: var(--surface-sunken);
		color: var(--accent-text);
		font-family: 'Source Serif 4', serif;
		font-size: 12px;
		text-decoration: none;
	}
	@media (hover: hover) {
		.maps-link-btn:hover {
			border-color: var(--accent-text);
			background: color-mix(in srgb, var(--accent-text) 6%, transparent);
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.maps-link-btn {
			transition:
				border-color 0.15s ease,
				background 0.15s ease,
				transform 0.1s ease;
		}
		.maps-link-btn:active {
			transform: scale(0.98);
		}
	}
	@media (hover: hover) {
		.route-card:hover {
			border-color: var(--accent-text);
			box-shadow: var(--elevation-1);
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.route-card {
			transition:
				border-color 0.15s ease,
				box-shadow 0.15s ease,
				transform 0.1s ease;
		}
		.route-card:active {
			transform: scale(0.98);
		}
	}
	.route-hdr {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: 'Source Serif 4', serif;
		font-size: 13px;
		font-weight: 600;
		color: var(--accent-text);
		margin-bottom: 8px;
	}
	.route-stops {
		display: flex;
		align-items: flex-start;
		overflow-x: auto;
		scrollbar-width: none;
		padding: 2px 0 6px;
	}
	.route-stops::-webkit-scrollbar {
		display: none;
	}
	.route-stop {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex-shrink: 0;
	}
	.route-num {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		font-size: 10px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.route-name {
		font-size: 9px;
		color: var(--text-muted);
		text-align: center;
		width: 70px;
		line-height: 1.25;
		margin-top: 3px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.route-connector {
		width: 20px;
		height: 2px;
		background: repeating-linear-gradient(90deg, var(--hairline-strong) 0, var(--hairline-strong) 4px, transparent 4px, transparent 7px);
		margin: 0 1px;
		flex-shrink: 0;
		align-self: flex-start;
		margin-top: 10px;
	}
	.route-open {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		font-size: 11px;
		color: var(--accent-text);
		padding-top: 4px;
		border-top: 1px solid var(--hairline);
		margin-top: 2px;
	}
	.km-tag {
		display: inline-block;
		margin-top: 5px;
		font-size: 10px;
		color: var(--text-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		padding: 1px 7px;
	}
	.tb-photos {
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	/* Linked Google Photos: thumbnail strips (inside a block, or day-level). */
	.ph-strip {
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.ph-thumb {
		width: 56px;
		height: 56px;
		padding: 0;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		overflow: hidden;
		cursor: pointer;
	}
	.ph-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		filter: var(--photo-filter);
	}
	.day-photos {
		margin: 10px 13px 4px;
		padding: 10px 12px;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-lg);
	}
	.day-photos-unmatched {
		margin: 14px 13px;
		border-style: dashed;
	}
	.dp-title {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}
	.ps-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-decoration: none;
		width: 80px;
		flex-shrink: 0;
	}
	.ps-thumb {
		width: 80px;
		height: 55px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		display: block;
		filter: var(--photo-filter);
	}
	.ps-placeholder {
		background: var(--surface-sunken);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.ps-placeholder::after {
		content: '📷';
		font-size: 18px;
		opacity: 0.35;
	}
	.ps-label {
		font-size: 10px;
		color: var(--text-muted);
		text-align: center;
		line-height: 1.3;
		margin-top: 3px;
		padding: 0 2px;
	}
	.wx {
		font-size: 9px;
		color: var(--text-muted);
		margin-top: 3px;
		line-height: 1.2;
		text-align: center;
	}

	/* ── Desktop: two-pane layout ──
	   The shell widens; hero + sticky daynav still span its full width (they live
	   outside .day-content). The day body becomes a two-column grid: a scrolling
	   left column (header, timeline, photos) and a sticky right column holding the
	   map then the Day-Route card. The keyed day-switch fly transition still
	   applies to the whole .day-content grid. */
	@media (min-width: 960px) {
		.shell {
			max-width: 1060px;
		}
		/* The horizontal day nav + hero variant tabs are superseded by the desktop
		   sidebar's day rail at every width ≥960px; hide them here (they return
		   below 960px, where the sidebar is gone and these drive navigation). */
		.daynav,
		.daynav-sentinel,
		.vtabs {
			display: none;
		}
		.day-content {
			display: grid;
			/* Map narrows on the 960–1199 tier so the timeline keeps its width next
			   to the 240px sidebar; it returns to a fixed 420px at ≥1200 (below). */
			grid-template-columns: minmax(0, 1fr) clamp(320px, 30vw, 420px);
			gap: 0 24px;
			padding: 0 24px 8px;
			align-items: start;
		}
		/* Left-column items are pinned to explicit rows 1-4 and the aside spans
		   those same rows (grid-row: 1 / 5). Spanning explicit row lines — rather
		   than `1 / -1`, which collapses to a single row when no rows are declared
		   and would force row 1 to the map's full height — lets the tall map/route
		   column sit beside the naturally-flowing left column. */
		.day-hdr,
		.tl,
		.day-photos,
		.footer {
			grid-column: 1;
			min-width: 0;
		}
		.day-hdr {
			grid-row: 1;
			margin: 16px 0 0;
		}
		.tl {
			grid-row: 2;
			padding: 12px 0 0;
		}
		.day-photos {
			grid-row: 3;
			margin: 12px 0 0;
		}
		.footer {
			grid-row: 4;
		}
		.day-aside {
			grid-column: 2;
			grid-row: 1 / 5;
			align-self: start;
			position: sticky;
			/* No sticky day nav to clear at ≥960px anymore; this offset keeps the map
			   clear of the demo page's sticky "sample trip" banner. */
			top: 72px;
		}
		.route-card {
			display: block;
			margin: 16px 0 0;
		}
		.maps-link-btn {
			display: none;
		}
	}

	/* ── Wide desktop (≥1200px) ──
	   The 240px sidebar leaves room for the full-width map again, so the day body's
	   right column returns to a fixed 420px (it was narrowed on the 960–1199 tier).
	   The former vertical day rail + shell grid moved out of TripView entirely — the
	   persistent sidebar now carries the day rail at every width ≥960px. */
	@media (min-width: 1200px) {
		.day-content {
			grid-template-columns: minmax(0, 1fr) 420px;
		}
	}
</style>
