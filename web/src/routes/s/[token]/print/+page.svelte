<script lang="ts">
	import { untrack } from 'svelte';
	import TripPrint from '$lib/TripPrint.svelte';
	import { loc, type Trip } from '$lib/trip-engine';

	// One document per page load, no in-place trip navigation — read once.
	let { data } = $props();
	const trip = untrack(() => data.trip as unknown as Trip);
	const lang = untrack(() => data.lang) || trip.defaultLanguage || trip.languages[0];
	const pageTitle = `${loc(trip, trip.title, lang)} — Zarparia`;
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="print-page">
	<TripPrint {trip} {lang} backHref={`/s/${data.token}`} />
</div>

<style>
	.print-page {
		min-height: 100vh;
		background: var(--surface-sunken);
		padding: 18px 12px 40px;
	}
	@media print {
		.print-page {
			background: #fff;
			padding: 0;
			min-height: 0;
		}
	}
</style>
