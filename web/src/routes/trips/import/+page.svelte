<script lang="ts">
	import { goto } from '$app/navigation';

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
			error = e.error ?? `Import failed (${res.status}).`;
			if (res.status === 422) {
				hint = 'Try adding explicit dates (e.g. "arriving 5 September 2026") and importing again.';
			}
		} catch {
			error = 'Network error. Please check your connection and try again.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>Import an itinerary</title>
</svelte:head>

<main>
	<a class="back" href="/">&larr; Trips</a>
	<h1>Import an itinerary</h1>
	<p class="lede">
		Paste a rough itinerary in any form and we'll turn it into a draft trip you can refine in the
		editor.
	</p>

	<textarea
		bind:value={text}
		placeholder={PLACEHOLDER}
		rows="12"
		disabled={busy}
		aria-label="Itinerary text"
	></textarea>

	<div class="row">
		<span class="counter" class:over={tooLong}>{text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
		<button class="import" onclick={submit} disabled={!canSubmit}>
			{busy ? 'Reading your itinerary…' : 'Import'}
		</button>
	</div>

	{#if busy}
		<p class="working">Reading your itinerary… this takes ~30–60s.</p>
	{/if}

	{#if error}
		<div class="error" role="alert">
			<p>{error}</p>
			{#if hint}<p class="hint">{hint}</p>{/if}
		</div>
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
		margin: 0.5rem 0 0.25rem;
	}
	.lede {
		color: #6b6153;
		margin: 0 0 1.25rem;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.5;
		padding: 0.9rem 1rem;
		border: 1px solid #d8ccb8;
		border-radius: 12px;
		background: #faf6ee;
		resize: vertical;
		min-height: 240px;
	}
	textarea:focus {
		outline: 2px solid #2b4a2b;
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
		color: #7a6e5f;
	}
	.counter.over {
		color: #7a2020;
		font-weight: 700;
	}
	.import {
		font: inherit;
		font-size: 0.9rem;
		background: #2b4a2b;
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
		color: #6b6153;
		margin-top: 0.75rem;
	}
	.error {
		margin-top: 1rem;
		background: #fdf0ee;
		border: 1px solid #e6b0aa;
		color: #7a2020;
		border-radius: 12px;
		padding: 0.75rem 1rem;
	}
	.error p {
		margin: 0;
	}
	.error .hint {
		margin-top: 0.4rem;
		color: #8a4b2b;
		font-size: 0.9rem;
	}
</style>
