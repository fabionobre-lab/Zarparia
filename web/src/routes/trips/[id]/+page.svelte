<script lang="ts">
	import TripView from '$lib/TripView.svelte';
	import type { Trip } from '$lib/trip-engine';
	let { data } = $props();
</script>

<div class="page">
	<div class="bar">
		<a class="back" href="/">← All trips</a>
		{#if data.role === 'owner' || data.role === 'editor'}
			<a class="edit" href="/trips/{data.trip.id}/edit">Edit</a>
		{/if}
	</div>
	<TripView trip={data.trip as unknown as Trip} />
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
	.back,
	.edit {
		font-size: 0.85rem;
		text-decoration: none;
		color: #2b4a2b;
	}
	.edit {
		border: 1px solid #cbb;
		border-radius: 999px;
		padding: 0.3rem 0.8rem;
	}
</style>
