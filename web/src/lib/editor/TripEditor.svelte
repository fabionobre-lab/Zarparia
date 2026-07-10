<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import type { Trip, Segment } from '$lib/trip-engine';
	import TripView from '$lib/TripView.svelte';
	import SegmentEditor from './SegmentEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';
	import { blankTrip, blankSegment, move, removeAt, pruneEmpty, nextId } from './factories';
	import { dndzone, dndId, fromItems, grabHandle, FLIP_MS } from './dnd';
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

	// ── Drag reorder for segments within the trip (handle-initiated) ──
	// See DayEditor for the state/effect rationale.
	type SegItem = { id: string; item: Segment };
	let segDragDisabled = $state(true);
	const wrapSeg = (s: Segment): SegItem => ({ id: dndId(s), item: s });
	let segItems = $state<SegItem[]>(untrack(() => draft.segments.map(wrapSeg)));
	$effect(() => {
		const modelIds = draft.segments.map(dndId).join('|');
		untrack(() => {
			if (segItems.map((w) => w.id).join('|') !== modelIds) segItems = draft.segments.map(wrapSeg);
		});
	});
	function considerSegs(e: CustomEvent<{ items: SegItem[] }>) {
		segItems = e.detail.items;
	}
	function finalizeSegs(e: CustomEvent<{ items: SegItem[] }>) {
		segItems = e.detail.items;
		draft.segments = fromItems(e.detail.items);
		segDragDisabled = true;
	}
	function grabSeg() {
		grabHandle((v) => (segDragDisabled = v));
	}
	function segIdx(s: Segment): number {
		return draft.segments.indexOf(s);
	}

	// The live preview renders TripView only once the draft has something to show:
	// any day with a date, or any trip title text. A brand-new blank draft (one
	// empty segment/day) otherwise renders as a broken empty hero, so we show a
	// quiet placeholder card until real content exists.
	const hasPreviewContent = $derived.by(() => {
		const anyTitle = Object.values(draft.title ?? {}).some((v) => !!v && v.trim() !== '');
		if (anyTitle) return true;
		return draft.segments.some((s) =>
			s.plans.some((p) => p.days.some((d) => !!d.date && d.date.trim() !== ''))
		);
	});

	const hasHome = $derived(!!draft.home);
	function toggleHome(on: boolean) {
		draft.home = on ? { name: '', postcode: '', lat: 0, lon: 0 } : undefined;
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

				<LocalizedInput bind:value={draft.locales as never} {langs} label="Locale (date format, e.g. en-GB)" placeholder="en-GB" />

				<div class="homebase">
					<label class="check"><input type="checkbox" checked={hasHome} onchange={(e) => toggleHome(e.currentTarget.checked)} /> Home base</label>
					{#if draft.home}
						<div class="grid4">
							<label class="f">Name<input type="text" bind:value={draft.home.name} /></label>
							<label class="f">Postcode<input type="text" bind:value={draft.home.postcode} /></label>
							<label class="f">Lat<input type="number" step="0.0001" bind:value={draft.home.lat} /></label>
							<label class="f">Lon<input type="number" step="0.0001" bind:value={draft.home.lon} /></label>
						</div>
					{/if}
				</div>

				<div class="tagsvocab">
					<div class="sub-hd"><span class="lbl">Tag vocabulary</span><button type="button" onclick={addTag}>+ Tag</button></div>
					{#each tagKeys as key (key)}
						<div class="tagrow">
							<span class="tkey">{key}</span>
							<LocalizedInput bind:value={draft.tags![key].label} {langs} label="Label" />
							<select bind:value={draft.tags![key].style} aria-label="Tag style">
								{#each ['sight', 'food', 'birthday', 'booking', 'logistics', 'fullday'] as s (s)}<option value={s}>{s}</option>{/each}
							</select>
							<button type="button" class="del" onclick={() => delete draft.tags![key]}>✕</button>
						</div>
					{/each}
				</div>
			</div>
		</details>

		<div class="segs-hd"><h2>Segments</h2><button type="button" onclick={addSegment}>+ Add segment</button></div>
		<div
			class="dndlist"
			use:dndzone={{ items: segItems, flipDurationMs: FLIP_MS, dragDisabled: segDragDisabled, dropTargetStyle: {} }}
			onconsider={considerSegs}
			onfinalize={finalizeSegs}
		>
			{#each segItems as w (w.id)}
				<SegmentEditor
					bind:segment={w.item}
					{langs}
					tags={draft.tags}
					canUp={segIdx(w.item) > 0}
					canDown={segIdx(w.item) < draft.segments.length - 1}
					onMove={(dir) => move(draft.segments, segIdx(w.item), dir)}
					onRemove={() => removeAt(draft.segments, segIdx(w.item))}
					onGrab={grabSeg}
				/>
			{/each}
		</div>
	</div>

	<div class="preview">
		<div class="preview-label">Live preview</div>
		{#if hasPreviewContent}
			{#key draft.languages.length}
				<TripView trip={draft} />
			{/key}
		{:else}
			<div class="preview-empty">Preview appears as you add trip details</div>
		{/if}
	</div>
</div>

<style>
	.editor {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 1.5rem 3rem;
		font-family: system-ui, sans-serif;
	}
	.form {
		min-width: 0;
	}
	@media (min-width: 1024px) {
		.editor {
			display: grid;
			grid-template-columns: minmax(560px, 1fr) 430px;
			gap: 2rem;
			align-items: start;
		}
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
	.f input,
	.f select {
		font: inherit;
		font-size: 0.85rem;
		text-transform: none;
		letter-spacing: normal;
		color: #1a1208;
		min-width: 0;
		padding: 0.35rem 0.5rem;
		border: 1px solid #d8ccb8;
		border-radius: 6px;
	}
	.homebase {
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px dashed #eee5d6;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #555;
		margin: 0.3rem 0 0.5rem;
	}
	.grid4 {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.5rem;
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
		margin-top: 1.5rem;
	}
	.preview-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #a99f8d;
		margin-bottom: 0.5rem;
		text-align: center;
	}
	.preview-empty {
		max-width: 430px;
		margin: 0 auto;
		border: 1px dashed #d8ccb8;
		border-radius: 14px;
		background: #fbf8f1;
		color: #9b917f;
		font-size: 0.85rem;
		text-align: center;
		padding: 3.5rem 1.5rem;
	}
	@media (min-width: 1024px) {
		.preview {
			position: sticky;
			top: 16px;
			margin-top: 0;
		}
		.preview-empty {
			padding: 5rem 1.5rem;
		}
	}
</style>
