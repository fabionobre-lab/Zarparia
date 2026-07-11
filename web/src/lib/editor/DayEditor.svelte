<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Day, Block, Trip } from '$lib/trip-engine';
	import { move, removeAt, blankBlock } from './factories';
	import { dndzone, dndId, fromItems, grabHandle, FLIP_MS } from './dnd';
	import BlockEditor from './BlockEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';
	import { t } from '$lib/i18n/store.svelte';

	type BlockItem = { id: string; item: Block };

	let {
		day = $bindable(),
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
		day: Day;
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

	// Lazy body: heavy block editors render only while the day is expanded.
	// autoOpen is a one-time seed (a newly added/duplicated day mounts expanded).
	let open = $state(untrack(() => autoOpen));
	let bodyEl = $state<HTMLElement>();
	onMount(() => {
		if (autoOpen) queueMicrotask(() => bodyEl?.querySelector<HTMLElement>('input,select,textarea')?.focus());
	});

	const hasStaticWx = $derived(!!day.staticWeather);
	function toggleStaticWx(on: boolean) {
		day.staticWeather = on ? { hi: 0, lo: 0, emoji: '☀️' } : undefined;
	}

	// Auto-expand + focus the most recently added/duplicated block.
	let justAddedBlock = $state<Block | null>(null);
	function addBlock() {
		day.blocks.push(blankBlock(langs));
		// Read the element back so the identity matches the reactive proxy the
		// template sees (Svelte wraps inserted objects), so autoOpen resolves.
		justAddedBlock = day.blocks[day.blocks.length - 1];
		syncBlocks();
	}
	/** Deep-clone a block (from its snapshot) and insert it right after the source,
	 *  expanded. */
	function duplicateBlock(src: Block) {
		const i = day.blocks.indexOf(src);
		if (i === -1) return;
		day.blocks.splice(i + 1, 0, structuredClone($state.snapshot(src)) as Block);
		justAddedBlock = day.blocks[i + 1];
		syncBlocks();
	}

	// ── Drag reorder for blocks within this day (handle-initiated) ──
	// svelte-dnd-action owns the list identity during a drag (it injects a shadow
	// placeholder item), so we hold the wrapped list in state and only mirror it
	// back into the model on consider/finalize. An effect re-syncs the list when
	// the model changes from elsewhere (add / remove / ↑↓), skipping mid-drag.
	let blockDragDisabled = $state(true);
	const wrap = (b: Block): BlockItem => ({ id: dndId(b), item: b });
	let blockItems = $state<BlockItem[]>(day.blocks.map(wrap));
	// Rebuild the wrapped list from the model; called imperatively after add/
	// remove/move/duplicate, since in-place array mutations don't reliably
	// re-fire the sync effect below.
	function syncBlocks() {
		blockItems = day.blocks.map(wrap);
	}
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
			title={t('day.dragReorder')}
			onpointerdown={onGrab}
			ontouchstart={onGrab}
			onclick={(e) => e.preventDefault()}
		>⠿</span>
		<span class="date">{day.date || t('day.noDate')}</span>
		<span class="title">{day.title?.[langs[0]] || t('day.untitled')}</span>
		<span class="controls">
			<button type="button" disabled={!canUp} onclick={(e) => (e.preventDefault(), onMove(-1))} aria-label={t('day.moveUp')}>↑</button>
			<button type="button" disabled={!canDown} onclick={(e) => (e.preventDefault(), onMove(1))} aria-label={t('day.moveDown')}>↓</button>
			{#if onDuplicate}<button type="button" onclick={(e) => (e.preventDefault(), onDuplicate())} aria-label={t('day.duplicateAria')}>{t('day.duplicate')}</button>{/if}
			<button type="button" class="del" onclick={(e) => (e.preventDefault(), onRemove())} aria-label={t('day.removeAria')}>✕</button>
		</span>
	</summary>
	{#if open}
	<div class="body" bind:this={bodyEl}>
		<div class="grid2">
			<label class="f">{t('day.dateIso')}<input type="date" bind:value={day.date} /></label>
			<label class="f">{t('day.routeMode')}
				<select bind:value={day.routeMode}>
					<option value={undefined}>{t('day.routeNone')}</option>
					<option value="walking">{t('day.walking')}</option>
					<option value="driving">{t('day.driving')}</option>
					<option value="transit">{t('day.transit')}</option>
					<option value="bicycling">{t('day.bicycling')}</option>
				</select>
			</label>
		</div>
		<LocalizedInput bind:value={day.title} {langs} label={t('day.dayTitle')} />
		<LocalizedInput bind:value={day.note as never} {langs} label={t('day.dayNote')} multiline />
		<LocalizedInput bind:value={day.banner as never} {langs} label={t('day.banner')} />
		<label class="f">{t('day.kmOverride')}<input type="number" step="0.1" min="0" bind:value={day.kmTotal} /></label>

		<label class="check"><input type="checkbox" checked={hasStaticWx} onchange={(e) => toggleStaticWx(e.currentTarget.checked)} /> {t('day.storedWeather')}</label>
		{#if day.staticWeather}
			<div class="grid3">
				<label class="f">{t('day.highC')}<input type="number" bind:value={day.staticWeather.hi} /></label>
				<label class="f">{t('day.lowC')}<input type="number" bind:value={day.staticWeather.lo} /></label>
				<label class="f">{t('day.emoji')}<input type="text" bind:value={day.staticWeather.emoji} /></label>
			</div>
		{/if}

		<div class="blocks">
			<div class="blocks-hd"><span class="lbl">{t('day.blocks')}</span><button type="button" onclick={addBlock}>{t('day.addBlock')}</button></div>
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
						autoOpen={w.item === justAddedBlock}
						canUp={blockIdx(w.item) > 0}
						canDown={blockIdx(w.item) < day.blocks.length - 1}
						onMove={(dir) => { move(day.blocks, blockIdx(w.item), dir); syncBlocks(); }}
						onRemove={() => { removeAt(day.blocks, blockIdx(w.item)); syncBlocks(); }}
						onDuplicate={() => duplicateBlock(w.item)}
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
		border: 1px solid var(--hairline-strong);
		border-radius: 9px;
		margin-bottom: 0.5rem;
		background: var(--surface);
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
		color: var(--text-muted);
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
		color: var(--text-muted);
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
		border-top: 1px solid var(--hairline);
	}
	.grid2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.grid3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.f {
		display: flex;
		flex-direction: column;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		gap: 0.2rem;
		margin-bottom: 0.5rem;
	}
	.f input,
	.f select {
		font: inherit;
		font-size: 0.85rem;
		text-transform: none;
		letter-spacing: normal;
		background: var(--surface);
		color: var(--text);
		min-width: 0;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 6px;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0.3rem 0 0.5rem;
	}
	.lbl {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
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
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		border-radius: 6px;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.35;
	}
	.del {
		color: var(--pill-bug-fg);
	}
</style>
