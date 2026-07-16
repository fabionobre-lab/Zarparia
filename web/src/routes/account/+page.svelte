<script lang="ts">
	import { t, locale } from '$lib/i18n/store.svelte';

	let { data } = $props();
	// This page never re-navigates without a full reload (deletion redirects
	// away, and the load guard already redirected anything else), so a
	// one-time read of the load payload is intentional here.
	// svelte-ignore state_referenced_locally
	const user = data.user;

	function initials(): string {
		const src = user.name ?? user.email;
		return src.trim().slice(0, 1).toUpperCase();
	}

	/** D1's `datetime('now')` default is UTC, space-separated
	 *  ("2026-07-16 12:34:56") — normalize before handing it to Intl. */
	function formatDate(sqlDateTime: string): string {
		const d = new Date(sqlDateTime.includes('T') ? sqlDateTime : sqlDateTime.replace(' ', 'T') + 'Z');
		if (Number.isNaN(d.getTime())) return sqlDateTime;
		return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
	}

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let confirmText = $state('');
	let busy = $state(false);
	let error = $state('');

	const expectedEmail = user.email.trim().toLowerCase();
	const canConfirm = $derived.by(() => {
		const v = confirmText.trim().toLowerCase();
		return v === 'delete' || v === expectedEmail;
	});

	function openDialog() {
		confirmText = '';
		error = '';
		dialogEl?.showModal();
	}
	function closeDialog() {
		dialogEl?.close();
	}

	async function confirmDelete(e: Event) {
		e.preventDefault();
		if (!canConfirm || busy) return;
		busy = true;
		error = '';
		try {
			const res = await fetch('/api/account', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ confirm: confirmText.trim() })
			});
			if (res.ok) {
				// The account (and its session row) is gone server-side; land on the
				// signed-out home with a brief notice rather than staying on a page
				// whose data no longer exists.
				location.href = '/?accountDeleted=1';
				return;
			}
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			error = body.error ?? t('account.deleteError');
		} catch {
			error = t('account.deleteError');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{t('account.pageTitle')}</title>
</svelte:head>

<main>
	<a class="back" href="/">{t('feedback.back')}</a>
	<h1>{t('account.heading')}</h1>

	<section class="profile">
		{#if user.avatarUrl}
			<img class="avatar" src={user.avatarUrl} alt="" width="56" height="56" />
		{:else}
			<span class="avatar avatar-fallback">{initials()}</span>
		{/if}
		<div class="profile-text">
			<span class="name">{user.name ?? user.email}</span>
			{#if user.name}<span class="email">{user.email}</span>{/if}
		</div>
	</section>

	<section>
		<h2>{t('account.yourDataHeading')}</h2>
		<p class="hint">{t('account.exportDescription')}</p>
		<a class="export-btn" href="/api/account/export">{t('account.exportButton')}</a>
	</section>

	<section class="danger">
		<h2>{t('account.dangerHeading')}</h2>
		<p class="hint">{t('account.dangerDescription')}</p>
		<button type="button" class="delete-btn" onclick={openDialog}>{t('account.deleteButton')}</button>
	</section>

	<section class="legal">
		<h2>{t('account.legalHeading')}</h2>
		<div class="legal-links">
			<a href="/privacy">{t('legal.privacy')}</a>
			<span aria-hidden="true">·</span>
			<a href="/terms">{t('legal.terms')}</a>
		</div>
	</section>
</main>

<dialog bind:this={dialogEl} class="confirm-dialog" aria-labelledby="del-title">
	<form onsubmit={confirmDelete}>
		<h2 id="del-title">{t('account.deleteDialogTitle')}</h2>
		<p class="warning">{t('account.deleteWarning')}</p>
		<label class="confirm-label" for="confirm-input">{t('account.deleteConfirmLabel')}</label>
		<input
			id="confirm-input"
			type="text"
			bind:value={confirmText}
			placeholder={t('account.deleteConfirmPlaceholder')}
			autocomplete="off"
			spellcheck="false"
			disabled={busy}
		/>
		{#if error}<p class="err" role="alert">{error}</p>{/if}
		<div class="dialog-actions">
			<button type="button" class="cancel" onclick={closeDialog} disabled={busy}>
				{t('account.deleteCancel')}
			</button>
			<button type="submit" class="confirm" disabled={!canConfirm || busy}>
				{busy ? t('account.deleting') : t('account.deleteConfirmButton')}
			</button>
		</div>
	</form>
</dialog>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 640px;
		margin: 2rem auto;
		padding: 0 1.5rem 3rem;
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
		margin: 0 0 0.5rem;
	}
	.hint {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0 0 0.9rem;
		line-height: 1.5;
	}
	.profile {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: 12px;
		padding: 1rem 1.1rem;
	}
	.avatar {
		flex-shrink: 0;
		width: 56px;
		height: 56px;
		border-radius: 999px;
		object-fit: cover;
		background: var(--surface-sunken);
	}
	.avatar-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.3rem;
		font-weight: 700;
		color: var(--text-muted);
	}
	.profile-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		font-weight: 700;
		font-size: 1rem;
	}
	.email {
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.export-btn {
		display: inline-flex;
		align-items: center;
		font-size: 0.88rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--accent-strong);
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
	}
	.export-btn:hover {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.danger {
		border: 1px solid var(--pill-bug-fg);
		border-radius: 12px;
		padding: 1rem 1.1rem;
		background: var(--pill-bug-bg);
	}
	.danger h2,
	.danger .hint {
		color: var(--pill-bug-fg);
	}
	.delete-btn {
		font: inherit;
		font-size: 0.88rem;
		font-weight: 600;
		background: var(--pill-bug-fg);
		color: var(--surface);
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
		cursor: pointer;
	}
	.delete-btn:hover {
		filter: brightness(0.92);
	}
	.legal {
		margin-bottom: 0;
	}
	.legal h2 {
		font-size: 0.95rem;
		color: var(--text-muted);
	}
	.legal-links {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	.legal-links a {
		color: var(--accent-strong);
		text-decoration: none;
	}
	.legal-links a:hover {
		text-decoration: underline;
	}
	.legal-links span {
		color: var(--text-muted);
	}

	.confirm-dialog {
		box-sizing: border-box;
		width: min(440px, calc(100vw - 2rem));
		border: 1px solid var(--hairline-strong);
		border-radius: 14px;
		padding: 1.1rem 1.2rem;
		background: var(--surface);
		color: var(--text);
		font-family: system-ui, sans-serif;
	}
	.confirm-dialog::backdrop {
		background: rgba(10, 7, 3, 0.55);
	}
	.confirm-dialog h2 {
		font-size: 1.05rem;
		margin: 0 0 0.6rem;
	}
	.warning {
		font-size: 0.85rem;
		line-height: 1.5;
		color: var(--text-muted);
		margin: 0 0 1rem;
	}
	.confirm-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		margin-bottom: 0.35rem;
	}
	.confirm-dialog input {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.9rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
	}
	.confirm-dialog input:focus {
		outline: 2px solid var(--accent-strong);
		outline-offset: 1px;
	}
	.err {
		color: var(--pill-bug-fg);
		font-size: 0.82rem;
		margin: 0.6rem 0 0;
	}
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.cancel,
	.confirm {
		font: inherit;
		font-size: 0.88rem;
		border-radius: 999px;
		padding: 0.5rem 1.1rem;
		cursor: pointer;
	}
	.cancel {
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		color: var(--text);
	}
	.confirm {
		background: var(--pill-bug-fg);
		border: none;
		color: var(--surface);
	}
	.confirm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
