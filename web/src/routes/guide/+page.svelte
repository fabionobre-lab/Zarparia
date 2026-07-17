<script lang="ts">
	import GuidePage from '$lib/guide/GuidePage.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { guide } from '$lib/guide/content';
	import { t, locale } from '$lib/i18n/store.svelte';

	let { data } = $props();

	const doc = $derived(guide[locale()]);
</script>

<GuidePage {doc} pageTitle={t('guide.pageTitle')} />

<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />
