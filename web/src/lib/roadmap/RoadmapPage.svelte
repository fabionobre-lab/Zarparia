<script lang="ts">
	import { t, locale, formatDate } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import { roadmap, roadmapLocaleKey, STATUS_ORDER } from './roadmap';
	import type { RoadmapStatus } from './types';

	const key = $derived(roadmapLocaleKey(locale()));

	const STATUS_LABEL: Record<RoadmapStatus, keyof Messages> = {
		shipped: 'roadmap.statusShipped',
		building: 'roadmap.statusBuilding',
		planned: 'roadmap.statusPlanned'
	};

	const grouped = $derived(
		STATUS_ORDER.map((status) => ({
			status,
			items: roadmap.items.filter((it) => it.status === status)
		})).filter((g) => g.items.length > 0)
	);
</script>

<svelte:head>
	<title>{t('roadmap.pageTitle')}</title>
</svelte:head>

<main>
	<a class="back" href="/">{t('legal.back')}</a>
	<h1>{t('roadmap.heading')}</h1>
	<p class="updated">{t('legal.lastUpdated')}: {formatDate(roadmap.updated)}</p>
	<p class="intro">{t('roadmap.intro')}</p>

	{#each grouped as group (group.status)}
		<section class="group">
			<h2 class="status {group.status}">{t(STATUS_LABEL[group.status])}</h2>
			<ul>
				{#each group.items as item (item.id)}
					<li>
						<span class="item-title">{item.title[key]}</span>
						{#if item.note}<span class="item-note">{item.note[key]}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</main>

<style>
	main {
		font-family: var(--font-ui);
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
		margin: 0 0 1.1rem;
	}
	.intro {
		font-size: var(--type-body);
		line-height: 1.6;
		color: var(--text);
		margin: 0 0 1.75rem;
	}
	.group {
		margin-bottom: 1.9rem;
	}
	.group h2 {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.25rem 0.65rem;
		border-radius: var(--radius-pill);
		margin: 0 0 0.9rem;
	}
	.status.shipped {
		background: var(--pill-go-bg);
		color: var(--pill-go-fg);
	}
	.status.building {
		background: var(--pill-info-bg);
		color: var(--pill-info-fg);
	}
	.status.planned {
		background: var(--pill-neutral-bg);
		color: var(--pill-neutral-fg);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	li {
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: var(--radius-md);
		padding: 0.7rem 0.9rem;
	}
	.item-title {
		display: block;
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--text);
	}
	.item-note {
		display: block;
		font-size: 0.82rem;
		color: var(--text-muted);
		margin-top: 0.2rem;
		line-height: 1.5;
	}
</style>
