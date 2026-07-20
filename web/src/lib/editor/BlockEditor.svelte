<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Block, Trip, CostCategory } from '$lib/trip-engine';
	import { move, removeAt, emptyLocalized } from './factories';
	import LocalizedInput from './LocalizedInput.svelte';
	import PlaceSearch from './PlaceSearch.svelte';
	import { t } from '$lib/i18n/store.svelte';

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
	const summary = $derived(block.title?.[langs[0]] || t('block.untitled'));

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

	// ── Cost (Phase 6 budget) ──
	// A cost is valid only with a positive amount; clearing the amount drops the
	// whole object (category alone can't validate). Category is meaningless
	// without an amount, so its <select> stays disabled until one is entered.
	const COST_CATEGORIES: CostCategory[] = ['lodging', 'food', 'transport', 'activities', 'shopping', 'other'];
	const catLabels = $derived<Record<CostCategory, string>>({
		lodging: t('block.cat.lodging'),
		food: t('block.cat.food'),
		transport: t('block.cat.transport'),
		activities: t('block.cat.activities'),
		shopping: t('block.cat.shopping'),
		other: t('block.cat.other')
	});
	function setCostAmount(raw: string) {
		const v = raw === '' ? NaN : Number(raw);
		if (!(v > 0)) {
			block.cost = undefined;
			return;
		}
		block.cost = { amount: v, category: block.cost?.category };
	}
	function setCostCategory(raw: string) {
		if (!block.cost) return;
		block.cost = { amount: block.cost.amount, category: raw === '' ? undefined : (raw as CostCategory) };
	}

	function addWaypoint() {
		(block.waypoints ??= []).push({ query: '', name: emptyLocalized(langs) });
	}
	function addPhoto() {
		(block.photoSpots ??= []).push({ name: '', mapsUrl: '' });
	}
	function addLink() {
		(block.links ??= []).push({ url: '' });
	}
	function addChecklist() {
		block.checklist = { title: emptyLocalized(langs), items: [{ text: emptyLocalized(langs), done: false }] };
	}
	function addChecklistItem() {
		(block.checklist ??= { title: emptyLocalized(langs), items: [] }).items.push({
			text: emptyLocalized(langs),
			done: false
		});
	}
</script>

<details class="block" bind:open>
	<summary>
		<span
			class="grip"
			aria-hidden="true"
			title={t('block.dragReorder')}
			onpointerdown={onGrab}
			ontouchstart={onGrab}
			onclick={(e) => e.preventDefault()}
		>⠿</span>
		<span class="time">{block.time || '—'}</span>
		<span class="title">{summary}</span>
		<span class="controls">
			<button type="button" disabled={!canUp} onclick={(e) => (e.preventDefault(), onMove(-1))} aria-label={t('block.moveUp')}>↑</button>
			<button type="button" disabled={!canDown} onclick={(e) => (e.preventDefault(), onMove(1))} aria-label={t('block.moveDown')}>↓</button>
			{#if onDuplicate}<button type="button" onclick={(e) => (e.preventDefault(), onDuplicate())} aria-label={t('block.duplicateAria')}>{t('day.duplicate')}</button>{/if}
			<button type="button" class="del" onclick={(e) => (e.preventDefault(), onRemove())} aria-label={t('block.removeAria')}>✕</button>
		</span>
	</summary>

	{#if open}
	<div class="body" bind:this={bodyEl}>
		<div class="grid2">
			<label class="f">{t('block.time')}<input type="text" bind:value={block.time} placeholder={t('block.timePlaceholder')} /></label>
			<label class="f">{t('block.dotColor')}<input type="color" bind:value={block.dotColor} /></label>
		</div>
		<LocalizedInput bind:value={block.title} {langs} label={t('block.title')} />

		{#if tagKeys.length}
			<div class="tags">
				<span class="lbl">{t('block.tags')}</span>
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

		<LocalizedInput bind:value={block.description as never} {langs} label={t('block.description')} multiline />

		<PlaceSearch label={t('block.findPlace')} onPick={onPickPlace} />

		<div class="grid2">
			<label class="f">{t('block.mapsUrl')}<input type="text" bind:value={block.mapsUrl} placeholder="https://maps.google.com/?q=..." /></label>
			<label class="f">{t('block.walkKm')}<input type="number" step="0.1" min="0" bind:value={block.km} /></label>
		</div>

		<div class="grid2">
			<label class="f">{t('block.costAmount')}<input type="number" step="0.01" min="0" value={block.cost?.amount ?? ''} oninput={(e) => setCostAmount(e.currentTarget.value)} /></label>
			<label class="f">{t('block.costCategory')}
				<select value={block.cost?.category ?? ''} onchange={(e) => setCostCategory(e.currentTarget.value)} disabled={!block.cost}>
					<option value="">{t('block.costCatNone')}</option>
					{#each COST_CATEGORIES as c (c)}<option value={c}>{catLabels[c]}</option>{/each}
				</select>
			</label>
		</div>

		<div class="grid2">
			<label class="f">{t('block.lat')}<input type="number" step="any" value={block.coords?.lat ?? ''} oninput={(e) => setCoord('lat', e.currentTarget.value)} /></label>
			<label class="f">{t('block.lon')}<input type="number" step="any" value={block.coords?.lon ?? ''} oninput={(e) => setCoord('lon', e.currentTarget.value)} /></label>
		</div>

		<LocalizedInput bind:value={block.warning as never} {langs} label={t('block.warning')} multiline />
		<LocalizedInput bind:value={block.note as never} {langs} label={t('block.note')} multiline />

		<div class="sub">
			<div class="sub-hd"><span class="lbl">{t('block.waypoints')}</span><button type="button" onclick={addWaypoint}>+ {t('common.add')}</button></div>
			{#each block.waypoints ?? [] as wp, i (i)}
				<div class="rowline">
					<input type="text" bind:value={wp.query} placeholder="Place+Query+For+Maps" aria-label={t('block.waypointQueryAria')} />
					<LocalizedInput bind:value={wp.name} {langs} label={t('block.name')} />
					<button type="button" class="del" onclick={() => removeAt(block.waypoints!, i)}>✕</button>
				</div>
			{/each}
		</div>

		<div class="sub">
			<div class="sub-hd"><span class="lbl">{t('block.photoSpots')}</span><button type="button" onclick={addPhoto}>+ {t('common.add')}</button></div>
			{#each block.photoSpots ?? [] as ps, i (i)}
				<div class="photo">
					<input type="text" bind:value={ps.name} placeholder={t('block.captionPlaceholder')} aria-label={t('block.photoCaptionAria')} />
					<input type="text" bind:value={ps.mapsUrl} placeholder={t('block.photoMapsPlaceholder')} aria-label={t('block.photoMapsAria')} />
					<input type="text" bind:value={ps.wiki} placeholder={t('block.wikiPlaceholder')} aria-label={t('block.wikiAria')} />
					<input type="text" bind:value={ps.fallbackImg} placeholder={t('block.fallbackImgPlaceholder')} aria-label={t('block.fallbackImgAria')} />
					<button type="button" class="del" onclick={() => removeAt(block.photoSpots!, i)}>✕</button>
				</div>
			{/each}
		</div>

		<div class="sub">
			<div class="sub-hd"><span class="lbl">{t('block.links')}</span><button type="button" onclick={addLink}>+ {t('common.add')}</button></div>
			{#each block.links ?? [] as lk, i (i)}
				<div class="rowline">
					<input type="url" bind:value={lk.url} placeholder={t('block.linkUrlPlaceholder')} aria-label={t('block.linkUrlAria')} />
					<input type="text" bind:value={lk.label} placeholder={t('block.linkLabelPlaceholder')} aria-label={t('block.linkLabelAria')} />
					<button type="button" class="del" onclick={() => removeAt(block.links!, i)}>✕</button>
				</div>
			{/each}
		</div>

		<div class="sub">
			<div class="sub-hd">
				<span class="lbl">{t('block.checklist')}</span>
				{#if block.checklist}
					<button type="button" class="del" onclick={() => (block.checklist = undefined)}
						>✕ {t('block.checklistRemove')}</button
					>
				{:else}
					<button type="button" onclick={addChecklist}>+ {t('common.add')}</button>
				{/if}
			</div>
			{#if block.checklist}
				<LocalizedInput bind:value={block.checklist.title} {langs} label={t('block.checklistTitle')} />
				{#each block.checklist.items as item, i (i)}
					<div class="rowline">
						<label class="chk"><input type="checkbox" bind:checked={item.done} /></label>
						<LocalizedInput bind:value={item.text} {langs} label={t('block.checklistItem')} />
						<button type="button" class="del" onclick={() => removeAt(block.checklist!.items, i)}>✕</button>
					</div>
				{/each}
				<button type="button" onclick={addChecklistItem}>+ {t('block.checklistAddItem')}</button>
			{/if}
		</div>

		<div class="sub">
			<label class="f">{t('block.planDiff')}
				<select value={diffKind} onchange={(e) => setDiffKind(e.currentTarget.value)}>
					<option value="none">{t('block.diffNone')}</option>
					<option value="added">{t('block.diffAdded')}</option>
					<option value="changed">{t('block.diffChanged')}</option>
					<option value="kept">{t('block.diffKept')}</option>
				</select>
			</label>
			{#if block.diff}
				<LocalizedInput bind:value={block.diff.reason} {langs} label={t('block.diffReason')} multiline />
			{/if}
		</div>
	</div>
	{/if}
</details>

<style>
	.block {
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		margin-bottom: 0.4rem;
		background: var(--surface);
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
		color: var(--text-muted);
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
		color: var(--text-muted);
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
		border-top: 1px solid var(--hairline);
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
		border-radius: var(--radius-md);
	}
	.lbl {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0.25rem 0 0.5rem;
	}
	.chip {
		font-size: 0.72rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.55rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.chip.on {
		background: var(--pill-info-bg);
		border-color: var(--pill-info-bg);
	}
	.chip input {
		display: none;
	}
	.sub {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--hairline);
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
	.chk {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	.rowline input,
	.photo input {
		font: inherit;
		font-size: 0.8rem;
		background: var(--surface);
		color: var(--text);
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		flex: 1;
		min-width: 8rem;
	}
	button {
		font: inherit;
		font-size: 0.8rem;
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		border-radius: var(--radius-button);
		padding: 0.2rem 0.5rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.del {
		color: var(--pill-bug-fg);
	}
</style>
