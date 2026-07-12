<script lang="ts">
	import { onDestroy } from 'svelte';
	import { t } from '$lib/i18n/store.svelte';

	let { tripId, onImported }: { tripId: string; onImported: () => void } = $props();

	type Phase =
		| 'loading' // checking token status
		| 'disconnected' // needs Google consent round-trip
		| 'idle' // connected, ready to open a picker session
		| 'picking' // session open, waiting for the user to finish in Google Photos
		| 'importing'
		| 'done'
		| 'error';

	let phase = $state<Phase>('loading');
	let errKey = $state('photos.errGeneric');
	let pickerUri = $state('');
	let sessionId = '';
	let pollTimer: ReturnType<typeof setTimeout> | undefined;
	let imported = $state(0);
	let unmatched = $state(0);
	let skipped = $state(0);

	const connectHref = $derived(
		`/auth/photos/connect?return=${encodeURIComponent(`/trips/${tripId}`)}`
	);

	$effect(() => {
		fetch('/api/photos/status')
			.then((r) => r.json() as Promise<{ connected?: boolean }>)
			.then((s) => (phase = s.connected ? 'idle' : 'disconnected'))
			.catch(() => (phase = 'disconnected'));
	});

	onDestroy(() => clearTimeout(pollTimer));

	function fail(key: string) {
		clearTimeout(pollTimer);
		errKey = key;
		phase = 'error';
	}

	async function startPicking() {
		phase = 'loading';
		try {
			const res = await fetch('/api/photos/picker-session', { method: 'POST' });
			if (res.status === 401) {
				phase = 'disconnected';
				return;
			}
			if (!res.ok) return fail('photos.errPicker');
			const s = (await res.json()) as { sessionId: string; pickerUri: string; pollIntervalMs: number };
			sessionId = s.sessionId;
			pickerUri = s.pickerUri;
			phase = 'picking';
			poll(Math.max(2000, s.pollIntervalMs));
		} catch {
			fail('photos.errPicker');
		}
	}

	function poll(intervalMs: number) {
		pollTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/photos/picker-session/${encodeURIComponent(sessionId)}`);
				if (res.status === 401) {
					phase = 'disconnected';
					return;
				}
				if (res.status === 410) return fail('photos.errSessionGone');
				if (!res.ok) return fail('photos.errPicker');
				const s = (await res.json()) as { mediaItemsSet: boolean };
				if (s.mediaItemsSet) {
					runImport();
				} else if (phase === 'picking') {
					poll(intervalMs);
				}
			} catch {
				if (phase === 'picking') poll(intervalMs); // transient network blip — keep waiting
			}
		}, intervalMs);
	}

	async function runImport() {
		phase = 'importing';
		imported = 0;
		unmatched = 0;
		skipped = 0;
		let pageToken: string | null = null;
		try {
			do {
				const res: Response = await fetch(`/api/trips/${tripId}/photos`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sessionId, pageToken })
				});
				if (res.status === 401) {
					phase = 'disconnected';
					return;
				}
				if (!res.ok) return fail('photos.errImport');
				const r = (await res.json()) as {
					imported: number;
					unmatched: number;
					skippedExisting: number;
					skippedOther: number;
					nextPageToken: string | null;
				};
				imported += r.imported + r.unmatched;
				unmatched += r.unmatched;
				skipped += r.skippedExisting + r.skippedOther;
				pageToken = r.nextPageToken;
			} while (pageToken);
			phase = 'done';
			onImported();
		} catch {
			fail('photos.errImport');
		}
	}
</script>

<div class="panel">
	<h3>{t('photos.heading')}</h3>

	{#if phase === 'loading'}
		<p class="muted">{t('photos.loading')}</p>
	{:else if phase === 'disconnected'}
		<p class="muted">{t('photos.intro')}</p>
		<a class="cta" href={connectHref} data-sveltekit-reload>{t('photos.connect')}</a>
	{:else if phase === 'idle'}
		<p class="muted">{t('photos.intro')}</p>
		<button class="cta" onclick={startPicking}>{t('photos.choose')}</button>
	{:else if phase === 'picking'}
		<p class="muted">{t('photos.waiting')}</p>
		<a class="cta" href={pickerUri} target="_blank" rel="noreferrer">{t('photos.openGoogle')}</a>
	{:else if phase === 'importing'}
		<p class="muted" aria-live="polite">{t('photos.importing', { n: String(imported) })}</p>
	{:else if phase === 'done'}
		<p class="ok" aria-live="polite">{t('photos.importedDone', { n: String(imported) })}</p>
		{#if unmatched > 0}<p class="muted">{t('photos.unmatchedNote', { n: String(unmatched) })}</p>{/if}
		{#if skipped > 0}<p class="muted">{t('photos.skippedNote', { n: String(skipped) })}</p>{/if}
		<button class="cta" onclick={startPicking}>{t('photos.chooseMore')}</button>
	{:else if phase === 'error'}
		<p class="err">{t(errKey as Parameters<typeof t>[0])}</p>
		<button class="cta" onclick={startPicking}>{t('photos.retry')}</button>
	{/if}

	<p class="hint">{t('photos.hint')}</p>
</div>

<style>
	.panel {
		max-width: 430px;
		margin: 0 auto 1rem;
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: 12px;
		padding: 0.9rem 1rem;
		font-family: system-ui, sans-serif;
	}
	h3 {
		font-size: 0.95rem;
		margin-bottom: 0.6rem;
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin: 0.3rem 0 0.6rem;
	}
	.ok {
		font-size: 0.85rem;
		margin: 0.3rem 0 0.6rem;
	}
	.err {
		color: var(--pill-bug-fg);
		font-size: 0.82rem;
		margin: 0.3rem 0 0.6rem;
	}
	.cta {
		display: inline-block;
		font: inherit;
		font-size: 0.82rem;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: #fff;
		border-radius: 6px;
		padding: 0.4rem 0.8rem;
		cursor: pointer;
		text-decoration: none;
	}
	.hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 0.7rem;
	}
</style>
