<script lang="ts">
	import RoadmapPage from '$lib/roadmap/RoadmapPage.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { t } from '$lib/i18n/store.svelte';

	let { data } = $props();
</script>

<RoadmapPage />

<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />
