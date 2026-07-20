<script lang="ts">
	import { photoUrl, type TripPhoto } from '$lib/photos';
	import { t } from '$lib/i18n/store.svelte';
	import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte';
	import { toast, dismissToast } from '$lib/toast';

	interface DayOption {
		date: string;
		label: string;
	}

	let {
		tripId,
		photos,
		index = $bindable(0),
		canEdit = false,
		photoToken,
		dayOptions = [],
		captionFor,
		onclose,
		onchanged
	}: {
		tripId: string;
		photos: TripPhoto[];
		index?: number;
		canEdit?: boolean;
		/** Public-link token — see TripView.svelte's `photoToken` doc. */
		photoToken?: string;
		dayOptions?: DayOption[];
		captionFor: (p: TripPhoto) => string;
		onclose: () => void;
		onchanged: () => void;
	} = $props();

	const photo = $derived(photos[Math.min(index, photos.length - 1)]);
	let busy = $state(false);
	let errMsg = $state('');
	let deleteConfirmOpen = $state(false);
	/* Snapshot of the photo the user actually confirmed for deletion. `photo`
	   is derived from `index`, so without this, arrow-navigating while the
	   confirm dialog is open would retarget the delete to a different photo. */
	let deleteTarget: TripPhoto | null = $state(null);

	/* ── Focus management — MoreSheet's hand-rolled pattern (nav/MoreSheet.
	   svelte). A native <dialog> would give this for free, but the delete
	   confirm child is ALREADY a native dialog: nesting it inside a second
	   showModal() layer makes top-layer stacking/inert behavior fiddly, so the
	   overlay stays a div and traps focus by hand. The component only mounts
	   while the lightbox is open, so mount == open and unmount == close. */
	let overlayEl = $state<HTMLDivElement | null>(null);
	let restoreFocus: HTMLElement | null = null;

	function focusables(): HTMLElement[] {
		if (!overlayEl) return [];
		return Array.from(
			overlayEl.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => el.offsetParent !== null);
	}

	/* Tab/Shift-Tab wrap within the overlay. Runs on the overlay element, so
	   keystrokes inside the (top-layer) delete confirm never reach it. */
	function trapTab(e: KeyboardEvent) {
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

	// On open: remember the opener (a photo thumb button) and move focus into
	// the dialog; on close: give focus back. If the opener is gone by then
	// (e.g. the photo was deleted), focus() on the detached node is a no-op.
	$effect(() => {
		restoreFocus = document.activeElement as HTMLElement | null;
		// Wait a frame so the overlay content is rendered/tabbable first.
		requestAnimationFrame(() => focusables()[0]?.focus());
		return () => {
			restoreFocus?.focus?.();
			restoreFocus = null;
		};
	});

	function prev() {
		if (index > 0) index--;
	}
	function next() {
		if (index < photos.length - 1) index++;
	}
	function onKeydown(e: KeyboardEvent) {
		/* While the delete confirm (a native <dialog>) is open it owns the
		   keyboard: its own Escape closes just the dialog, and that same
		   keydown must not also reach here and dismiss the whole lightbox;
		   arrows must not keep navigating underneath it. */
		if (deleteConfirmOpen) return;
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			/* When the move-to-day <select> holds focus, arrows change its
			   options — they must not also flip the photo underneath. */
			if (document.activeElement instanceof HTMLSelectElement) return;
			if (e.key === 'ArrowLeft') prev();
			else next();
		}
	}

	async function moveTo(e: Event) {
		if (!photo) return;
		// Snapshot the target + its previous day BEFORE the PATCH: `photo` is
		// derived from `index`, and the Undo closure outlives this component
		// (onchanged() closes the lightbox).
		const target = photo;
		const prevDay = target.dayDate ?? '';
		const value = (e.currentTarget as HTMLSelectElement).value;
		busy = true;
		errMsg = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/photos/${target.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dayDate: value || null })
			});
			if (res.ok) {
				// A move is a trivially reversible PATCH → offer Undo (7s duration
				// comes automatically from the toast store when an action is set).
				toast(t('toast.photoMoved'), {
					actionLabel: t('common.undo'),
					onAction: () => void undoMove(target.id, prevDay)
				});
				onchanged();
			} else errMsg = t('photos.errSave');
		} catch {
			errMsg = t('photos.errSave');
		} finally {
			busy = false;
		}
	}

	/** Undo a move-to-day: PATCH the previous dayDate back. Runs from the toast
	 *  action after the lightbox has closed, so errors surface as a toast. */
	async function undoMove(photoId: string, prevDay: string) {
		dismissToast();
		try {
			const res = await fetch(`/api/trips/${tripId}/photos/${photoId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dayDate: prevDay || null })
			});
			if (res.ok) onchanged();
			else toast.danger(t('photos.errSave'));
		} catch {
			toast.danger(t('photos.errSave'));
		}
	}

	function remove() {
		if (!photo) return;
		deleteTarget = photo;
		deleteConfirmOpen = true;
	}

	async function confirmRemove() {
		const target = deleteTarget;
		deleteTarget = null;
		if (!target) return;
		busy = true;
		errMsg = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/photos/${target.id}`, { method: 'DELETE' });
			if (res.ok) {
				// Unlike moveTo, delete closes the lightbox immediately (there's
				// nothing left to show once the current photo is gone) — the
				// toast's Undo action is what gives the user a way back, same
				// trivially-reversible-action idiom as the move-to-day flow.
				onchanged();
				onclose();
				toast(t('toast.photoDeleted'), {
					actionLabel: t('common.undo'),
					onAction: () => void undoDelete(target.id)
				});
			} else {
				errMsg = t('photos.errSave');
			}
		} catch {
			errMsg = t('photos.errSave');
		} finally {
			busy = false;
		}
	}

	/** Undo a delete: restore the soft-deleted row (clears deleted_at) so it
	 *  reappears everywhere it was filtered out of. Runs from the toast
	 *  action after the lightbox has already closed, so errors surface as a
	 *  toast — same shape as undoMove. */
	async function undoDelete(photoId: string) {
		dismissToast();
		try {
			const res = await fetch(`/api/trips/${tripId}/photos/${photoId}/restore`, { method: 'POST' });
			if (res.ok) onchanged();
			else toast.danger(t('photos.errSave'));
		} catch {
			toast.danger(t('photos.errSave'));
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if photo}
	<div
		bind:this={overlayEl}
		class="overlay"
		role="dialog"
		aria-modal="true"
		aria-label={t('photos.lightboxLabel')}
		tabindex="-1"
		onkeydown={trapTab}
	>
		<!-- Backdrop click closes (pointer affordance only — tabindex -1 keeps it
		     out of the focus trap, like MoreSheet's scrim; keyboard users have
		     Escape and the visible ✕). The inner frame stops propagation. -->
		<button class="backdrop" tabindex="-1" aria-label={t('photos.close')} onclick={onclose}></button>
		<div class="frame">
			<img class="big" src={photoUrl(tripId, photo.id, 'disp', photoToken)} alt={captionFor(photo)} />
			<div class="chrome">
				<div class="caption">{captionFor(photo)}</div>
				{#if canEdit}
					<div class="edit-row">
						<label class="mv-label" for="ph-move">{t('photos.moveTo')}</label>
						<select id="ph-move" value={photo.dayDate ?? ''} onchange={moveTo} disabled={busy}>
							<option value="">{t('photos.unassigned')}</option>
							{#each dayOptions as d (d.date)}
								<option value={d.date}>{d.label}</option>
							{/each}
						</select>
						<button class="del" onclick={remove} disabled={busy}>{t('photos.delete')}</button>
					</div>
				{/if}
				{#if errMsg}<div class="err">{errMsg}</div>{/if}
			</div>
			{#if index > 0}
				<button class="nav prev" onclick={prev} aria-label={t('photos.prev')}>‹</button>
			{/if}
			{#if index < photos.length - 1}
				<button class="nav next" onclick={next} aria-label={t('photos.next')}>›</button>
			{/if}
			<button class="close" onclick={onclose} aria-label={t('photos.close')}>✕</button>
		</div>
	</div>
{/if}

<ConfirmDialog
	bind:open={deleteConfirmOpen}
	title={t('photos.deleteTitle')}
	body={t('photos.confirmDelete')}
	cancelLabel={t('common.cancel')}
	confirmLabel={t('photos.delete')}
	onconfirm={confirmRemove}
/>

<style>
	/* NOTE on the hardcoded colors below: everything in this component renders
	   over the near-black photo backdrop, never over an app surface — so the
	   chrome (captions, labels, nav circles, delete button) uses deliberate
	   theme-INVARIANT over-photo colors (warm creams on translucent near-black),
	   not the light-dark() tokens. Do not sweep them onto theme tokens. */
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		/* Darker than --scrim on purpose: a photo-viewing surround, not a dialog
		   scrim — the image needs a near-black field in both themes. */
		background: rgba(10, 8, 4, 0.82);
		border: 0;
		cursor: default;
	}
	.frame {
		position: relative;
		max-width: min(92vw, 900px);
		max-height: 88vh;
		display: flex;
		flex-direction: column;
	}
	.big {
		max-width: 100%;
		max-height: calc(88vh - 84px);
		object-fit: contain;
		border-radius: var(--radius-md);
		box-shadow: var(--elevation-3);
	}
	.chrome {
		padding: 10px 2px 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: var(--font-ui);
	}
	.caption {
		color: #f0ead9; /* warm cream over the photo backdrop — theme-invariant */
		font-size: 0.82rem;
	}
	.edit-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.mv-label {
		color: #cfc7b4; /* muted cream over the photo backdrop — theme-invariant */
		font-size: 0.78rem;
	}
	.edit-row select {
		font-size: 0.8rem;
		max-width: 15rem;
		padding: 0.2rem 0.35rem;
		border-radius: var(--radius-md);
	}
	.del {
		font-size: 0.78rem;
		/* Danger styling tuned for the dark photo surround (not --warn-*) */
		color: #f3b6ab;
		background: rgba(200, 64, 64, 0.18);
		border: 1px solid rgba(220, 120, 110, 0.45);
		border-radius: var(--radius-button);
		padding: 0.2rem 0.7rem;
		cursor: pointer;
	}
	.err {
		color: #f3b6ab; /* danger tint readable on the photo backdrop — theme-invariant */
		font-size: 0.78rem;
	}
	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 38px;
		height: 38px;
		border-radius: 50%;
		border: 0;
		/* Translucent near-black circle + cream glyph, sits ON the image — theme-invariant */
		background: rgba(20, 16, 10, 0.65);
		color: #f0ead9;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
	}
	.prev {
		left: -8px;
	}
	.next {
		right: -8px;
	}
	.close {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 0;
		/* Same over-photo circle idiom as .nav, slightly more opaque — theme-invariant */
		background: rgba(20, 16, 10, 0.75);
		color: #f0ead9;
		font-size: 0.95rem;
		cursor: pointer;
	}
</style>
