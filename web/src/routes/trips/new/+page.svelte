<script lang="ts">
	import TripEditor from '$lib/editor/TripEditor.svelte';
	import CreationWizard from '$lib/editor/CreationWizard.svelte';
	import type { Trip } from '$lib/trip-engine';

	// The landing is a two-step creation wizard. "Start from a blank trip" drops
	// straight into the old blank editor; "Create trip" scaffolds a draft and
	// hands it to the same editor for review before the (now working) save.
	let stage = $state<'wizard' | 'blank' | 'editor'>('wizard');
	let scaffolded = $state<Trip | null>(null);

	function onCreate(trip: Trip) {
		scaffolded = trip;
		stage = 'editor';
	}
</script>

<svelte:head>
	<title>New trip — Trips</title>
</svelte:head>

{#if stage === 'wizard'}
	<CreationWizard {onCreate} onBlank={() => (stage = 'blank')} />
{:else if stage === 'blank'}
	<TripEditor initial={null} mode="new" />
{:else}
	<TripEditor initial={scaffolded} mode="new" />
{/if}
