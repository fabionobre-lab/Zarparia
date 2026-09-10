<script lang="ts">
	// One stop on the day's timeline: the time rail (time + weather badge + dot)
	// and the body (title, maps link, tags, description, km/cost, booking links,
	// warning/note, checklist, photo spots, plan diff, linked photos).
	//
	// Extracted verbatim from TripView so the timeline has an editing seam: this
	// is where inline editing and the per-block inspector will attach. Values the
	// component can derive from `trip`/`lang` on its own (localisation, money,
	// chrome strings, online state) are derived here rather than threaded through
	// as props; anything needing TripView's own state (weather cache, wiki
	// thumbnails, checklist persistence, the lightbox) arrives as a prop.
	import {
		type Trip,
		type Block,
		type Plan,
		type PhotoSpot,
		type ChecklistItem,
		type CostCategory,
		loc,
		localeFor,
		safeUrl,
		linkLabel
	} from '$lib/trip-engine';
	import { tripChrome } from '$lib/i18n/tripChrome';
	import { formatTemp, walkMinutes, formatMoney } from '$lib/format';
	import { isOnline } from '$lib/online.svelte';
	import { t } from '$lib/i18n/store.svelte';
	import { type TripPhoto } from '$lib/photos';
	import PhotoStrip from './PhotoStrip.svelte';
	import EditableText from './EditableText.svelte';
	import BlockInspector from './BlockInspector.svelte';
	import GuideSheet from './GuideSheet.svelte';
	import Tip from '$lib/Tip.svelte';

	let {
		trip,
		lang,
		block,
		index,
		stopNum = null,
		isLast,
		plan,
		isNext = false,
		badge = null,
		isPast = false,
		photos = [],
		photoToken,
		spotImg,
		checklistDone,
		onToggleChecklist,
		onopenphoto,
		edit = false,
		onedit,
		oninsertbefore,
		onduplicate,
		onremove,
		onmove,
		ongrab,
		canMoveUp = false,
		canMoveDown = false,
		showDiff = false
	}: {
		trip: Trip;
		lang: string;
		block: Block;
		/** Index within the day's blocks — the checklist/photo placement key. */
		index: number;
		/** This stop's number on the day map and in the Day-Route stepper, shown
		 *  on the dot so a pin can be traced back to its stop. Null for a block
		 *  no surface can locate (no coordinates, no Maps link). */
		stopNum?: number | null;
		/** Last block of the day: suppresses the connector line below the dot. */
		isLast: boolean;
		/** The day's plan, for `diffLabels` on a variant block. */
		plan: Plan;
		/** This is the next upcoming block today (highlights the dot + title). */
		isNext?: boolean;
		/** Hourly/daily weather for this block's time, or null. */
		badge?: { emoji: string; temp: number } | null;
		isPast?: boolean;
		/** Google Photos placed on this block. */
		photos?: TripPhoto[];
		photoToken?: string;
		/** Resolved (and URL-checked) thumbnail for a photo spot, if any. */
		spotImg: (spot: PhotoSpot) => string | undefined;
		/** Rendered done-state of checklist item `ii` (may be an unsaved override). */
		checklistDone: (ii: number, item: ChecklistItem) => boolean;
		onToggleChecklist: (item: ChecklistItem, ii: number) => void;
		onopenphoto: (index: number) => void;
		/** In-place editing: text fields become contenteditable in situ. */
		edit?: boolean;
		/** Fired after any edit, so the page can save and record an undo step.
		 *  `structural` forces its own step (see lib/trip/history.svelte.ts). */
		onedit?: (structural?: boolean) => void;
		/** Insert a new stop immediately above this one. */
		oninsertbefore?: () => void;
		onduplicate?: () => void;
		onremove?: () => void;
		onmove?: (dir: -1 | 1) => void;
		/** Pointer-down on the drag grip, handing control to svelte-dnd-action. */
		ongrab?: (e: Event) => void;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		/** Segment has plan variants, so the diff annotation is meaningful. */
		showDiff?: boolean;
	} = $props();

	const L = (obj: Parameters<typeof loc>[1]) => loc(trip, obj, lang);
	const money = (n: number) => formatMoney(n, trip.currency, localeFor(trip, lang));
	/* Trip-chrome strings follow the TRIP CONTENT language, not the UI locale —
	   see lib/i18n/tripChrome.ts. */
	const uiText = $derived(tripChrome[lang === 'pt' ? 'pt' : 'en']);
	// Offline-stale-weather hint (Phase 6 item 5): while offline a fetch can't
	// have just succeeded, so any badge rendered at all is held-over/static data.
	const offline = $derived(!isOnline());

	// ── Checklist items ──
	// Owned here rather than threaded through TripDay: the list lives on this
	// block, and nothing above needs to know it changed beyond the usual
	// structural-edit notification.
	function addChecklistItem() {
		if (!block.checklist) return;
		block.checklist.items.push({
			text: Object.fromEntries(trip.languages.map((l) => [l, ''])),
			done: false
		});
		onedit?.(true);
	}
	function removeChecklistItem(ii: number) {
		if (!block.checklist) return;
		block.checklist.items.splice(ii, 1);
		onedit?.(true);
	}

	const CATEGORY_EMOJI: Record<CostCategory, string> = {
		lodging: '🛏️',
		food: '🍽️',
		transport: '🚕',
		activities: '🎟️',
		shopping: '🛍️',
		other: '💷'
	};

	// ── Stop guide (i) button + full-screen overlay ──
	// The button only renders once the guide has at least one non-empty
	// section — an empty `guide: {}` object (or one whose only populated
	// field resolves to "" in this language) shouldn't add a dead button.
	const hasGuide = $derived.by(() => {
		const g = block.guide;
		if (!g) return false;
		return !!(L(g.why) || L(g.before) || g.dontMiss?.length || L(g.story) || L(g.closer));
	});
	let guideOpen = $state(false);
</script>

<div class="tb" class:tb-edit={edit}>
	{#if edit}
		<!-- Insert affordance, absolutely positioned on the rail at this stop's top
		     edge. It lives INSIDE the block on purpose: the timeline is a
		     svelte-dnd-action zone while editing, and that library requires the
		     zone's children to map 1:1 onto its items, so a "+" row between blocks
		     would break dragging. -->
		<button class="tb-insert" onclick={() => oninsertbefore?.()} aria-label={t('block.insertBefore')} title={t('block.insertBefore')}>
			<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14" /></svg>
		</button>
	{/if}
	<div class="tb-left">
		{#if edit}
			<span
				class="tb-grip"
				title={t('block.dragReorder')}
				aria-hidden="true"
				onpointerdown={ongrab}
				ontouchstart={ongrab}
			>⠿</span>
		{/if}
		<div class="tb-time">
			{block.time}
			{#if badge && !isPast}
				{#if offline}
					<Tip text={uiText.wxOfflineHint}>
						<div class="wx">
							<span aria-hidden="true">{badge.emoji}</span> {formatTemp(badge.temp)}
							<span class="wx-offline">{uiText.wxOffline}</span>
						</div>
					</Tip>
				{:else}
					<div class="wx">
						<span aria-hidden="true">{badge.emoji}</span> {formatTemp(badge.temp)}
					</div>
				{/if}
			{/if}
		</div>
		<div class="tb-dot-col">
			{#if stopNum != null}
				<div
					class="tb-stop-num"
					class:tb-dot-next={isNext}
					style={block.dotColor ? `--dot:${block.dotColor}` : ''}
					aria-label="{uiText.stop} {stopNum}"
				>{stopNum}</div>
			{:else}
				<div class="tb-dot" class:tb-dot-next={isNext} style="background:{block.dotColor || 'var(--text-muted)'}"></div>
			{/if}
			{#if !isLast}<div class="tb-line"></div>{/if}
		</div>
	</div>
	<div class="tb-body">
		<div class="tb-title-row">
			<div class="tb-title" class:tb-title-next={isNext}>
				<EditableText bind:value={block.title} {lang} {edit} {onedit} label={uiText.edBlockTitle} />
			</div>
			{#if block.mapsUrl}
				<a
					class="map-icon-btn"
					href={safeUrl(block.mapsUrl)}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={uiText.maps}
					title={uiText.maps}
				>
					<span class="map-icon-circle">
						<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
					</span>
				</a>
			{/if}
			{#if hasGuide}
				<button
					type="button"
					class="map-icon-btn"
					onclick={() => (guideOpen = true)}
					aria-label={t('block.guideOpen')}
					title={t('block.guideOpen')}
				>
					<span class="map-icon-circle">
						<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5" stroke-linecap="round" /><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none" /></svg>
					</span>
				</button>
			{/if}
			{#if edit}
				<BlockInspector
					{block}
					{trip}
					{lang}
					{onedit}
					{onduplicate}
					{onremove}
					{onmove}
					{canMoveUp}
					{canMoveDown}
					{showDiff}
				/>
			{/if}
		</div>
		{#if block.tags?.length}
			<div class="tb-tags">
				{#each block.tags as key (key)}
					{@const tag = trip.tags?.[key]}
					{#if tag}<span class="tb-tag {tag.style ?? 'logistics'}">{L(tag.label)}</span>{/if}
				{/each}
			</div>
		{/if}
		<!-- Description is offered as an empty placeholder while editing (it's the
		     field people reach for most); the optional warning/note boxes below are
		     only editable once they exist, since rendering an empty coloured box on
		     every stop would drown the timeline. Adding those is the inspector's
		     job in Phase 3. -->
		{#if edit || L(block.description)}
			<div class="tb-meta">
				<EditableText bind:value={block.description} {lang} {edit} {onedit} label={uiText.edBlockDesc} />
			</div>
		{/if}
		{#if block.km}
			{@const blockWalkMin = walkMinutes(block.km)}
			<div class="km-tag">🚶 ~{block.km} km{#if blockWalkMin} · ~{blockWalkMin} {uiText.walkSuffix}{/if}</div>
		{/if}
		{#if block.cost}
			{@const cat = block.cost.category}
			<div class="cost-tag">
				<span aria-hidden="true">{cat ? CATEGORY_EMOJI[cat] : '💷'}</span>
				{money(block.cost.amount)}{#if cat}<span class="cost-cat"> · {uiText.costCat[cat]}</span>{/if}
			</div>
		{/if}
		{#if block.links?.length}
			<div class="tb-links">
				{#each block.links as lk, i (i)}
					{@const href = safeUrl(lk.url)}
					{#if href}
						<a class="tb-link" {href} target="_blank" rel="noopener noreferrer">
							<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
							{linkLabel(lk)}
						</a>
					{/if}
				{/each}
			</div>
		{/if}
		{#if L(block.warning)}
			<div class="tb-warn">
				<EditableText bind:value={block.warning} {lang} {edit} {onedit} label={uiText.edWarning} />
			</div>
		{/if}
		{#if L(block.note)}
			<div class="tb-note">
				<EditableText bind:value={block.note} {lang} {edit} {onedit} label={uiText.edNote} />
			</div>
		{/if}
		{#if block.checklist}
			{@const doneCount = block.checklist.items.filter((it, ii) => checklistDone(ii, it)).length}
			<div class="tb-checklist">
				<div class="tb-checklist-hdr">
					<span class="tb-checklist-title">
						<EditableText bind:value={block.checklist.title} {lang} {edit} {onedit} label={uiText.edChecklistTitle} />
					</span>
					<span class="tb-checklist-progress">{doneCount}/{block.checklist.items.length}</span>
				</div>
				<ul class="tb-checklist-items">
					{#each block.checklist.items as item, ii (ii)}
						{@const itemDone = checklistDone(ii, item)}
						<li class="tb-checklist-item" class:done={itemDone}>
							<label>
								<input
									type="checkbox"
									checked={itemDone}
									onchange={() => onToggleChecklist(item, ii)}
								/>
								<span class="tb-checklist-text">
									<EditableText bind:value={item.text} {lang} {edit} {onedit} label={uiText.edChecklistItem} />
								</span>
							</label>
							{#if edit}
								<button
									type="button"
									class="cl-del"
									onclick={() => removeChecklistItem(ii)}
									aria-label={t('block.removeChecklistItemAria')}
									title={t('block.removeChecklistItemAria')}
								>✕</button>
							{/if}
						</li>
					{/each}
				</ul>
				{#if edit}
					<button type="button" class="cl-add" onclick={addChecklistItem}>
						+ {t('common.add')}
					</button>
				{/if}
			</div>
		{/if}
		{#if block.photoSpots?.length}
			<div class="tb-photos">
				{#each block.photoSpots as sp (sp)}
					{@const img = spotImg(sp)}
					<a href={safeUrl(sp.mapsUrl)} target="_blank" rel="noopener noreferrer" class="ps-card">
						{#if img}
							<img src={img} class="ps-thumb" alt={L(sp.name)} />
						{:else}
							<div class="ps-thumb ps-placeholder" aria-hidden="true"></div>
						{/if}
						<span class="ps-label">{L(sp.name)}</span>
					</a>
				{/each}
			</div>
		{/if}
		{#if block.diff && plan.diffLabels?.[block.diff.kind]}
			<div class="diff-{block.diff.kind}">{L(plan.diffLabels[block.diff.kind])}{L(block.diff.reason)}</div>
		{/if}
		{#if photos.length}
			<PhotoStrip {photos} tripId={trip.id} {photoToken} openLabel={uiText.openPhoto} onopen={onopenphoto} />
		{/if}
	</div>
</div>

{#if guideOpen}
	<GuideSheet {trip} {lang} {block} mapsLabel={uiText.maps} onclose={() => (guideOpen = false)} />
{/if}

<style>
	.tb {
		display: flex;
	}
	/* Editing chrome anchors to the block box. */
	.tb-edit {
		position: relative;
	}
	/* Insert-above: sits on the timeline rail at this stop's top edge, straddling
	   the boundary with the stop before it. Quiet until the block is hovered so
	   the timeline doesn't read as a row of buttons; always visible on touch,
	   where there is no hover to reveal it. */
	.tb-insert {
		position: absolute;
		top: -9px;
		left: 14px;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 1px solid var(--hairline-strong);
		border-radius: 50%;
		background: var(--surface);
		color: var(--text-muted);
		cursor: pointer;
	}
	@media (hover: hover) {
		.tb-insert {
			opacity: 0;
		}
		.tb:hover .tb-insert,
		.tb-insert:focus-visible {
			opacity: 1;
		}
		.tb-insert:hover {
			border-color: var(--accent-text);
			color: var(--accent-text);
			background: color-mix(in srgb, var(--accent-text) 10%, var(--surface));
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.tb-insert {
			transition:
				opacity 0.12s ease,
				border-color 0.12s ease,
				color 0.12s ease;
		}
	}
	/* Drag grip, above the time on the rail. Cursor + touch-action are what make
	   svelte-dnd-action's handle-initiated drag feel right on touch. */
	.tb-grip {
		font-size: 11px;
		line-height: 1;
		color: var(--text-muted);
		opacity: 0.55;
		cursor: grab;
		touch-action: none;
		user-select: none;
		padding: 0 4px 3px;
	}
	.tb-grip:active {
		cursor: grabbing;
	}
	.tb-left {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 50px;
		flex-shrink: 0;
		padding-top: 12px;
	}
	.tb-time {
		font-size: 10px;
		font-weight: 500;
		color: var(--text-muted);
		text-align: center;
		line-height: 1.2;
		font-variant-numeric: tabular-nums;
	}
	.tb-dot-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 4px;
		flex: 1;
	}
	.tb-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		border: 2px solid var(--surface);
		box-shadow: 0 0 0 1px var(--hairline);
	}
	/* Numbered stop: the counterpart of the day-map pin, so the eye matches pin 5
	   to stop 5 without a legend. Filled with --accent-text rather than --accent:
	   the pin sits on the light map tiles, where solid accent reads strongly,
	   while this one sits on the page surface — in dark mode accent is a dark
	   green on dark navy and all but disappears there. --accent-text is the
	   accent already tuned to be legible against the surface in both themes, so
	   the disc takes it and the digit takes the surface colour back. */
	.tb-stop-num {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		margin-top: -6px;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--accent-text);
		color: var(--surface);
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
		/* A stop's own dot colour rings the disc instead of filling it: as a fill
		   it can be any stored colour, and the digit on top would be a coin toss
		   for legibility. */
		box-shadow:
			0 0 0 2px var(--surface),
			0 0 0 3.5px var(--dot, transparent);
		box-sizing: border-box;
	}
	.tb-line {
		width: 1.5px;
		flex: 1;
		min-height: 14px;
		background: var(--hairline-strong);
		margin-top: 2px;
	}
	.tb-dot-next {
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--accent-text) 25%, transparent),
			0 0 0 1px var(--accent-text);
	}
	.tb-body {
		flex: 1;
		padding: 11px 0 11px 9px;
		border-bottom: 1px solid var(--hairline-strong);
	}
	/* Last stop of the day carries no rule below it. When a trailing "now" marker
	   follows (a separate component, so outside this scope) it is the real last
	   child and this correctly stops matching — same as before the extraction. */
	.tb:last-child .tb-body {
		border-bottom: none;
	}
	.tb-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.tb-title {
		font-family: 'Source Serif 4', serif;
		font-size: 14px;
		font-weight: 500;
		color: var(--text);
		line-height: 1.3;
	}
	.tb-title-next {
		color: var(--accent-text);
		font-weight: 700;
	}
	/* Quiet "open in maps" affordance: a small stone-colored ghost circle on
	   the block's title row. The anchor itself is the full 44px touch target
	   (padding, not visual size) — the visible circle inside it is smaller. */
	.map-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		color: var(--text-muted);
		text-decoration: none;
	}
	/* The guide button reuses .map-icon-btn but is a <button>, not an <a> —
	   reset the native button chrome the anchor never had. */
	button.map-icon-btn {
		border: none;
		background: transparent;
		padding: 0;
		font: inherit;
		cursor: pointer;
	}
	.map-icon-circle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 1px solid var(--hairline-strong);
		background: transparent;
	}
	.map-icon-btn:hover .map-icon-circle,
	.map-icon-btn:focus-visible .map-icon-circle {
		border-color: var(--accent-text);
		color: var(--accent-text);
		background: color-mix(in srgb, var(--accent-text) 8%, transparent);
	}
	@media (prefers-reduced-motion: no-preference) {
		.map-icon-circle {
			transition:
				border-color 0.15s ease,
				background 0.15s ease,
				color 0.15s ease,
				transform 0.1s ease;
		}
		.map-icon-btn:active .map-icon-circle {
			transform: scale(0.9);
		}
	}
	.tb-tags {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		margin: 4px 0 3px;
	}
	.tb-tag {
		font-size: 10px;
		padding: 2px 7px;
		border-radius: var(--radius-pill);
		white-space: nowrap;
	}
	.tb-tag.sight {
		background: var(--chip-sight-bg);
		color: var(--chip-sight-fg);
	}
	.tb-tag.food {
		background: var(--chip-food-bg);
		color: var(--chip-food-fg);
	}
	.tb-tag.logistics {
		background: var(--chip-logistics-bg);
		color: var(--chip-logistics-fg);
	}
	.tb-tag.booking {
		background: var(--chip-booking-bg);
		color: var(--chip-booking-fg);
	}
	.tb-tag.fullday {
		background: var(--chip-fullday-bg);
		color: var(--chip-fullday-fg);
	}
	.tb-tag.birthday {
		background: var(--chip-bday-grad);
		color: var(--chip-bday-fg);
		font-weight: 500;
	}
	.tb-meta {
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.55;
		margin-top: 2px;
	}
	.tb-warn {
		background: var(--warn-bg);
		border-left: 2.5px solid var(--warn-bar);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 5px;
		font-size: 11px;
		color: var(--warn-fg);
		line-height: 1.45;
	}
	.tb-note {
		background: var(--note-bg);
		border-radius: var(--radius-md);
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--note-fg);
		line-height: 1.45;
	}
	.diff-added {
		background: var(--add-bg);
		border-left: 2.5px solid var(--moss);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--add-fg);
		line-height: 1.45;
	}
	.diff-changed {
		background: var(--chg-bg);
		border-left: 2.5px solid var(--gold);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--chg-fg);
		line-height: 1.45;
	}
	.diff-kept {
		background: var(--note-bg);
		border-left: 2.5px solid var(--accent-text);
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		padding: 5px 9px;
		margin-top: 4px;
		font-size: 11px;
		color: var(--note-fg);
		line-height: 1.45;
	}
	.km-tag {
		display: inline-block;
		margin-top: 5px;
		font-size: 10px;
		color: var(--text-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		padding: 1px 7px;
	}
	.cost-tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 5px;
		margin-left: 5px;
		font-size: 10px;
		font-weight: 600;
		color: var(--accent-strong);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		padding: 1px 7px;
		font-variant-numeric: tabular-nums;
	}
	.cost-cat {
		font-weight: 400;
		color: var(--text-muted);
	}
	.tb-links {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin-top: 7px;
	}
	.tb-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 600;
		text-decoration: none;
		color: var(--chip-booking-fg);
		background: var(--chip-booking-bg);
		border-radius: var(--radius-md);
		padding: 3px 9px;
	}
	.tb-link:hover {
		text-decoration: underline;
	}
	.tb-link svg {
		flex-shrink: 0;
		opacity: 0.85;
	}
	.tb-checklist {
		margin-top: 8px;
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		padding: 7px 10px;
	}
	.tb-checklist-hdr {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		font-size: 12px;
		font-weight: 600;
	}
	.tb-checklist-progress {
		font-size: 10px;
		font-weight: 500;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.tb-checklist-items {
		list-style: none;
		margin: 5px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.tb-checklist-item label {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: 12px;
		cursor: pointer;
	}
	.tb-checklist-item input[type='checkbox'] {
		margin-top: 2px;
		flex-shrink: 0;
	}
	.tb-checklist-item.done .tb-checklist-text {
		color: var(--text-muted);
		text-decoration: line-through;
	}
	/* Editing chrome on the list. The row becomes a flex line so the remove
	   control sits at its end without disturbing the label's own layout. */
	.tb-checklist-item {
		display: flex;
		align-items: flex-start;
		gap: 4px;
	}
	.tb-checklist-item label {
		flex: 1;
		min-width: 0;
	}
	.cl-del {
		flex-shrink: 0;
		border: none;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 10px;
		line-height: 1;
		padding: 3px 4px;
		border-radius: var(--radius-sm);
	}
	@media (hover: hover) {
		.cl-del:hover {
			color: var(--warn-fg);
			background: var(--warn-bg);
		}
	}
	.cl-add {
		margin-top: 5px;
		border: 1px dashed var(--hairline-strong);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		font-family: var(--font-ui);
		font-size: 11px;
		padding: 2px 8px;
		cursor: pointer;
	}
	@media (hover: hover) {
		.cl-add:hover {
			border-color: var(--accent-text);
			color: var(--accent-text);
		}
	}
	.tb-photos {
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.ps-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-decoration: none;
		width: 80px;
		flex-shrink: 0;
	}
	.ps-thumb {
		width: 80px;
		height: 55px;
		object-fit: cover;
		border-radius: var(--radius-sm);
		display: block;
		filter: var(--photo-filter);
	}
	.ps-placeholder {
		background: var(--surface-sunken);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.ps-placeholder::after {
		content: '📷';
		font-size: 18px;
		opacity: 0.35;
	}
	.ps-label {
		font-size: 10px;
		color: var(--text-muted);
		text-align: center;
		line-height: 1.3;
		margin-top: 3px;
		padding: 0 2px;
	}
	.wx {
		font-size: 9px;
		color: var(--text-muted);
		margin-top: 3px;
		line-height: 1.2;
		text-align: center;
	}
	/* Offline-stale-weather hint (Phase 6 item 5): .wx is already the muted
	   token; this just de-emphasizes the suffix a touch further, matching the
	   .dh-eye opacity-on-top-of-muted-color pattern used elsewhere. */
	.wx-offline {
		opacity: 0.7;
	}
</style>
