<script lang="ts">
	import { untrack, onDestroy } from 'svelte';
	import TripView from '$lib/TripView.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { setSidebarAbout } from '$lib/nav/tripNav.svelte';
	import { loc, type Trip } from '$lib/trip-engine';
	import { t } from '$lib/i18n/store.svelte';
	import DemoAboutDialog from './DemoAboutDialog.svelte';

	let { data } = $props();

	// The demo trip is fixed for the page's lifetime (no navigation between
	// trips like /trips/[id]), so this initial read is intentionally non-reactive.
	const trip = untrack(() => data.trip as unknown as Trip);
	let lang = $state(trip.defaultLanguage || trip.languages[0]);
	const pageTitle = $derived(`${loc(trip, trip.title, lang)} — Zarparia`);

	// Auto-open the About dialog on the visitor's first demo view this session;
	// the banner's About button reopens it any time after.
	const ABOUT_SEEN_KEY = 'zarparia-demo-about-seen';
	let aboutOpen = $state(false);
	$effect(() => {
		if (!sessionStorage.getItem(ABOUT_SEEN_KEY)) {
			sessionStorage.setItem(ABOUT_SEEN_KEY, '1');
			aboutOpen = true;
		}
	});

	// Expose the About dialog to the desktop sidebar's utilities (the sidebar lives
	// in the root layout and can't see this page's local dialog state). Cleared on
	// destroy so it doesn't leak to other routes. Label tracks the UI locale.
	$effect(() => {
		setSidebarAbout({ label: t('demo.about'), open: () => (aboutOpen = true) });
	});
	onDestroy(() => setSidebarAbout(null));

	// Family "Demo banner" anatomy (DESIGN.md): the strip spans the FULL
	// viewport width at ≥960px — above the sidebar, never clipped to the
	// content column. Below 960px there's no sidebar and the banner stays
	// in-flow (sticky), so this is a no-op there in practice (the CSS var and
	// body class are only consumed by the ≥960px rules).
	let demoBannerEl = $state<HTMLDivElement | null>(null);

	// Publish the banner's measured height (it can wrap onto two lines at
	// narrower desktop widths) as --demo-banner-h so the layout can push the
	// sidebar + content column below it. Mirrors Nobria's --demo-h. Cleared on
	// unmount so a later route's layout isn't left with a stale offset.
	$effect(() => {
		const el = demoBannerEl;
		if (!el) return;
		const root = document.documentElement;
		const set = () => root.style.setProperty('--demo-banner-h', `${el.offsetHeight}px`);
		set();
		const ro = new ResizeObserver(set);
		ro.observe(el);
		return () => {
			ro.disconnect();
			root.style.removeProperty('--demo-banner-h');
		};
	});

	// Stamp <body class="has-demo-banner"> while this page is mounted, so the
	// root layout's grid (and the sticky sidebar) know to offset below the
	// fixed banner. Removed on destroy.
	$effect(() => {
		document.body.classList.add('has-demo-banner');
		return () => document.body.classList.remove('has-demo-banner');
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="page">
	<div class="demo-banner" bind:this={demoBannerEl}>
		<div class="demo-banner-inner">
			<span class="demo-banner-text">{t('demo.banner')}</span>
			<div class="demo-banner-actions">
				<button type="button" class="ghost" onclick={() => (aboutOpen = true)}>{t('demo.about')}</button>
				<a class="ghost" href="/">{t('demo.back')}</a>
				<!-- Sign-in CTA is deliberately the SECONDARY style: DESIGN.md's demo
				     banner anatomy — "App-specific actions may differ; their styling
				     may not" (was a filled primary before the round-2 sweep). -->
				<a class="ghost" href="/auth/login/google">{t('demo.signInCta')}</a>
			</div>
		</div>
	</div>

	<DemoAboutDialog bind:open={aboutOpen} />

	<TripView {trip} bind:lang photos={data.photos} photosEditable={false} />

	<BottomBar
		user={data.user}
		items={[{ id: 'back', label: t('nav.back'), icon: 'back', href: '/' }]}
		onAbout={() => (aboutOpen = true)}
		aboutLabel={t('demo.about')}
	/>
</div>

<style>
	.page {
		min-height: calc(100vh - 60px);
		background: var(--surface-sunken);
	}
	.demo-banner {
		position: sticky;
		top: 0;
		z-index: 20;
		/* Family anatomy (DESIGN.md "Demo banner"): the raised surface tier.
		   --surface-sunken is the wrong tier here — in Zarparia's remap it only
		   equals the canon's raised token in LIGHT mode; DARK mode diverges
		   (mixes black into bg instead), which would mismatch the shared family
		   look. --an-surface-raised is used directly since this app has no
		   local --surface-raised alias (see tokens.css). */
		background: var(--an-surface-raised);
		border-bottom: 1px solid var(--hairline);
	}
	/* Family "Demo banner" anatomy (DESIGN.md): "The strip spans the FULL
	   viewport width at every breakpoint — above/with any rail or sidebar,
	   never clipped to the content column; navigation chrome starts below
	   it." Below 960px the banner lives inside normal block flow (no
	   sidebar exists there, so the sticky behaviour above already spans the
	   full viewport). At ≥960px the root layout becomes a 240px-sidebar +
	   content grid and this element sits inside the content column, so
	   `position: sticky` alone would start it at x=240 — pin it to the
	   viewport instead. z-index clears the Sidebar (default stacking, no
	   explicit z-index) but stays below Toast (1050) / MoreSheet (1100) /
	   dialogs, matching the app's z-index ladder. */
	@media (min-width: 960px) {
		.demo-banner {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			z-index: 1000;
		}
	}
	/* Background stays full-bleed; the content is centered and capped to the trip
	   shell width so the actions line up with the (up to 1060px) shell instead of
	   spilling to the far edges on wide screens. */
	.demo-banner-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 0.75rem;
		font-family: var(--font-ui);
		max-width: 1060px;
		margin: 0 auto;
		padding: 0.6rem 1rem;
	}
	.demo-banner-text {
		font-size: 0.85rem;
		color: var(--text-muted);
		flex: 1 1 220px;
	}
	.demo-banner-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.ghost {
		font: inherit;
		font-size: 0.85rem;
		text-decoration: none;
		border-radius: var(--radius-button);
		padding: 0.4rem 0.9rem;
		white-space: nowrap;
		cursor: pointer;
		/* Family secondary button: hairline border, transparent background.
		   ALL banner actions use this style per the demo-banner anatomy in
		   DESIGN.md (the former .primary sign-in fill was removed round-2). */
		color: var(--accent-strong);
		border: 1px solid var(--hairline-strong);
		background: transparent;
	}
	/* On mobile the bottom app bar carries Back / About / Sign in, so the banner
	   sheds its action buttons and keeps just the "nothing is saved" notice. */
	@media (max-width: 959.98px) {
		.demo-banner-actions {
			display: none;
		}
		.demo-banner-text {
			flex-basis: 100%;
		}
	}
	@media (max-width: 520px) {
		.demo-banner-inner {
			padding: 0.55rem 0.75rem;
		}
		.demo-banner-text {
			order: -1;
		}
	}
</style>
