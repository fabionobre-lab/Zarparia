<script lang="ts">
	import { untrack } from 'svelte';
	import type { Day, Block, Trip } from '$lib/trip-engine';
	import { move, removeAt, blankBlock } from './factories';
	import { dndzone, dndId, fromItems, grabHandle, FLIP_MS } from './dnd';
	import BlockEditor from './BlockEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';

	type BlockItem = { id: string; item: Block };

	let {
		day = $bindable(),
		langs,
		tags,
		onRemove,
		onMove,
		onGrab,
		canUp,
		canDown
	}: {
		day: Day;
		langs: string[];
		tags: Trip['tags'];
		onRemove: () => void;
		onMove: (dir: -1 | 1) => void;
		onGrab?: (e: Event) => void;
		canUp: boolean;
		canDown: boolean;
	} = $props();

	// Lazy body: heavy block editors render only while the day is expanded.
	let open = $state(false);

	const hasStaticWx = $derived(!!day.staticWeather);
	function toggleStaticWx(on: boolean) {
		day.staticWeather = on ? { hi: 0, lo: 0, emoji: '☀️' } : undefined;
	}
	function addBlock() {
		day.blocks.push(blankBlock(langs));
	}

	// ── Drag reorder for blocks within this day (handle-initiated) ──
	// svelte-dnd-action owns the list identity during a drag (it injects a shadow
	// placeholder item), so we hold the wrapped list in state and only mirror it
	// back into the model on consider/finalize. An effect re-syncs the list when
	// the model changes from elsewhere (add / remove / ↑↓), skipping mid-drag.
	let blockDragDisabled = $state(true);
	const wrap = (b: Block): BlockItem => ({ id: dndId(b), item: b });
	let blockItems = $state<BlockItem[]>(day.blocks.map(wrap));
	$effect(() => {
		const modelIds = day.blocks.map(dndId).join('|');
		untrack(() => {
			if (blockItems.map((w) => w.id).join('|') !== modelIds) blockItems = day.blocks.map(wrap);
		});
	});
	function considerBlocks(e: CustomEvent<{ items: BlockItem[] }>) {
		blockItems = e.detail.items;
	}
	function finalizeBlocks(e: CustomEvent<{ items: BlockItem[] }>) {
		blockItems = e.detail.items;
		day.blocks = fromItems(e.detail.items);
		blockDragDisabled = true;
	}
	function grabBlock() {
		grabHandle((v) => (blockDragDisabled = v));
	}
	function blockIdx(b: Block): number {
		return day.blocks.indexOf(b);
	}
</script>

<details class="day" bind:open>
	<summary>
		<span
			class="grip"
			aria-hidden="true"
			title="Drag to reorder day"
			onpointerdown={onGrab}
			ontouchstart={onGrab}
			onclick={(e) => e.preventDefault()}
		>⠿</span>
		<span class="date">{day.date || 'no date'}</span>
		<span class="title">{day.title?.[langs[0]] || '(untitled day)'}</span>
		<span class="controls">
			<button type="button" disabled={!canUp} onclick={(e) => (e.preventDefault(), onMove(-1))} aria-label="Move day up">↑</button>
			<button type="button" disabled={!canDown} onclick={(e) => (e.preventDefault(), onMove(1))} aria-label="Move day down">↓</button>
			<button type="button" class="del" onclick={(e) => (e.preventDefault(), onRemove())} aria-label="Remove day">✕</button>
		</span>
	</summary>
	{#if open}
	<div class="body">
		<div class="grid2">
			<label class="f">Date (ISO)<input type="date" bind:value={day.date} /></label>
			<label class="f">Route mode
				<select bind:value={day.routeMode}>
					<option value={undefined}>(none)</option>
					<option value="walking">walking</option>
					<option value="driving">driving</option>
					<option value="transit">transit</option>
					<option value="bicycling">bicycling</option>
				</select>
			</label>
		</div>
		<LocalizedInput bind:value={day.title} {langs} label="Day title" />
		<LocalizedInput bind:value={day.note as never} {langs} label="Day note" multiline />
		<LocalizedInput bind:value={day.banner as never} {langs} label="Banner (celebration strip)" />
		<label class="f">Total km override (optional)<input type="number" step="0.1" min="0" bind:value={day.kmTotal} /></label>

		<label class="check"><input type="checkbox" checked={hasStaticWx} onchange={(e) => toggleStaticWx(e.currentTarget.checked)} /> Stored weather (for past trips)</label>
		{#if day.staticWeather}
			<div class="grid3">
				<label class="f">High °C<input type="number" bind:value={day.staticWeather.hi} /></label>
				<label class="f">Low °C<input type="number" bind:value={day.staticWeather.lo} /></label>
				<label class="f">Emoji<input type="text" bind:value={day.staticWeather.emoji} /></label>
			</div>
		{/if}

		<div class="blocks">
			<div class="blocks-hd"><span class="lbl">Blocks</span><button type="button" onclick={addBlock}>+ Add block</button></div>
			<div
				class="dndlist"
				use:dndzone={{ items: blockItems, flipDurationMs: FLIP_MS, dragDisabled: blockDragDisabled, dropTargetStyle: {} }}
				onconsider={considerBlocks}
				onfinalize={finalizeBlocks}
			>
				{#each blockItems as w (w.id)}
					<BlockEditor
						bind:block={w.item}
						{langs}
						{tags}
						canUp={blockIdx(w.item) > 0}
						canDown={blockIdx(w.item) < day.blocks.length - 1}
						onMove={(dir) => move(day.blocks, blockIdx(w.item), dir)}
						onRemove={() => removeAt(day.blocks, blockIdx(w.item))}
						onGrab={grabBlock}
					/>
				{/each}
			</div>
		</div>
	</div>
	{/if}
</details>

<style>
	.day {
		border: 1px solid #d8ccb8;
		border-radius: 9px;
		margin-bottom: 0.5rem;
		background: #fbf8f1;
	}
	summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.7rem;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.grip {
		cursor: grab;
		color: #b3a892;
		font-size: 1rem;
		line-height: 1;
		flex-shrink: 0;
		touch-action: none;
		user-select: none;
	}
	.grip:active {
		cursor: grabbing;
	}
	.date {
		font-size: 0.75rem;
		color: #7a6e5f;
		width: 6rem;
		flex-shrink: 0;
	}
	.title {
		flex: 1;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.controls {
		display: flex;
		gap: 0.15rem;
	}
	.body {
		padding: 0.6rem 0.7rem;
		border-top: 1px solid #eee5d6;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.grid3 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
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
		padding: 0.35rem 0.5rem;
		border: 1px solid #d8ccb8;
		border-radius: 6px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: #555;
		margin: 0.3rem 0 0.5rem;
	}
	.lbl {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #7a6e5f;
	}
	.blocks {
		margin-top: 0.5rem;
	}
	.blocks-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
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
	}
	.del {
		color: #a33;
	}
</style>
