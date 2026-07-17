<script lang="ts">
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { t } from '$lib/i18n/store.svelte';
	import { locale } from '$lib/i18n/store.svelte';
	import type { AdminUserRow } from '$lib/server/users';
	import EmptyState from '$lib/ui/empty/EmptyState.svelte';

	let { data } = $props();

	/** D1's `datetime('now')` is UTC, space-separated ("2026-07-16 12:34:56") —
	 *  not the plain-date ISO string the shared formatDate() expects, so this
	 *  page formats its own date+time timestamps locally. */
	function formatDateTime(sqlDateTime: string): string {
		const d = new Date(sqlDateTime.replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return sqlDateTime;
		return new Intl.DateTimeFormat(locale(), {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(d);
	}

	function initials(row: AdminUserRow): string {
		const src = row.name ?? row.email;
		return src.trim().slice(0, 1).toUpperCase();
	}
</script>

<svelte:head>
	<title>{t('admin.approvals.pageTitle')}</title>
</svelte:head>

<main>
	<a class="back" href="/">{t('feedback.back')}</a>
	<h1>{t('admin.approvals.heading')}</h1>

	<section>
		<h2>{t('admin.approvals.pendingHeading')}</h2>
		{#if data.pending.length === 0}
			<EmptyState kind="approvals"><p>{t('admin.approvals.pendingEmpty')}</p></EmptyState>
		{:else}
			<ul class="list">
				{#each data.pending as row (row.id)}
					<li class="item">
						<div class="who">
							{#if row.avatarUrl}
								<img class="avatar" src={row.avatarUrl} alt="" width="36" height="36" />
							{:else}
								<span class="avatar avatar-fallback">{initials(row)}</span>
							{/if}
							<div class="who-text">
								<span class="name">{row.name ?? row.email}</span>
								{#if row.name}<span class="email">{row.email}</span>{/if}
								<span class="date">{t('admin.approvals.requestedLabel', { date: formatDateTime(row.createdAt) })}</span>
							</div>
						</div>
						<div class="actions">
							<form method="POST" action="?/decide">
								<input type="hidden" name="userId" value={row.id} />
								<input type="hidden" name="status" value="approved" />
								<button type="submit" class="approve">{t('admin.approvals.approve')}</button>
							</form>
							<form method="POST" action="?/decide">
								<input type="hidden" name="userId" value={row.id} />
								<input type="hidden" name="status" value="rejected" />
								<button type="submit" class="reject">{t('admin.approvals.reject')}</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h2>{t('admin.approvals.recentHeading')}</h2>
		{#if data.recent.length === 0}
			<EmptyState kind="approvals"><p>{t('admin.approvals.recentEmpty')}</p></EmptyState>
		{:else}
			<ul class="list">
				{#each data.recent as row (row.id)}
					<li class="item">
						<div class="who">
							{#if row.avatarUrl}
								<img class="avatar" src={row.avatarUrl} alt="" width="36" height="36" />
							{:else}
								<span class="avatar avatar-fallback">{initials(row)}</span>
							{/if}
							<div class="who-text">
								<span class="name">{row.name ?? row.email}</span>
								{#if row.name}<span class="email">{row.email}</span>{/if}
								<span class="date">
									<span class="chip {row.status}">
										{row.status === 'approved' ? t('admin.approvals.statusApproved') : t('admin.approvals.statusRejected')}
									</span>
									{#if row.approvedAt}
										{t('admin.approvals.decidedLabel', { date: formatDateTime(row.approvedAt) })}
									{/if}
								</span>
							</div>
						</div>
						<div class="actions">
							<form method="POST" action="?/decide">
								<input type="hidden" name="userId" value={row.id} />
								<input type="hidden" name="status" value="pending" />
								<button type="submit" class="undo">{t('admin.approvals.undo')}</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />

<style>
	main {
		font-family: var(--font-ui);
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
		margin: 0.5rem 0 1.5rem;
	}
	section {
		margin-bottom: 2rem;
	}
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.75rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: var(--radius-lg);
		padding: 0.7rem 0.9rem;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}
	.avatar {
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		object-fit: cover;
		background: var(--surface-sunken);
	}
	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-muted);
	}
	.who-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.email {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.date {
		font-size: 0.75rem;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.chip {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-pill);
	}
	.chip.approved {
		background: var(--pill-go-bg);
		color: var(--pill-go-fg);
	}
	.chip.rejected {
		background: var(--pill-neutral-bg);
		color: var(--pill-neutral-fg);
	}
	.actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}
	.actions form {
		margin: 0;
	}
	.approve,
	.reject,
	.undo {
		font: inherit;
		font-size: 0.82rem;
		padding: 0.4rem 0.8rem;
		border-radius: var(--radius-button);
		cursor: pointer;
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		color: var(--text);
	}
	.approve {
		border-color: transparent;
		background: var(--pill-go-bg);
		color: var(--pill-go-fg);
	}
	.reject {
		border-color: transparent;
		background: var(--pill-warn-bg);
		color: var(--pill-warn-fg);
	}
	.undo:hover,
	.approve:hover,
	.reject:hover {
		filter: brightness(0.95);
	}
</style>
