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
		color: #1a1208;
	}
	.back {
		font-size: 0.8rem;
		text-decoration: none;
		color: #7a6e5f;
	}
	h1 {
		font-size: 1.5rem;
		margin: 0.5rem 0 1.25rem;
	}
	.empty {
		color: #666;
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
		background: #faf6ee;
		border: 1px solid #e2ddd2;
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
		background: #efe9dc;
		color: #6b6153;
	}
	.badge.bug {
		background: #fbe3df;
		color: #8a2b20;
	}
	.badge.idea {
		background: #e3eefb;
		color: #1e3a5f;
	}
	.badge.other {
		background: #ece8e0;
		color: #6b6153;
	}
	.who {
		font-size: 0.82rem;
		font-weight: 600;
		color: #4a4030;
	}
	.date {
		font-size: 0.78rem;
		color: #9a8f7f;
		margin-left: auto;
	}
	.chip {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		background: #ede8e0;
		color: #7a6e5f;
	}
	.chip.new {
		background: #dce8f5;
		color: #1e3a5f;
	}
	.chip.planned {
		background: #f5edd5;
		color: #7a5a10;
	}
	.chip.done {
		background: #daf0e5;
		color: #1a5a34;
	}
	.chip.dismissed {
		background: #ede8e0;
		color: #7a6e5f;
	}
	.status-sel {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.25rem 0.4rem;
		border: 1px solid #d8ccb8;
		border-radius: 6px;
		background: #fff;
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
		color: #9a8f7f;
		font-family: ui-monospace, monospace;
	}
</style>
