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
	const THEME_COLORS: Record<string, { bg: string; eyebrow: string; accent: string }> = {
		tartan: { bg: '#2b4a2b', eyebrow: '#e8c84a', accent: '#2b4a2b' },
		navy: { bg: '#1e3054', eyebrow: '#c17817', accent: '#1e3054' },
		terracotta: { bg: '#7c3a29', eyebrow: '#e6b566', accent: '#7c3a29' },
		olive: { bg: '#4a5324', eyebrow: '#d9c46a', accent: '#4a5324' },
		azure: { bg: '#17456b', eyebrow: '#e0a24a', accent: '#17456b' },
		sand: { bg: '#5b4a30', eyebrow: '#e8cf8a', accent: '#5b4a30' }
	};
	function heroStyleFor(seg: Segment): string {
		const base = THEME_COLORS[seg.theme || 'tartan'] ?? THEME_COLORS.tartan;
		const bg = seg.themeColors?.heroBg || base.bg;
		const eyebrow = seg.themeColors?.eyebrow || base.eyebrow;
		const accent = seg.themeColors?.accent || base.accent;
		return `--ha-bg:${bg};--ha-eyebrow:${eyebrow};--ha-accent:${accent}`;
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
	<a class="card" href="/trips/{trip.id}">
		{#if trip.cover}<div class="cover" aria-hidden="true">{trip.cover}</div>{/if}
		<div class="card-main">
			<div class="card-title">{trip.title ?? trip.id}</div>
			<div class="card-dates">{formatDateRange(trip.startDate, trip.endDate)}</div>
		</div>
		{#if trip.role !== 'owner'}<span class="role">{trip.role === 'editor' ? t('role.canEdit') : t('role.viewOnly')}</span>{/if}
		<span class="chip {trip.status}">{t(statusKey[trip.status] ?? 'home.statusUpcoming')}</span>
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
		<h1>Trips</h1>
		<p>{t('landing.tagline')}</p>
		<p><a href="/auth/login/google">{t('header.signInGoogle')}</a> {t('landing.toGetStarted')}</p>
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
		font-size: 1.5rem;
	}
	/* Below ~520px stack: heading on its own row, actions side by side below it,
	   so the buttons never squeeze the heading into a mid-word wrap. */
	@media (max-width: 520px) {
		.head {
			flex-direction: column;
			align-items: stretch;
			gap: 0.75rem;
		}
		.actions {
			width: 100%;
		}
		.import-btn,
		.new {
			flex: 1;
			min-height: 40px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
		}
	}
	.shared-hd {
		font-size: 1.1rem;
		margin: 1.75rem 0 0.25rem;
		color: #444;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.new {
		font-size: 0.85rem;
		text-decoration: none;
		color: #2b4a2b;
		border: 1px solid #cbb;
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.import-btn {
		font-size: 0.85rem;
		text-decoration: none;
		color: #7a6e5f;
		border: 1px solid #e2ddd2;
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.empty {
		color: #666;
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
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #faf6ee;
		border: 1px solid #e2ddd2;
		border-radius: 12px;
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: #1a1208;
	}
	.cover {
		font-size: 30px;
		width: 52px;
		height: 52px;
		border-radius: 12px;
		background: #efe9dc;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.card-main {
		flex: 1;
		min-width: 0;
	}
	.card-title {
		font-weight: 700;
	}
	.card-dates {
		font-size: 0.8rem;
		color: #7a6e5f;
		margin-top: 0.15rem;
	}
	.role {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #7a5a10;
		background: #f5edd5;
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
	}
	.chip {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
	}
	.chip.past {
		background: #ede8e0;
		color: #7a6e5f;
	}
	.chip.active {
		background: #daf0e5;
		color: #1a5a34;
	}
	.chip.upcoming {
		background: #dce8f5;
		color: #1e3a5f;
	}
</style>
