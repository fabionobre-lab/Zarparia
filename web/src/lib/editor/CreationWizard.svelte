<script lang="ts">
	import type { Trip } from '$lib/trip-engine';
	import { scaffoldTrip, slugifyId, isoAddDays, move, removeAt, type WizardStop } from './factories';
	import { t } from '$lib/i18n/store.svelte';

	let { onCreate, onBlank }: { onCreate: (trip: Trip) => void; onBlank: () => void } = $props();

	// Common IANA zones; the select is applied to every segment's weather.
	const TIMEZONES = [
		'Europe/London',
		'Europe/Lisbon',
		'Europe/Paris',
		'Europe/Madrid',
		'Europe/Rome',
		'Europe/Berlin',
		'Europe/Athens',
		'Europe/Moscow',
		'America/New_York',
		'America/Toronto',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'America/Mexico_City',
		'America/Sao_Paulo',
		'Asia/Dubai',
		'Asia/Kolkata',
		'Asia/Singapore',
		'Asia/Hong_Kong',
		'Asia/Shanghai',
		'Asia/Tokyo',
		'Australia/Sydney',
		'Pacific/Auckland',
		'UTC'
	];

	let step = $state<1 | 2>(1);

	// Step 1
	let title = $state('');
	let startDate = $state('');
	let languages = $state<string[]>(['en']);
	let defaultLanguage = $state('en');
	let timezone = $state('Europe/London');
	let homeName = $state('');

	// Inline "add language" (no native prompt).
	let langFormOpen = $state(false);
	let langInput = $state('');
	let langErr = $state('');
	function submitLanguage() {
		const code = langInput.trim().toLowerCase();
		if (code.length < 2) return (langErr = t('wizard.errLangCode'));
		if (languages.includes(code)) return (langErr = t('wizard.errLangDup', { code }));
		languages.push(code);
		langInput = '';
		langErr = '';
		langFormOpen = false;
	}
	function removeLanguage(code: string) {
		if (languages.length <= 1) return;
		languages = languages.filter((l) => l !== code);
		if (defaultLanguage === code) defaultLanguage = languages[0];
	}

	// Step 2 — stops
	let stops = $state<WizardStop[]>([{ name: '', nights: 1 }]);
	function addStop() {
		stops.push({ name: '', nights: 1 });
	}

	const validStops = $derived(stops.filter((s) => s.name.trim() !== ''));
	const totalNights = $derived(validStops.reduce((s, st) => s + Math.max(1, Math.floor(st.nights) || 1), 0));
	const endDate = $derived(startDate && totalNights ? isoAddDays(startDate, totalNights) : '');
	const step1Valid = $derived(title.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(startDate));

	let step1Err = $state('');
	function goStep2() {
		if (!title.trim()) return (step1Err = t('wizard.errTitle'));
		if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return (step1Err = t('wizard.errStartDate'));
		step1Err = '';
		step = 2;
	}

	let creating = $state(false);
	let createErr = $state('');

	/** Geocode a place name via Nominatim; returns [lat, lon] or null on any miss. */
	async function geocode(q: string): Promise<[number, number] | null> {
		try {
			const r = await fetch(
				`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
				{ headers: { Accept: 'application/json' } }
			);
			if (!r.ok) return null;
			const arr = (await r.json()) as Array<{ lat: string; lon: string }>;
			if (!Array.isArray(arr) || !arr[0]) return null;
			const lat = parseFloat(arr[0].lat);
			const lon = parseFloat(arr[0].lon);
			return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
		} catch {
			return null;
		}
	}

	async function create() {
		if (validStops.length === 0) return (createErr = t('wizard.errAddStop'));
		createErr = '';
		creating = true;
		const trip = scaffoldTrip({
			title,
			startDate,
			languages,
			defaultLanguage,
			timezone,
			homeName,
			stops
		});
		// Geocode each segment name (1 req/s per Nominatim policy). On a miss we
		// DROP the weather object entirely rather than leave lat/lon at 0,0 (those
		// are fabricated coordinates in the Gulf of Guinea that look valid); the
		// editor then shows weather unchecked so the user can enable + search later.
		for (let i = 0; i < trip.segments.length; i++) {
			const seg = trip.segments[i];
			const name = seg.title[defaultLanguage] ?? '';
			const hit = name ? await geocode(name) : null;
			if (hit && seg.weather) {
				seg.weather.lat = hit[0];
				seg.weather.lon = hit[1];
			} else {
				seg.weather = undefined;
			}
			if (i < trip.segments.length - 1) await new Promise((res) => setTimeout(res, 1100));
		}
		creating = false;
		onCreate(trip);
	}
</script>

<div class="wizard">
	<div class="head">
		<h1>{t('wizard.newTrip')}</h1>
		<a class="blanklink" href="#blank" onclick={(e) => (e.preventDefault(), onBlank())}>{t('wizard.startBlank')}</a>
	</div>
	<div class="steps">
		<span class="stepdot" class:on={step === 1}>{t('wizard.step1')}</span>
		<span class="stepdot" class:on={step === 2}>{t('wizard.step2')}</span>
	</div>

	{#if step === 1}
		<div class="card">
			<label class="f">{t('wizard.tripTitle')}
				<input type="text" bind:value={title} placeholder={t('wizard.tripTitlePlaceholder')} />
			</label>
			<label class="f">{t('wizard.startDate')}
				<input type="date" bind:value={startDate} />
			</label>

			<div class="f">
				<span class="lbl">{t('wizard.languages')}</span>
				<div class="chips">
					{#each languages as l (l)}
						<span class="chip">{l}{#if languages.length > 1}<button type="button" onclick={() => removeLanguage(l)}>✕</button>{/if}</span>
					{/each}
					{#if !langFormOpen}
						<button type="button" class="add" onclick={() => { langFormOpen = true; langErr = ''; }}>{t('wizard.addLanguage')}</button>
					{/if}
				</div>
				{#if langFormOpen}
					<div class="miniform">
						<input
							type="text"
							placeholder={t('wizard.langCodePlaceholder')}
							bind:value={langInput}
							onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), submitLanguage())}
							aria-label={t('wizard.newLangCodeAria')}
						/>
						<button type="button" class="add" onclick={submitLanguage}>{t('common.add')}</button>
						<button type="button" onclick={() => { langFormOpen = false; langInput = ''; langErr = ''; }}>{t('common.cancel')}</button>
						{#if langErr}<span class="err">{langErr}</span>{/if}
					</div>
				{/if}
				{#if languages.length > 1}
					<label class="inline">{t('wizard.default')}
						<select bind:value={defaultLanguage}>
							{#each languages as l (l)}<option value={l}>{l}</option>{/each}
						</select>
					</label>
				{/if}
			</div>

			<label class="f">{t('wizard.timezone')} <span class="lblhint">{t('wizard.appliedAllStops')}</span>
				<select bind:value={timezone}>
					{#each TIMEZONES as tz (tz)}<option value={tz}>{tz}</option>{/each}
				</select>
			</label>

			<label class="f">{t('wizard.homeBase')} <span class="lblhint">{t('wizard.optional')}</span>
				<input type="text" bind:value={homeName} placeholder={t('wizard.homePlaceholder')} />
			</label>

			{#if step1Err}<div class="err">{step1Err}</div>{/if}
			<div class="actions">
				<button type="button" class="primary" disabled={!step1Valid} onclick={goStep2}>{t('wizard.nextStops')}</button>
			</div>
		</div>
	{:else}
		<div class="card">
			<div class="stops-hd"><span class="lbl">{t('wizard.stops')}</span><button type="button" onclick={addStop}>{t('wizard.addStop')}</button></div>
			{#each stops as stop, i (i)}
				<div class="stoprow">
					<input class="sname" type="text" bind:value={stop.name} placeholder={t('wizard.stopNamePlaceholder')} aria-label={t('wizard.stopNameAria')} />
					<label class="nights">{t('wizard.nights')}
						<input type="number" min="1" step="1" bind:value={stop.nights} aria-label={t('wizard.nights')} />
					</label>
					<div class="rowctl">
						<button type="button" disabled={i === 0} onclick={() => move(stops, i, -1)} aria-label={t('wizard.moveStopUp')}>↑</button>
						<button type="button" disabled={i === stops.length - 1} onclick={() => move(stops, i, 1)} aria-label={t('wizard.moveStopDown')}>↓</button>
						<button type="button" class="del" disabled={stops.length <= 1} onclick={() => removeAt(stops, i)} aria-label={t('wizard.removeStop')}>✕</button>
					</div>
				</div>
			{/each}

			<div class="footer">
				{#if totalNights}
					<span><strong>{totalNights}</strong> {t('wizard.nightsWord')} · <strong>{totalNights + 1}</strong> {t('wizard.daysWord')}</span>
					{#if endDate}<span>{startDate} → {endDate}</span>{/if}
				{:else}
					<span class="muted">{t('wizard.addStopHint')}</span>
				{/if}
			</div>

			{#if createErr}<div class="err">{createErr}</div>{/if}
			<div class="actions">
				<button type="button" onclick={() => (step = 1)}>{t('wizard.back')}</button>
				<button type="button" class="primary" disabled={validStops.length === 0 || creating} onclick={create}>
					{creating ? t('wizard.creating') : t('wizard.createTrip')}
				</button>
			</div>
			{#if creating}<div class="muted geo">{t('wizard.lookingUpCoords')}</div>{/if}
		</div>
	{/if}
</div>

<style>
	.wizard {
		max-width: 640px;
		margin: 0 auto;
		padding: 1.5rem 1.5rem 3rem;
		font-family: var(--font-ui);
		color: var(--text);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	h1 {
		font-size: var(--type-h1);
	}
	.blanklink {
		font-size: 0.85rem;
		color: var(--accent-strong);
		text-decoration: none;
	}
	.blanklink:hover {
		text-decoration: underline;
	}
	.steps {
		display: flex;
		gap: 0.5rem;
		margin: 0.8rem 0 1rem;
	}
	.stepdot {
		font-size: 0.78rem;
		padding: 0.25rem 0.7rem;
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		color: var(--text-muted);
	}
	.stepdot.on {
		background: var(--accent);
		color: #fff;
	}
	.card {
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-lg);
		background: var(--surface);
		padding: 1.1rem 1.1rem 1rem;
	}
	.f {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		margin-bottom: 0.9rem;
	}
	.lbl {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		font-weight: 600;
	}
	.lblhint {
		font-size: 0.62rem;
		color: var(--text-muted);
		text-transform: none;
		letter-spacing: normal;
	}
	.f input,
	.f select,
	.inline select {
		font: inherit;
		font-size: 0.9rem;
		text-transform: none;
		letter-spacing: normal;
		color: var(--text);
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
	}
	.inline {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 0.4rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
		margin: 0.2rem 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.6rem;
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: normal;
	}
	.chip button {
		border: none;
		background: none;
		cursor: pointer;
		color: var(--pill-bug-fg);
		padding: 0;
	}
	.miniform {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin: 0.3rem 0;
	}
	.miniform input {
		font: inherit;
		font-size: 0.85rem;
		background: var(--surface);
		color: var(--text);
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
	}
	.stops-hd {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.6rem;
	}
	.stoprow {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
		margin-bottom: 0.5rem;
	}
	.sname {
		flex: 1;
		font: inherit;
		font-size: 0.9rem;
		background: var(--surface);
		color: var(--text);
		padding: 0.45rem 0.5rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		min-width: 0;
	}
	.nights {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		width: 4.5rem;
	}
	.nights input {
		font: inherit;
		font-size: 0.9rem;
		background: var(--surface);
		color: var(--text);
		padding: 0.45rem 0.4rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
	}
	.rowctl {
		display: flex;
		gap: 0.2rem;
	}
	.footer {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.4rem;
		font-size: 0.85rem;
		border-top: 1px dashed var(--hairline-strong);
		margin-top: 0.5rem;
		padding-top: 0.7rem;
		color: var(--text-muted);
	}
	.actions {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 1rem;
	}
	.actions button {
		font: inherit;
		font-size: 0.9rem;
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		border-radius: var(--radius-button);
		padding: 0.5rem 1.1rem;
		cursor: pointer;
	}
	.primary {
		background: var(--accent) !important;
		color: #fff;
		border-color: var(--accent) !important;
		margin-left: auto;
	}
	.primary:disabled {
		opacity: 0.5;
		cursor: default;
	}
	button.add {
		font: inherit;
		font-size: 0.8rem;
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		border-radius: var(--radius-button);
		padding: 0.25rem 0.6rem;
		cursor: pointer;
	}
	.rowctl button {
		font: inherit;
		font-size: 0.8rem;
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		border-radius: var(--radius-button);
		padding: 0.3rem 0.5rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.del {
		color: var(--pill-bug-fg);
	}
	.err {
		flex-basis: 100%;
		font-size: 0.8rem;
		color: var(--pill-bug-fg);
		margin-top: 0.3rem;
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.82rem;
	}
	.geo {
		margin-top: 0.6rem;
	}
</style>
