<script lang="ts">
	// Loading placeholder for TripView's day content (Phase 3 task 4) — shown
	// by the root layout while a client-side navigation to /trips/[id] is in
	// flight. Shape mirrors a day's timeline: a day-header bar followed by a
	// few time + title + description rows.
	import Skeleton from '../Skeleton.svelte';
</script>

<div class="day-skel" aria-hidden="true">
	<Skeleton height="1.4rem" width="45%" radius="var(--radius-sm)" />
	<Skeleton height="0.85rem" width="70%" radius="var(--radius-sm)" />
	{#each Array.from({ length: 4 }) as _, i (i)}
		<div class="block-row">
			<Skeleton height="2.2rem" width="2.2rem" circle />
			<div class="block-text">
				<Skeleton height="0.55rem" width="3.5rem" radius="var(--radius-sm)" />
				<Skeleton height="0.95rem" width="80%" radius="var(--radius-sm)" />
				<Skeleton height="0.8rem" width="55%" radius="var(--radius-sm)" />
			</div>
		</div>
	{/each}
</div>

<style>
	.day-skel {
		max-width: 640px;
		margin: 0 auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.block-row {
		display: flex;
		align-items: flex-start;
		gap: 0.8rem;
	}
	.block-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 0.1rem;
	}
</style>
