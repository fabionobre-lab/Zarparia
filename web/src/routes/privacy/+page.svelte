<script lang="ts">
	import LegalPage from '$lib/legal/LegalPage.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { privacy } from '$lib/legal/privacy';
	import { t, locale } from '$lib/i18n/store.svelte';

	let { data } = $props();

	const doc = $derived(privacy[locale()]);
</script>

<!-- In-app mirror of the family legal, which is canonical on the house site —
     DESIGN.md Conventions ("Family legal"). Content stays app-specific here
     (the cookie table below names this app's cookies and must stay accurate). -->
<svelte:head>
	<link rel="canonical" href="https://aria-nobre.pages.dev/privacy.html" />
</svelte:head>

<LegalPage {doc} pageTitle={t('privacy.pageTitle')} />

<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />
