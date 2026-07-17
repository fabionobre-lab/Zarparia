<script lang="ts">
	// Branded error boundary — reuses the gate-card visual language from the
	// pending-approval screen in routes/+page.svelte (same crest/card/centered
	// layout), so an error still reads as "part of the app" rather than a bare
	// browser error page. Must render for signed-out visitors (it can appear on
	// public routes) and stay on house tokens only, no hardcoded colors, so it
	// works in dark mode too.
	import { page } from '$app/state';
	import { t } from '$lib/i18n/store.svelte';
	import crestSvg from '$lib/assets/zarparia-crest.svg?raw';

	const isNotFound = $derived(page.status === 404);
	const title = $derived(isNotFound ? t('error.pageTitle404') : t('error.pageTitleGeneric'));
	const heading = $derived(isNotFound ? t('error.notFoundHeading') : t('error.genericHeading'));
	const body = $derived(isNotFound ? t('error.notFoundBody') : t('error.genericBody'));
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main class="error-shell">
	<div class="error-card">
		<span class="error-crest">{@html crestSvg}</span>
		<h1 class="error-heading">{heading}</h1>
		<p class="error-body">{body}</p>
		<a class="error-home" href="/">{t('legal.back')}</a>
	</div>
</main>

<style>
	.error-shell {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100dvh - 6rem);
		padding: 1.5rem 0;
		font-family: var(--font-ui);
	}
	.error-card {
		width: 100%;
		max-width: 420px;
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: var(--radius-lg);
		box-shadow: var(--elevation-2);
		padding: 2rem;
		margin: 0 1.5rem;
		text-align: center;
	}
	.error-crest :global(svg) {
		display: block;
		width: 56px;
		height: 56px;
		margin: 0 auto 1rem;
	}
	.error-heading {
		font-size: var(--type-h1);
		margin: 0 0 0.6rem;
		color: var(--text);
	}
	.error-body {
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0 0 1.5rem;
	}
	.error-home {
		display: inline-block;
		font-size: 0.85rem;
		padding: 0.5rem 1.1rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-button);
		background: var(--surface);
		color: var(--text);
		text-decoration: none;
	}
	.error-home:hover {
		background: var(--surface-sunken);
	}
	@media (max-width: 460px) {
		.error-shell {
			padding: 1rem 0.5rem;
		}
		.error-card {
			padding: 1.5rem 1.25rem;
			border-radius: var(--radius-lg);
			margin: 0;
		}
	}
</style>
