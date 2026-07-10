<script lang="ts">
	import TripEditor from '$lib/editor/TripEditor.svelte';
</script>

<svelte:head>
	<title>New trip — Trips</title>
</svelte:head>

<TripEditor initial={null} mode="new" />
