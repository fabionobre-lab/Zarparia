<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { Segment, Trip } from '$lib/trip-engine';
	import { move, removeAt, blankPlan, nextId, slugifyId, THEME_NAMES } from './factories';
	import PlanEditor from './PlanEditor.svelte';
	import LocalizedInput from './LocalizedInput.svelte';
	import PlaceSearch from './PlaceSearch.svelte';
	import { t } from '$lib/i18n/store.svelte';

	let {
		segment = $bindable(),
		langs,
		tags,
		defaultTimezone = 'Europe/London',
		autoOpen = false,
		onRemove,
		onMove,
		onGrab,
		canUp,
		canDown
	}: {
		segment: Segment;
		langs: string[];
		tags: Trip['tags'];
		defaultTimezone?: string;
		autoOpen?: boolean;
		onRemove: () => void;
		onMove: (dir: -1 | 1) => void;
		onGrab?: (e: Event) => void;
		canUp: boolean;
		canDown: boolean;
	} = $props();

	// Lazy body: segments are expanded by default (preserving prior behavior),
	// but the body can be collapsed to drop its inputs from the DOM.
	let open = $state(true);
	let bodyEl = $state<HTMLElement>();
	onMount(() => {
		if (autoOpen) queueMicrotask(() => bodyEl?.querySelector<HTMLElement>('input,select,textarea')?.focus());
	});

	// ── Auto-slug the segment id from the title until the user edits the id ──
	// A blank/placeholder id (new segment) tracks the title; a meaningful id
	// (loaded trip, or once the user types) is left alone.
	let idDirty = $state(!!segment.id && !/^segment(-\d+)?$/.test(segment.id));
	$effect(() => {
		const titleText = segment.title?.[langs[0]] ?? '';
		if (idDirty) return;
		const slug = slugifyId(titleText);
		untrack(() => {
			if (slug && segment.id !== slug) segment.id = slug;
		});
	});

	const hasWeather = $derived(!!segment.weather);
	function toggleWeather(on: boolean) {
		segment.weather = on ? { lat: 0, lon: 0, granularity: 'daily', timezone: defaultTimezone } : undefined;
	}

	const hasColors = $derived(!!segment.themeColors);
	function toggleColors(on: boolean) {
		segment.themeColors = on ? { heroBg: '#2b4a2b', accent: '#2b4a2b', eyebrow: '#e8c84a' } : undefined;
	}
	function addPlan() {
		segment.plans.push(blankPlan(langs, nextId('plan', segment.plans.map((p) => p.id))));
	}
	function onPickWeather(p: { name: string; lat: number; lon: number }) {
		if (!segment.weather) return;
		segment.weather.lat = p.lat;
		segment.weather.lon = p.lon;
	}
</script>

<details class="seg" bind:open>
	<summary>
		<span
			class="grip"
			aria-hidden="true"
			title={t('seg.dragReorder')}
			onpointerdown={onGrab}
			ontouchstart={onGrab}
			onclick={(e) => e.preventDefault()}
		>⠿</span>
		<span class="title">{segment.title?.[langs[0]] || segment.id || t('seg.placeholder')}</span>
		<span class="controls">
			<button type="button" disabled={!canUp} onclick={(e) => (e.preventDefault(), onMove(-1))} aria-label={t('seg.moveUp')}>↑</button>
			<button type="button" disabled={!canDown} onclick={(e) => (e.preventDefault(), onMove(1))} aria-label={t('seg.moveDown')}>↓</button>
			<button type="button" class="del" onclick={(e) => (e.preventDefault(), onRemove())}>{t('seg.remove')}</button>
		</span>
	</summary>
	{#if open}
	<div class="body" bind:this={bodyEl}>
		<div class="grid2">
			<label class="f">{t('seg.segmentId')}
				<input type="text" bind:value={segment.id} oninput={() => (idDirty = true)} placeholder={t('seg.autoPlaceholder')} />
				<span class="fhint">{t('seg.internalKey')}</span>
			</label>
			<label class="f">{t('seg.theme')}
				<select bind:value={segment.theme}>
					{#each THEME_NAMES as themeName (themeName)}<option value={themeName}>{themeName}</option>{/each}
				</select>
			</label>
		</div>
		<LocalizedInput bind:value={segment.title} {langs} label={t('seg.segmentTitle')} />
		<LocalizedInput bind:value={segment.subtitle as never} {langs} label={t('seg.subtitle')} />
		<LocalizedInput bind:value={segment.footer as never} {langs} label={t('seg.footer')} />

		<label class="check"><input type="checkbox" checked={hasColors} onchange={(e) => toggleColors(e.currentTarget.checked)} /> {t('seg.customColors')}</label>
		{#if segment.themeColors}
			<div class="grid3">
				<label class="f">{t('seg.headerBg')}<input type="color" bind:value={segment.themeColors.heroBg} /></label>
				<label class="f">{t('seg.accent')}<input type="color" bind:value={segment.themeColors.accent} /></label>
				<label class="f">{t('seg.eyebrow')}<input type="color" bind:value={segment.themeColors.eyebrow} /></label>
			</div>
		{/if}

		<label class="check"><input type="checkbox" checked={hasWeather} onchange={(e) => toggleWeather(e.currentTarget.checked)} /> {t('seg.liveWeather')}</label>
		{#if segment.weather}
			<PlaceSearch label={t('seg.findPlaceLatLon')} onPick={onPickWeather} />
			<div class="grid4">
				<label class="f">{t('editor.lat')}<input type="number" step="0.0001" bind:value={segment.weather.lat} /></label>
				<label class="f">{t('editor.lon')}<input type="number" step="0.0001" bind:value={segment.weather.lon} /></label>
				<label class="f">{t('seg.granularity')}
					<select bind:value={segment.weather.granularity}>
						<option value="daily">{t('common.daily')}</option>
						<option value="hourly">{t('common.hourly')}</option>
					</select>
				</label>
				<label class="f">{t('seg.timezone')}<input type="text" bind:value={segment.weather.timezone} /></label>
			</div>
		{/if}

		<div class="plans">
			<div class="plans-hd">
				<span class="lbl">{t('seg.plans')} {segment.plans.length > 1 ? t('seg.plansAsTabs') : ''}</span>
				<button type="button" onclick={addPlan}>{t('seg.addPlan')}</button>
			</div>
			{#if segment.plans.length > 1}
				<label class="f">{t('seg.defaultPlan')}
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
	{/if}
</details>

<style>
	.seg {
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-lg);
		margin-bottom: 0.75rem;
		background: var(--surface);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.6rem 0.8rem;
		cursor: pointer;
		list-style: none;
		background: var(--surface-sunken);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
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
	.title {
		flex: 1;
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.grid3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.grid4 {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
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
	.fhint {
		font-size: 0.6rem;
		text-transform: none;
		letter-spacing: normal;
		color: var(--text-muted);
		margin-top: 0.15rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0.3rem 0 0.5rem;
	}
	.plans {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--hairline);
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
		color: var(--text-muted);
		font-weight: 600;
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
	}
	.del {
		color: var(--pill-bug-fg);
	}
</style>
