<script lang="ts">
	import { untrack } from 'svelte';
	import type { Plan, Day, Trip } from '$lib/trip-engine';
	import { move, removeAt, blankDay, emptyLocalized, isoAddDays } from './factories';
	import { dndzone, dndId, fromItems, grabHandle, FLIP_MS } from './dnd';
	import DayEditor from './DayEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';
	import { t } from '$lib/i18n/store.svelte';

	type DayItem = { id: string; item: Day };

	let {
		plan = $bindable(),
		langs,
		tags,
		multiPlan,
		onRemove,
		onMove,
		canUp,
		canDown
	}: {
		plan: Plan;
		langs: string[];
		tags: Trip['tags'];
		multiPlan: boolean;
		onRemove: () => void;
		onMove: (dir: -1 | 1) => void;
		canUp: boolean;
		canDown: boolean;
	} = $props();

	const hasDiffLabels = $derived(!!plan.diffLabels);
	function toggleDiffLabels(on: boolean) {
		plan.diffLabels = on
			? { added: emptyLocalized(langs), changed: emptyLocalized(langs), kept: emptyLocalized(langs) }
			: undefined;
	}
	// Auto-expand + focus the most recently added/duplicated day.
	let justAddedDay = $state<Day | null>(null);
	function addDay() {
		const d = blankDay(langs);
		// Default the new day's date to the previous day's date + 1 (blank if none).
		const prev = plan.days[plan.days.length - 1];
		if (prev?.date) d.date = isoAddDays(prev.date, 1);
		plan.days.push(d);
		// Read the element back so the identity matches the reactive proxy the
		// template sees (Svelte wraps inserted objects), so autoOpen resolves.
		justAddedDay = plan.days[plan.days.length - 1];
		syncItems();
	}
	/** Deep-clone a day (from its snapshot), date = source date + 1, insert right
	 *  after the source, expanded. */
	function duplicateDay(src: Day) {
		const i = plan.days.indexOf(src);
		if (i === -1) return;
		const copy = structuredClone($state.snapshot(src)) as Day;
		if (src.date) copy.date = isoAddDays(src.date, 1);
		plan.days.splice(i + 1, 0, copy);
		justAddedDay = plan.days[i + 1];
		syncItems();
	}

	// ── Drag reorder for days within this plan (handle-initiated) ──
	// See DayEditor for the state/effect rationale (dnd owns list identity during
	// a drag; the model is mirrored on consider/finalize).
	let dayDragDisabled = $state(true);
	const wrap = (d: Day): DayItem => ({ id: dndId(d), item: d });
	let dayItems = $state<DayItem[]>(plan.days.map(wrap));
	// Rebuild the wrapped list from the model. Called imperatively after add/
	// remove/duplicate (in-place array mutations don't reliably re-fire the sync
	// effect below), and left as a fallback for external model changes.
	function syncItems() {
		dayItems = plan.days.map(wrap);
	}
	$effect(() => {
		const modelIds = plan.days.map(dndId).join('|');
		untrack(() => {
			if (dayItems.map((w) => w.id).join('|') !== modelIds) dayItems = plan.days.map(wrap);
		});
	});
	function considerDays(e: CustomEvent<{ items: DayItem[] }>) {
		dayItems = e.detail.items;
	}
	function finalizeDays(e: CustomEvent<{ items: DayItem[] }>) {
		dayItems = e.detail.items;
		plan.days = fromItems(e.detail.items);
		dayDragDisabled = true;
	}
	function grabDay() {
		grabHandle((v) => (dayDragDisabled = v));
	}
	function dayIdx(d: Day): number {
		return plan.days.indexOf(d);
	}
</script>

<div class="plan">
	{#if multiPlan}
		<div class="plan-hd">
			<input class="pid" type="text" bind:value={plan.id} placeholder="plan-id" aria-label={t('plan.idAria')} />
			<span class="controls">
				<button type="button" disabled={!canUp} onclick={() => onMove(-1)} aria-label={t('plan.moveUp')}>↑</button>
				<button type="button" disabled={!canDown} onclick={() => onMove(1)} aria-label={t('plan.moveDown')}>↓</button>
				<button type="button" class="del" onclick={onRemove}>{t('plan.remove')}</button>
			</span>
		</div>
		<LocalizedInput bind:value={plan.label as never} {langs} label={t('plan.label')} />
		<label class="check"><input type="checkbox" checked={hasDiffLabels} onchange={(e) => toggleDiffLabels(e.currentTarget.checked)} /> {t('plan.diffAnnotations')}</label>
		{#if plan.diffLabels}
			<div class="difflabels">
				<LocalizedInput bind:value={plan.diffLabels.added as never} {langs} label={t('plan.addedPrefix')} />
				<LocalizedInput bind:value={plan.diffLabels.changed as never} {langs} label={t('plan.changedPrefix')} />
				<LocalizedInput bind:value={plan.diffLabels.kept as never} {langs} label={t('plan.keptPrefix')} />
			</div>
		{/if}
	{/if}

	<div class="days-hd"><span class="lbl">{t('plan.days')}</span><button type="button" onclick={addDay}>{t('plan.addDay')}</button></div>
	<div
		class="dndlist"
		use:dndzone={{ items: dayItems, flipDurationMs: FLIP_MS, dragDisabled: dayDragDisabled, dropTargetStyle: {} }}
		onconsider={considerDays}
		onfinalize={finalizeDays}
	>
		{#each dayItems as w (w.id)}
			<DayEditor
				bind:day={w.item}
				{langs}
				{tags}
				autoOpen={w.item === justAddedDay}
				canUp={dayIdx(w.item) > 0}
				canDown={dayIdx(w.item) < plan.days.length - 1}
				onMove={(dir) => { move(plan.days, dayIdx(w.item), dir); syncItems(); }}
				onRemove={() => { removeAt(plan.days, dayIdx(w.item)); syncItems(); }}
				onDuplicate={() => duplicateDay(w.item)}
				onGrab={grabDay}
			/>
		{/each}
	</div>
</div>

<style>
	.plan {
		margin-bottom: 0.5rem;
	}
	.plan-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}
	.pid {
		font: inherit;
		font-size: 0.85rem;
		background: var(--surface);
		color: var(--text);
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 6px;
	}
	.controls {
		display: flex;
		gap: 0.2rem;
	}
	.difflabels {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0.3rem 0 0.5rem;
	}
	.days-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin: 0.5rem 0 0.4rem;
	}
	.lbl {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		font-weight: 600;
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
