<script lang="ts">
	import type { ShareRow, SharePermission } from '$lib/server/shares';
	import { t } from '$lib/i18n/store.svelte';
	import { busyButton } from '$lib/actions/busyButton';

	let { tripId }: { tripId: string } = $props();

	type LinkInfo = { url: string; role: SharePermission } | null;

	let shares = $state<ShareRow[]>([]);
	let email = $state('');
	let permission = $state<SharePermission>('viewer');
	let loading = $state(true);
	let busy = $state(false);
	let error = $state('');

	let link = $state<LinkInfo>(null);
	// Select value mirrors the link state: 'off' when no link, else the role.
	let linkMode = $state<'off' | SharePermission>('off');
	let linkBusy = $state(false);
	let linkError = $state('');
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/shares`);
			if (res.ok) shares = ((await res.json()) as { shares: ShareRow[] }).shares;
			else error = t('share.errLoad');
		} catch {
			error = t('share.errLoad');
		} finally {
			loading = false;
		}
	}

	async function loadLink() {
		linkError = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/share-link`);
			if (res.ok) {
				link = ((await res.json()) as { link: LinkInfo }).link;
				linkMode = link ? link.role : 'off';
			} else {
				linkError = t('share.errLoadLink');
			}
		} catch {
			linkError = t('share.errLoadLink');
		}
	}

	$effect(() => {
		load();
		loadLink();
	});

	async function changeLink(e: Event) {
		const next = (e.currentTarget as HTMLSelectElement).value as 'off' | SharePermission;
		linkBusy = true;
		linkError = '';
		try {
			if (next === 'off') {
				const res = await fetch(`/api/trips/${tripId}/share-link`, { method: 'DELETE' });
				if (res.ok) {
					link = null;
					linkMode = 'off';
				} else {
					linkError = t('share.errTurnOff');
					linkMode = link ? link.role : 'off';
				}
			} else {
				const res = await fetch(`/api/trips/${tripId}/share-link`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ role: next })
				});
				if (res.ok) {
					link = ((await res.json()) as { link: LinkInfo }).link;
					linkMode = link ? link.role : 'off';
				} else {
					linkError = t('share.errUpdateLink');
					linkMode = link ? link.role : 'off';
				}
			}
		} catch {
			linkError = t('share.errNetwork');
			linkMode = link ? link.role : 'off';
		} finally {
			linkBusy = false;
		}
	}

	async function copyLink() {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link.url);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1500);
		} catch {
			linkError = t('share.errCopy');
		}
	}

	async function add(e: Event) {
		e.preventDefault();
		error = '';
		if (!email.trim()) return;
		busy = true;
		try {
			const res = await fetch(`/api/trips/${tripId}/shares`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), permission })
			});
			if (res.ok) {
				email = '';
				await load();
			} else {
				error = ((await res.json()) as { error?: string }).error ?? t('share.errShare');
			}
		} catch {
			error = t('share.errNetwork');
		} finally {
			busy = false;
		}
	}

	async function remove(userId: string) {
		busy = true;
		error = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/shares/${userId}`, { method: 'DELETE' });
			if (res.ok) await load();
			else error = t('share.errRemove');
		} catch {
			error = t('share.errRemove');
		} finally {
			busy = false;
		}
	}
</script>

<div class="panel">
	<h3>{t('share.heading')}</h3>

	<section class="linkshare">
		<label class="lbl" for="link-mode">{t('share.linkSharing')}</label>
		<select id="link-mode" value={linkMode} onchange={changeLink} disabled={linkBusy}>
			<option value="off">{t('share.linkOff')}</option>
			<option value="viewer">{t('share.linkCanView')}</option>
			<option value="editor">{t('share.linkCanEdit')}</option>
		</select>
		{#if link}
			<div class="linkrow">
				<input class="linkurl" type="text" readonly value={link.url} aria-label={t('share.shareableLink')} />
				<button type="button" class="copy" onclick={copyLink} use:busyButton={linkBusy}>
					{copied ? t('share.copied') : t('share.copy')}
				</button>
			</div>
			<p class="sr-only" aria-live="polite">{copied ? t('share.copiedAnnounce') : ''}</p>
		{/if}
		{#if linkError}<p class="err">{linkError}</p>{/if}
	</section>

	<form onsubmit={add}>
		<input type="email" bind:value={email} placeholder={t('share.emailPlaceholder')} required />
		<select bind:value={permission}>
			<option value="viewer">{t('share.optionCanView')}</option>
			<option value="editor">{t('share.optionCanEdit')}</option>
		</select>
		<button type="submit" use:busyButton={busy}>{t('share.shareButton')}</button>
	</form>
	{#if error}<p class="err">{error}</p>{/if}

	{#if loading}
		<p class="muted">{t('share.loading')}</p>
	{:else if shares.length === 0}
		<p class="muted">{t('share.notSharedYet')}</p>
	{:else}
		<ul>
			{#each shares as s (s.userId)}
				<li>
					<span class="who">{s.name ?? s.email}</span>
					<span class="perm">{s.permission === 'editor' ? t('share.optionCanEdit') : t('share.optionCanView')}</span>
					<button type="button" class="rm" onclick={() => remove(s.userId)} use:busyButton={busy}>{t('share.remove')}</button>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="hint">{t('share.hint')}</p>
</div>

<style>
	.panel {
		max-width: 430px;
		margin: 0 auto 1rem;
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-lg);
		padding: 0.9rem 1rem;
		font-family: var(--font-ui);
	}
	h3 {
		font-size: 0.95rem;
		margin-bottom: 0.6rem;
	}
	.linkshare {
		margin-bottom: 0.9rem;
		padding-bottom: 0.9rem;
		border-bottom: 1px solid var(--hairline);
	}
	.lbl {
		display: block;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 0.35rem;
	}
	.linkshare select {
		width: 100%;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
	}
	.linkrow {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}
	.linkurl {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-size: 0.8rem;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
	}
	.copy {
		flex: 0 0 auto;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	form {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	input {
		flex: 1;
		min-width: 10rem;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
	}
	select {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.4rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
	}
	button {
		font: inherit;
		font-size: 0.82rem;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: #fff;
		border-radius: var(--radius-button);
		padding: 0.4rem 0.8rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
	}
	.err {
		color: var(--pill-bug-fg);
		font-size: 0.8rem;
		margin-top: 0.4rem;
	}
	.muted {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin-top: 0.6rem;
	}
	ul {
		list-style: none;
		margin: 0.6rem 0 0;
		padding: 0;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0;
		border-top: 1px solid var(--hairline);
		font-size: 0.85rem;
	}
	.who {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.perm {
		font-size: 0.72rem;
		color: var(--text-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		padding: 0.15rem 0.5rem;
	}
	.rm {
		background: none;
		color: var(--pill-bug-fg);
		border-color: var(--hairline-strong);
		padding: 0.25rem 0.5rem;
	}
	.hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 0.6rem;
	}
</style>
