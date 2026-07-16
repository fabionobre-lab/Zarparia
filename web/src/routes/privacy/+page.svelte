<script lang="ts">
	import LegalPage from '$lib/legal/LegalPage.svelte';
	import { privacy } from '$lib/legal/privacy';
	import { t, locale } from '$lib/i18n/store.svelte';

	const doc = $derived(privacy[locale()]);
</script>

<LegalPage {doc} pageTitle={t('privacy.pageTitle')} />
