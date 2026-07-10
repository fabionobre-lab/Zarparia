<script lang="ts">
	import { untrack } from 'svelte';
	import type { Plan, Day, Trip } from '$lib/trip-engine';
	import { move, removeAt, blankDay, emptyLocalized } from './factories';
	import { dndzone, dndId, fromItems, grabHandle, FLIP_MS } from './dnd';
	import DayEditor from './DayEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';

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
	function addDay() {
		plan.days.push(blankDay(langs));
	}

	// ── Drag reorder for days within this plan (handle-initiated) ──
	// See DayEditor for the state/effect rationale (dnd owns list identity during
	// a drag; the model is mirrored on consider/finalize).
	let dayDragDisabled = $state(true);
	const wrap = (d: Day): DayItem => ({ id: dndId(d), item: d });
	let dayItems = $state<DayItem[]>(plan.days.map(wrap));
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
			<input class="pid" type="text" bind:value={plan.id} placeholder="plan-id" aria-label="Plan id" />
			<span class="controls">
				<button type="button" disabled={!canUp} onclick={() => onMove(-1)} aria-label="Move plan up">↑</button>
				<button type="button" disabled={!canDown} onclick={() => onMove(1)} aria-label="Move plan down">↓</button>
				<button type="button" class="del" onclick={onRemove}>Remove plan</button>
			</span>
		</div>
		<LocalizedInput bind:value={plan.label as never} {langs} label="Plan label (tab)" />
		<label class="check"><input type="checkbox" checked={hasDiffLabels} onchange={(e) => toggleDiffLabels(e.currentTarget.checked)} /> Diff annotations (prefix labels)</label>
		{#if plan.diffLabels}
			<div class="difflabels">
				<LocalizedInput bind:value={plan.diffLabels.added as never} {langs} label="Added prefix" />
				<LocalizedInput bind:value={plan.diffLabels.changed as never} {langs} label="Changed prefix" />
				<LocalizedInput bind:value={plan.diffLabels.kept as never} {langs} label="Kept prefix" />
			</div>
		{/if}
	{/if}

	<div class="days-hd"><span class="lbl">Days</span><button type="button" onclick={addDay}>+ Add day</button></div>
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
				canUp={dayIdx(w.item) > 0}
				canDown={dayIdx(w.item) < plan.days.length - 1}
				onMove={(dir) => move(plan.days, dayIdx(w.item), dir)}
				onRemove={() => removeAt(plan.days, dayIdx(w.item))}
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
		padding: 0.3rem 0.5rem;
		border: 1px solid #d8ccb8;
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
		color: #555;
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
		color: #7a6e5f;
		font-weight: 600;
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
