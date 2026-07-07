<script lang="ts">
	import TripEditor from '$lib/editor/TripEditor.svelte';
	import type { Trip } from '$lib/trip-engine';
	let { data } = $props();
</script>

<TripEditor initial={data.trip as unknown as Trip} mode="edit" tripId={data.tripId} baseUpdatedAt={data.updatedAt} />
