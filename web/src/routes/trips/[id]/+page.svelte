<script lang="ts">
	import TripView from '$lib/TripView.svelte';
	import SharePanel from '$lib/SharePanel.svelte';
	import type { Trip } from '$lib/trip-engine';
	let { data } = $props();

	let showShare = $state(false);
</script>

<div class="page">
	<div class="bar">
		<a class="back" href="/">← All trips</a>
		<div class="actions">
			{#if data.role === 'owner'}
				<button class="btn" onclick={() => (showShare = !showShare)}>{showShare ? 'Close' : 'Share'}</button>
			{:else}
				<span class="role">Shared · {data.role === 'editor' ? 'can edit' : 'view only'}</span>
			{/if}
			{#if data.role === 'owner' || data.role === 'editor'}
				<a class="btn" href="/trips/{data.trip.id}/edit">Edit</a>
			{/if}
		</div>
	</div>

	{#if showShare && data.role === 'owner'}
		<SharePanel tripId={data.trip.id} />
	{/if}

	{#key data.trip.id}
		<TripView trip={data.trip as unknown as Trip} />
	{/key}
</div>

<style>
	.page {
		padding: 1rem 0.5rem 2rem;
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
		color: #2b4a2b;
		font-family: system-ui, sans-serif;
	}
	.btn {
		border: 1px solid #cbb;
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
		background: #faf6ee;
		cursor: pointer;
	}
	.role {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #7a5a10;
		background: #f5edd5;
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
	}
</style>
