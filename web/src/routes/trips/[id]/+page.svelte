<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import TripView from '$lib/TripView.svelte';
	import SharePanel from '$lib/SharePanel.svelte';
	import TripPhotosPanel from '$lib/TripPhotosPanel.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import type { IconName } from '$lib/nav/NavIcon.svelte';
	import { loc, type Trip } from '$lib/trip-engine';
	import type { TripPhoto } from '$lib/photos';
	import { createAutosave } from '$lib/trip/autosave.svelte';
	import { createHistory } from '$lib/trip/history.svelte';
	import { tripActions } from '$lib/nav/tripNav.svelte';
	import TripSettingsDrawer from '$lib/trip/TripSettingsDrawer.svelte';
	import { t } from '$lib/i18n/store.svelte';
	import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte';
	import OfflineBar from '$lib/trip/OfflineBar.svelte';
	import { isOnline } from '$lib/online.svelte';
	import { chipKey, createReconnectRetry } from '$lib/trip/saveGuards';
	let { data } = $props();

	let showShare = $state(false);
	let showPhotos = $state(false);
	let showSettings = $state(false);
	const canEdit = $derived(data.role === 'owner' || data.role === 'editor');

	// ── In-place editing (Phase 2 WYSIWYG) ──
	// The page owns a mutable copy of the loaded doc. TripView renders this copy
	// in BOTH modes, not just while editing, because a checklist tick also
	// mutates the doc and has to land somewhere that survives to the next save.
	// `autosave` debounces every mutation into one PUT and owns the single
	// `updated_at` baseline for the page.
	let draft = $state<Trip>(untrack(() => structuredClone(data.trip) as unknown as Trip));
	let autosave = $state(
		untrack(() => createAutosave(data.trip.id, () => draft, data.updatedAt))
	);
	// Document-level undo. Structural edits (insert/delete/duplicate/reorder)
	// can't be undone by the browser, so the draft keeps its own history; text
	// typed inside a field is still left to the field's native undo.
	let history = $state(
		untrack(() =>
			createHistory(
				() => draft,
				(t) => (draft = t)
			)
		)
	);
	// `?edit=1` opens straight into edit mode — how the creation wizard hands off,
	// so a brand-new trip lands you on the real itinerary ready to type rather
	// than on a form describing it.
	let editing = $state(
		untrack(
			() =>
				(data.role === 'owner' || data.role === 'editor') &&
				page.url.searchParams.get('edit') === '1'
		)
	);
	// Navigating between two trips re-runs `load` without remounting this
	// component, so re-seed the draft (and drop any scheduled save for the trip
	// we just left). Guarded on the id so an incidental re-run of `load` can
	// never discard unsaved edits to the trip already open.
	$effect(() => {
		const incoming = data.trip as unknown as Trip;
		untrack(() => {
			if (incoming.id === draft.id) return;
			reconnect.cancel();
			autosave.dispose();
			draft = structuredClone(incoming) as Trip;
			autosave = createAutosave(incoming.id, () => draft, data.updatedAt);
			history = createHistory(
				() => draft,
				(t) => (draft = t)
			);
			editing = false;
		});
	});

	// Only owners/editors write; for a viewer this stays undefined, which is also
	// what keeps their checklist ticks local-only (see TripView's `onedit` doc).
	const onedit = $derived(
		canEdit
			? (structural?: boolean) => {
					history.capture(structural);
					autosave.schedule();
				}
			: undefined
	);
	// Stepping the history is itself a change that has to reach the server.
	function doUndo() {
		if (history.undo()) autosave.schedule();
	}
	function doRedo() {
		if (history.redo()) autosave.schedule();
	}
	const onundo = $derived(canEdit ? doUndo : undefined);

	// Ctrl/⌘Z steps the document history — but only when focus is OUTSIDE an
	// editable field, where the browser's own per-field undo is what the user
	// means. Shift adds redo.
	function onWindowKeydown(e: KeyboardEvent) {
		if (!editing || !canEdit) return;
		if (e.key !== 'z' && e.key !== 'Z') return;
		if (!(e.metaKey || e.ctrlKey)) return;
		const el = document.activeElement as HTMLElement | null;
		if (el?.isContentEditable) return;
		const tag = el?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		e.preventDefault();
		if (e.shiftKey) doRedo();
		else doUndo();
	}

	function toggleEditing() {
		if (editing) autosave.flush();
		editing = !editing;
	}

	// Bounded retry when the browser reports a connection. It reads the CURRENT
	// `autosave` (the page replaces that variable) and never uses an $effect on
	// the status: a device that says "online" while the PUT keeps failing would
	// loop without end. See saveGuards.ts.
	const reconnect = createReconnectRetry(() => autosave);
	function onReconnectSignal() {
		if (canEdit && isOnline()) reconnect.trigger();
	}
	function onVisibility() {
		if (document.visibilityState === 'visible') onReconnectSignal();
	}
	onDestroy(() => {
		reconnect.cancel();
		autosave.dispose();
	});

	// Don't leave a debounced edit unsaved on the way out. If the edit is still
	// unsaved after that (the save failed, or the draft is invalid), ask first:
	// `flush()` has nothing to send in those states, so the edit would be lost
	// with no sign. Leaving the site is covered by `beforeunload` below.
	let leaveOpen = $state(false);
	let leaveTo: URL | null = null;
	let leaveConfirmed = false;
	beforeNavigate(({ cancel, willUnload, to }) => {
		autosave.flush();
		if (leaveConfirmed || willUnload || !to) return;
		if (to.url.pathname === page.url.pathname) return;
		if (autosave.status === 'error' || autosave.status === 'invalid') {
			cancel();
			leaveTo = to.url;
			leaveOpen = true;
		}
	});
	afterNavigate(() => (leaveConfirmed = false));
	function confirmLeave() {
		leaveConfirmed = true;
		if (leaveTo) void goto(leaveTo);
	}
	$effect(() => {
		if (!autosave.busy) return;
		const handler = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	const saveLabel = $derived.by(() => {
		const key = chipKey(autosave.status, isOnline());
		return key ? t(key) : '';
	});
	// Height of the sticky status block, so the day strip can sit below it.
	let statusH = $state(0);

	// Mobile bottom bar: Trips · (Share if owner) · (Edit if canEdit) · More.
	// The More sheet carries every secondary per-trip action: Print and Add to
	// calendar (published by TripView, which owns the plan selection the ICS is
	// built from), plus Photos and Settings.
	type BarItem = {
		id: string;
		label: string;
		icon: IconName;
		href?: string;
		onclick?: () => void;
		current?: boolean;
	};
	const barItems = $derived<BarItem[]>([
		{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/' },
		...(data.role === 'owner'
			? [
					{
						id: 'share',
						label: t('nav.share'),
						icon: 'share' as IconName,
						onclick: () => (showShare = !showShare),
						current: showShare
					}
				]
			: []),
		...(canEdit
			? [
					{
						id: 'edit',
						label: editing ? t('tripbar.doneEditing') : t('nav.edit'),
						icon: 'edit' as IconName,
						onclick: toggleEditing,
						current: editing
					}
				]
			: [])
	]);
	// The desktop control bar is hidden below 960px, so Photos and Settings reach
	// mobile through the bottom bar's More sheet.
	const barMoreRows = $derived(
		[
			// Published by TripView — the ICS is built from its own plan selection,
			// so the page can't construct it itself.
			...(tripActions()?.printHref
				? [
						{
							id: 'print',
							label: t('tripbar.print'),
							icon: 'print' as IconName,
							onclick: () => goto(tripActions()!.printHref!)
						}
					]
				: []),
			...(tripActions()
				? [
						{
							id: 'calendar',
							label: t('tripbar.calendar'),
							icon: 'calendar' as IconName,
							onclick: () => tripActions()!.downloadIcs()
						}
					]
				: []),
			...(canEdit
				? [
						{
							id: 'photos',
							label: t('tripbar.photos'),
							icon: 'photos' as IconName,
							onclick: () => (showPhotos = !showPhotos)
						},
						{
							id: 'settings',
							label: t('tripbar.settings'),
							icon: 'edit' as IconName,
							onclick: () => (showSettings = !showSettings)
						}
					]
				: [])
		]
	);

	// Photos load client-side only (SSR of a big trip's strips exceeds the
	// Workers CPU limit) and are refetched after any mutation (import, move,
	// delete) — the API is the source of truth.
	let photos = $state<TripPhoto[]>([]);
	$effect(() => {
		data.trip.id;
		photos = [];
		refreshPhotos();
	});
	async function refreshPhotos() {
		try {
			const res = await fetch(`/api/trips/${data.trip.id}/photos`);
			if (res.ok) photos = ((await res.json()) as { photos: TripPhoto[] }).photos;
		} catch {
			// keep the current list; next navigation reloads it anyway
		}
	}

	// Mirrors TripView's internal language selection so the document title
	// tracks the language the visitor is currently viewing.
	let lang = $state(untrack(() => (data.trip as unknown as Trip).defaultLanguage));
	$effect(() => {
		// Re-seed when navigating to a different trip (component below remounts via #key).
		data.trip.id;
		lang = (data.trip as unknown as Trip).defaultLanguage || (data.trip as unknown as Trip).languages[0];
	});
	const pageTitle = $derived(`${loc(draft, draft.title, lang)} — Zarparia`);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<svelte:window onkeydown={onWindowKeydown} ononline={onReconnectSignal} />
<svelte:document onvisibilitychange={onVisibility} />

<div class="page" class:editing style:--status-h="{statusH}px">
	<div class="bar">
		<a class="back" href="/">{t('tripbar.allTrips')}</a>
		<div class="actions">
			{#if data.role === 'owner'}
				<button class="btn" onclick={() => (showShare = !showShare)}>{showShare ? t('tripbar.close') : t('tripbar.share')}</button>
			{:else}
				<span class="role">{t('tripbar.shared')} · {data.role === 'editor' ? t('role.canEdit') : t('role.viewOnly')}</span>
			{/if}
			{#if canEdit}
				<button class="btn" onclick={() => (showPhotos = !showPhotos)}>{showPhotos ? t('tripbar.close') : t('tripbar.photos')}</button>
				<button class="btn" class:on={showSettings} onclick={() => (showSettings = !showSettings)} aria-pressed={showSettings}>{t('tripbar.settings')}</button>
				<button class="btn btn-edit" class:on={editing} onclick={toggleEditing} aria-pressed={editing}>
					{editing ? t('tripbar.doneEditing') : t('tripbar.edit')}
				</button>
			{/if}
		</div>
	</div>

	{#if canEdit && (editing || autosave.status !== 'clean')}
		<!-- Sticky, so the save chip, Retry and the banners stay in view while the
		     user edits far down a long trip (audit U4-02). -->
		<div class="status-stack" bind:clientHeight={statusH}>
			{#if editing && !isOnline()}
				<OfflineBar />
			{/if}
			<div class="editbar">
				{#if saveLabel}
					<span class="save-chip s-{autosave.status}" aria-live="polite">{saveLabel}</span>
				{/if}
				{#if autosave.status === 'error'}
					<button class="retry" onclick={() => autosave.retry()}>{t('save.retry')}</button>
				{/if}
				{#if editing}
					<!-- Also reachable with Ctrl/⌘Z, but touch has no keyboard and the
					     shortcut is invisible — so the buttons are the real affordance. -->
					<span class="undo-group">
						<button class="undo-btn" onclick={doUndo} disabled={!history.canUndo} title={t('common.undo')} aria-label={t('common.undo')}>↶</button>
						<button class="undo-btn" onclick={doRedo} disabled={!history.canRedo} title={t('common.redo')} aria-label={t('common.redo')}>↷</button>
					</span>
					<span class="edit-hint">{t('edit.hint')}</span>
				{/if}
			</div>

			{#if autosave.status === 'conflict'}
				<div class="banner banner-conflict" role="alert">
					<strong>{t('save.conflict')}</strong>
					<p>{t('save.conflictBody')}</p>
					<button class="btn" onclick={() => window.location.reload()}>{t('save.reload')}</button>
				</div>
			{/if}

			{#if autosave.status === 'invalid' && autosave.errors.length}
				<div class="banner banner-invalid" role="alert">
					<strong>{t('save.invalidBody')}</strong>
					<ul>{#each autosave.errors as e (e)}<li>{e}</li>{/each}</ul>
				</div>
			{/if}
		</div>
	{/if}

	<ConfirmDialog
		bind:open={leaveOpen}
		title={t('leave.title')}
		body={t('leave.body')}
		confirmLabel={t('leave.confirm')}
		cancelLabel={t('leave.stay')}
		onconfirm={confirmLeave}
	/>

	{#if showShare && data.role === 'owner'}
		<SharePanel tripId={data.trip.id} tripTitle={loc(draft, draft.title, lang)} />
	{/if}

	{#if showPhotos && canEdit}
		<TripPhotosPanel tripId={data.trip.id} onImported={refreshPhotos} />
	{/if}

	{#key data.trip.id}
		<TripView
			trip={draft}
			bind:lang
			{photos}
			photosEditable={canEdit}
			onphotoschanged={refreshPhotos}
			edit={editing && canEdit}
			{onedit}
			{onundo}
			printHref={`/trips/${data.trip.id}/print?lang=${lang}`}
			actionsInMoreSheet
		/>
	{/key}

	{#if canEdit}
		<TripSettingsDrawer trip={draft} bind:open={showSettings} {onedit} />
	{/if}

	<BottomBar user={data.user} items={barItems} moreRows={barMoreRows} />
</div>

<style>
	.page {
		padding: 1rem 0.5rem 2rem;
		min-height: calc(100vh - 60px);
		background: var(--surface-sunken);
	}
	.bar {
		max-width: 430px;
		margin: 0 auto 0.75rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-family: var(--font-ui);
	}
	/* On mobile the bottom app bar carries All trips / Share / Edit / Photos, so
	   the top action row is redundant — hide it below the desktop breakpoint. */
	@media (max-width: 959.98px) {
		.bar {
			display: none;
		}
	}
	/* Match the full-bleed trip shell so the control bar spans the same width as
	   the itinerary below it (was capped at 1060px alongside the old centred
	   shell). */
	@media (min-width: 960px) {
		.bar {
			max-width: none;
		}
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.back,
	.btn {
		font-size: 0.85rem;
		text-decoration: none;
		color: var(--accent-strong);
		font-family: var(--font-ui);
	}
	.btn {
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-button);
		padding: 0.3rem 0.8rem;
		background: var(--surface);
		cursor: pointer;
	}
	.btn.on {
		border-color: var(--accent-text);
		background: color-mix(in srgb, var(--accent-text) 12%, transparent);
	}
	.role {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pill-warn-fg);
		background: var(--pill-warn-bg);
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.6rem;
	}

	/* ── Edit-mode status row ──
	   Lives outside .bar because .bar is desktop-only: on mobile the edit toggle
	   is in the bottom app bar, but the save state still has to be visible. */
	.status-stack,
	.editbar,
	.banner {
		max-width: 430px;
		margin: 0 auto 0.6rem;
		font-family: var(--font-ui);
	}
	@media (min-width: 960px) {
		.status-stack,
		.editbar,
		.banner {
			max-width: none;
		}
	}
	/* Pinned to the top while the page scrolls. Its height is published as
	   --status-h; the day strip in TripView sits below it. The z-index is above
	   the day strip (1000) so the two never overlap. */
	.status-stack {
		position: sticky;
		top: 0;
		z-index: 1001;
		background: var(--surface-sunken);
		padding: 0.3rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.status-stack > .editbar,
	.status-stack > .banner {
		margin: 0;
		max-width: none;
	}
	.editbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.save-chip {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.6rem;
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		color: var(--text-muted);
		white-space: nowrap;
	}
	.save-chip.s-saved {
		color: var(--add-fg);
		background: var(--add-bg);
		border-color: transparent;
	}
	.save-chip.s-error,
	.save-chip.s-conflict,
	.save-chip.s-invalid {
		color: var(--warn-fg);
		background: var(--warn-bg);
		border-color: transparent;
	}
	.edit-hint {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.undo-group {
		display: inline-flex;
		gap: 0.25rem;
	}
	.undo-btn {
		font-family: var(--font-ui);
		font-size: 0.9rem;
		line-height: 1;
		color: var(--accent-strong);
		background: var(--surface);
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-button);
		min-width: 32px;
		min-height: 28px;
		cursor: pointer;
	}
	.undo-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.retry {
		font-size: 0.75rem;
		font-family: var(--font-ui);
		color: var(--accent-strong);
		background: none;
		border: none;
		padding: 0;
		text-decoration: underline;
		cursor: pointer;
	}
	.banner {
		border-radius: var(--radius-md);
		padding: 0.6rem 0.8rem;
		font-size: 0.8rem;
		line-height: 1.45;
	}
	.banner strong {
		display: block;
		margin-bottom: 0.2rem;
	}
	.banner p {
		margin: 0 0 0.5rem;
	}
	.banner ul {
		margin: 0.2rem 0 0;
		padding-left: 1.1rem;
	}
	.banner-conflict {
		background: var(--warn-bg);
		color: var(--warn-fg);
		border-left: 2.5px solid var(--warn-bar);
	}
	.banner-invalid {
		background: var(--note-bg);
		color: var(--note-fg);
	}
</style>
