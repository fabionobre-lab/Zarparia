<script lang="ts">
	import LegalPage from '$lib/legal/LegalPage.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { privacy } from '$lib/legal/privacy';
	import { t, locale } from '$lib/i18n/store.svelte';

	let { data } = $props();

	const doc = $derived(privacy[locale()]);
</script>

<LegalPage {doc} pageTitle={t('privacy.pageTitle')} />

<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />
