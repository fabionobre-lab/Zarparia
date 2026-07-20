<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		type Trip,
		type Segment,
		type Plan,
		type Day,
		loc,
		localeFor,
		dayLabel,
		dayKmTotal
	} from './trip-engine';
	import { tripChrome } from './i18n/tripChrome';
	import { walkMinutes } from './format';

	// A standalone, print-optimised document that lays out the WHOLE trip — every
	// segment (its default plan), every day, every block — on A4 paper. Unlike
	// TripView (a mobile-first, one-day-at-a-time interactive shell), this renders
	// flat and static so the browser's own "Print → Save as PDF" produces a clean
	// multi-page document. No weather fetch, no maps, no photos: only what prints
	// well and needs no network.
	let {
		trip,
		lang = trip.defaultLanguage || trip.languages[0],
		backHref,
		autoPrint = true
	}: {
		trip: Trip;
		/** Trip-content language to render in (EN|PT hero language, passed through
		 *  from the viewer). Falls back to the trip default. */
		lang?: string;
		/** Where the on-screen "Back to trip" link returns to (the private trip or
		 *  the public share page). Omit to hide the link. */
		backHref?: string;
		/** Fire window.print() once on mount (the whole point of this route). */
		autoPrint?: boolean;
	} = $props();

	// The print document is rendered once and never navigates to another trip
	// (the page remounts per document), so every value below is an intentional
	// one-shot read of the initial props — untrack()'d to say so explicitly.
	const L = (obj: Parameters<typeof loc>[1]) => loc(trip, obj, lang);
	const locale = untrack(() => localeFor(trip, lang));
	const ui = untrack(() => tripChrome[lang === 'pt' ? 'pt' : 'en']);
	const isPt = untrack(() => lang === 'pt');

	const planOf = (seg: Segment): Plan =>
		seg.plans.find((p) => p.id === seg.defaultPlan) ?? seg.plans[0];

	interface SegView {
		seg: Segment;
		plan: Plan;
	}
	const segViews: SegView[] = untrack(() =>
		trip.segments.filter((s) => s.plans.length > 0).map((seg) => ({ seg, plan: planOf(seg) }))
	);

	// ── Date range + planned-day count for the cover line ──
	function dateUTC(iso: string): Date {
		const [y, m, d] = iso.split('-').map(Number);
		return new Date(Date.UTC(y, m - 1, d));
	}
	function isValidISO(iso: string): boolean {
		return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(dateUTC(iso).getTime());
	}
	const allDates: string[] = segViews
		.flatMap((sv) => sv.plan.days.map((d) => d.date))
		.filter(isValidISO)
		.sort();
	const dayCount = segViews.reduce((n, sv) => n + sv.plan.days.length, 0);
	function fmtDate(iso: string, withYear: boolean): string {
		return new Intl.DateTimeFormat(locale, {
			day: 'numeric',
			month: 'long',
			year: withYear ? 'numeric' : undefined,
			timeZone: 'UTC'
		}).format(dateUTC(iso));
	}
	const rangeLabel = (() => {
		if (allDates.length === 0) return '';
		const first = allDates[0];
		const last = allDates[allDates.length - 1];
		if (first === last) return fmtDate(first, true);
		return `${fmtDate(first, false)} – ${fmtDate(last, true)}`;
	})();
	const dayCountLabel = dayCount > 0 ? `${dayCount} ${isPt ? 'dias' : dayCount === 1 ? 'day' : 'days'}` : '';
	// Built in JS so the " · " separator keeps its spaces (Svelte trims literal
	// whitespace around {#if} in markup).
	const metaLine = [rangeLabel, dayCountLabel].filter(Boolean).join(' · ');

	function tagLabel(key: string): string | null {
		const tag = trip.tags?.[key];
		return tag ? L(tag.label) : null;
	}

	onMount(() => {
		if (!autoPrint) return;
		// `?noauto` opens the document without the print dialog popping — handy for
		// reading/checking the layout, or reopening the page from history.
		if (new URLSearchParams(location.search).has('noauto')) return;
		// Wait for the serif webfont so the print snapshot isn't taken mid-swap
		// (which would mis-measure line heights and page breaks). Guarded — older
		// engines may lack document.fonts.
		const go = () => {
			try {
				window.print();
			} catch {
				/* print unavailable (headless/embedded) — the button still works */
			}
		};
		const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
		if (fonts?.ready) fonts.ready.then(go).catch(go);
		else go();
	});
</script>

<div class="wrap">
	{#if backHref}
		<div class="toolbar">
			<a class="tb-back" href={backHref}>← {ui.printBack}</a>
			<button class="tb-print" onclick={() => window.print()}>{ui.printPdf}</button>
		</div>
	{/if}

	<article class="paper">
		<header class="doc-hdr">
			<div class="brand">Zarparia</div>
			{#if L(trip.eyebrow)}<div class="eyebrow">{L(trip.eyebrow)}</div>{/if}
			<h1 class="doc-title">{L(trip.title)}</h1>
			{#if metaLine}<div class="doc-range">{metaLine}</div>{/if}
		</header>

		{#each segViews as { seg, plan } (seg.id)}
			<section class="seg">
				<div class="seg-hdr">
					<h2 class="seg-title">{L(seg.title)}</h2>
					{#if L(seg.subtitle)}<div class="seg-sub">{L(seg.subtitle)}</div>{/if}
				</div>

				{#each plan.days as day (day.date)}
					{@const km = dayKmTotal(day)}
					{@const wx = day.staticWeather}
					<div class="day">
						<div class="day-hdr">
							<div class="day-date">{dayLabel(day.date, locale)}</div>
							<h3 class="day-title">{L(day.title)}</h3>
							<div class="day-facts">
								{#if wx}
									<span class="fact">{wx.emoji ?? ''} {Math.round(wx.hi)}° / {Math.round(wx.lo)}°</span>
								{/if}
								{#if km}
									{@const wm = walkMinutes(km)}
									<span class="fact">🦶 ~{km.toFixed(1)} km{#if wm} · ~{wm} {ui.walkSuffix}{/if}</span>
								{/if}
							</div>
						</div>
						{#if L(day.note)}<p class="day-note">{L(day.note)}</p>{/if}
						{#if L(day.banner)}<div class="day-banner">{L(day.banner)}</div>{/if}

						<ul class="blocks">
							{#each day.blocks as b, bi (bi)}
								<li class="block">
									<div class="b-time">{b.time}</div>
									<div class="b-body">
										<div class="b-title">
											<span>{L(b.title)}</span>
											{#if b.tags?.length}
												{#each b.tags as key (key)}
													{@const label = tagLabel(key)}
													{#if label}<span class="b-tag">{label}</span>{/if}
												{/each}
											{/if}
										</div>
										{#if L(b.description)}<div class="b-desc">{L(b.description)}</div>{/if}
										{#if b.km}
											{@const wm = walkMinutes(b.km)}
											<div class="b-km">🚶 ~{b.km} km{#if wm} · ~{wm} {ui.walkSuffix}{/if}</div>
										{/if}
										{#if L(b.warning)}<div class="b-warn">{L(b.warning)}</div>{/if}
										{#if L(b.note)}<div class="b-note">{L(b.note)}</div>{/if}
										{#if b.checklist}
											<div class="b-check">
												<div class="b-check-title">{L(b.checklist.title)}</div>
												<ul class="b-check-items">
													{#each b.checklist.items as item, ii (ii)}
														<li class:done={item.done}>
															<span class="box" aria-hidden="true">{item.done ? '☑' : '☐'}</span>
															{L(item.text)}
														</li>
													{/each}
												</ul>
											</div>
										{/if}
										{#if b.photoSpots?.length}
											<div class="b-spots">
												<span class="b-spots-lbl">{ui.photos}:</span>
												{b.photoSpots.map((sp) => sp.name).join(' · ')}
											</div>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</div>
				{/each}

				{#if L(seg.footer)}<div class="seg-footer">{L(seg.footer)}</div>{/if}
			</section>
		{/each}

		<footer class="doc-foot">
			{isPt ? 'Roteiro gerado no Zarparia' : 'Itinerary from Zarparia'}
		</footer>
	</article>
</div>

<style>
	/* A4 page geometry: the printer owns the physical margins; on screen we mimic
	   the same 210mm sheet on a sunken backdrop so the preview reads as paper. */
	@page {
		size: A4;
		margin: 16mm 15mm;
	}

	.wrap {
		--doc-accent: #2b4a2b;
		--doc-ink: #1c1c1a;
		--doc-muted: #6a6a63;
		--doc-hairline: #d9d6cd;
		font-family: 'Source Serif 4', Georgia, serif;
		color: var(--doc-ink);
	}

	/* ── Screen-only toolbar (never printed) ── */
	.toolbar {
		max-width: 210mm;
		margin: 0 auto 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-family: var(--font-ui, system-ui, sans-serif);
	}
	.tb-back {
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--accent-strong, #2b4a2b);
	}
	.tb-print {
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		border: 1px solid var(--doc-accent);
		background: var(--doc-accent);
		color: #fff;
		border-radius: 999px;
		padding: 0.45rem 1.1rem;
	}
	.tb-print:hover {
		filter: brightness(1.08);
	}

	/* ── The sheet ── */
	.paper {
		max-width: 210mm;
		margin: 0 auto;
		background: #fff;
		color: var(--doc-ink);
		padding: 18mm 16mm;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 8px 28px rgba(0, 0, 0, 0.12);
		box-sizing: border-box;
	}

	.doc-hdr {
		border-bottom: 2px solid var(--doc-accent);
		padding-bottom: 10px;
		margin-bottom: 18px;
	}
	.brand {
		font-family: var(--font-ui, system-ui, sans-serif);
		font-size: 10px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--doc-accent);
		font-weight: 600;
	}
	.eyebrow {
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--doc-muted);
		margin-top: 6px;
	}
	.doc-title {
		font-size: 26px;
		font-weight: 700;
		line-height: 1.1;
		margin: 3px 0 0;
	}
	.doc-range {
		font-size: 12px;
		color: var(--doc-muted);
		margin-top: 5px;
	}

	.seg {
		margin-top: 22px;
	}
	.seg-hdr {
		break-after: avoid;
	}
	.seg-title {
		font-size: 17px;
		font-weight: 700;
		color: var(--doc-accent);
		margin: 0;
		padding-bottom: 3px;
		border-bottom: 1px solid var(--doc-hairline);
	}
	.seg-sub {
		font-size: 11px;
		color: var(--doc-muted);
		margin-top: 3px;
	}

	.day {
		margin-top: 14px;
		break-inside: avoid;
	}
	.day-hdr {
		break-after: avoid;
	}
	.day-date {
		font-size: 9.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--doc-accent);
		font-weight: 600;
	}
	.day-title {
		font-size: 14px;
		font-weight: 700;
		margin: 1px 0 0;
	}
	.day-facts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		margin-top: 3px;
	}
	.fact {
		font-size: 10.5px;
		color: var(--doc-muted);
	}
	.day-note {
		font-size: 11px;
		color: var(--doc-muted);
		margin: 5px 0 0;
		line-height: 1.45;
	}
	.day-banner {
		font-size: 11px;
		font-style: italic;
		color: var(--doc-accent);
		margin-top: 5px;
	}

	.blocks {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}
	.block {
		display: grid;
		grid-template-columns: 46px 1fr;
		gap: 10px;
		padding: 6px 0;
		border-top: 1px solid var(--doc-hairline);
		break-inside: avoid;
	}
	.block:first-child {
		border-top: none;
	}
	.b-time {
		font-size: 11px;
		font-weight: 600;
		color: var(--doc-accent);
		font-variant-numeric: tabular-nums;
		padding-top: 1px;
	}
	.b-title {
		font-size: 12.5px;
		font-weight: 600;
		line-height: 1.3;
	}
	.b-tag {
		display: inline-block;
		font-family: var(--font-ui, system-ui, sans-serif);
		font-size: 8.5px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--doc-muted);
		border: 1px solid var(--doc-hairline);
		border-radius: 4px;
		padding: 0 5px;
		margin-left: 5px;
		vertical-align: middle;
		white-space: nowrap;
	}
	.b-desc {
		font-size: 11px;
		color: #3a3a36;
		line-height: 1.45;
		margin-top: 2px;
	}
	.b-km {
		font-size: 10px;
		color: var(--doc-muted);
		margin-top: 3px;
	}
	.b-warn {
		font-size: 10.5px;
		color: #7a2020;
		border-left: 2px solid #c84040;
		padding-left: 7px;
		margin-top: 4px;
		line-height: 1.4;
	}
	.b-note {
		font-size: 10.5px;
		color: var(--doc-muted);
		border-left: 2px solid var(--doc-hairline);
		padding-left: 7px;
		margin-top: 4px;
		line-height: 1.4;
	}
	.b-check {
		margin-top: 5px;
	}
	.b-check-title {
		font-size: 10.5px;
		font-weight: 600;
	}
	.b-check-items {
		list-style: none;
		margin: 2px 0 0;
		padding: 0;
	}
	.b-check-items li {
		font-size: 10.5px;
		line-height: 1.5;
		color: #3a3a36;
	}
	.b-check-items li.done {
		color: var(--doc-muted);
		text-decoration: line-through;
	}
	.b-check-items .box {
		margin-right: 4px;
	}
	.b-spots {
		font-size: 10px;
		color: var(--doc-muted);
		margin-top: 4px;
		line-height: 1.4;
	}
	.b-spots-lbl {
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 8.5px;
	}

	.seg-footer {
		font-size: 10.5px;
		font-style: italic;
		color: var(--doc-muted);
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--doc-hairline);
	}

	.doc-foot {
		margin-top: 26px;
		padding-top: 8px;
		border-top: 1px solid var(--doc-hairline);
		font-family: var(--font-ui, system-ui, sans-serif);
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--doc-muted);
		text-align: center;
	}

	/* ── Print: drop the screen scaffolding, let @page own the geometry, force
	   the accent colours through (browsers strip backgrounds/colour by default). ── */
	@media print {
		.toolbar {
			display: none;
		}
		.paper {
			max-width: none;
			margin: 0;
			padding: 0;
			box-shadow: none;
		}
		.wrap {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
</style>
