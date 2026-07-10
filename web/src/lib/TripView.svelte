<script lang="ts">
	import { untrack } from 'svelte';
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
		truncStop,
		dayKmTotal,
		fetchSegmentWeather,
		safeUrl
	} from './trip-engine';

	// trip is fixed for the lifetime of a mounted TripView (the page remounts
	// per trip id), so these initial reads are intentionally non-reactive.
	let {
		trip,
		lang = $bindable(untrack(() => trip.defaultLanguage || trip.languages[0]))
	}: { trip: Trip; lang?: string } = $props();
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
	// Local-date (YYYY-MM-DD from wall-clock getFullYear/Month/Date, NOT the
	// UTC-based toISOString) so "today" matches the visitor's own calendar day.
	function localISODate(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}
	/** Day index to open on: today's day if the trip is currently active
	 *  (today between the first and last day, inclusive), landing on the next
	 *  planned day when today itself is an unplanned gap date. Past/upcoming
	 *  trips (today outside that range) keep the existing default of day 0. */
	function initialDayIndex(days: FlatDay[]): number {
		if (days.length === 0) return 0;
		const first = days[0].day.date;
		const last = days[days.length - 1].day.date;
		const today = localISODate(new Date());
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
	// changes. behavior 'auto' matches the static engine — 'smooth' is silently
	// dropped in some embedded/reduced-motion environments.
	let dayBtnEls: (HTMLButtonElement | null)[] = [];
	$effect(() => {
		const el = dayBtnEls[clampedIdx];
		el?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
	});

	const uiText = $derived(
		lang === 'pt'
			? { maps: 'Abrir no Maps', dayRoute: 'Rota do Dia', openRoute: 'Abrir rota no Google Maps →' }
			: { maps: 'Open in Maps', dayRoute: 'Day Route', openRoute: 'Open route in Google Maps →' }
	);

	function setLang(l: string) {
		lang = l;
	}
	function setPlan(seg: Segment, planId: string) {
		planBySeg = { ...planBySeg, [seg.id]: planId };
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
</script>

<div class="shell" class:theme-navy={current?.seg.theme === 'navy'} style={themeStyle}>
	<div class="hero">
		<div class="hero-inner">
			<div class="hero-row1">
				<div class="trip-eyebrow">{L(trip.eyebrow)}</div>
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

	<nav class="daynav" aria-label="Days">
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
	</nav>

	<div class="scroll-area">
		{#if current}
			{@const seg = current.seg}
			{@const plan = current.plan}
			{@const day = current.day}
			{@const wx = daySummary(seg, day)}
			{@const km = dayKmTotal(day)}
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

			{#if routeForDay}
				<a href={routeForDay.url} target="_blank" rel="noreferrer" class="route-card">
					<div class="route-hdr">
						<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>
						{uiText.dayRoute}
					</div>
					<div class="route-stops">
						{#each routeForDay.places as p, i (i)}
							{#if i > 0}<div class="route-connector"></div>{/if}
							<div class="route-stop">
								<div class="route-num">{i + 1}</div>
								<div class="route-name">{truncStop(p.name)}</div>
							</div>
						{/each}
					</div>
					<div class="route-open">
						<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
						{uiText.openRoute}
					</div>
				</a>
			{/if}

			<div class="tl">
				{#each day.blocks as b, bi (bi)}
					{@const badge = blockBadge(seg, day, b.time)}
					<div class="tb">
						<div class="tb-left">
							<div class="tb-time">
								{b.time}
								{#if badge && !isPast}
									<div class="wx"><span aria-hidden="true">{badge.emoji}</span> {badge.temp}°C</div>
								{/if}
							</div>
							<div class="tb-dot-col">
								<div class="tb-dot" style="background:{b.dotColor || 'var(--stone)'}"></div>
								{#if bi < day.blocks.length - 1}<div class="tb-line"></div>{/if}
							</div>
						</div>
						<div class="tb-body">
							<div class="tb-title">{L(b.title)}</div>
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
										<a href={safeUrl(sp.mapsUrl)} target="_blank" rel="noreferrer" class="ps-card">
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
							{#if b.mapsUrl}
								<a class="map-btn" href={safeUrl(b.mapsUrl)} target="_blank" rel="noreferrer">
									<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
									{uiText.maps}
								</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
			{#if L(seg.footer)}<div class="footer">{L(seg.footer)}</div>{/if}
		{/if}
	</div>
</div>

<style>
	.shell {
		max-width: 430px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		background: var(--cream);
		--ink: #1a1208;
		--stone: #7a6e5f;
		--heather: #7b4f7a;
		--gold: #b8860b;
		--cream: #faf6ee;
		--moss: #3d5a3d;
		--border: #d8ccb8;
		--loch: #1e3a5f;
		--hero-bg: #2b4a2b;
		--hero-eyebrow: #e8c84a;
		--accent: #2b4a2b;
		font-family: 'Source Serif 4', Georgia, serif;
		color: var(--ink);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
	}
	.shell.theme-navy {
		--hero-bg: #1e3054;
		--hero-eyebrow: #c17817;
		--accent: #1e3054;
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
		justify-content: space-between;
		align-items: center;
		margin-bottom: 5px;
	}
	.trip-eyebrow {
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--hero-eyebrow);
		opacity: 0.75;
	}
	.lang-toggle {
		display: flex;
		border-radius: 20px;
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
	.trip-title {
		font-family: 'Playfair Display', Georgia, serif;
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
		border-radius: 10px 10px 0 0;
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
		background: var(--cream);
		color: var(--ink);
		font-weight: 500;
	}
	.daynav {
		display: flex;
		overflow-x: auto;
		scrollbar-width: none;
		background: var(--cream);
		border-bottom: 1px solid var(--border);
		padding: 0 4px;
	}
	.daynav::-webkit-scrollbar {
		display: none;
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
		border-bottom-color: var(--accent);
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
		color: var(--stone);
	}
	.daybtn .dnum {
		font-size: 15px;
		font-weight: 500;
		color: var(--stone);
		font-family: 'Playfair Display', serif;
		line-height: 1;
	}
	.daybtn.on .dow,
	.daybtn.on .dnum {
		color: var(--accent);
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
		background: var(--border);
		margin: 4px 0;
		flex-shrink: 0;
	}
	.scroll-area {
		padding-bottom: 20px;
	}
	.day-hdr {
		margin: 12px 13px 0;
		background: var(--hero-bg);
		border-radius: 13px;
		padding: 13px 15px 12px;
	}
	.dh-eye {
		font-size: 9px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--hero-eyebrow);
		opacity: 0.7;
		margin-bottom: 2px;
	}
	.dh-title {
		font-family: 'Playfair Display', serif;
		font-size: 18px;
		color: #fff;
		font-weight: 700;
		line-height: 1.2;
	}
	.dh-note {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.55);
		margin-top: 3px;
		line-height: 1.4;
	}
	.bday-strip {
		background: var(--heather);
		border-radius: 8px;
		padding: 6px 11px;
		margin-top: 8px;
		font-family: 'Playfair Display', serif;
		font-style: italic;
		font-size: 12px;
		color: #fff;
		line-height: 1.3;
	}
	.wx-hdr {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		padding: 6px 0 2px;
		font-size: 11px;
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
		padding: 5px 13px 0;
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
		color: var(--stone);
		text-align: center;
		line-height: 1.2;
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
		border: 2px solid var(--cream);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.07);
	}
	.tb-line {
		width: 1.5px;
		flex: 1;
		min-height: 14px;
		background: var(--border);
		margin-top: 2px;
	}
	.tb-body {
		flex: 1;
		padding: 11px 0 11px 9px;
		border-bottom: 1px solid var(--border);
	}
	.tb:last-child .tb-body {
		border-bottom: none;
	}
	.tb-title {
		font-family: 'Playfair Display', serif;
		font-size: 14px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.3;
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
		border-radius: 20px;
		white-space: nowrap;
	}
	.tb-tag.sight {
		background: #dce8f5;
		color: var(--loch);
	}
	.tb-tag.food {
		background: #daf0e5;
		color: var(--moss);
	}
	.tb-tag.logistics {
		background: #ede8e0;
		color: var(--stone);
	}
	.tb-tag.booking {
		background: #f5edd5;
		color: #7a5a10;
	}
	.tb-tag.fullday {
		background: #ede0f0;
		color: var(--heather);
	}
	.tb-tag.birthday {
		background: linear-gradient(120deg, #f2d2f0, #dfd0f2);
		color: #5a2a78;
		font-weight: 500;
	}
	.tb-meta {
		font-size: 12px;
		color: var(--stone);
		line-height: 1.55;
		margin-top: 2px;
	}
	.tb-warn {
		background: #fdf0ee;
		border-left: 2.5px solid #c84040;
		border-radius: 0 7px 7px 0;
		padding: 5px 9px;
		margin-top: 5px;
		font-size: 11px;
		color: #7a2020;
		line-height: 1.45;
	}
	.tb-note {
		background: #f0ece4;
		border-radius: 7px;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--stone);
		line-height: 1.45;
	}
	.diff-added {
		background: #e5f5e8;
		border-left: 2.5px solid var(--moss);
		border-radius: 0 7px 7px 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: #1a3a1a;
		line-height: 1.45;
	}
	.diff-changed {
		background: #fef6de;
		border-left: 2.5px solid var(--gold);
		border-radius: 0 7px 7px 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: #5a3a00;
		line-height: 1.45;
	}
	.diff-kept {
		background: #f0ece4;
		border-left: 2.5px solid var(--accent);
		border-radius: 0 7px 7px 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--stone);
		line-height: 1.45;
	}
	.map-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 6px;
		padding: 5px 11px;
		border: 1px solid var(--border);
		border-radius: 20px;
		font-size: 11px;
		color: var(--loch);
		text-decoration: none;
		background: rgba(30, 58, 95, 0.04);
	}
	.footer {
		text-align: center;
		padding: 10px 0 3px;
		font-size: 10px;
		color: var(--border);
		font-family: 'Playfair Display', serif;
		font-style: italic;
		letter-spacing: 0.05em;
	}
	.route-card {
		display: block;
		margin: 10px 13px 4px;
		background: linear-gradient(135deg, #f7f4ee 0%, #eee9df 100%);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 12px 14px 10px;
		text-decoration: none;
		color: var(--ink);
	}
	.route-hdr {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: 'Playfair Display', serif;
		font-size: 13px;
		font-weight: 600;
		color: var(--accent);
		margin-bottom: 8px;
	}
	.route-stops {
		display: flex;
		align-items: center;
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
		color: var(--stone);
		text-align: center;
		max-width: 58px;
		line-height: 1.2;
		margin-top: 3px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.route-connector {
		width: 20px;
		height: 2px;
		background: repeating-linear-gradient(90deg, var(--border) 0, var(--border) 4px, transparent 4px, transparent 7px);
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
		color: var(--loch);
		padding-top: 4px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
		margin-top: 2px;
	}
	.km-tag {
		display: inline-block;
		margin-top: 5px;
		font-size: 10px;
		color: #888;
		background: #f4f1ec;
		border-radius: 10px;
		padding: 1px 7px;
	}
	.tb-photos {
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
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
		border-radius: 5px;
		display: block;
	}
	.ps-placeholder {
		background: #e8e4db;
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
		color: #1e3a5f;
		text-align: center;
		line-height: 1.3;
		margin-top: 3px;
		padding: 0 2px;
	}
	.wx {
		font-size: 9px;
		color: #888;
		margin-top: 3px;
		line-height: 1.2;
		text-align: center;
	}
</style>
