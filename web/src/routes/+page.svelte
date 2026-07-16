<script lang="ts">
	import LocaleSwitcher from '$lib/i18n/LocaleSwitcher.svelte';
	import { t, formatDateRange } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import { getNow } from '$lib/now';
	import {
		type Trip,
		type Segment,
		tripTimezone,
		isoDateInTZ,
		minutesSinceMidnightInTZ,
		parseBlockTimeMinutes,
		flattenTripDays,
		daysBetweenISO,
		loc
	} from '$lib/trip-engine';
	import { paletteFor } from '$lib/theme-colors';

	let { data } = $props();

	const statusKey: Record<string, keyof Messages> = {
		past: 'home.statusPast',
		active: 'home.statusNow',
		upcoming: 'home.statusUpcoming'
	};

	// The active trip (today within start–end) is pulled out into its own hero
	// card above the grid, so it's excluded from the owned/shared lists
	// rendered as regular cards below. Activeness is judged against the shared
	// clock (not the server-computed `status`) so the hero honours the `?now=`
	// test override; without the override the two always agree.
	// "empty trips" is judged from the *unfiltered* owned list, so a user
	// whose only trip is the active one doesn't see "No trips yet.".
	const activeTrip = $derived.by(() => {
		const today = isoDateInTZ(getNow());
		return data.trips.find(
			(tr) => tr.startDate && tr.endDate && tr.startDate <= today && today <= tr.endDate
		);
	});
	const ownedAll = $derived(data.trips.filter((tr) => tr.role === 'owner'));
	const owned = $derived(ownedAll.filter((tr) => tr.id !== activeTrip?.id));
	const shared = $derived(
		data.trips.filter((tr) => tr.role !== 'owner' && tr.id !== activeTrip?.id)
	);

	// "Day N of M" from the list payload's date range alone (no trip timezone
	// available there) — refined below once the full doc is fetched.
	const dayCount = $derived.by(() => {
		if (!activeTrip?.startDate || !activeTrip?.endDate) return null;
		const today = isoDateInTZ(getNow());
		const day = daysBetweenISO(activeTrip.startDate, today) + 1;
		const total = daysBetweenISO(activeTrip.startDate, activeTrip.endDate) + 1;
		return { day: Math.min(Math.max(day, 1), total), total };
	});

	// Segment/city + "next block" info isn't in the list payload — fetched
	// client-side after mount from the trip's full doc. Best-effort: any
	// failure just means the hero shows less detail, never breaks the page.
	function heroStyleFor(seg: Segment): string {
		const p = paletteFor(seg.theme, seg.themeColors);
		return `--ha-bg:${p.bg};--ha-eyebrow:${p.eyebrow};--ha-accent:${p.accent}`;
	}

	// Non-active cards get a thin theme-colored left band using the trip's
	// first-segment theme (carried on the list payload — see listTripsForUser),
	// reusing the same palette as the active-trip hero above instead of
	// rendering flat.
	function cardBandStyle(trip: (typeof data.trips)[number]): string {
		// Emit only the theme BASE colour; the card CSS derives a mode-appropriate
		// band tint from it (the base itself in light — unchanged identity — and an
		// OKLCH-lightened tint in dark so the band reads on a dark surface).
		const p = paletteFor(trip.theme, trip.themeColors);
		return `--card-base:${p.accent}`;
	}

	let activeDetail = $state<{ city?: string; next?: { title: string; time: string } } | null>(
		null
	);
	let heroThemeStyle = $state('');

	$effect(() => {
		const id = activeTrip?.id;
		activeDetail = null;
		heroThemeStyle = '';
		if (!id) return;
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`/api/trips/${id}`);
				if (!res.ok || cancelled) return;
				const body = (await res.json()) as { doc: Trip };
				const trip = body.doc;
				const tz = tripTimezone(trip);
				const now = getNow();
				const todayISO = isoDateInTZ(now, tz);
				const flat = flattenTripDays(trip);
				const todays = flat.find((f) => f.day.date === todayISO);
				const lang = trip.defaultLanguage;
				let next: { title: string; time: string } | undefined;
				if (todays) {
					const mins = minutesSinceMidnightInTZ(now, tz);
					for (const b of todays.day.blocks) {
						const bt = parseBlockTimeMinutes(b.time);
						if (bt !== null && bt > mins) {
							next = { title: loc(trip, b.title, lang), time: b.time };
							break;
						}
					}
				}
				if (cancelled) return;
				activeDetail = { city: todays ? loc(trip, todays.seg.title, lang) : undefined, next };
				const themeSeg = todays?.seg ?? trip.segments[0];
				if (themeSeg) heroThemeStyle = heroStyleFor(themeSeg);
			} catch {
				// Network/parse error — the hero already renders fine without this detail.
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

{#snippet card(trip: (typeof data.trips)[number])}
	<a class="card" style={cardBandStyle(trip)} href="/trips/{trip.id}">
		{#if trip.cover}<div class="cover" aria-hidden="true">{trip.cover}</div>{/if}
		<div class="card-main">
			<div class="card-top">
				<div class="card-title">{trip.title ?? trip.id}</div>
				<span class="chip {trip.status}">{t(statusKey[trip.status] ?? 'home.statusUpcoming')}</span>
			</div>
			<div class="card-dates">{formatDateRange(trip.startDate, trip.endDate)}</div>
			{#if trip.role !== 'owner'}<span class="role">{trip.role === 'editor' ? t('role.canEdit') : t('role.viewOnly')}</span>{/if}
		</div>
	</a>
{/snippet}

<svelte:head>
	<title>{t('home.pageTitle')}</title>
</svelte:head>

<main>
	{#if data.user}
		<div class="head">
			<h1>{t('home.yourTrips')}</h1>
			<div class="actions">
				<a class="import-btn" href="/trips/import">{t('home.importItinerary')}</a>
				<a class="new" href="/trips/new">{t('home.newTrip')}</a>
			</div>
		</div>

		{#if activeTrip}
			<a class="hero-active" style={heroThemeStyle} href="/trips/{activeTrip.id}">
				<div class="hero-active-eyebrow">{t('home.activeEyebrow')}</div>
				<div class="hero-active-title">{activeTrip.title ?? activeTrip.id}</div>
				<div class="hero-active-meta">
					{#if dayCount}
						<span
							>{t('home.dayOfTotal', { day: dayCount.day, total: dayCount.total })}{activeDetail?.city
								? ` · ${activeDetail.city}`
								: ''}</span
						>
					{/if}
					<span class="hero-active-dates">{formatDateRange(activeTrip.startDate, activeTrip.endDate)}</span>
				</div>
				{#if activeDetail?.next}
					<div class="hero-active-next">
						{t('home.nextLabel')}: {activeDetail.next.title} · {activeDetail.next.time}
					</div>
				{/if}
			</a>
		{/if}

		{#if ownedAll.length === 0}
			<p class="empty">{t('home.noTrips')} <a href="/trips/new">{t('home.createFirst')}</a></p>
		{:else if owned.length > 0}
			<div class="cards">
				{#each owned as trip (trip.id)}{@render card(trip)}{/each}
			</div>
		{/if}

		{#if shared.length > 0}
			<h2 class="shared-hd">{t('home.sharedWithYou')}</h2>
			<div class="cards">
				{#each shared as trip (trip.id)}{@render card(trip)}{/each}
			</div>
		{/if}
	{:else}
		<h1>Zarparia</h1>
		<p>{t('landing.tagline')}</p>
		<div class="landing-actions">
			<a class="landing-signin" href="/auth/login/google">{t('header.signInGoogle')}</a>
			<a class="landing-demo" href="/demo">{t('landing.tryDemo')}</a>
		</div>
		<div class="landing-lang">
			<LocaleSwitcher />
		</div>
	{/if}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 1200px;
		margin: 2rem auto;
		padding: 0 1.5rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	h1 {
		font-size: var(--type-h1);
	}
	/* Below ~520px stack: heading on its own row, actions side by side below it,
	   so the buttons never squeeze the heading into a mid-word wrap. */
	@media (max-width: 520px) {
		main {
			margin-top: 1rem;
		}
		h1 {
			font-size: clamp(21px, 1.15rem + 0.9vw, 25px);
		}
		.head {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
		}
		.actions {
			width: 100%;
		}
		.import-btn,
		.new {
			flex: 1;
			min-height: 44px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
		.hero-active {
			margin-top: 0.9rem;
		}
		.cards {
			margin-top: 0.9rem;
		}
	}
	.shared-hd {
		font-size: 1.1rem;
		margin: 1.75rem 0 0.25rem;
		color: var(--text);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.new {
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--accent-strong);
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.new:hover {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.import-btn {
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--text-muted);
		border: 1px solid var(--hairline);
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.import-btn:hover {
		background: var(--surface-sunken);
	}
	@media (prefers-reduced-motion: no-preference) {
		.new,
		.import-btn {
			transition:
				transform 0.1s ease,
				background 0.15s ease;
		}
		.new:active,
		.import-btn:active {
			transform: scale(0.97);
		}
	}
	.empty {
		color: var(--text-muted);
		margin-top: 1.5rem;
	}
	/* Active-trip hero: a single prominent card above the regular grid.
	   --ha-* custom properties default to the app's "active" green (matching
	   .chip.active below) and are overridden inline once the trip's own
	   segment theme colors are fetched client-side. */
	.hero-active {
		display: block;
		margin-top: 1.25rem;
		padding: 1.1rem 1.3rem 1.25rem;
		border-radius: 16px;
		background: var(--ha-bg, #1a5a34);
		color: #fff;
		text-decoration: none;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.14);
	}
	.hero-active:hover {
		box-shadow: 0 6px 22px rgba(0, 0, 0, 0.2);
	}
	@media (prefers-reduced-motion: no-preference) {
		.hero-active {
			transition:
				transform 0.1s ease,
				box-shadow 0.15s ease;
		}
		.hero-active:active {
			transform: scale(0.98);
		}
	}
	.hero-active-eyebrow {
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ha-eyebrow, #bfe7cf);
		opacity: 0.85;
		margin-bottom: 0.3rem;
	}
	.hero-active-title {
		font-family: 'Playfair Display', Georgia, serif;
		font-size: 1.6rem;
		font-weight: 700;
		line-height: 1.12;
		margin-bottom: 0.45rem;
	}
	.hero-active-meta {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.82);
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.6rem;
		font-variant-numeric: tabular-nums;
	}
	.hero-active-dates::before {
		content: '·';
		margin-right: 0.6rem;
		opacity: 0.6;
	}
	.hero-active-next {
		margin-top: 0.65rem;
		padding-top: 0.55rem;
		border-top: 1px solid rgba(255, 255, 255, 0.18);
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.78);
	}
	.landing-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.75rem;
	}
	.landing-signin,
	.landing-demo {
		font-size: 0.9rem;
		text-decoration: none;
		border-radius: 999px;
		padding: 0.55rem 1.2rem;
		font-weight: 600;
	}
	.landing-signin {
		color: #fff;
		background: var(--accent);
		border: 1px solid var(--accent);
	}
	.landing-demo {
		color: var(--accent-strong);
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		font-weight: 500;
	}
	.landing-demo:hover {
		background: var(--surface-sunken);
	}
	.landing-lang {
		margin-top: 1.5rem;
	}
	.cards {
		margin-top: 1.25rem;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	@media (min-width: 1024px) {
		.cards {
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}
	.card {
		/* Band tint derived from the inline --card-base: the base itself in light
		   (identity unchanged); in dark, re-lightened to L 0.58 with chroma
		   preserved so the band still reads as the theme's hue (e.g. navy stays
		   blue) instead of washing out to a near-white pastel at high lightness.
		   Falls back to the hairline when a trip has no theme. The derived colour
		   is applied to
		   border-left-color DIRECTLY in the theme-conditional rules (not routed
		   through a custom property): Chromium keeps the pending-substitution
		   value of the `border-left` shorthand stale across live data-theme
		   flips when the derivation lives in an intermediate variable. */
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-left: 4px solid var(--card-base, var(--hairline-strong));
		border-radius: 12px;
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: var(--text);
	}
	:root[data-theme='dark'] .card {
		border-left-color: oklch(from var(--card-base, #7a6e5f) 0.58 c h);
	}
	@media (prefers-color-scheme: dark) {
		:root:not([data-theme]) .card {
			border-left-color: oklch(from var(--card-base, #7a6e5f) 0.58 c h);
		}
	}
	.card:hover {
		/* Only the three non-band sides — the band (left) colour is theme-managed
		   above and must not be clobbered by a hover border-color shorthand. */
		border-top-color: var(--hairline-strong);
		border-right-color: var(--hairline-strong);
		border-bottom-color: var(--hairline-strong);
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
	}
	@media (prefers-reduced-motion: no-preference) {
		.card {
			transition:
				transform 0.1s ease,
				box-shadow 0.15s ease,
				border-color 0.15s ease;
		}
		.card:active {
			transform: scale(0.98);
		}
	}
	.cover {
		font-size: 30px;
		width: 52px;
		height: 52px;
		border-radius: 12px;
		background: var(--surface-sunken);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.card-main {
		flex: 1;
		min-width: 0;
	}
	/* Title + status chip share a row so the chip sits top-right, vertically
	   aligned with the title's own line — not floating centered against the
	   whole card's height (which grows/shrinks with the optional cover/role). */
	.card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.card-title {
		flex: 1;
		min-width: 0;
		font-weight: 700;
	}
	.card-dates {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-top: 0.15rem;
		font-variant-numeric: tabular-nums;
	}
	.role {
		display: inline-block;
		margin-top: 0.35rem;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--pill-warn-fg);
		background: var(--pill-warn-bg);
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
	}
	.chip {
		flex-shrink: 0;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
	}
	.chip.past {
		background: var(--pill-neutral-bg);
		color: var(--pill-neutral-fg);
	}
	.chip.active {
		background: var(--pill-go-bg);
		color: var(--pill-go-fg);
	}
	.chip.upcoming {
		background: var(--pill-info-bg);
		color: var(--pill-info-fg);
	}
</style>
