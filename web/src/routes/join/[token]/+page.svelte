<script lang="ts">
	import { t } from '$lib/i18n/store.svelte';

	let { data }: { data: { state: 'dev-login'; devLoginUrl: string } | { state: 'invalid' } } =
		$props();
</script>

<div class="panel">
	{#if data.state === 'dev-login'}
		<h1>{t('join.signInHeading')}</h1>
		<p>{t('join.signInBody')}</p>
		<a class="btn" href={data.devLoginUrl}>{t('join.signInDev')}</a>
	{:else}
		<h1>{t('join.invalidHeading')}</h1>
		<p>{t('join.invalidBody')}</p>
		<a class="btn" href="/">{t('join.goToTrips')}</a>
	{/if}
</div>

<style>
	.panel {
		max-width: 430px;
		margin: 3rem auto;
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: 12px;
		padding: 1.4rem 1.2rem;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	h1 {
		font-size: 1.1rem;
		margin-bottom: 0.6rem;
		color: var(--accent-strong);
	}
	p {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin-bottom: 1rem;
	}
	.btn {
		display: inline-block;
		font-size: 0.85rem;
		text-decoration: none;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: #fff;
		border-radius: 8px;
		padding: 0.5rem 1rem;
	}
</style>
