<script lang="ts">
	// Generic shimmer placeholder block (Phase 3 task 4). Used to build
	// layout-matching skeletons for the home trip list and TripView's day
	// content — NOT meant for minor widgets (per the task brief, only those
	// two initial content loads get skeletons).
	let {
		width = '100%',
		height = '1em',
		radius,
		circle = false
	}: {
		width?: string;
		height?: string;
		radius?: string;
		circle?: boolean;
	} = $props();
</script>

<span
	class="skeleton"
	class:circle
	style:width
	style:height
	style:border-radius={circle ? '50%' : (radius ?? 'var(--radius-sm)')}
	aria-hidden="true"
></span>

<style>
	.skeleton {
		display: block;
		background: var(--surface-sunken);
		position: relative;
		overflow: hidden;
	}
	@media (prefers-reduced-motion: no-preference) {
		.skeleton::after {
			content: '';
			position: absolute;
			inset: 0;
			transform: translateX(-100%);
			background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--text) 8%, transparent), transparent);
			animation: shimmer 1.6s ease-in-out infinite;
		}
	}
	@keyframes shimmer {
		100% {
			transform: translateX(100%);
		}
	}
</style>
