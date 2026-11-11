<script lang="ts">
	// Shown on the trip page while the user is in edit mode with no connection.
	// There is no offline write queue yet, so this says plainly that edits are not
	// saved. It lives inside the page's sticky status block, so it sits above the
	// content and can never cover the mobile bottom bar or the day strip.
	import { t } from '$lib/i18n/store.svelte';
</script>

<div class="offline-bar" role="status">{t('offline.bar')}</div>

<style>
	.offline-bar {
		font-family: var(--font-ui);
		font-size: 0.8rem;
		line-height: 1.4;
		padding: 0.45rem 0.8rem;
		border-radius: var(--radius-md);
		background: var(--warn-bg);
		color: var(--warn-fg);
		border-left: 2.5px solid var(--warn-bar);
	}
</style>
