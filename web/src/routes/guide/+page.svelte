<script lang="ts">
	import GuidePage from '$lib/guide/GuidePage.svelte';
	import { guide } from '$lib/guide/content';
	import { t, locale } from '$lib/i18n/store.svelte';

	const doc = $derived(guide[locale()]);
</script>

<GuidePage {doc} pageTitle={t('guide.pageTitle')} />
