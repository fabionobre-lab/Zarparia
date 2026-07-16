<script lang="ts">
	import { untrack } from 'svelte';
	import TripView from '$lib/TripView.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
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
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="page">
	<div class="demo-banner">
		<div class="demo-banner-inner">
			<span class="demo-banner-text">{t('demo.banner')}</span>
			<div class="demo-banner-actions">
				<button type="button" class="ghost" onclick={() => (aboutOpen = true)}>{t('demo.about')}</button>
				<a class="ghost" href="/">{t('demo.back')}</a>
				<a class="primary" href="/auth/login/google">{t('demo.signInCta')}</a>
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
		background: var(--surface);
		border-bottom: 1px solid var(--hairline-strong);
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
		font-family: system-ui, sans-serif;
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
	.ghost,
	.primary {
		font: inherit;
		font-size: 0.85rem;
		text-decoration: none;
		border-radius: 999px;
		padding: 0.4rem 0.9rem;
		white-space: nowrap;
		cursor: pointer;
	}
	.ghost {
		color: var(--accent-strong);
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
	}
	.primary {
		color: #fff;
		background: var(--accent);
		border: 1px solid var(--accent);
		font-weight: 600;
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
