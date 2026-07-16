<script lang="ts">
	import LocaleSwitcher from '$lib/i18n/LocaleSwitcher.svelte';
	import ThemeToggle from '$lib/theme/ThemeToggle.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { t, formatDateRange } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import { page } from '$app/state';
	import { getNow } from '$lib/now';
	import crestSvg from '$lib/assets/zarparia-crest.svg?raw';
	import markSvg from '$lib/assets/zarparia-mark-cc.svg?raw';
	import wordmarkSvg from '$lib/assets/zarparia-wordmark-cc.svg?raw';
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

	// Phase 2: after self-service account deletion, the client lands here with
	// ?accountDeleted=1 (the account/session are already gone server-side, so a
	// query param — not server state — is what carries the notice across the
	// redirect). Read once; no need to react to later navigations.
	// svelte-ignore state_referenced_locally
	const accountDeleted = page.url.searchParams.get('accountDeleted') === '1';

	// Phase 1 (legal pack): consent line under the Google sign-in button. The
	// %TERMS%/%PRIVACY% tokens in the message are swapped for real <a> links to
	// /terms and /privacy below, instead of injecting raw HTML.
	const consentParts = $derived(t('landing.consentText').split(/(%TERMS%|%PRIVACY%)/));

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
	{#if data.user && data.gateStatus}
		<div class="gate-shell">
			<div class="gate-card">
				<span class="gate-crest">{@html crestSvg}</span>
				<h1 class="gate-heading">
					{data.gateStatus === 'rejected' ? t('pending.rejectedHeading') : t('pending.heading')}
				</h1>
				<p class="gate-body">
					{data.gateStatus === 'rejected' ? t('pending.rejectedBody') : t('pending.body')}
				</p>
				<form method="POST" action="/auth/logout">
					<button type="submit" class="gate-signout">{t('header.signOut')}</button>
				</form>
				<div class="gate-legal">
					<a href="/guide">{t('nav.guide')}</a>
					<span aria-hidden="true">·</span>
					<a href="/privacy">{t('legal.privacy')}</a>
					<span aria-hidden="true">·</span>
					<a href="/terms">{t('legal.terms')}</a>
				</div>
			</div>
		</div>
	{:else if data.user}
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
			<div class="empty">
				<p>{t('home.noTrips')} <a href="/trips/new">{t('home.createFirst')}</a></p>
				<div class="empty-links">
					<a href="/trips/import">{t('home.importItinerary')}</a>
					<span aria-hidden="true">·</span>
					<a href="/demo">{t('landing.tryDemo')}</a>
					<span aria-hidden="true">·</span>
					<a href="/guide">{t('home.readGuide')}</a>
				</div>
			</div>
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

		<BottomBar
			user={data.user}
			items={[
				{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/', current: true },
				{ id: 'new', label: t('nav.newTrip'), icon: 'newTrip', href: '/trips/new' },
				{ id: 'import', label: t('nav.import'), icon: 'import', href: '/trips/import' }
			]}
		/>
	{:else}
		<div class="auth-shell">
			<div class="auth-card">
				{#if accountDeleted}
					<p class="deleted-notice" role="status">{t('account.deletedNotice')}</p>
				{/if}
				<div class="auth-card-top">
					<!-- Mobile has no site header, so the card carries the theme toggle
					     itself (hidden >=960px where the full header provides it). -->
					<span class="card-theme"><ThemeToggle /></span>
					<LocaleSwitcher />
				</div>
				<div class="auth-lockup">
					<div class="auth-lockup-row">
						<span class="auth-mark">{@html markSvg}</span>
						<span class="auth-wordmark">{@html wordmarkSvg}</span>
					</div>
					<!-- Brand tagline: part of the mark, so it stays English in both locales. -->
					<p class="auth-tagline">Chart your journey.</p>
				</div>
				<a class="auth-google-btn" href="/auth/login/google">
					<svg class="google-g" aria-hidden="true" viewBox="0 0 18 18" width="18" height="18">
						<path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
						<path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
						<path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
						<path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
					</svg>
					{t('header.signInGoogle')}
				</a>
				<p class="auth-consent">
					{#each consentParts as part, i (i)}
						{#if part === '%TERMS%'}<a href="/terms">{t('legal.terms')}</a
							>{:else if part === '%PRIVACY%'}<a href="/privacy">{t('legal.privacy')}</a
							>{:else}{part}{/if}
					{/each}
				</p>
				<a class="auth-demo-callout" href="/demo">
					<span class="auth-demo-title">{t('landing.tryDemo')}</span>
					<span class="auth-demo-sub">{t('landing.tryDemoSub')}</span>
				</a>
				<div class="auth-legal-footer">
					<a href="/guide">{t('nav.guide')}</a>
					<span aria-hidden="true">·</span>
					<a href="/roadmap">{t('nav.roadmap')}</a>
					<span aria-hidden="true">·</span>
					<a href="/privacy">{t('legal.privacy')}</a>
					<span aria-hidden="true">·</span>
					<a href="/terms">{t('legal.terms')}</a>
				</div>
			</div>
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
	.empty p {
		margin: 0;
	}
	.empty-links {
		margin-top: 0.6rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
	}
	.empty-links a {
		color: var(--accent-strong);
		text-decoration: none;
	}
	.empty-links a:hover {
		text-decoration: underline;
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
	/* Signed-out landing: a single centered auth card rather than a hero +
	   pill row. The site header already shows the brand mark for signed-out
	   visitors too, so the card lockup can stay the visual focus without
	   duplicating a full-bleed hero above it. */
	.auth-shell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100dvh - 6rem);
		padding: 1.5rem 0;
	}
	.auth-card {
		position: relative;
		width: 100%;
		max-width: 400px;
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
		padding: 2rem;
	}
	.auth-card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.deleted-notice {
		font-size: 0.82rem;
		text-align: center;
		color: var(--pill-go-fg);
		background: var(--pill-go-bg);
		border-radius: 8px;
		padding: 0.55rem 0.7rem;
		margin: 0 0 0.75rem;
	}
	/* Card-corner theme toggle: mobile only (the >=960px header already has one).
	   Bumped to a 44px tap target — the header sizing (34px) is too small for the
	   card, which is the only chrome on the mobile landing. */
	.card-theme :global(.theme-toggle) {
		width: 44px;
		height: 44px;
		min-height: 44px;
	}
	@media (min-width: 960px) {
		.card-theme {
			display: none;
		}
		/* With the theme slot gone, flex-end keeps EN|PT pinned right exactly as
		   the card looked before (space-between would drift it left). */
		.auth-card-top {
			justify-content: flex-end;
		}
	}
	.auth-lockup {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		margin-bottom: 1.75rem;
	}
	/* Horizontal lockup: mark + wordmark on one row, sized to the canonical
	   lockup's proportions (wordmark caps top-aligned with the mark; the star
	   tittle and descenders overshoot, hence the negative offset). */
	.auth-lockup-row {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 8px;
	}
	.auth-mark :global(svg) {
		display: block;
		height: 60px;
		width: auto;
	}
	.auth-wordmark {
		margin-top: -11px;
	}
	.auth-wordmark :global(svg) {
		display: block;
		height: 55.5px;
		width: auto;
		color: var(--text);
	}
	.auth-tagline {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 12px 0 0;
	}
	.auth-google-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		width: 100%;
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: 10px;
		padding: 0.7rem 1rem;
		box-sizing: border-box;
	}
	.auth-google-btn:hover {
		background: var(--surface-sunken);
	}
	.google-g {
		flex-shrink: 0;
	}
	/* Consent line: small and muted, directly under the sign-in button — the
	   Terms/Privacy words are real links into /terms and /privacy. */
	.auth-consent {
		font-size: 0.72rem;
		line-height: 1.5;
		color: var(--text-muted);
		text-align: center;
		margin: 0.6rem 0 0;
	}
	.auth-consent a {
		color: var(--text-muted);
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}
	.auth-consent a:hover {
		color: var(--accent-strong);
	}
	/* Unobtrusive legal footer at the very bottom of the signed-out card. */
	.auth-legal-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 1.25rem;
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.auth-legal-footer a {
		color: var(--text-muted);
		text-decoration: none;
	}
	.auth-legal-footer a:hover {
		color: var(--accent-strong);
		text-decoration: underline;
	}
	.auth-demo-callout {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.15rem;
		text-decoration: none;
		margin-top: 1rem;
		padding: 0.5rem;
	}
	.auth-demo-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--accent-strong);
	}
	.auth-demo-sub {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.auth-demo-callout:hover .auth-demo-title {
		text-decoration: underline;
	}
	@media (prefers-reduced-motion: no-preference) {
		.auth-google-btn {
			transition:
				transform 0.1s ease,
				background 0.15s ease;
		}
		.auth-google-btn:active {
			transform: scale(0.98);
		}
	}
	@media (max-width: 460px) {
		.auth-shell {
			padding: 1rem 0.5rem;
		}
		.auth-card {
			padding: 1.5rem 1.25rem;
			border-radius: 14px;
		}
		.auth-lockup-row {
			gap: 6px;
		}
		.auth-mark :global(svg) {
			height: 47px;
		}
		.auth-wordmark {
			margin-top: -8.5px;
		}
		.auth-wordmark :global(svg) {
			height: 43.5px;
		}
	}
	/* Pending/rejected gate: a signed-in user whose account isn't approved yet.
	   Reuses the auth-card's centered-card language so the screen still reads
	   as "part of the app", not an error page. */
	.gate-shell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100dvh - 6rem);
		padding: 1.5rem 0;
	}
	.gate-card {
		width: 100%;
		max-width: 420px;
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: 16px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
		padding: 2rem;
		text-align: center;
	}
	.gate-crest :global(svg) {
		display: block;
		width: 56px;
		height: 56px;
		margin: 0 auto 1rem;
	}
	.gate-heading {
		font-size: var(--type-h1);
		margin: 0 0 0.6rem;
	}
	.gate-body {
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0 0 1.5rem;
	}
	.gate-signout {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.5rem 1.1rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text);
		cursor: pointer;
	}
	.gate-signout:hover {
		background: var(--surface-sunken);
	}
	.gate-legal {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 1.1rem;
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.gate-legal a {
		color: var(--text-muted);
		text-decoration: none;
	}
	.gate-legal a:hover {
		color: var(--accent-strong);
		text-decoration: underline;
	}
	@media (max-width: 460px) {
		.gate-shell {
			padding: 1rem 0.5rem;
		}
		.gate-card {
			padding: 1.5rem 1.25rem;
			border-radius: 14px;
		}
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
