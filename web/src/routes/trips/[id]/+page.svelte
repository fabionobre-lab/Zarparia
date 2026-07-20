<script lang="ts">
	import { untrack } from 'svelte';
	import TripView from '$lib/TripView.svelte';
	import SharePanel from '$lib/SharePanel.svelte';
	import TripPhotosPanel from '$lib/TripPhotosPanel.svelte';
	import BottomBar from '$lib/nav/BottomBar.svelte';
	import type { IconName } from '$lib/nav/NavIcon.svelte';
	import { loc, type Trip } from '$lib/trip-engine';
	import type { TripPhoto } from '$lib/photos';
	import { t } from '$lib/i18n/store.svelte';
	let { data } = $props();

	let showShare = $state(false);
	let showPhotos = $state(false);
	const canEdit = $derived(data.role === 'owner' || data.role === 'editor');

	// Mobile bottom bar: Trips · (Share if owner) · (Edit if canEdit) · More.
	// Photos moves into the More sheet (it's page-level state here, so trivially
	// wirable). The ics/"Add to calendar" action lives inside TripView's hero and
	// isn't exposed cross-component, so it's intentionally left out of More.
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
			? [{ id: 'edit', label: t('nav.edit'), icon: 'edit' as IconName, href: `/trips/${data.trip.id}/edit` }]
			: [])
	]);
	const barMoreRows = $derived(
		canEdit
			? [
					{
						id: 'photos',
						label: t('tripbar.photos'),
						icon: 'photos' as IconName,
						onclick: () => (showPhotos = !showPhotos)
					}
				]
			: []
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
	const pageTitle = $derived(`${loc(data.trip as unknown as Trip, (data.trip as unknown as Trip).title, lang)} — Zarparia`);
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="page">
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
				<a class="btn" href="/trips/{data.trip.id}/edit">{t('tripbar.edit')}</a>
			{/if}
		</div>
	</div>

	{#if showShare && data.role === 'owner'}
		<SharePanel tripId={data.trip.id} />
	{/if}

	{#if showPhotos && canEdit}
		<TripPhotosPanel tripId={data.trip.id} onImported={refreshPhotos} />
	{/if}

	{#key data.trip.id}
		<TripView
			trip={data.trip as unknown as Trip}
			bind:lang
			{photos}
			photosEditable={canEdit}
			onphotoschanged={refreshPhotos}
			checklistEditable={canEdit}
			tripUpdatedAt={data.updatedAt}
			printHref={`/trips/${data.trip.id}/print?lang=${lang}`}
		/>
	{/key}

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
	/* Match the widened trip shell so the control bar doesn't sit 430px-wide
	   above a 1060px shell. */
	@media (min-width: 960px) {
		.bar {
			max-width: 1060px;
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
	.role {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pill-warn-fg);
		background: var(--pill-warn-bg);
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.6rem;
	}
</style>
