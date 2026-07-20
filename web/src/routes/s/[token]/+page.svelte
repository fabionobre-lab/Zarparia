<script lang="ts">
	import { untrack } from 'svelte';
	import TripView from '$lib/TripView.svelte';
	import { loc, type Trip } from '$lib/trip-engine';
	import { t } from '$lib/i18n/store.svelte';
	import type { TripPhoto } from '$lib/photos';

	let { data } = $props();

	// The trip is fixed for the page's lifetime (no navigation between trips on
	// this route, one token per page load), so this initial read is
	// intentionally non-reactive — same convention as routes/demo/+page.svelte.
	const trip = untrack(() => data.trip as unknown as Trip);
	let lang = $state(trip.defaultLanguage || trip.languages[0]);
	const pageTitle = $derived(`${loc(trip, trip.title, lang)} — Zarparia`);

	// Photos load client-side (SSR of a big trip's strips exceeds the Workers
	// CPU limit — same rationale as /trips/[id]), authorized by the public-link
	// token in the query string instead of a session (see
	// api/trips/[id]/photos's public-token grant).
	let photos = $state<TripPhoto[]>([]);
	$effect(() => {
		fetch(`/api/trips/${trip.id}/photos?token=${encodeURIComponent(data.token)}`)
			.then((res) => (res.ok ? (res.json() as Promise<{ photos: TripPhoto[] }>) : null))
			.then((body) => {
				if (body) photos = body.photos;
			})
			.catch(() => {
				// keep the current (empty) list — a failed fetch shouldn't break the page
			});
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="page">
	<!-- Family "Demo banner" anatomy (DESIGN.md), same shape as routes/demo but
	     simpler: this route never has a sidebar (not in +layout.svelte's
	     SIDEBAR_ROUTES), so there's no need for demo's fixed-position +
	     --demo-banner-h dance — an in-flow sticky strip already spans full
	     width at every breakpoint here. One action only, per spec: "Plan your
	     own trip" back to '/'. -->
	<div class="public-banner">
		<div class="public-banner-inner">
			<span class="public-banner-text">{t('publicShare.banner')}</span>
			<a class="ghost" href="/">{t('publicShare.cta')}</a>
		</div>
	</div>

	<TripView {trip} bind:lang {photos} photosEditable={false} photoToken={data.token} />
</div>

<style>
	.page {
		min-height: calc(100vh - 60px);
		background: var(--surface-sunken);
	}
	.public-banner {
		position: sticky;
		top: 0;
		z-index: 20;
		background: var(--an-surface-raised);
		border-bottom: 1px solid var(--hairline);
	}
	.public-banner-inner {
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
	.public-banner-text {
		font-size: 0.85rem;
		color: var(--text-muted);
		flex: 1 1 220px;
	}
	.ghost {
		font: inherit;
		font-size: 0.85rem;
		text-decoration: none;
		border-radius: var(--radius-button);
		padding: 0.4rem 0.9rem;
		white-space: nowrap;
		cursor: pointer;
		flex-shrink: 0;
		/* Family secondary button: hairline border, transparent background —
		   the demo banner's anatomy applies to every app-specific action here
		   too (DESIGN.md: "App-specific actions may differ; their styling may
		   not"). */
		color: var(--accent-strong);
		border: 1px solid var(--hairline-strong);
		background: transparent;
	}
	@media (max-width: 520px) {
		.public-banner-inner {
			padding: 0.55rem 0.75rem;
		}
	}
</style>
