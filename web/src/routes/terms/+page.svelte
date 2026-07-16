<script lang="ts">
	import LegalPage from '$lib/legal/LegalPage.svelte';
	import { terms } from '$lib/legal/terms';
	import { t, locale } from '$lib/i18n/store.svelte';

	const doc = $derived(terms[locale()]);
</script>

<LegalPage {doc} pageTitle={t('terms.pageTitle')} />
