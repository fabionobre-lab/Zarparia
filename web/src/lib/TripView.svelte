<script lang="ts">
	import { untrack, onDestroy } from 'svelte';
	import { slide } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import {
		type Trip,
		type Segment,
		type Plan,
		type Day,
		type SegWeather,
		type ChecklistItem,
		type PhotoSpot,
		type Localized,
		loc,
		localeFor,
		dayLabel,
		dowShort,
		dayNum,
		wxEmoji,
		tripIsPast,
		routePlaces,
		routeUrl,
		dayStops,
		blockStopNumbers,
		tripCostTotal,
		fetchSegmentWeather,
		safeUrl,
		buildIcs,
		tripTimezone,
		isoDateInTZ,
		hhmmInTZ,
		minutesSinceMidnightInTZ,
		parseBlockTimeMinutes
	} from './trip-engine';
	import type { MapStop, PhotoStop } from './DayMap.svelte';
	import PhotoLightbox from './PhotoLightbox.svelte';
	import TripDay from './trip/TripDay.svelte';
	import PhotoStrip from './trip/PhotoStrip.svelte';
	import EditableText from './trip/EditableText.svelte';
	import SegmentInspector from './trip/SegmentInspector.svelte';
	import PlanInspector from './trip/PlanInspector.svelte';
	import { blankDay, blankSegment, isoAddDays, nextId } from './editor/factories';
	import { toast, dismissToast } from './toast';
	import { t } from './i18n/store.svelte';
	import { tripChrome } from './i18n/tripChrome';
	import { photoUrl, type TripPhoto } from './photos';
	import { getNow } from './now';
	import { formatMoney } from './format';
	import { setTripNav, setTripActions, type TripNavVM } from './nav/tripNav.svelte';

	// trip is fixed for the lifetime of a mounted TripView (the page remounts
	// per trip id), so these initial reads are intentionally non-reactive.
	let {
		trip,
		lang = $bindable(untrack(() => trip.defaultLanguage || trip.languages[0])),
		photos = [],
		photosEditable = false,
		photoToken,
		onphotoschanged,
		printHref,
		actionsInMoreSheet = false,
		edit = false,
		onedit,
		onundo
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
		/** Link to the standalone print/PDF document for this trip (e.g.
		 *  `/trips/[id]/print?lang=…`). Renders a "Print / Save as PDF" action in
		 *  the hero when set; omitted where no such route exists (editor preview). */
		printHref?: string;
		/** The host route has a bottom bar whose More sheet carries Print and
		 *  "Add to calendar" instead (see lib/nav/tripNav.svelte.ts). Hides them
		 *  from the hero below 960px only — desktop keeps them, and a route
		 *  without a bottom bar (the public /s/[token] share link) must leave
		 *  this off or the two actions become unreachable on a phone. */
		actionsInMoreSheet?: boolean;
		/** In-place editing (Phase 2 WYSIWYG): text fields in the hero, the day
		 *  header and every block become contenteditable where they render. */
		edit?: boolean;
		/** Notifies the owner of `trip` that the doc was mutated in place, so it
		 *  can persist it (the trip page debounces these into one PUT — see
		 *  lib/trip/autosave.svelte.ts).
		 *
		 *  Its presence is also what makes checklist ticks persistent: with a
		 *  handler, a tick mutates `trip` and is saved by the page; without one —
		 *  the /demo route, public /s/[token] links, viewers, the editor's live
		 *  preview — ticks stay local state that resets on reload, exactly as
		 *  before (Phase 6 item 2). */
		onedit?: (structural?: boolean) => void;
		/** Step the document history back — surfaced as the Undo action on the
		 *  toast raised when a stop is deleted. */
		onundo?: () => void;
	} = $props();
	let planBySeg = $state<Record<string, string>>(
		untrack(() => Object.fromEntries(trip.segments.map((s) => [s.id, s.defaultPlan ?? s.plans[0].id])))
	);
	let wxBySeg = $state<Record<string, SegWeather | null>>({});
	let wikiImgs = $state<Record<string, string | null>>({});

	// ── Packing/pre-trip checklist toggles (Phase 6 item 2) ──
	// Two modes, chosen by whether the caller can persist edits at all:
	//
	//  - With `onedit` (the trip page, owner/editor): the tick mutates the live
	//    doc and the page saves it through the same debounced autosave as every
	//    inline text edit. Phase 2 replaced a second, independent PUT here —
	//    two writers on one trip meant two `updated_at` baselines racing each
	//    other into spurious 409s the moment both were used in one session.
	//  - Without it (/demo, public /s/[token] links, viewers, the editor's live
	//    preview): ticks are local-only overrides that reset on reload.
	//
	// Overrides are keyed by (segment id, plan id, day date, block index, item
	// index) since blocks carry no id of their own.
	let checklistOverrides = $state<Record<string, boolean>>({});
	function checklistKey(seg: Segment, plan: Plan, day: Day, bi: number, ii: number): string {
		return `${seg.id}|${plan.id}|${day.date}|${bi}|${ii}`;
	}
	function checklistDone(seg: Segment, plan: Plan, day: Day, bi: number, ii: number, item: ChecklistItem): boolean {
		return checklistOverrides[checklistKey(seg, plan, day, bi, ii)] ?? item.done;
	}
	function toggleChecklistItem(
		seg: Segment,
		plan: Plan,
		day: Day,
		bi: number,
		item: ChecklistItem,
		ii: number
	) {
		const next = !checklistDone(seg, plan, day, bi, ii, item);
		if (onedit) {
			// `item` is the live object inside `trip` (a $state draft owned by the
			// page whenever onedit is wired), so this mutation is what gets saved.
			item.done = next;
			onedit();
			return;
		}
		checklistOverrides = {
			...checklistOverrides,
			[checklistKey(seg, plan, day, bi, ii)]: next
		};
	}

	// ── Day-level structural editing (Phase 7) ──
	// Owned here rather than in TripDay because removing or reordering a day also
	// has to move the day SELECTION, which lives in this component. Each op
	// mutates the current plan's day list and reports a structural edit so it
	// lands as its own undo step.
	function dayOps() {
		return current ? { plan: current.plan, i: current.plan.days.indexOf(current.day) } : null;
	}
	/** First unclaimed date at or after `fromIso` + 1 day.
	 *
	 *  Two days sharing a date makes the nav's date walk skip every day after
	 *  them — they vanish from the strip — so a new day must never collide. And
	 *  it can't simply be left undated either: `date` is required AND pattern-
	 *  matched, so a blank one fails the schema and the day silently can't save.
	 *  Walking forward to a free slot always yields something valid; when that
	 *  lands out of sequence (inserting mid-trip), the day inspector's
	 *  out-of-order hint tells the author to adjust it. */
	function nextFreeDate(days: Day[], fromIso: string): string {
		const used = new Set(days.map((d) => d.date).filter(Boolean));
		// No usable anchor (a trip of undated days): fall back to today's date.
		let candidate = isoAddDays(fromIso || isoDateInTZ(getNow(), tz), 1);
		for (let guard = 0; used.has(candidate) && guard < 400; guard++) {
			candidate = isoAddDays(candidate, 1);
		}
		return candidate;
	}
	function insertDayAfter() {
		const c = dayOps();
		if (!c || c.i < 0) return;
		const d = blankDay(trip.languages);
		d.date = nextFreeDate(c.plan.days, c.plan.days[c.i].date);
		c.plan.days.splice(c.i + 1, 0, d);
		onedit?.(true);
		dayIdx = clampedIdx + 1;
	}
	function duplicateDay() {
		const c = dayOps();
		if (!c || c.i < 0) return;
		const copy = structuredClone($state.snapshot(c.plan.days[c.i])) as Day;
		// A verbatim copy would duplicate the date, which is the same collision.
		copy.date = nextFreeDate(c.plan.days, c.plan.days[c.i].date);
		c.plan.days.splice(c.i + 1, 0, copy);
		onedit?.(true);
		dayIdx = clampedIdx + 1;
	}
	function removeDay() {
		const c = dayOps();
		if (!c || c.i < 0 || c.plan.days.length <= 1) return; // schema: minItems 1
		c.plan.days.splice(c.i, 1);
		onedit?.(true);
		// Land on the neighbour rather than whatever now occupies this index.
		dayIdx = Math.max(0, clampedIdx - 1);
		toast.danger(t('day.removed'), {
			actionLabel: t('common.undo'),
			onAction: () => {
				onundo?.();
				dismissToast();
			}
		});
	}
	function moveDay(dir: -1 | 1) {
		const c = dayOps();
		if (!c || c.i < 0) return;
		const j = c.i + dir;
		if (j < 0 || j >= c.plan.days.length) return;
		const [d] = c.plan.days.splice(c.i, 1);
		c.plan.days.splice(j, 0, d);
		onedit?.(true);
		dayIdx = clampedIdx + dir;
	}

	// ── Segment-level structural editing (Phase 8) ──
	// `dayIdx` is a global index across every segment's days, so any segment op
	// has to recompute where the selection should land. This mirrors
	// computeFlatDays' walk exactly — keep them in step.
	function firstDayIndexOfSegment(si: number): number {
		let gi = 0;
		for (let i = 0; i < si && i < trip.segments.length; i++) {
			const s = trip.segments[i];
			const p = s.plans.find((x) => x.id === planBySeg[s.id]) ?? s.plans[0];
			gi += p.days.length;
		}
		return gi;
	}
	function segIndex(): number {
		return current ? trip.segments.indexOf(current.seg) : -1;
	}
	/** Every day in the trip, across all plans — the collision set new dates must
	 *  avoid, and the source of the trip's last date. */
	function allTripDays(): Day[] {
		return trip.segments.flatMap((s) => s.plans.flatMap((p) => p.days));
	}
	function lastTripDate(): string {
		const dates = allTripDays()
			.map((d) => d.date)
			.filter(Boolean)
			.sort();
		return dates.length ? dates[dates.length - 1] : '';
	}
	function insertSegmentAfter() {
		const si = segIndex();
		if (si < 0) return;
		const s = blankSegment(
			trip.languages,
			nextId('segment', trip.segments.map((x) => x.id))
		);
		// blankSegment's day carries no date, and an undated day fails the schema —
		// the whole trip would sit unsaveable until you noticed. Start it after the
		// trip's last day. (Computed before the splice, so the new segment's own
		// day isn't in the collision set.)
		s.plans[0].days[0].date = nextFreeDate(allTripDays(), lastTripDate());
		trip.segments.splice(si + 1, 0, s);
		onedit?.(true);
		dayIdx = firstDayIndexOfSegment(si + 1);
	}
	function duplicateSegment() {
		const si = segIndex();
		if (si < 0) return;
		const copy = structuredClone($state.snapshot(trip.segments[si])) as Segment;
		// Segment ids must be unique — plan selection is stored against them.
		copy.id = nextId(copy.id || 'segment', trip.segments.map((x) => x.id));
		// A verbatim copy repeats every date, and duplicate dates make the nav's
		// date walk skip days. Re-date the copy consecutively after the trip's last
		// day; each plan is a variant of the same days, so all plans share the run.
		const start = nextFreeDate(allTripDays(), lastTripDate());
		for (const p of copy.plans) {
			let cursor = start;
			for (const d of p.days) {
				d.date = cursor;
				cursor = isoAddDays(cursor, 1);
			}
		}
		trip.segments.splice(si + 1, 0, copy);
		onedit?.(true);
		dayIdx = firstDayIndexOfSegment(si + 1);
	}
	function removeSegment() {
		const si = segIndex();
		if (si < 0 || trip.segments.length <= 1) return; // schema: minItems 1
		trip.segments.splice(si, 1);
		onedit?.(true);
		// Land on the start of whichever segment now occupies this slot (or the
		// one before it, if we removed the last).
		dayIdx = firstDayIndexOfSegment(Math.min(si, trip.segments.length - 1));
		toast.danger(t('seg.removed'), {
			actionLabel: t('common.undo'),
			onAction: () => {
				onundo?.();
				dismissToast();
			}
		});
	}
	function moveSegment(dir: -1 | 1) {
		const si = segIndex();
		if (si < 0) return;
		const j = si + dir;
		if (j < 0 || j >= trip.segments.length) return;
		const [s] = trip.segments.splice(si, 1);
		trip.segments.splice(j, 0, s);
		onedit?.(true);
		dayIdx = firstDayIndexOfSegment(j);
	}

	// ── Plan-variant structural editing (Phase 9) ──
	// A plan is an alternate version of a segment's days. Ops live here because
	// they touch `planBySeg` (which plan is on screen) as well as the document.
	function planOps() {
		if (!current) return null;
		const seg = current.seg;
		return { seg, i: seg.plans.indexOf(current.plan) };
	}
	function addPlanVariant() {
		const c = planOps();
		if (!c || c.i < 0) return;
		// A variant starts as a copy of the plan you're looking at — an empty one
		// would need every day rebuilt by hand, which is never what you want.
		const copy = structuredClone($state.snapshot(c.seg.plans[c.i])) as Plan;
		copy.id = nextId('plan', c.seg.plans.map((p) => p.id));
		copy.label = undefined;
		c.seg.plans.splice(c.i + 1, 0, copy);
		onedit?.(true);
		setPlan(c.seg, copy.id);
	}
	function duplicatePlanVariant() {
		addPlanVariant();
	}
	function removePlanVariant() {
		const c = planOps();
		if (!c || c.i < 0 || c.seg.plans.length <= 1) return; // schema: minItems 1
		const removedId = c.seg.plans[c.i].id;
		c.seg.plans.splice(c.i, 1);
		// defaultPlan points at a plan by id; leaving it dangling would silently
		// fall back to the first plan on every load.
		if (c.seg.defaultPlan === removedId) c.seg.defaultPlan = undefined;
		onedit?.(true);
		setPlan(c.seg, c.seg.plans[Math.min(c.i, c.seg.plans.length - 1)].id);
		toast.danger(t('plan.removed'), {
			actionLabel: t('common.undo'),
			onAction: () => {
				onundo?.();
				dismissToast();
			}
		});
	}
	function movePlanVariant(dir: -1 | 1) {
		const c = planOps();
		if (!c || c.i < 0) return;
		const j = c.i + dir;
		if (j < 0 || j >= c.seg.plans.length) return;
		const [p] = c.seg.plans.splice(c.i, 1);
		c.seg.plans.splice(j, 0, p);
		onedit?.(true);
	}
	function setDefaultPlanToCurrent() {
		const c = planOps();
		if (!c || c.i < 0) return;
		c.seg.defaultPlan = c.seg.plans[c.i].id;
		onedit?.(true);
	}

	const isPast = untrack(() => tripIsPast(trip));
	const L = (obj: Parameters<typeof loc>[1]) => loc(trip, obj, lang);
	const planOf = (seg: Segment): Plan =>
		seg.plans.find((p) => p.id === planBySeg[seg.id]) ?? seg.plans[0];

	// ── Budget (Phase 6 budget) ──
	// Money helper bound to the trip's currency + the content-language locale.
	const money = (n: number) => formatMoney(n, trip.currency, localeFor(trip, lang));
	// Whole-trip estimate, plan-aware so switching plans re-totals (see
	// tripCostTotal). Recomputes on plan changes via the planBySeg dependency.
	const estTotal = $derived(tripCostTotal(trip, planBySeg));
	// Show the budget bar when a target is set OR any stop carries a cost, so a
	// trip that only estimates (no target yet) still surfaces its running total.
	const showBudget = $derived((trip.budget ?? 0) > 0 || estTotal > 0);
	// Bar fill is clamped to 100%; the numbers still show the true overspend.
	const budgetRatio = $derived(trip.budget ? estTotal / trip.budget : null);
	const budgetPct = $derived(budgetRatio === null ? 0 : Math.min(100, Math.round(budgetRatio * 100)));
	// green ≤80% · amber ≤100% · red over — the universal traffic-light pattern.
	const budgetState = $derived(
		budgetRatio === null ? 'none' : budgetRatio > 1 ? 'over' : budgetRatio > 0.8 ? 'warn' : 'ok'
	);
	// The bar is one glanceable line by default (label · spent of target · track);
	// the exact remaining/over figure is the number you only want when you're
	// actually deciding a purchase, so it's behind a tap. Collapsed by default
	// because the hero sits above the itinerary on every phone screen.
	let budgetOpen = $state(false);

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
	// Trip identity for that same stuck line. The hero's big title is the CURRENT
	// SEGMENT's title and scrolls away; this is the trip's own title, so scrolling
	// deep into a day never loses "which trip am I in" — and it costs no extra
	// height, riding the line the day label already occupies.
	const stuckTripTitle = $derived(L(trip.title));

	// ── Swipe between days (touch) ──
	// Below 960px the horizontal day strip is the only day switcher, and it lives
	// at the top of the screen; a left/right swipe over the day body does the same
	// thing under the thumb. Deliberately narrow so it never steals a gesture that
	// belongs to something else: it ignores multi-touch, anything that starts
	// inside a horizontally scrollable descendant (photo strips, the Day-Route
	// rail, the day nav itself), and anything more vertical than horizontal.
	// Off while editing, where a swipe is far more likely to be a text selection.
	const SWIPE_MIN_PX = 60;
	let swipeStartX = 0;
	let swipeStartY = 0;
	let swipeArmed = false;

	/** True when the gesture began inside an element that scrolls horizontally on
	 *  its own — that element owns the swipe, not the day switcher. */
	function startsInHorizontalScroller(target: EventTarget | null): boolean {
		let el = target instanceof Element ? target : null;
		while (el) {
			if (el.classList.contains('scroll-area')) return false;
			if (el.scrollWidth > el.clientWidth + 1) {
				const ox = getComputedStyle(el).overflowX;
				if (ox === 'auto' || ox === 'scroll') return true;
			}
			el = el.parentElement;
		}
		return false;
	}

	// ── Day-change direction ──
	// Which way the day body slides in. The transition used to be a fixed 8px
	// vertical rise, identical whether you moved forward or back — which reads
	// wrong under a swipe, where the thumb travels horizontally and the content
	// answered vertically. Every navigation route (swipe, a tap on the date
	// strip, the desktop rail) goes through goToDay() so the motion always
	// matches the direction actually travelled.
	let dayDir = $state<1 | -1>(1);

	/** Navigate to a day by absolute index, recording the direction travelled.
	 *  Structural editor operations still assign `dayIdx` directly — they are
	 *  edits rather than navigation, and inherit whatever direction was last set. */
	function goToDay(next: number) {
		const clamped = Math.max(0, Math.min(next, flatDays.length - 1));
		if (clamped === clampedIdx) return;
		dayDir = clamped > clampedIdx ? 1 : -1;
		dayIdx = clamped;
	}

	function goDay(delta: number) {
		goToDay(clampedIdx + delta);
	}

	function onSwipeStart(e: TouchEvent) {
		if (edit || e.touches.length !== 1) {
			swipeArmed = false;
			return;
		}
		swipeStartX = e.touches[0].clientX;
		swipeStartY = e.touches[0].clientY;
		swipeArmed = !startsInHorizontalScroller(e.target);
	}

	function onSwipeEnd(e: TouchEvent) {
		if (!swipeArmed) return;
		swipeArmed = false;
		const t = e.changedTouches[0];
		if (!t) return;
		const dx = t.clientX - swipeStartX;
		const dy = t.clientY - swipeStartY;
		// Clearly horizontal: past the distance floor AND at least twice as much
		// horizontal as vertical, so a diagonal scroll flick never switches days.
		if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 2) return;
		goDay(dx < 0 ? 1 : -1);
	}

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
	function spotKey(sp: { name: Localized | string; wiki?: string; fallbackImg?: string }): string | null {
		return sp.wiki ? sp.wiki : sp.fallbackImg ? 'img:' + L(sp.name) : null;
	}
	$effect(() => {
		const day = current?.day;
		if (!day) return;
		for (const b of day.blocks) {
			for (const sp of b.photoSpots ?? []) {
				if (!sp.wiki && sp.fallbackImg) {
					const k = 'img:' + L(sp.name);
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
	/** Thumbnail for a photo spot: the fetched Wikipedia image (or the spot's
	 *  own fallback), URL-checked. Handed to TripBlock, which owns the markup
	 *  but not this cache. */
	function spotImg(sp: PhotoSpot): string | undefined {
		const k = spotKey(sp);
		return k ? safeUrl(wikiImgs[k] ?? undefined) : undefined;
	}

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

	// ── Day stops ──
	// One numbering for the whole day, shared by the map, the Day-Route stepper
	// and the timeline dots (see dayStops in trip-engine). Names are localized
	// for the active language, so switching languages re-derives them.
	const stopsForDay = $derived(current ? dayStops(trip, current.day.blocks, lang) : []);
	/** Stop number per block index — what the timeline dot shows. */
	const blockStopNums = $derived(
		current ? blockStopNumbers(stopsForDay, current.day.blocks.length) : []
	);

	// Route places for the current day
	const routeForDay = $derived.by(() => {
		if (!current) return null;
		const places = routePlaces(trip, current.day.blocks, lang);
		if (places.length < 2) return null;
		return { url: routeUrl(places, current.day.routeMode), places };
	});

	// Pins for the stops that carry coordinates, keeping their shared number —
	// a stop with only a Maps query stays in the stepper and on the timeline but
	// cannot be placed on the map, so the pin numbers may skip.
	const dayMapStops = $derived.by<MapStop[]>(() => {
		if (!current) return [];
		const times = current.day.blocks.map((b) => b.time);
		return stopsForDay
			.filter((s) => s.coords)
			.map((s) => ({
				lat: s.coords!.lat,
				lon: s.coords!.lon,
				n: s.n,
				popup: `${times[s.blockIndex] ?? ''} — ${s.name}`
			}));
	});

	// ── Linked Google Photos ──
	// Photos come pre-placed (segment/plan/day/block) by capture time; this
	// component only groups them onto the selected day. The segment guard
	// covers the rare case of two segments containing the same calendar date.
	// Placement resolves by stable id first, falling back to the date for rows
	// written before ids existed (see migration 0013). That fallback is what
	// makes re-dating a day safe: an id-carrying photo follows its day, and an
	// un-backfilled one behaves exactly as it always did.
	const dayPhotos = $derived.by<TripPhoto[]>(() => {
		if (!current) return [];
		const dayId = (current.day as { id?: string }).id;
		return photos.filter((p) => {
			if (p.dayId && dayId) return p.dayId === dayId;
			return p.dayDate === current.day.date && (!p.segmentId || p.segmentId === current.seg.id);
		});
	});
	/** Which block of the current day a photo belongs to, or null for the
	 *  day-level strip. Resolved by the block's stable id where the row has one
	 *  — which is what keeps a photo on its stop when the day is reordered —
	 *  and by the stored index otherwise. A placement computed against another
	 *  plan, or an index left dangling by an older edit, degrades to day level. */
	function blockSlotFor(p: TripPhoto): number | null {
		if (!current) return null;
		if (p.blockId) {
			const byId = current.day.blocks.findIndex((b) => (b as { id?: string }).id === p.blockId);
			return byId === -1 ? null : byId;
		}
		if (p.blockIndex == null) return null;
		if (p.planId && p.planId !== current.plan.id) return null;
		if (p.blockIndex < 0 || p.blockIndex >= current.day.blocks.length) return null;
		return p.blockIndex;
	}
	const photosByBlock = $derived.by<Map<number, TripPhoto[]>>(() => {
		const m = new Map<number, TripPhoto[]>();
		if (!current) return m;
		for (const p of dayPhotos) {
			const slot = blockSlotFor(p);
			if (slot == null) continue;
			const arr = m.get(slot);
			if (arr) arr.push(p);
			else m.set(slot, [p]);
		}
		return m;
	});
	const dayLevelPhotos = $derived(dayPhotos.filter((p) => blockSlotFor(p) == null));
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
				goToDay(gi);
			},
			selectPlan: (segId: string, planId: string) => {
				const seg = trip.segments.find((s) => s.id === segId);
				if (seg) setPlan(seg, planId);
			}
		};
		setTripNav(vm);
	});

	// Republished whenever the print link or the plan/language selection behind
	// the ICS changes, so the More sheet's actions always reflect what's on
	// screen. Only worth publishing where a host actually renders them.
	$effect(() => {
		if (!actionsInMoreSheet) return;
		// Touch the reactive inputs downloadIcs closes over, so switching plan or
		// language re-publishes rather than leaving a stale closure.
		lang;
		planBySeg;
		setTripActions({ printHref, downloadIcs });
		return () => setTripActions(null);
	});

	onDestroy(() => {
		setTripNav(null);
		setTripActions(null);
	});
</script>

<div class="shell theme-{current?.seg.theme || 'tartan'}" style={themeStyle}>
	<div class="hero">
		<div class="hero-inner">
			<div class="hero-row1" class:in-more={actionsInMoreSheet}>
				<div class="trip-eyebrow">
					<EditableText bind:value={trip.eyebrow} {lang} {edit} {onedit} label={uiText.edEyebrow} />
				</div>
				<div class="hero-actions">
					{#if printHref}
						<a class="ics-btn" href={printHref} aria-label={uiText.printPdf}>
							<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></svg>
							<span class="btn-label">{uiText.printPdf}</span>
						</a>
					{/if}
					<button class="ics-btn" onclick={downloadIcs} aria-label={uiText.addToCalendar}>
						<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
						<span class="btn-label">{uiText.addToCalendar}</span>
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
			<!-- The hero shows the CURRENT segment's title/subtitle, so editing here
			     edits that segment. Both fall back to the plain read rendering when
			     there is no current day (an empty draft in the editor preview). -->
			{#if current}
				{@const cur = current.seg}
				<div class="trip-title">
					<EditableText bind:value={cur.title} {lang} {edit} {onedit} label={uiText.edSegTitle} />
					{#if edit}
						<SegmentInspector
							{trip}
							seg={cur}
							{onedit}
							oninsert={insertSegmentAfter}
							onduplicate={duplicateSegment}
							onremove={removeSegment}
							onmove={moveSegment}
							canMoveUp={trip.segments.indexOf(cur) > 0}
							canMoveDown={trip.segments.indexOf(cur) < trip.segments.length - 1}
							canRemove={trip.segments.length > 1}
						/>
					{/if}
				</div>
				<div class="trip-sub">
					<EditableText bind:value={cur.subtitle} {lang} {edit} {onedit} label={uiText.edSegSubtitle} />
				</div>
			{:else}
				<div class="trip-title"></div>
				<div class="trip-sub"></div>
			{/if}
			<!-- Variant tabs. Normally only worth showing when there's more than one
			     plan, but while editing they're also the only way to create the
			     second one, so the row stays. -->
			{#if current && (edit || current.seg.plans.length > 1)}
				<div class="vtabs" class:vtabs-edit={edit}>
					{#each current.seg.plans as p (p.id)}
						{@const on = p.id === planOf(current.seg).id}
						<button class="vtab" class:on aria-pressed={on} onclick={() => setPlan(current.seg, p.id)}>
							{L(p.label) || p.id}
						</button>
					{/each}
					{#if edit}
						<button class="vtab vtab-add" onclick={addPlanVariant} aria-label={t('plan.addVariant')} title={t('plan.addVariant')}>+</button>
						<PlanInspector
							{trip}
							seg={current.seg}
							plan={current.plan}
							{lang}
							isDefault={(current.seg.defaultPlan ?? current.seg.plans[0].id) === current.plan.id}
							{onedit}
							onadd={addPlanVariant}
							onduplicate={duplicatePlanVariant}
							onremove={removePlanVariant}
							onmove={movePlanVariant}
							onsetdefault={setDefaultPlanToCurrent}
							canMoveUp={current.seg.plans.indexOf(current.plan) > 0}
							canMoveDown={current.seg.plans.indexOf(current.plan) < current.seg.plans.length - 1}
							canRemove={current.seg.plans.length > 1}
						/>
					{/if}
				</div>
			{/if}
			{#if showBudget}
				<div class="budget budget-{budgetState}">
					{#if trip.budget}
						<!-- With a target set there IS a detail figure to reveal, so the
						     summary row is the disclosure control. -->
						<button
							class="budget-summary"
							aria-expanded={budgetOpen}
							aria-controls="budget-detail"
							onclick={() => (budgetOpen = !budgetOpen)}
						>
							<span class="budget-label">{uiText.budget}</span>
							<span class="budget-figs">
								<span class="budget-spent">{money(estTotal)}</span>
								<span class="budget-of">{uiText.budgetOf} {money(trip.budget)}</span>
							</span>
							<svg
								class="budget-caret"
								class:open={budgetOpen}
								aria-hidden="true"
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
							>
								<path d="M6 9l6 6 6-6" />
							</svg>
						</button>
						<div
							class="budget-track"
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax={trip.budget}
							aria-valuenow={estTotal}
							aria-label={uiText.budget}
						>
							<div class="budget-fill" style="width:{budgetPct}%"></div>
						</div>
						<div id="budget-detail">
							{#if budgetOpen}
								{@const delta = Math.abs((trip.budget ?? 0) - estTotal)}
								<div
									class="budget-remain"
									transition:slide={{ duration: prefersReducedMotion.current ? 0 : 160 }}
								>
									{money(delta)}
									{budgetState === 'over' ? uiText.budgetOver : uiText.budgetLeft}
								</div>
							{/if}
						</div>
					{:else}
						<!-- No target: the running total is the whole story, nothing to expand. -->
						<div class="budget-summary budget-summary-static">
							<span class="budget-label">{uiText.budget}</span>
							<span class="budget-figs">
								<span class="budget-spent">{money(estTotal)}</span>
							</span>
						</div>
					{/if}
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
						onclick={() => goToDay(gi)}
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
				<span class="dnc-trip">{stuckTripTitle}</span>
				<span class="dnc-sep" aria-hidden="true">·</span>
				<span class="dnc-day">{stuckDayLabel}</span>
			</div>
		{/if}
	</nav>

	<!-- Touch-only day switching; the day strip above stays the visible, keyboard-
	     and screen-reader-accessible control, so this adds no new requirement.
	     Named group (same pattern as DayMap's map panel) so the swipe handlers sit
	     on an element that actually announces what it contains. -->
	<div
		class="scroll-area"
		role="group"
		aria-label={stuckDayLabel || stuckTripTitle}
		ontouchstart={onSwipeStart}
		ontouchend={onSwipeEnd}
	>
		{#if current}
			{@const seg = current.seg}
			{@const plan = current.plan}
			{@const day = current.day}
			{#key clampedIdx}
				<TripDay
					{trip}
					{lang}
					{seg}
					{plan}
					{day}
					dir={dayDir}
					wx={daySummary(seg, day)}
					{isToday}
					{nowMarkerIdx}
					{nowLabel}
					bind:nowMarkerEl
					mapStops={dayMapStops}
					{photoMapStops}
					{routeForDay}
					stopNums={blockStopNums}
					badgeFor={(time) => blockBadge(seg, day, time)}
					{photosByBlock}
					{dayLevelPhotos}
					{photoToken}
					{spotImg}
					checklistDone={(bi, ii, item) => checklistDone(seg, plan, day, bi, ii, item)}
					onToggleChecklist={(bi, item, ii) => toggleChecklistItem(seg, plan, day, bi, item, ii)}
					onopenlightbox={openLightbox}
					onphotostopclick={openBlockPhotos}
					{edit}
					{onedit}
					{onundo}
					dayPhotoCount={dayPhotos.filter((p) => !p.dayId).length}
					ondayinsert={insertDayAfter}
					ondayduplicate={duplicateDay}
					ondayremove={removeDay}
					ondaymove={moveDay}
					canDayMoveUp={plan.days.indexOf(day) > 0}
					canDayMoveDown={plan.days.indexOf(day) < plan.days.length - 1}
					canDayRemove={plan.days.length > 1}
				/>
			{/key}
		{/if}
		{#if unmatchedPhotos.length && photosEditable}
			<div class="day-photos day-photos-unmatched">
				<div class="dp-title">{uiText.unmatchedPhotos}</div>
				<PhotoStrip
					photos={unmatchedPhotos}
					tripId={trip.id}
					{photoToken}
					openLabel={uiText.openPhoto}
					onopen={(pi) => openLightbox(unmatchedPhotos, pi)}
				/>
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
		/* Never compress the ics button or the language pill — but on narrow
		   phones with long labels (esp. Portuguese: "Imprimir / Salvar PDF" +
		   "Adicionar ao calendário" + the lang pill together overflow a 375px
		   viewport), let the group wrap onto its own second/third line instead
		   of overflowing `.hero`'s `overflow: hidden` and clipping the language
		   pill off-screen entirely. */
		flex-wrap: wrap;
		justify-content: flex-end;
		flex-shrink: 0;
		/* flex-wrap only wraps once this box is actually constrained narrower
		   than its children's combined width — without a width cap a
		   shrink-to-fit flex item just grows to fit its content and overflows
		   `.hero-row1` instead of wrapping. */
		max-width: 100%;
		margin-left: auto;
	}
	.ics-btn,
	.lang-toggle {
		flex-shrink: 0;
	}
	/* ── Phones: give the title the top of the hero back ──
	   With Portuguese labels at 390px the two action buttons and the language
	   pill wrapped onto two lines — a 98px block of chrome sitting above the
	   trip title, which is the one thing the screen is actually about. Below
	   960px the buttons drop their text and become icon squares (the aria-label
	   still carries the name), and the eyebrow takes a full line so the whole
	   action group fits on one. Labels return at 960px, which is where the shell stops being a ~430px
	   centred column and goes full-bleed. That column — not the viewport — is
	   the real constraint: at a 768px viewport the hero is still only 398px
	   wide, so a 600px or 768px breakpoint re-wrapped immediately. */
	@media (max-width: 959.98px) {
		/* Where the bottom bar's More sheet carries them, the hero drops them
		   entirely — the language pill is all that's left, and the eyebrow and
		   title get the top of the screen back. Routes without a bottom bar keep
		   the compact icon row below. */
		.hero-row1.in-more .ics-btn {
			display: none;
		}
		.btn-label {
			display: none;
		}
		.ics-btn {
			/* Square icon button. 30px visual, 44px hit area via the shared ::after
			   (inset -7px on all four sides here, since these don't sit edge to edge). */
			width: 30px;
			padding: 0;
			justify-content: center;
		}
		.hero-row1:not(.in-more) .trip-eyebrow {
			/* Own line, so the icon row below it is a single unbroken row. With the
			   buttons moved to the More sheet only the language pill is left, and
			   that shares the eyebrow's line comfortably. */
			flex: 1 0 100%;
		}
		.hero-actions {
			/* Aligned with the eyebrow and title rather than ragged against the
			   right edge, which is what the wrapped layout looked like. */
			justify-content: flex-start;
			margin-left: 0;
		}
	}
	/* ── Hero chrome sizing ──
	   These controls used to be 44px tall so the CONTROL was the touch target.
	   For a two-character language code that reads as a slab of chrome sitting
	   above the trip title. The visual box is now 30px and each control carries a
	   transparent ::after that expands the HIT area back past 44px, so the tap
	   target is unchanged (WCAG 2.5.5 AAA still met) while the row costs 14px
	   less on every phone screen. `position: relative` on the control anchors it;
	   `.lang-toggle` must NOT clip (see below) or the expansion is cut off. */
	.ics-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 12px;
		min-height: 30px;
		position: relative;
		box-sizing: border-box;
		border-radius: var(--radius-button);
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(0, 0, 0, 0.2);
		color: rgba(255, 255, 255, 0.75);
		font-size: 11px;
		font-family: inherit;
		letter-spacing: 0.02em;
		cursor: pointer;
		text-decoration: none;
	}
	.ics-btn::after {
		content: '';
		position: absolute;
		inset: -7px;
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
		border: 1px solid rgba(255, 255, 255, 0.18);
		/* Deliberately NOT `overflow: hidden` (which is what used to round the
		   ends): it would clip each button's ::after hit-area expansion back to
		   the 30px visual box. The end buttons round themselves instead. */
	}
	.lang-btn {
		padding: 4px 12px;
		min-height: 30px;
		position: relative;
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
	/* Only vertical expansion: neighbouring codes sit edge to edge, so growing
	   the hit area sideways would overlap the other language's target. */
	.lang-btn::after {
		content: '';
		position: absolute;
		inset: -7px 0;
	}
	.lang-btn:first-child {
		border-start-start-radius: var(--radius-pill);
		border-end-start-radius: var(--radius-pill);
	}
	.lang-btn:last-child {
		border-start-end-radius: var(--radius-pill);
		border-end-end-radius: var(--radius-pill);
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
		/* While editing, the segment's ⋮ sits beside the title. Flex with a single
		   child lays out identically to the block box it replaces, so read mode is
		   unaffected. */
		display: flex;
		align-items: center;
		gap: 4px;
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
	/* Budget bar (Phase 6 budget) — lives in the hero, so it inherits the
	   white-on-dark hero palette (translucent white surfaces, a colour-coded
	   fill). The traffic-light fill colour is driven by --budget-color, set by
	   the state modifier class. */
	/* Compact by default: one row (label · spent of target) over a hairline track.
	   The exact remaining figure expands on tap — see `budgetOpen`. This was three
	   stacked lines (~82px) in the hero, above the itinerary, on every phone. */
	.budget {
		margin-top: 8px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		padding: 6px 11px 7px;
		color: #fff;
	}
	.budget-summary {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		/* Reset: this is a button carrying a plain row of text. */
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
		position: relative;
	}
	/* The row is short; expand the tap target over the track and padding below it
	   rather than making the row itself taller. */
	.budget-summary::after {
		content: '';
		position: absolute;
		inset: -6px -11px -13px;
	}
	.budget-summary-static {
		cursor: default;
	}
	.budget-label {
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.7);
		/* Shrink first (PT's "Orçamento da viagem" is ~2x the English label); the
		   figures are the part that must never wrap. */
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.budget-figs {
		display: flex;
		gap: 5px;
		align-items: baseline;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		flex: 0 0 auto;
		margin-left: auto;
	}
	.budget-spent {
		font-weight: 700;
	}
	.budget-of {
		color: rgba(255, 255, 255, 0.7);
	}
	.budget-caret {
		flex: 0 0 auto;
		color: rgba(255, 255, 255, 0.55);
		align-self: center;
	}
	.budget-caret.open {
		transform: rotate(180deg);
	}
	@media (prefers-reduced-motion: no-preference) {
		.budget-caret {
			transition: transform 0.16s ease;
		}
	}
	.budget-track {
		margin-top: 5px;
		height: 3px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.18);
		overflow: hidden;
	}
	.budget-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--budget-color, #86c98a);
	}
	@media (prefers-reduced-motion: no-preference) {
		.budget-fill {
			transition: width 0.35s ease;
		}
	}
	.budget-remain {
		padding-top: 5px;
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.8);
		font-variant-numeric: tabular-nums;
	}
	.budget-ok {
		--budget-color: #86c98a;
	}
	.budget-warn {
		--budget-color: #e9c15f;
	}
	.budget-over {
		--budget-color: #e58f7d;
	}
	.budget-over .budget-spent {
		color: #f2b3a5;
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
		/* The trip page publishes the height of its sticky save-status block as
		   --status-h; stay below it. Other pages leave it unset. */
		top: var(--status-h, 0px);
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
	   top: the trip's own title + the active day's weekday and title, on ONE line.
	   Eyebrow styling, theme-tinted via --accent-text. Its slide/fade is
	   reduced-motion gated in the markup (transition duration → 0).

	   Both halves ellipsize independently so neither can push the other out: the
	   trip title is capped at 45% of the line (it's the stable, quickly-relearned
	   half), and the day label — the part that actually changes as you scroll —
	   takes whatever is left. */
	.daynav-context {
		display: flex;
		align-items: baseline;
		gap: 5px;
		padding: 3px 12px 4px;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent-text);
		line-height: 1.3;
		border-top: 1px solid var(--hairline);
	}
	.dnc-trip,
	.dnc-day {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.dnc-trip {
		flex: 0 1 auto;
		max-width: 45%;
		font-weight: 600;
	}
	.dnc-sep {
		flex: 0 0 auto;
		opacity: 0.5;
	}
	.dnc-day {
		flex: 1 1 auto;
		opacity: 0.8;
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

	/* ── Tablets, foldables, split-screen (700–959px) ──
	   The shell was pinned to a 430px column at EVERY width below 960px, so an
	   iPad in portrait (768px), an unfolded foldable or a half-screen window
	   rendered a phone-width strip with ~300px of dead margin on either side. The
	   column fills the space here instead. TripDay switches to its two-pane day
	   body at the same 700px breakpoint, so the width goes to the map rather than
	   to over-long lines of body text — and the ≥960px rules below (full bleed,
	   24px gutters, sidebar day rail) still take over from here unchanged. */
	@media (min-width: 700px) {
		.shell {
			max-width: 900px;
		}
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

	/* ── Desktop ──
	   The shell widens; hero + sticky daynav span its full width. The day body's
	   own two-column grid lives in TripDay, which owns those elements. */
	@media (min-width: 960px) {
		.shell {
			/* Full-bleed: fill the fluid content track beside the 240px sidebar
			   rather than centring in a 1060px column. The extra width is routed to
			   the map (the right grid track below is `1fr`); the timeline's left
			   track is capped at a readable measure so line length stays sane while
			   the map — and the route it shows — grow with the viewport. */
			max-width: none;
		}
		/* The horizontal day nav + hero variant tabs are superseded by the desktop
		   sidebar's day rail at every width ≥960px; hide them here (they return
		   below 960px, where the sidebar is gone and these drive navigation). */
		.daynav,
		.daynav-sentinel,
		.vtabs:not(.vtabs-edit) {
			display: none;
		}
		/* Align the hero's horizontal padding to the day body's 24px so the eyebrow/
		   title/budget bar line up with the timeline below at full bleed. */
		.hero {
			padding-left: 24px;
			padding-right: 24px;
		}
		/* The day strip is hidden up here, so its stuck context line can never
		   render — but the trip title it carries is the sidebar's job at this width
		   anyway. */
		/* The unmatched-photos card shares the .day-photos class with the day-level
		   card that now lives in TripDay, and inherited this margin from TripDay's
		   desktop grid rules. Preserved verbatim so the extraction changes nothing
		   visually — it is almost certainly an accident of the shared class name
		   (the card sits outside the grid, flush to the scroll area's edges). */
		.day-photos {
			margin: 12px 0 0;
		}
	}
</style>
