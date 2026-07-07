<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import type { Trip } from '$lib/trip-engine';
	import TripView from '$lib/TripView.svelte';
	import SegmentEditor from './SegmentEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';
	import { blankTrip, blankSegment, move, removeAt, pruneEmpty, nextId } from './factories';
	import { validateTripDoc, type TripDoc } from '$lib/validateTrip';

	let {
		initial,
		mode,
		tripId,
		baseUpdatedAt
	}: { initial: Trip | null; mode: 'new' | 'edit'; tripId?: string; baseUpdatedAt?: string } =
		$props();

	let draft = $state<Trip>(
		untrack(() => (initial ? (structuredClone($state.snapshot(initial)) as Trip) : blankTrip()))
	);
	let errors = $state<string[]>([]);
	let saving = $state(false);

	// Optimistic-concurrency base version, rebased after each successful save.
	let base = $state<string | undefined>(untrack(() => baseUpdatedAt));

	// ── Dirty guard: warn before losing unsaved edits ──
	// Serialize the same way save() does so cosmetic differences don't read as dirty.
	function serialize(): string {
		return JSON.stringify(pruneEmpty($state.snapshot(draft)) ?? null);
	}
	let savedSnapshot = $state(untrack(serialize));
	let justSaved = $state(false);
	const dirty = $derived(!justSaved && serialize() !== savedSnapshot);

	beforeNavigate((nav) => {
		if (dirty && !confirm('Discard unsaved changes?')) nav.cancel();
	});
	$effect(() => {
		if (!dirty) return;
		const handler = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	const langs = $derived(draft.languages);

	function addLanguage() {
		const code = prompt('Language code (e.g. "es")')?.trim().toLowerCase();
		if (code && !draft.languages.includes(code)) draft.languages.push(code);
	}
	function removeLanguage(code: string) {
		if (draft.languages.length <= 1) return;
		draft.languages = draft.languages.filter((l) => l !== code);
		if (draft.defaultLanguage === code) draft.defaultLanguage = draft.languages[0];
	}
	function addSegment() {
		draft.segments.push(blankSegment(langs, nextId('segment', draft.segments.map((s) => s.id))));
	}

	// Trip-level tags vocabulary
	function addTag() {
		const key = prompt('Tag key (short, e.g. "mu")')?.trim();
		if (!key) return;
		draft.tags ??= {};
		if (!draft.tags[key]) draft.tags[key] = { label: Object.fromEntries(langs.map((l) => [l, ''])), style: 'sight' };
	}
	const tagKeys = $derived(draft.tags ? Object.keys(draft.tags) : []);

	async function save() {
		errors = [];
		const clean = pruneEmpty($state.snapshot(draft)) as TripDoc | undefined;
		if (!clean) {
			errors = ['Trip is empty.'];
			return;
		}
		const check = validateTripDoc(clean);
		if (!check.valid) {
			errors = check.errors;
			return;
		}
		saving = true;
		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (mode === 'edit' && base) headers['x-base-updated-at'] = base;
			const res = await fetch(mode === 'new' ? '/api/trips' : `/api/trips/${tripId}`, {
				method: mode === 'new' ? 'POST' : 'PUT',
				headers,
				body: JSON.stringify(clean)
			});
			if (res.ok) {
				const data = (await res.json()) as { id: string; updatedAt?: string };
				// Rebase the version and snapshot so consecutive saves work and the
				// dirty guard doesn't prompt on the post-save navigation.
				if (data.updatedAt) base = data.updatedAt;
				savedSnapshot = serialize();
				justSaved = true;
				await goto(`/trips/${data.id}`);
			} else {
				const e = (await res.json()) as { error?: string; details?: string[] };
				errors = e.details ?? [e.error ?? `Save failed (${res.status})`];
			}
		} catch {
			errors = ['Network error while saving.'];
		} finally {
			saving = false;
		}
	}
</script>

<div class="editor">
	<div class="form">
		<div class="bar">
			<a class="back" href={mode === 'edit' ? `/trips/${tripId}` : '/'}>← Cancel</a>
			<button class="save" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save trip'}</button>
		</div>

		{#if errors.length}
			<div class="errors">
				<strong>Please fix:</strong>
				<ul>{#each errors as e (e)}<li>{e}</li>{/each}</ul>
			</div>
		{/if}

		<details class="settings" open>
			<summary>Trip settings</summary>
			<div class="sbody">
				<LocalizedInput bind:value={draft.title} {langs} label="Trip title" />
				<LocalizedInput bind:value={draft.eyebrow as never} {langs} label="Eyebrow (e.g. April 2026)" />

				<div class="langs">
					<span class="lbl">Languages</span>
					<div class="chips">
						{#each draft.languages as l (l)}
							<span class="chip">{l}{#if draft.languages.length > 1}<button type="button" onclick={() => removeLanguage(l)}>✕</button>{/if}</span>
						{/each}
						<button type="button" class="add" onclick={addLanguage}>+ Language</button>
					</div>
					<label class="f inline">Default
						<select bind:value={draft.defaultLanguage}>
							{#each draft.languages as l (l)}<option value={l}>{l}</option>{/each}
						</select>
					</label>
				</div>

				<div class="tagsvocab">
					<div class="sub-hd"><span class="lbl">Tag vocabulary</span><button type="button" onclick={addTag}>+ Tag</button></div>
					{#each tagKeys as key (key)}
						<div class="tagrow">
							<span class="tkey">{key}</span>
							<LocalizedInput bind:value={draft.tags![key].label} {langs} label="Label" />
							<select bind:value={draft.tags![key].style}>
								{#each ['sight', 'food', 'birthday', 'booking', 'logistics', 'fullday'] as s (s)}<option value={s}>{s}</option>{/each}
							</select>
							<button type="button" class="del" onclick={() => delete draft.tags![key]}>✕</button>
						</div>
					{/each}
				</div>
			</div>
		</details>

		<div class="segs-hd"><h2>Segments</h2><button type="button" onclick={addSegment}>+ Add segment</button></div>
		{#each draft.segments as segment, i (segment)}
			<SegmentEditor
				bind:segment={draft.segments[i]}
				{langs}
				tags={draft.tags}
				canUp={i > 0}
				canDown={i < draft.segments.length - 1}
				onMove={(dir) => move(draft.segments, i, dir)}
				onRemove={() => removeAt(draft.segments, i)}
			/>
		{/each}
	</div>

	<div class="preview">
		<div class="preview-label">Live preview</div>
		{#key draft.languages.length}
			<TripView trip={draft} />
		{/key}
	</div>
</div>

<style>
	.editor {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 460px);
		gap: 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 1.25rem 3rem;
		align-items: start;
		font-family: system-ui, sans-serif;
	}
	.form {
		min-width: 0;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		position: sticky;
		top: 0;
		background: #fff;
		padding: 0.5rem 0;
		z-index: 2;
	}
	.back {
		text-decoration: none;
		color: #2b4a2b;
		font-size: 0.9rem;
	}
	.save {
		font: inherit;
		background: #2b4a2b;
		color: #fff;
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1.2rem;
		cursor: pointer;
	}
	.save:disabled {
		opacity: 0.5;
	}
	.errors {
		background: #fdf0ee;
		border: 1px solid #e6b0aa;
		border-radius: 8px;
		padding: 0.6rem 0.8rem;
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
		color: #7a2020;
	}
	.errors ul {
		margin: 0.3rem 0 0 1rem;
	}
	.settings {
		border: 1px solid #d8ccb8;
		border-radius: 10px;
		margin-bottom: 1rem;
		background: #fbf8f1;
	}
	.settings > summary {
		padding: 0.6rem 0.8rem;
		cursor: pointer;
		font-weight: 700;
	}
	.sbody {
		padding: 0.7rem 0.8rem;
		border-top: 1px solid #eee5d6;
	}
	.langs {
		margin: 0.5rem 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		margin: 0.3rem 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: #f0ece4;
		border-radius: 999px;
		padding: 0.2rem 0.6rem;
		font-size: 0.8rem;
	}
	.chip button {
		border: none;
		background: none;
		cursor: pointer;
		color: #a33;
		padding: 0;
		font-size: 0.75rem;
	}
	.lbl {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #7a6e5f;
		font-weight: 600;
	}
	.f {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.72rem;
		color: #7a6e5f;
	}
	.f.inline {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.3rem;
	}
	select {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.3rem 0.5rem;
		border: 1px solid #d8ccb8;
		border-radius: 6px;
	}
	.tagsvocab {
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px dashed #eee5d6;
	}
	.sub-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}
	.tagrow {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
	}
	.tkey {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		background: #f0ece4;
		border-radius: 4px;
		padding: 0.3rem 0.4rem;
		margin-top: 0.3rem;
	}
	.segs-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0.5rem 0 0.75rem;
	}
	h2 {
		font-size: 1.05rem;
	}
	button {
		font: inherit;
		font-size: 0.82rem;
		border: 1px solid #d8ccb8;
		background: #faf6ee;
		border-radius: 6px;
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}
	.del {
		color: #a33;
	}
	.preview {
		position: sticky;
		top: 1rem;
	}
	.preview-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #999;
		margin-bottom: 0.4rem;
		text-align: center;
	}
	@media (max-width: 860px) {
		.editor {
			grid-template-columns: 1fr;
		}
		.preview {
			position: static;
		}
	}
</style>
