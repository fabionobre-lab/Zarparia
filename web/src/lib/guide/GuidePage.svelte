<script lang="ts">
	import { t } from '$lib/i18n/store.svelte';
	import type { GuideDoc } from './types';

	let { doc, pageTitle }: { doc: GuideDoc; pageTitle: string } = $props();
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<main>
	<a class="back" href="/">{t('legal.back')}</a>
	<h1>{t('guide.heading')}</h1>
	<p class="intro">{doc.intro}</p>

	<nav class="toc" aria-label={t('guide.tocLabel')}>
		{#each doc.groups as group (group.id)}
			<a href="#{group.id}">{group.heading}</a>
		{/each}
	</nav>

	{#each doc.groups as group (group.id)}
		<section class="group" id={group.id}>
			<h2>{group.heading}</h2>
			{#each group.entries as entry (entry.id)}
				<article class="entry" id={entry.id}>
					<h3>
						<a class="anchor" href="#{entry.id}">{entry.title}</a>
					</h3>
					{#each entry.body as p}<p>{p}</p>{/each}
				</article>
			{/each}
		</section>
	{/each}

	<p class="footer-link">
		<a href="/roadmap">{t('nav.roadmap')} →</a>
	</p>
</main>

<style>
	main {
		font-family: var(--font-ui);
		max-width: 720px;
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
	.intro {
		font-size: var(--type-body);
		line-height: 1.6;
		color: var(--text-muted);
		margin: 0 0 1.5rem;
	}
	.toc {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.9rem;
		background: var(--surface);
		border-top: 1px solid var(--hairline);
		border-bottom: 1px solid var(--hairline);
		padding: 0.7rem 0.2rem;
		margin: 0 0 1.75rem;
	}
	.toc a {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--accent-strong);
		text-decoration: none;
		white-space: nowrap;
	}
	.toc a:hover {
		text-decoration: underline;
	}
	.group {
		margin: 2.25rem 0 0;
		padding-top: 0.75rem;
		scroll-margin-top: 3.5rem;
	}
	.group h2 {
		font-size: 1.2rem;
		margin: 0 0 0.9rem;
		color: var(--text);
	}
	.entry {
		margin-bottom: 1.6rem;
		scroll-margin-top: 3.5rem;
	}
	.entry:last-child {
		margin-bottom: 0;
	}
	.entry h3 {
		font-size: 1rem;
		margin: 0 0 0.4rem;
	}
	.entry h3 .anchor {
		color: var(--text);
		text-decoration: none;
	}
	.entry h3 .anchor:hover {
		color: var(--accent-strong);
		text-decoration: underline;
	}
	.entry p {
		font-size: 0.92rem;
		line-height: 1.65;
		color: var(--text);
		margin: 0 0 0.6rem;
	}
	.entry p:last-child {
		margin-bottom: 0;
	}
	.footer-link {
		margin-top: 2.5rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--hairline);
		font-size: 0.85rem;
	}
	.footer-link a {
		color: var(--accent-strong);
		text-decoration: none;
	}
	.footer-link a:hover {
		text-decoration: underline;
	}
</style>
