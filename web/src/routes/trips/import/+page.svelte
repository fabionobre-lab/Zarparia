<script lang="ts">
	import { goto } from '$app/navigation';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import { t } from '$lib/i18n/store.svelte';

	let { data } = $props();

	const MAX = 20000;
	const PLACEHOLDER =
		'Paste anything — an email thread, notes, or a sentence. For example:\n\n' +
		'"Two weeks in Italy in September, arriving from Fortaleza in Rome, then Florence, ' +
		'Pisa, Amalfi, Positano, Capri, then Naples and home."';

	let text = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let hint = $state<string | null>(null);

	const tooLong = $derived(text.length > MAX);
	const canSubmit = $derived(text.trim().length > 0 && !tooLong && !busy);

	async function submit() {
		if (!canSubmit) return;
		busy = true;
		error = null;
		hint = null;
		try {
			const res = await fetch('/api/trips/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text })
			});
			if (res.ok) {
				const data = (await res.json()) as { id: string };
				await goto(`/trips/${data.id}/edit`);
				return;
			}
			const e = (await res.json().catch(() => ({}))) as { error?: string };
			// The API's error strings are English; map the known statuses to the
			// active UI language and fall back to the server text for the rest.
			if (res.status === 501) error = t('import.errNotConfigured');
			else if (res.status === 400) error = t('import.errEmpty');
			else if (res.status === 413) error = t('import.errTooLong');
			else if (res.status === 422) error = e.error ?? t('import.err422');
			else error = e.error ?? t('import.errFailed', { status: res.status });
			if (res.status === 422) {
				hint = t('import.hint422');
			}
		} catch {
			error = t('import.errNetwork');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{t('import.pageTitle')}</title>
</svelte:head>

<main>
	<a class="back" href="/">{t('import.back')}</a>
	<h1>{t('import.heading')}</h1>
	<p class="lede">
		{t('import.lede')}
	</p>

	<textarea
		bind:value={text}
		placeholder={PLACEHOLDER}
		rows="12"
		disabled={busy}
		aria-label={t('import.textareaAria')}
	></textarea>

	<div class="row">
		<span class="counter" class:over={tooLong}>{text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
		<button class="import" onclick={submit} disabled={!canSubmit}>
			{busy ? t('import.reading') : t('import.importBtn')}
		</button>
	</div>

	{#if busy}
		<p class="working">{t('import.readingLong')}</p>
	{/if}

	{#if error}
		<div class="error" role="alert">
			<p>{error}</p>
			{#if hint}<p class="hint">{hint}</p>{/if}
		</div>
	{/if}
</main>

<BottomBar user={data.user} items={[{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' }]} />

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
		margin: 0.5rem 0 0.25rem;
	}
	.lede {
		color: var(--text-muted);
		margin: 0 0 1.25rem;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.5;
		padding: 0.9rem 1rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		resize: vertical;
		min-height: 240px;
	}
	textarea:focus {
		outline: 2px solid var(--accent-strong);
		outline-offset: 1px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 0.75rem;
		gap: 1rem;
	}
	.counter {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.counter.over {
		color: var(--pill-bug-fg);
		font-weight: 700;
	}
	.import {
		font: inherit;
		font-size: 0.9rem;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 999px;
		padding: 0.55rem 1.4rem;
		cursor: pointer;
	}
	.import:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.working {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin-top: 0.75rem;
	}
	.error {
		margin-top: 1rem;
		background: var(--pill-bug-bg);
		border: 1px solid var(--pill-bug-bg);
		color: var(--pill-bug-fg);
		border-radius: 12px;
		padding: 0.75rem 1rem;
	}
	.error p {
		margin: 0;
	}
	.error .hint {
		margin-top: 0.4rem;
		color: var(--pill-bug-fg);
		font-size: 0.9rem;
	}
</style>
