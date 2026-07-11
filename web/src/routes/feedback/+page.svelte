<script lang="ts">
	import { formatDate, t } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import type { FeedbackAdminRow, FeedbackRow, FeedbackStatus } from '$lib/feedback';
	import { FEEDBACK_STATUSES } from '$lib/feedback';

	let { data } = $props();

	// Local, mutable copy so the admin status <select> can update optimistically.
	// Seeded from load data once; the page reloads on navigation so this is fine.
	// svelte-ignore state_referenced_locally
	let items = $state<(FeedbackRow | FeedbackAdminRow)[]>(data.items);

	const TYPE_KEY: Record<string, keyof Messages> = {
		bug: 'feedback.typeBug',
		idea: 'feedback.typeIdea',
		other: 'feedback.typeOther'
	};
	const STATUS_KEY: Record<FeedbackStatus, keyof Messages> = {
		new: 'feedback.statusNew',
		planned: 'feedback.statusPlanned',
		done: 'feedback.statusDone',
		dismissed: 'feedback.statusDismissed'
	};

	/** Epoch ms → 'YYYY-MM-DD' so the locale-aware formatDate can render it. */
	function isoDate(ms: number): string {
		return new Date(ms).toISOString().slice(0, 10);
	}

	function submitter(item: FeedbackRow | FeedbackAdminRow): string {
		const a = item as FeedbackAdminRow;
		return a.userName ?? a.userEmail;
	}

	async function changeStatus(item: FeedbackRow | FeedbackAdminRow, e: Event) {
		const next = (e.currentTarget as HTMLSelectElement).value as FeedbackStatus;
		const prev = item.status;
		item.status = next; // optimistic
		try {
			const res = await fetch(`/api/feedback/${item.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: next })
			});
			if (!res.ok) item.status = prev; // revert
		} catch {
			item.status = prev; // revert
		}
	}
</script>

<svelte:head>
	<title>{t('feedback.pageTitle')}</title>
</svelte:head>

<main>
	<a class="back" href="/">{t('feedback.back')}</a>
	<h1>{data.admin ? t('feedback.adminHeading') : t('feedback.heading')}</h1>

	{#if items.length === 0}
		<p class="empty">{t('feedback.empty')}</p>
	{:else}
		<ul class="list">
			{#each items as item (item.id)}
				<li class="item">
					<div class="top">
						<span class="badge {item.type}">{t(TYPE_KEY[item.type])}</span>
						{#if data.admin}
							<span class="who">{submitter(item)}</span>
						{/if}
						<span class="date">{formatDate(isoDate(item.createdAt))}</span>
						{#if data.admin}
							<select
								class="status-sel"
								aria-label={t('feedback.statusLabel')}
								value={item.status}
								onchange={(e) => changeStatus(item, e)}
							>
								{#each FEEDBACK_STATUSES as s (s)}
									<option value={s}>{t(STATUS_KEY[s])}</option>
								{/each}
							</select>
						{:else}
							<span class="chip {item.status}">{t(STATUS_KEY[item.status])}</span>
						{/if}
					</div>
					<p class="msg">{item.message}</p>
					{#if item.page}<span class="page">{item.page}</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 760px;
		margin: 2rem auto;
		padding: 0 1.5rem;
		color: var(--text);
	}
	.back {
		font-size: 0.8rem;
		text-decoration: none;
		color: var(--text-muted);
	}
	h1 {
		font-size: var(--type-h1);
		margin: 0.5rem 0 1.25rem;
	}
	.empty {
		color: var(--text-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.item {
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: 12px;
		padding: 0.8rem 1rem;
	}
	.top {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.badge {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: var(--pill-neutral-bg);
		color: var(--pill-neutral-fg);
	}
	.badge.bug {
		background: var(--pill-bug-bg);
		color: var(--pill-bug-fg);
	}
	.badge.idea {
		background: var(--pill-info-bg);
		color: var(--pill-info-fg);
	}
	.badge.other {
		background: var(--pill-neutral-bg);
		color: var(--pill-neutral-fg);
	}
	.who {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text);
	}
	.date {
		font-size: 0.78rem;
		color: var(--text-muted);
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}
	.chip {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: var(--pill-neutral-bg);
		color: var(--pill-neutral-fg);
	}
	.chip.new {
		background: var(--pill-info-bg);
		color: var(--pill-info-fg);
	}
	.chip.planned {
		background: var(--pill-warn-bg);
		color: var(--pill-warn-fg);
	}
	.chip.done {
		background: var(--pill-go-bg);
		color: var(--pill-go-fg);
	}
	.chip.dismissed {
		background: var(--pill-neutral-bg);
		color: var(--pill-neutral-fg);
	}
	.status-sel {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
	}
	.msg {
		margin: 0.6rem 0 0;
		font-size: 0.92rem;
		line-height: 1.5;
		white-space: pre-wrap;
	}
	.page {
		display: inline-block;
		margin-top: 0.5rem;
		font-size: 0.72rem;
		color: var(--text-muted);
		font-family: ui-monospace, monospace;
	}
</style>
