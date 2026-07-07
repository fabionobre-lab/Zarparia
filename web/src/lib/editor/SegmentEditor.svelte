<script lang="ts">
	import type { Segment, Trip } from '$lib/trip-engine';
	import { move, removeAt, blankPlan, emptyLocalized } from './factories';
	import PlanEditor from './PlanEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';

	let {
		segment = $bindable(),
		langs,
		tags,
		onRemove,
		onMove,
		canUp,
		canDown
	}: {
		segment: Segment;
		langs: string[];
		tags: Trip['tags'];
		onRemove: () => void;
		onMove: (dir: -1 | 1) => void;
		canUp: boolean;
		canDown: boolean;
	} = $props();

	const hasWeather = $derived(!!segment.weather);
	function toggleWeather(on: boolean) {
		segment.weather = on ? { lat: 0, lon: 0, granularity: 'daily', timezone: 'Europe/London' } : undefined;
	}

	const hasColors = $derived(!!segment.themeColors);
	function toggleColors(on: boolean) {
		segment.themeColors = on ? { heroBg: '#2b4a2b', accent: '#2b4a2b', eyebrow: '#e8c84a' } : undefined;
	}
	function addPlan() {
		segment.plans.push(blankPlan(langs, 'plan-' + (segment.plans.length + 1)));
	}
</script>

<details class="seg" open>
	<summary>
		<span class="title">{segment.title?.[langs[0]] || segment.id || '(segment)'}</span>
		<span class="controls">
			<button type="button" disabled={!canUp} onclick={(e) => (e.preventDefault(), onMove(-1))}>↑</button>
			<button type="button" disabled={!canDown} onclick={(e) => (e.preventDefault(), onMove(1))}>↓</button>
			<button type="button" class="del" onclick={(e) => (e.preventDefault(), onRemove())}>Remove segment</button>
		</span>
	</summary>
	<div class="body">
		<div class="grid2">
			<label class="f">Segment id<input type="text" bind:value={segment.id} /></label>
			<label class="f">Theme
				<select bind:value={segment.theme}>
					<option value="tartan">tartan (green)</option>
					<option value="navy">navy (blue)</option>
				</select>
			</label>
		</div>
		<LocalizedInput bind:value={segment.title} {langs} label="Segment title" />
		<LocalizedInput bind:value={segment.subtitle as never} {langs} label="Subtitle" />
		<LocalizedInput bind:value={segment.footer as never} {langs} label="Footer" />

		<label class="check"><input type="checkbox" checked={hasColors} onchange={(e) => toggleColors(e.currentTarget.checked)} /> Custom colors (override theme)</label>
		{#if segment.themeColors}
			<div class="grid3">
				<label class="f">Header bg<input type="color" bind:value={segment.themeColors.heroBg} /></label>
				<label class="f">Accent<input type="color" bind:value={segment.themeColors.accent} /></label>
				<label class="f">Eyebrow<input type="color" bind:value={segment.themeColors.eyebrow} /></label>
			</div>
		{/if}

		<label class="check"><input type="checkbox" checked={hasWeather} onchange={(e) => toggleWeather(e.currentTarget.checked)} /> Live weather</label>
		{#if segment.weather}
			<div class="grid4">
				<label class="f">Lat<input type="number" step="0.0001" bind:value={segment.weather.lat} /></label>
				<label class="f">Lon<input type="number" step="0.0001" bind:value={segment.weather.lon} /></label>
				<label class="f">Granularity
					<select bind:value={segment.weather.granularity}>
						<option value="daily">daily</option>
						<option value="hourly">hourly</option>
					</select>
				</label>
				<label class="f">Timezone<input type="text" bind:value={segment.weather.timezone} /></label>
			</div>
		{/if}

		<div class="plans">
			<div class="plans-hd">
				<span class="lbl">Plans {segment.plans.length > 1 ? '(shown as tabs)' : ''}</span>
				<button type="button" onclick={addPlan}>+ Add plan variant</button>
			</div>
			{#if segment.plans.length > 1}
				<label class="f">Default plan
					<select bind:value={segment.defaultPlan}>
						{#each segment.plans as p (p.id)}<option value={p.id}>{p.id}</option>{/each}
					</select>
				</label>
			{/if}
			{#each segment.plans as plan, i (plan)}
				<PlanEditor
					bind:plan={segment.plans[i]}
					{langs}
					{tags}
					multiPlan={segment.plans.length > 1}
					canUp={i > 0}
					canDown={i < segment.plans.length - 1}
					onMove={(dir) => move(segment.plans, i, dir)}
					onRemove={() => removeAt(segment.plans, i)}
				/>
			{/each}
		</div>
	</div>
</details>

<style>
	.seg {
		border: 1px solid #cbbfa6;
		border-radius: 10px;
		margin-bottom: 0.75rem;
		background: #fff;
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.6rem 0.8rem;
		cursor: pointer;
		list-style: none;
		background: #f3eee2;
		border-radius: 10px 10px 0 0;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.title {
		font-weight: 700;
		font-size: 0.95rem;
	}
	.controls {
		display: flex;
		gap: 0.2rem;
	}
	.body {
		padding: 0.7rem 0.8rem;
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
	.grid4 {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
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
	.plans {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid #eee5d6;
	}
	.plans-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
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
