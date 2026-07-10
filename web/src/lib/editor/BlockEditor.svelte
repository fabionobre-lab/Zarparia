<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Block, Trip } from '$lib/trip-engine';
	import { move, removeAt, emptyLocalized } from './factories';
	import LocalizedInput from './LocalizedInput.svelte';
	import PlaceSearch from './PlaceSearch.svelte';

	let {
		block = $bindable(),
		langs,
		tags,
		autoOpen = false,
		onRemove,
		onDuplicate,
		onMove,
		onGrab,
		canUp,
		canDown
	}: {
		block: Block;
		langs: string[];
		tags: Trip['tags'];
		autoOpen?: boolean;
		onRemove: () => void;
		onDuplicate?: () => void;
		onMove: (dir: -1 | 1) => void;
		onGrab?: (e: Event) => void;
		canUp: boolean;
		canDown: boolean;
	} = $props();

	// Lazy body: only render the (heavy) editing fields while expanded. Model
	// bindings live on `block`, so collapsing never loses unsaved edits.
	// autoOpen is a one-time seed (a newly added/duplicated block mounts expanded).
	let open = $state(untrack(() => autoOpen));
	let bodyEl = $state<HTMLElement>();
	onMount(() => {
		if (autoOpen) queueMicrotask(() => bodyEl?.querySelector<HTMLElement>('input,select,textarea')?.focus());
	});

	const tagKeys = $derived(tags ? Object.keys(tags) : []);
	const summary = $derived(block.title?.[langs[0]] || '(untitled block)');

	function toggleTag(key: string) {
		// Assign first, then read `block.tags` back as the reactive proxy — mutating
		// the raw array returned by `?? (block.tags = [])` wouldn't notify.
		if (!block.tags) block.tags = [];
		const list = block.tags;
		const i = list.indexOf(key);
		if (i === -1) list.push(key);
		else list.splice(i, 1);
	}

	const diffKind = $derived(block.diff?.kind ?? 'none');
	function setDiffKind(kind: string) {
		if (kind === 'none') block.diff = undefined;
		else block.diff = { kind: kind as 'added' | 'changed' | 'kept', reason: block.diff?.reason ?? emptyLocalized(langs) };
	}

	// Lat/lon are optional and independent of each other while typing; a
	// partial pair is pruned before save (see pruneEmpty in factories.ts).
	function setCoord(key: 'lat' | 'lon', raw: string) {
		const v = raw === '' ? undefined : Number(raw);
		const next = { ...(block.coords ?? {}), [key]: v };
		block.coords = next.lat === undefined && next.lon === undefined ? undefined : (next as never);
	}

	// Fill coords from a picked place. mapsUrl and the (default-language) title are
	// only filled when empty — a pick never clobbers what the user already wrote.
	function onPickPlace(p: { name: string; lat: number; lon: number }) {
		block.coords = { lat: p.lat, lon: p.lon };
		if (!block.mapsUrl) block.mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(p.name)}`;
		const def = langs[0];
		if (!block.title?.[def]) {
			if (!block.title) block.title = {};
			block.title[def] = p.name;
		}
	}

	function addWaypoint() {
		(block.waypoints ??= []).push({ query: '', name: emptyLocalized(langs) });
	}
	function addPhoto() {
		(block.photoSpots ??= []).push({ name: '', mapsUrl: '' });
	}
</script>

<details class="block" bind:open>
	<summary>
		<span
			class="grip"
			aria-hidden="true"
			title="Drag to reorder block"
			onpointerdown={onGrab}
			ontouchstart={onGrab}
			onclick={(e) => e.preventDefault()}
		>⠿</span>
		<span class="time">{block.time || '—'}</span>
		<span class="title">{summary}</span>
		<span class="controls">
			<button type="button" disabled={!canUp} onclick={(e) => (e.preventDefault(), onMove(-1))} aria-label="Move block up">↑</button>
			<button type="button" disabled={!canDown} onclick={(e) => (e.preventDefault(), onMove(1))} aria-label="Move block down">↓</button>
			{#if onDuplicate}<button type="button" onclick={(e) => (e.preventDefault(), onDuplicate())} aria-label="Duplicate block">Duplicate</button>{/if}
			<button type="button" class="del" onclick={(e) => (e.preventDefault(), onRemove())} aria-label="Remove block">✕</button>
		</span>
	</summary>

	{#if open}
	<div class="body" bind:this={bodyEl}>
		<div class="grid2">
			<label class="f">Time<input type="text" bind:value={block.time} placeholder="09:30 or ~14:00" /></label>
			<label class="f">Dot color<input type="color" bind:value={block.dotColor} /></label>
		</div>
		<LocalizedInput bind:value={block.title} {langs} label="Title" />

		{#if tagKeys.length}
			<div class="tags">
				<span class="lbl">Tags</span>
				<div class="chips">
					{#each tagKeys as key (key)}
						<label class="chip" class:on={block.tags?.includes(key)}>
							<input type="checkbox" checked={block.tags?.includes(key)} onchange={() => toggleTag(key)} />
							{tags?.[key].label?.[langs[0]] ?? key}
						</label>
					{/each}
				</div>
			</div>
		{/if}

		<LocalizedInput bind:value={block.description as never} {langs} label="Description" multiline />

		<PlaceSearch label="Find place" onPick={onPickPlace} />

		<div class="grid2">
			<label class="f">Maps URL<input type="text" bind:value={block.mapsUrl} placeholder="https://maps.google.com/?q=..." /></label>
			<label class="f">Walk (km)<input type="number" step="0.1" min="0" bind:value={block.km} /></label>
		</div>

		<div class="grid2">
			<label class="f">Lat<input type="number" step="any" value={block.coords?.lat ?? ''} oninput={(e) => setCoord('lat', e.currentTarget.value)} /></label>
			<label class="f">Lon<input type="number" step="any" value={block.coords?.lon ?? ''} oninput={(e) => setCoord('lon', e.currentTarget.value)} /></label>
		</div>

		<LocalizedInput bind:value={block.warning as never} {langs} label="Warning" multiline />
		<LocalizedInput bind:value={block.note as never} {langs} label="Note" multiline />

		<div class="sub">
			<div class="sub-hd"><span class="lbl">Waypoints</span><button type="button" onclick={addWaypoint}>+ Add</button></div>
			{#each block.waypoints ?? [] as wp, i (i)}
				<div class="rowline">
					<input type="text" bind:value={wp.query} placeholder="Place+Query+For+Maps" aria-label="Waypoint maps query" />
					<LocalizedInput bind:value={wp.name} {langs} label="Name" />
					<button type="button" class="del" onclick={() => removeAt(block.waypoints!, i)}>✕</button>
				</div>
			{/each}
		</div>

		<div class="sub">
			<div class="sub-hd"><span class="lbl">Photo spots</span><button type="button" onclick={addPhoto}>+ Add</button></div>
			{#each block.photoSpots ?? [] as ps, i (i)}
				<div class="photo">
					<input type="text" bind:value={ps.name} placeholder="Caption" aria-label="Photo spot caption" />
					<input type="text" bind:value={ps.mapsUrl} placeholder="Maps URL" aria-label="Photo spot maps URL" />
					<input type="text" bind:value={ps.wiki} placeholder="Wikipedia page title (optional)" aria-label="Photo spot Wikipedia page title" />
					<input type="text" bind:value={ps.fallbackImg} placeholder="Fallback image URL (optional)" aria-label="Photo spot fallback image URL" />
					<button type="button" class="del" onclick={() => removeAt(block.photoSpots!, i)}>✕</button>
				</div>
			{/each}
		</div>

		<div class="sub">
			<label class="f">Plan diff
				<select value={diffKind} onchange={(e) => setDiffKind(e.currentTarget.value)}>
					<option value="none">none</option>
					<option value="added">added</option>
					<option value="changed">changed</option>
					<option value="kept">kept</option>
				</select>
			</label>
			{#if block.diff}
				<LocalizedInput bind:value={block.diff.reason} {langs} label="Diff reason" multiline />
			{/if}
		</div>
	</div>
	{/if}
</details>

<style>
	.block {
		border: 1px solid #e2ddd2;
		border-radius: 8px;
		margin-bottom: 0.4rem;
		background: #fff;
	}
	summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.grip {
		cursor: grab;
		color: #b3a892;
		font-size: 0.9rem;
		line-height: 1;
		flex-shrink: 0;
		touch-action: none;
		user-select: none;
	}
	.grip:active {
		cursor: grabbing;
	}
	.time {
		font-size: 0.75rem;
		color: #7a6e5f;
		width: 3.5rem;
		flex-shrink: 0;
	}
	.title {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.controls {
		display: flex;
		gap: 0.15rem;
	}
	.body {
		padding: 0.6rem;
		border-top: 1px solid #f0ece4;
	}
	.grid2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.f {
		display: flex;
		flex-direction: column;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #7a6e5f;
		gap: 0.2rem;
		margin-bottom: 0.5rem;
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
	.lbl {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #7a6e5f;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0.25rem 0 0.5rem;
	}
	.chip {
		font-size: 0.72rem;
		border: 1px solid #d8ccb8;
		border-radius: 999px;
		padding: 0.2rem 0.55rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.chip.on {
		background: #dce8f5;
		border-color: #b6cbe4;
	}
	.chip input {
		display: none;
	}
	.sub {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px dashed #eee5d6;
	}
	.sub-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.35rem;
	}
	.rowline,
	.photo {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		margin-bottom: 0.4rem;
	}
	.rowline input,
	.photo input {
		font: inherit;
		font-size: 0.8rem;
		padding: 0.3rem 0.45rem;
		border: 1px solid #d8ccb8;
		border-radius: 6px;
		flex: 1;
		min-width: 8rem;
	}
	button {
		font: inherit;
		font-size: 0.8rem;
		border: 1px solid #d8ccb8;
		background: #faf6ee;
		border-radius: 6px;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.del {
		color: #a33;
	}
</style>
