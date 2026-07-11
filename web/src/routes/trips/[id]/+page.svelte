<script lang="ts">
	import { untrack } from 'svelte';
	import TripView from '$lib/TripView.svelte';
	import SharePanel from '$lib/SharePanel.svelte';
	import { loc, type Trip } from '$lib/trip-engine';
	import { t } from '$lib/i18n/store.svelte';
	let { data } = $props();

	let showShare = $state(false);

	// Mirrors TripView's internal language selection so the document title
	// tracks the language the visitor is currently viewing.
	let lang = $state(untrack(() => (data.trip as unknown as Trip).defaultLanguage));
	$effect(() => {
		// Re-seed when navigating to a different trip (component below remounts via #key).
		data.trip.id;
		lang = (data.trip as unknown as Trip).defaultLanguage || (data.trip as unknown as Trip).languages[0];
	});
	const pageTitle = $derived(`${loc(data.trip as unknown as Trip, (data.trip as unknown as Trip).title, lang)} — Trips`);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="page">
	<div class="bar">
		<a class="back" href="/">{t('tripbar.allTrips')}</a>
		<div class="actions">
			{#if data.role === 'owner'}
				<button class="btn" onclick={() => (showShare = !showShare)}>{showShare ? t('tripbar.close') : t('tripbar.share')}</button>
			{:else}
				<span class="role">{t('tripbar.shared')} · {data.role === 'editor' ? t('role.canEdit') : t('role.viewOnly')}</span>
			{/if}
			{#if data.role === 'owner' || data.role === 'editor'}
				<a class="btn" href="/trips/{data.trip.id}/edit">{t('tripbar.edit')}</a>
			{/if}
		</div>
	</div>

	{#if showShare && data.role === 'owner'}
		<SharePanel tripId={data.trip.id} />
	{/if}

	{#key data.trip.id}
		<TripView trip={data.trip as unknown as Trip} bind:lang />
	{/key}
</div>

<style>
	.page {
		padding: 1rem 0.5rem 2rem;
		min-height: calc(100vh - 60px);
		background: var(--surface-sunken);
	}
	.bar {
		max-width: 430px;
		margin: 0 auto 0.75rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-family: system-ui, sans-serif;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.back,
	.btn {
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--accent-strong);
		font-family: system-ui, sans-serif;
	}
	.btn {
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		background: var(--surface);
		cursor: pointer;
	}
	.role {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pill-warn-fg);
		background: var(--pill-warn-bg);
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
	}
</style>
