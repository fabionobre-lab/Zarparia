<script lang="ts">
	// Compact search-as-you-type place finder backed by Nominatim (OpenStreetMap).
	// Debounced (400ms), min 3 chars, at most one request/second (stale requests
	// are dropped via a sequence guard). Emits the picked place to the parent.
	import { t } from '$lib/i18n/store.svelte';

	interface NominatimResult {
		display_name: string;
		lat: string;
		lon: string;
	}

	let {
		onPick,
		label = t('place.findPlace'),
		placeholder = t('place.searchPlaceholder')
	}: {
		onPick: (p: { name: string; lat: number; lon: number }) => void;
		label?: string;
		placeholder?: string;
	} = $props();

	const MIN_CHARS = 3;
	const DEBOUNCE_MS = 400;
	const MIN_INTERVAL_MS = 1000;

	let query = $state('');
	let results = $state<NominatimResult[]>([]);
	let open = $state(false);
	let active = $state(-1);
	let searched = $state(false); // a search completed for the current query
	let loading = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let lastFetchAt = 0;
	let seq = 0; // increments per request; late responses whose seq != current are dropped

	// Stable ids for aria wiring (unique per instance).
	const uid = Math.random().toString(36).slice(2, 8);
	const listId = `placesearch-list-${uid}`;
	const optId = (i: number) => `placesearch-opt-${uid}-${i}`;

	function trimName(s: string): string {
		return s.length > 60 ? s.slice(0, 59).trimEnd() + '…' : s;
	}

	function onInput() {
		active = -1;
		searched = false;
		clearTimeout(debounceTimer);
		const q = query.trim();
		if (q.length < MIN_CHARS) {
			results = [];
			open = false;
			return;
		}
		open = true;
		debounceTimer = setTimeout(() => schedule(q), DEBOUNCE_MS);
	}

	// Enforce the 1 req/s ceiling: if we fetched recently, defer until the window
	// opens; a newer keystroke will have cleared this timer in onInput first.
	function schedule(q: string) {
		const wait = MIN_INTERVAL_MS - (Date.now() - lastFetchAt);
		if (wait > 0) {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => schedule(q), wait);
			return;
		}
		void run(q);
	}

	async function run(q: string) {
		if (q !== query.trim()) return; // stale before it even started
		const mine = ++seq;
		lastFetchAt = Date.now();
		loading = true;
		try {
			const r = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
				{ headers: { Accept: 'application/json' } }
			);
			if (mine !== seq) return; // a newer request superseded this one
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			const arr = (await r.json()) as NominatimResult[];
			if (mine !== seq) return;
			results = Array.isArray(arr) ? arr : [];
		} catch {
			if (mine !== seq) return;
			results = []; // errors are silent — the dropdown shows "No results"
		} finally {
			if (mine === seq) {
				loading = false;
				searched = true;
			}
		}
	}

	function pick(r: NominatimResult) {
		const lat = Math.round(parseFloat(r.lat) * 1e5) / 1e5;
		const lon = Math.round(parseFloat(r.lon) * 1e5) / 1e5;
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
		onPick({ name: r.display_name, lat, lon });
		reset();
	}

	function reset() {
		query = '';
		results = [];
		open = false;
		active = -1;
		searched = false;
		seq++; // invalidate any in-flight response
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			open = false;
			active = -1;
			return;
		}
		if (!open || results.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = (active + 1) % results.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = active <= 0 ? results.length - 1 : active - 1;
		} else if (e.key === 'Enter') {
			if (active >= 0 && active < results.length) {
				e.preventDefault();
				pick(results[active]);
			}
		}
	}

	function onFocusOut(e: FocusEvent) {
		const container = e.currentTarget as HTMLElement;
		const next = e.relatedTarget as Node | null;
		if (next && container.contains(next)) return;
		open = false;
		active = -1;
	}
</script>

<div class="place" onfocusout={onFocusOut}>
	<span class="lbl">{label}</span>
	<div class="control">
		<input
			type="text"
			role="combobox"
			aria-expanded={open}
			aria-controls={listId}
			aria-autocomplete="list"
			aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
			autocomplete="off"
			{placeholder}
			bind:value={query}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={() => {
				if (query.trim().length >= MIN_CHARS) open = true;
			}}
		/>
		{#if open}
			<ul class="menu" role="listbox" id={listId} aria-label={label}>
				{#if results.length}
					{#each results as r, i (r.display_name + i)}
						<!-- svelte-ignore a11y_click_events_have_key_events -- keyboard is handled on the combobox input per the ARIA listbox pattern -->
						<li
							id={optId(i)}
							role="option"
							aria-selected={i === active}
							class="opt"
							class:active={i === active}
							onmousedown={(e) => e.preventDefault()}
							onclick={() => pick(r)}
							onmouseenter={() => (active = i)}
						>
							{trimName(r.display_name)}
						</li>
					{/each}
				{:else if searched}
					<li class="opt empty">{t('place.noResults')}</li>
				{:else if loading}
					<li class="opt empty">{t('place.searching')}</li>
				{/if}
				<li class="attr" aria-hidden="true">© OpenStreetMap</li>
			</ul>
		{/if}
	</div>
</div>

<style>
	.place {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-bottom: 0.5rem;
		min-width: 0;
	}
	.lbl {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.control {
		position: relative;
	}
	input {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.85rem;
		color: var(--text);
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 6px;
		background: var(--surface);
	}
	.menu {
		position: absolute;
		top: calc(100% + 2px);
		left: 0;
		right: 0;
		z-index: 20;
		margin: 0;
		padding: 0.2rem;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: 6px;
		box-shadow: 0 6px 18px rgba(30, 22, 8, 0.12);
		max-height: 15rem;
		overflow-y: auto;
	}
	.opt {
		padding: 0.35rem 0.45rem;
		border-radius: 4px;
		font-size: 0.8rem;
		color: var(--text);
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.opt.active {
		background: var(--pill-info-bg);
	}
	.opt.empty {
		color: var(--text-muted);
		cursor: default;
	}
	.attr {
		padding: 0.25rem 0.45rem 0.1rem;
		font-size: 0.62rem;
		color: var(--text-muted);
		text-align: right;
		border-top: 1px solid var(--hairline);
		margin-top: 0.15rem;
	}
</style>
