<script lang="ts">
	// Loading placeholder for the home trip list (Phase 3 task 4) — shown by
	// the root layout while a client-side navigation to "/" is in flight (see
	// +layout.svelte's `navigating` check). Shape mirrors +page.svelte's
	// .cards/.card layout: a title + status chip row, then a date line.
	import Skeleton from '../Skeleton.svelte';
</script>

<div class="list-skel" aria-hidden="true">
	{#each Array.from({ length: 3 }) as _, i (i)}
		<div class="row">
			<div class="top">
				<Skeleton height="1.1rem" width="60%" radius="var(--radius-sm)" />
				<Skeleton height="1.4rem" width="4.5rem" radius="var(--radius-pill)" />
			</div>
			<Skeleton height="0.8rem" width="40%" radius="var(--radius-sm)" />
		</div>
	{/each}
</div>

<style>
	.list-skel {
		margin-top: 1.25rem;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	@media (min-width: 1024px) {
		.list-skel {
			grid-template-columns: 1fr 1fr;
		}
	}
	.row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--hairline);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
</style>
