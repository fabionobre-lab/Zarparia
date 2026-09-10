<script lang="ts">
	// Full-screen reading guide for one stop, opened from the (i) button on
	// TripBlock's title row. Mechanics copied from nav/MoreSheet.svelte: a
	// hand-rolled focus trap, Escape closes, body scroll lock, and a
	// pushState/beforeNavigate pair so the Android/browser Back gesture closes
	// the sheet instead of leaving the page. Unlike MoreSheet this sheet is
	// content, not chrome — read-only, no editing here (guides are authored
	// through the connector or the trip document).
	import { untrack, onDestroy } from 'svelte';
	import { pushState, beforeNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { type Trip, type Block, loc, safeUrl } from '$lib/trip-engine';
	import { t } from '$lib/i18n/store.svelte';
	import { tripT } from '$lib/i18n/tripChrome';

	let {
		trip,
		lang,
		block,
		mapsLabel,
		onclose
	}: {
		trip: Trip;
		lang: string;
		block: Block;
		/** Existing "open in Maps" chrome label, reused on the Map pill so the
		 *  sheet doesn't introduce a second wording for the same action. */
		mapsLabel: string;
		onclose: () => void;
	} = $props();

	const L = (obj: Parameters<typeof loc>[1]) => loc(trip, obj, lang);

	/** Split a guide text field on blank lines into separate paragraphs. */
	function paras(text: string | undefined): string[] {
		if (!text) return [];
		return text
			.split(/\r?\n\s*\r?\n/)
			.map((p) => p.trim())
			.filter(Boolean);
	}

	const guide = $derived(block.guide);
	const why = $derived(L(guide?.why));
	const before = $derived(L(guide?.before));
	const dontMiss = $derived(guide?.dontMiss ?? []);
	const story = $derived(L(guide?.story));
	const closer = $derived(L(guide?.closer));
	const titleId = 'guide-sheet-title';

	let panelEl = $state<HTMLDivElement | null>(null);
	let restoreFocus: HTMLElement | null = null;

	// ── Android/browser Back closes the sheet (same idiom as MoreSheet) ──
	let entryPushed = false;
	let skipRewind = false;

	beforeNavigate(() => {
		skipRewind = true;
		onclose();
	});

	$effect(() => {
		const flagged = !!page.state.guideSheet;
		untrack(() => {
			if (!entryPushed) {
				entryPushed = true;
				pushState('', { ...page.state, guideSheet: true });
			} else if (entryPushed && !flagged) {
				// Our entry went away while still mounted: Back was pressed.
				entryPushed = false;
				onclose();
			}
		});
	});

	// Rewind our history entry once, when the sheet unmounts (X, Escape, or the
	// block going away). Not in the effect teardown: Svelte 5 runs a teardown
	// before every re-run, and pushState() itself re-runs the effect.
	onDestroy(() => {
		if (entryPushed) {
			entryPushed = false;
			if (!skipRewind && page.state.guideSheet) history.back();
		}
	});

	function focusables(): HTMLElement[] {
		if (!panelEl) return [];
		return Array.from(
			panelEl.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => el.offsetParent !== null);
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		const items = focusables();
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement as HTMLElement | null;
		if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	$effect(() => {
		restoreFocus = document.activeElement as HTMLElement | null;
		document.body.style.overflow = 'hidden';
		requestAnimationFrame(() => focusables()[0]?.focus());
		return () => {
			document.body.style.overflow = '';
			restoreFocus?.focus?.();
			restoreFocus = null;
		};
	});
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div
	bind:this={panelEl}
	class="gs-overlay"
	role="dialog"
	aria-modal="true"
	aria-labelledby={titleId}
	tabindex="-1"
	onkeydown={onKeydown}
>
	<div class="gs-header">
		<button type="button" class="gs-close" onclick={onclose} aria-label={t('guide.close')} title={t('guide.close')}>
			<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
		</button>
		<div class="gs-header-text">
			<h2 id={titleId} class="gs-title">{L(block.title)}</h2>
			<div class="gs-meta">
				<span>{block.time}</span>
				{#if block.mapsUrl}
					<a class="gs-map" href={safeUrl(block.mapsUrl)} target="_blank" rel="noopener noreferrer">{mapsLabel}</a>
				{/if}
			</div>
		</div>
	</div>
	<div class="gs-body">
		<div class="gs-content">
			{#if why}
				<p class="gs-why">{why}</p>
			{/if}
			{#if before}
				<section class="gs-section">
					<h3>{tripT(lang, 'guideBefore')}</h3>
					{#each paras(before) as p, i (i)}
						<p>{p}</p>
					{/each}
				</section>
			{/if}
			{#if dontMiss.length}
				<section class="gs-section">
					<h3>{tripT(lang, 'guideDontMiss')}</h3>
					<ol class="gs-dont-miss">
						{#each dontMiss as item, i (i)}
							<li>
								<strong>{L(item.name)}</strong>
								{#each paras(L(item.text)) as p, j (j)}
									<p>{p}</p>
								{/each}
							</li>
						{/each}
					</ol>
				</section>
			{/if}
			{#if story}
				<section class="gs-section">
					<h3>{tripT(lang, 'guideStory')}</h3>
					{#each paras(story) as p, i (i)}
						<p>{p}</p>
					{/each}
				</section>
			{/if}
			{#if closer}
				<section class="gs-section">
					<h3>{tripT(lang, 'guideCloser')}</h3>
					{#each paras(closer) as p, i (i)}
						<p>{p}</p>
					{/each}
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	.gs-overlay {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		font-family: var(--font-ui);
		opacity: 0;
		transform: translateY(6px);
	}
	@media (prefers-reduced-motion: no-preference) {
		.gs-overlay {
			animation: gs-in var(--dur-base, 0.2s) var(--ease-out, ease) forwards;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.gs-overlay {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes gs-in {
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media print {
		.gs-overlay {
			display: none;
		}
	}
	.gs-header {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: calc(0.9rem + env(safe-area-inset-top)) 1rem 0.9rem;
		border-bottom: 1px solid var(--hairline);
		flex-shrink: 0;
	}
	.gs-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: var(--radius-button);
	}
	.gs-close:hover {
		color: var(--accent-strong);
	}
	.gs-header-text {
		flex: 1;
		min-width: 0;
		padding-top: 8px;
	}
	.gs-title {
		margin: 0;
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 1.15rem;
		font-weight: 600;
		color: var(--text);
		line-height: 1.3;
	}
	.gs-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 5px;
		font-size: 0.75rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.gs-map {
		display: inline-flex;
		align-items: center;
		padding: 2px 10px;
		border-radius: var(--radius-pill);
		background: var(--chip-booking-bg);
		color: var(--chip-booking-fg);
		font-weight: 600;
		text-decoration: none;
		font-size: 0.72rem;
	}
	.gs-body {
		flex: 1;
		overflow-y: auto;
		padding: 0 1rem calc(2rem + env(safe-area-inset-bottom));
	}
	.gs-content {
		max-width: 640px;
		margin: 0 auto;
		padding-top: 1.1rem;
	}
	.gs-why {
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--text);
		margin: 0 0 1.4rem;
	}
	.gs-section {
		margin-bottom: 1.4rem;
	}
	.gs-section h3 {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--accent-strong);
	}
	.gs-section p {
		font-size: 1rem;
		line-height: 1.55;
		color: var(--text);
		margin: 0 0 0.75rem;
	}
	.gs-section p:last-child {
		margin-bottom: 0;
	}
	.gs-dont-miss {
		margin: 0;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.gs-dont-miss li {
		font-size: 1rem;
		line-height: 1.55;
		color: var(--text);
	}
	.gs-dont-miss strong {
		display: block;
		font-weight: 700;
		margin-bottom: 0.15rem;
	}
	.gs-dont-miss p {
		margin: 0;
		color: var(--text);
	}
</style>
