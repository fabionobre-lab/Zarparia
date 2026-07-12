<script lang="ts">
	import TripEditor from '$lib/editor/TripEditor.svelte';
	import type { Trip } from '$lib/trip-engine';
	import { t } from '$lib/i18n/store.svelte';
	let { data } = $props();

	const trip = $derived(data.trip as unknown as Trip);
	const tripTitle = $derived(trip.title?.[trip.defaultLanguage] ?? Object.values(trip.title ?? {})[0] ?? data.tripId);
</script>

<svelte:head>
	<title>{t('editor.editLabel')}: {tripTitle} — geornada</title>
</svelte:head>

<TripEditor initial={data.trip as unknown as Trip} mode="edit" tripId={data.tripId} baseUpdatedAt={data.updatedAt} />
