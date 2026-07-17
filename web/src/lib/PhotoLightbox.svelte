<script lang="ts">
	import { photoUrl, type TripPhoto } from '$lib/photos';
	import { t } from '$lib/i18n/store.svelte';
	import ConfirmDialog from '$lib/dialog/ConfirmDialog.svelte';
	import { toast } from '$lib/toast';

	interface DayOption {
		date: string;
		label: string;
	}

	let {
		tripId,
		photos,
		index = $bindable(0),
		canEdit = false,
		dayOptions = [],
		captionFor,
		onclose,
		onchanged
	}: {
		tripId: string;
		photos: TripPhoto[];
		index?: number;
		canEdit?: boolean;
		dayOptions?: DayOption[];
		captionFor: (p: TripPhoto) => string;
		onclose: () => void;
		onchanged: () => void;
	} = $props();

	const photo = $derived(photos[Math.min(index, photos.length - 1)]);
	let busy = $state(false);
	let errMsg = $state('');
	let deleteConfirmOpen = $state(false);

	function prev() {
		if (index > 0) index--;
	}
	function next() {
		if (index < photos.length - 1) index++;
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowLeft') prev();
		else if (e.key === 'ArrowRight') next();
	}

	async function moveTo(e: Event) {
		if (!photo) return;
		const value = (e.currentTarget as HTMLSelectElement).value;
		busy = true;
		errMsg = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/photos/${photo.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dayDate: value || null })
			});
			if (res.ok) onchanged();
			else errMsg = t('photos.errSave');
		} catch {
			errMsg = t('photos.errSave');
		} finally {
			busy = false;
		}
	}

	function remove() {
		if (!photo) return;
		deleteConfirmOpen = true;
	}

	async function confirmRemove() {
		if (!photo) return;
		busy = true;
		errMsg = '';
		try {
			const res = await fetch(`/api/trips/${tripId}/photos/${photo.id}`, { method: 'DELETE' });
			if (res.ok) {
				onchanged();
				onclose();
				toast(t('toast.photoDeleted'));
			} else {
				errMsg = t('photos.errSave');
			}
		} catch {
			errMsg = t('photos.errSave');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if photo}
	<div class="overlay" role="dialog" aria-modal="true" aria-label={t('photos.lightboxLabel')}>
		<!-- Backdrop click closes; the inner frame stops propagation. -->
		<button class="backdrop" aria-label={t('photos.close')} onclick={onclose}></button>
		<div class="frame">
			<img class="big" src={photoUrl(tripId, photo.id, 'disp')} alt={captionFor(photo)} />
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
		color: #f0ead9;
		font-size: 0.82rem;
	}
	.edit-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.mv-label {
		color: #cfc7b4;
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
		color: #f3b6ab;
		background: rgba(200, 64, 64, 0.18);
		border: 1px solid rgba(220, 120, 110, 0.45);
		border-radius: var(--radius-button);
		padding: 0.2rem 0.7rem;
		cursor: pointer;
	}
	.err {
		color: #f3b6ab;
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
		background: rgba(20, 16, 10, 0.75);
		color: #f0ead9;
		font-size: 0.95rem;
		cursor: pointer;
	}
</style>
