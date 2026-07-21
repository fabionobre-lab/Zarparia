<script lang="ts">
	import type { ShareRow, InviteRow, SharePermission } from '$lib/server/shares';
	import { t, translateIn, locale } from '$lib/i18n/store.svelte';
	import { LOCALES, LOCALE_SHORT } from '$lib/i18n';
	import type { Locale } from '$lib/i18n/messages';
	import { busyButton } from '$lib/actions/busyButton';
	import { toast } from '$lib/toast';
	import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte';

	let { tripId, tripTitle }: { tripId: string; tripTitle: string } = $props();

	// Language of the composed email, chosen independently of the app's UI
	// language: the owner knows the recipient's language, and for a pending
	// invitee (no account) there's no stored preference to auto-detect. Defaults
	// to the current UI locale.
	let emailLang = $state<Locale>(locale());

	// The message to send is surfaced as a visible, copyable draft rather than
	// only firing a mailto: link — mailto often silently no-ops in embedded/in-app
	// browsers, which read to the user as "nothing happened". The draft is shown
	// automatically right after a share, and reopenable per row.
	let draft = $state<{ kind: 'invite' | 'share'; email: string; permission: SharePermission } | null>(null);

	/** Build the tailored subject/body for a recipient in the chosen emailLang.
	 *  Reads emailLang so the preview updates live when the picker changes. */
	function emailContent(kind: 'invite' | 'share', toEmail: string, perm: SharePermission) {
		const url = `${location.origin}/trips/${tripId}`;
		const role = translateIn(emailLang, perm === 'editor' ? 'share.emailRoleEditor' : 'share.emailRoleViewer');
		const subject = translateIn(emailLang, kind === 'invite' ? 'share.emailInviteSubject' : 'share.emailShareSubject', {
			trip: tripTitle
		});
		const body = translateIn(emailLang, kind === 'invite' ? 'share.emailInviteBody' : 'share.emailShareBody', {
			trip: tripTitle,
			role,
			url,
			email: toEmail
		});
		return { subject, body };
	}

	const draftContent = $derived(draft ? emailContent(draft.kind, draft.email, draft.permission) : null);

	/** Fire a mailto: (opens the owner's mail app where one is registered).
	 *  Best-effort — the Copy button is the reliable path everywhere. */
	function openMailApp() {
		if (!draft || !draftContent) return;
		location.href = `mailto:${encodeURIComponent(draft.email)}?subject=${encodeURIComponent(draftContent.subject)}&body=${encodeURIComponent(draftContent.body)}`;
	}

	async function copyDraft() {
		if (!draftContent) return;
		try {
			await navigator.clipboard.writeText(`${draftContent.subject}\n\n${draftContent.body}`);
			toast(t('share.emailCopied'));
		} catch {
			error = t('share.errCopy');
		}
	}

	type LinkInfo = { url: string; role: SharePermission } | null;

	let shares = $state<ShareRow[]>([]);
	let invites = $state<InviteRow[]>([]);
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

	// Public link (docs/public-share-route-spec.md) — anonymous, read-only,
	// a separate control from the collaborator link above (different table,
	// different grant: never signs the visitor into anything).
	type PublicLinkInfo = { url: string } | null;
	let publicLink = $state<PublicLinkInfo>(null);
	let publicLoading = $state(true);
	let publicBusy = $state(false);
	let publicError = $state('');
	let publicRevokeOpen = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/shares`);
			if (res.ok) {
				const data = (await res.json()) as { shares: ShareRow[]; invites?: InviteRow[] };
				shares = data.shares;
				invites = data.invites ?? [];
			} else error = t('share.errLoad');
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
		loadPublicLink();
	});

	async function loadPublicLink() {
		publicError = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/public-link`);
			if (res.ok) publicLink = ((await res.json()) as { link: PublicLinkInfo }).link;
			else publicError = t('share.publicErrLoad');
		} catch {
			publicError = t('share.publicErrLoad');
		} finally {
			publicLoading = false;
		}
	}

	async function createPublicLink() {
		publicBusy = true;
		publicError = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/public-link`, { method: 'PUT' });
			if (res.ok) publicLink = ((await res.json()) as { link: PublicLinkInfo }).link;
			else publicError = t('share.publicErrCreate');
		} catch {
			publicError = t('share.errNetwork');
		} finally {
			publicBusy = false;
		}
	}

	async function copyPublicLink() {
		if (!publicLink) return;
		try {
			await navigator.clipboard.writeText(publicLink.url);
			toast(t('toast.publicLinkCopied'));
		} catch {
			publicError = t('share.errCopy');
		}
	}

	async function confirmRevokePublicLink() {
		publicBusy = true;
		publicError = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/public-link`, { method: 'DELETE' });
			if (res.ok) {
				publicLink = null;
				toast(t('toast.publicLinkRevoked'));
			} else {
				publicError = t('share.publicErrRevoke');
			}
		} catch {
			publicError = t('share.errNetwork');
		} finally {
			publicBusy = false;
		}
	}

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
				const data = (await res.json()) as { invite?: unknown };
				const sharedEmail = email.trim();
				const sharedPermission = permission;
				email = '';
				// Surface the ready-to-send message immediately so the owner can
				// actually notify the person — sharing alone doesn't email anyone.
				draft = { kind: data.invite ? 'invite' : 'share', email: sharedEmail, permission: sharedPermission };
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

	async function removeInvite(inviteEmail: string) {
		busy = true;
		error = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/invites/${encodeURIComponent(inviteEmail)}`, {
				method: 'DELETE'
			});
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

	<section class="linkshare">
		<span class="lbl">{t('share.publicHeading')}</span>
		<p class="hint public-hint">{t('share.publicHint')}</p>
		{#if publicLink}
			<div class="linkrow">
				<input
					class="linkurl"
					type="text"
					readonly
					value={publicLink.url}
					aria-label={t('share.publicShareableLink')}
				/>
				<button type="button" class="copy" onclick={copyPublicLink} use:busyButton={publicBusy}>
					{t('share.copy')}
				</button>
			</div>
			<button type="button" class="rm" onclick={() => (publicRevokeOpen = true)} use:busyButton={publicBusy}>
				{t('share.publicRevoke')}
			</button>
		{:else if !publicLoading}
			<button type="button" onclick={createPublicLink} use:busyButton={publicBusy}>
				{t('share.publicCreate')}
			</button>
		{/if}
		{#if publicError}<p class="err">{publicError}</p>{/if}
	</section>

	<ConfirmDialog
		bind:open={publicRevokeOpen}
		title={t('share.publicRevokeConfirmTitle')}
		body={t('share.publicRevokeConfirmBody')}
		confirmLabel={t('share.publicRevoke')}
		cancelLabel={t('common.cancel')}
		onconfirm={confirmRevokePublicLink}
	/>

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
	{:else if shares.length === 0 && invites.length === 0}
		<p class="muted">{t('share.notSharedYet')}</p>
	{:else}
		<div class="emaillang">
			<label for="email-lang">{t('share.emailLanguage')}</label>
			<select id="email-lang" bind:value={emailLang}>
				{#each LOCALES as l (l)}
					<option value={l}>{LOCALE_SHORT[l]}</option>
				{/each}
			</select>
		</div>
		{#if draft && draftContent}
			<div class="draft">
				<p class="draft-h">{t('share.emailDraftHeading')}</p>
				<p class="draft-meta"><span class="draft-k">{t('share.emailTo')}:</span> {draft.email}</p>
				<p class="draft-meta"><span class="draft-k">{t('share.emailSubjectLabel')}:</span> {draftContent.subject}</p>
				<pre class="draft-body">{draftContent.body.replace(/\r\n/g, '\n')}</pre>
				<div class="draft-actions">
					<button type="button" onclick={openMailApp}>{t('share.emailOpen')}</button>
					<button type="button" class="mail" onclick={copyDraft}>{t('share.emailCopy')}</button>
					<button type="button" class="rm" onclick={() => (draft = null)}>{t('share.emailClose')}</button>
				</div>
			</div>
		{/if}
		<ul>
			{#each shares as s (s.userId)}
				<li>
					<span class="who">{s.name ?? s.email}</span>
					<span class="perm">{s.permission === 'editor' ? t('share.optionCanEdit') : t('share.optionCanView')}</span>
					<button type="button" class="mail" onclick={() => (draft = { kind: 'share', email: s.email, permission: s.permission })}>{t('share.emailNotify')}</button>
					<button type="button" class="rm" onclick={() => remove(s.userId)} use:busyButton={busy}>{t('share.remove')}</button>
				</li>
			{/each}
			{#each invites as inv (inv.email)}
				<li>
					<span class="who">{inv.email}</span>
					<span class="perm pending">{t('share.pending')}</span>
					<span class="perm">{inv.permission === 'editor' ? t('share.optionCanEdit') : t('share.optionCanView')}</span>
					<button type="button" class="mail" onclick={() => (draft = { kind: 'invite', email: inv.email, permission: inv.permission })}>{t('share.emailInvite')}</button>
					<button type="button" class="rm" onclick={() => removeInvite(inv.email)} use:busyButton={busy}>{t('share.remove')}</button>
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
	.perm.pending {
		color: var(--pill-fullday-fg, var(--text-muted));
		background: var(--pill-fullday-bg, var(--surface-sunken));
	}
	.rm {
		background: none;
		color: var(--pill-bug-fg);
		border-color: var(--hairline-strong);
		padding: 0.25rem 0.5rem;
	}
	.mail {
		background: none;
		color: var(--text);
		border-color: var(--hairline-strong);
		padding: 0.25rem 0.5rem;
	}
	.emaillang {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.7rem;
	}
	.emaillang label {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.emaillang select {
		font-size: 0.8rem;
		padding: 0.25rem 0.4rem;
	}
	.draft {
		margin-top: 0.7rem;
		padding: 0.7rem 0.8rem;
		background: var(--surface-sunken);
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-md);
	}
	.draft-h {
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 0.4rem;
	}
	.draft-meta {
		font-size: 0.8rem;
		margin-bottom: 0.2rem;
		overflow-wrap: anywhere;
	}
	.draft-k {
		color: var(--text-muted);
	}
	.draft-body {
		font: inherit;
		font-size: 0.8rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		margin: 0.4rem 0;
		padding: 0.5rem 0.6rem;
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: var(--radius-md);
		max-height: 12rem;
		overflow-y: auto;
	}
	.draft-actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.hint {
		font-size: 0.72rem;
		color: var(--text-muted);
		margin-top: 0.6rem;
	}
	.public-hint {
		margin-top: 0;
		margin-bottom: 0.5rem;
	}
	.linkshare .rm {
		margin-top: 0.5rem;
	}
</style>
