<script lang="ts">
	import LegalPage from '$lib/legal/LegalPage.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { terms } from '$lib/legal/terms';
	import { t, locale } from '$lib/i18n/store.svelte';

	let { data } = $props();

	const doc = $derived(terms[locale()]);
</script>

<LegalPage {doc} pageTitle={t('terms.pageTitle')} />

<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />
