<script lang="ts">
	import type { Localized } from '$lib/trip-engine';

	let {
		value = $bindable(),
		langs,
		label,
		multiline = false,
		placeholder = ''
	}: {
		value: Localized;
		langs: string[];
		label: string;
		multiline?: boolean;
		placeholder?: string;
	} = $props();

	// Optional localized fields arrive as undefined; create the object (writes
	// back through the binding) so the template and per-language bindings work
	// on both server and client.
	if (!value) value = {};

	// Fill a key for each language so inputs render (client-side).
	$effect(() => {
		for (const l of langs) if (value[l] === undefined) value[l] = '';
	});
</script>

<div class="loc">
	<span class="lbl">{label}</span>
	{#each langs as l (l)}
		<div class="row">
			{#if langs.length > 1}<span class="tag">{l}</span>{/if}
			{#if multiline}
				<textarea bind:value={value[l]} {placeholder} rows="2" aria-label={`${label} (${l.toUpperCase()})`}></textarea>
			{:else}
				<input type="text" bind:value={value[l]} {placeholder} aria-label={`${label} (${l.toUpperCase()})`} />
			{/if}
		</div>
	{/each}
</div>

<style>
	.loc {
		margin-bottom: 0.5rem;
		min-width: 0;
	}
	.lbl {
		display: block;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		margin-bottom: 0.2rem;
	}
	.row {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
		margin-bottom: 0.25rem;
	}
	.tag {
		font-size: 0.6rem;
		text-transform: uppercase;
		color: var(--text-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.35rem;
		margin-top: 0.35rem;
	}
	input,
	textarea {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
		resize: vertical;
	}
</style>
