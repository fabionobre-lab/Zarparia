<script lang="ts">
	import { t, formatDate } from '$lib/i18n/store.svelte';
	import type { LegalDoc } from './types';

	let { doc, pageTitle }: { doc: LegalDoc; pageTitle: string } = $props();
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<main>
	<a class="back" href="/">{t('legal.back')}</a>
	<h1>{doc.title}</h1>
	<p class="updated">{t('legal.lastUpdated')}: {formatDate('2026-07-16')}</p>

	{#each doc.intro as p}<p class="intro">{p}</p>{/each}

	{#each doc.sections as section (section.id)}
		<section>
			<h2>{section.heading}</h2>
			{#each section.paragraphs as p}<p>{p}</p>{/each}
			{#if section.bullets}
				<ul>
					{#each section.bullets as b}<li>{b}</li>{/each}
				</ul>
			{/if}
		</section>
	{/each}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 680px;
		margin: 2rem auto;
		padding: 0 1.5rem 4rem;
		color: var(--text);
	}
	.back {
		font-size: 0.8rem;
		text-decoration: none;
		color: var(--text-muted);
	}
	h1 {
		font-size: var(--type-h1);
		margin: 0.5rem 0 0.35rem;
	}
	.updated {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0 0 1.75rem;
	}
	.intro {
		font-size: var(--type-body);
		line-height: 1.6;
		color: var(--text);
		margin: 0 0 1.75rem;
	}
	section {
		margin-bottom: 1.9rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0 0 0.6rem;
		color: var(--text);
	}
	section p {
		font-size: 0.95rem;
		line-height: 1.65;
		color: var(--text);
		margin: 0 0 0.85rem;
	}
	section p:last-child {
		margin-bottom: 0;
	}
	ul {
		margin: 0.6rem 0 0.85rem;
		padding-left: 1.3rem;
	}
	li {
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--text);
		margin-bottom: 0.4rem;
	}
	li:last-child {
		margin-bottom: 0;
	}
</style>
