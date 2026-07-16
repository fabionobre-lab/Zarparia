<script lang="ts">
	import TripEditor from '$lib/editor/TripEditor.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import type { Trip } from '$lib/trip-engine';
	import { t } from '$lib/i18n/store.svelte';
	let { data } = $props();

	const trip = $derived(data.trip as unknown as Trip);
	const tripTitle = $derived(trip.title?.[trip.defaultLanguage] ?? Object.values(trip.title ?? {})[0] ?? data.tripId);
</script>

<svelte:head>
	<title>{t('editor.editLabel')}: {tripTitle} — Zarparia</title>
</svelte:head>

<TripEditor initial={data.trip as unknown as Trip} mode="edit" tripId={data.tripId} baseUpdatedAt={data.updatedAt} />

<!-- Editor keeps its own sticky-top Cancel/Save bar; the bottom bar only adds
     Trips + More and auto-hides while the on-screen keyboard is open (see the
     visualViewport heuristic in BottomBar), so form fields stay unobstructed. -->
<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />
