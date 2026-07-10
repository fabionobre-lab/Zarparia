<script lang="ts">
	import LocaleSwitcher from '$lib/i18n/LocaleSwitcher.svelte';
	import { t, formatDateRange } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';

	let { data } = $props();

	const statusKey: Record<string, keyof Messages> = {
		past: 'home.statusPast',
		active: 'home.statusNow',
		upcoming: 'home.statusUpcoming'
	};

	const owned = $derived(data.trips.filter((tr) => tr.role === 'owner'));
	const shared = $derived(data.trips.filter((tr) => tr.role !== 'owner'));
</script>

{#snippet card(trip: (typeof data.trips)[number])}
	<a class="card" href="/trips/{trip.id}">
		{#if trip.cover}<div class="cover" aria-hidden="true">{trip.cover}</div>{/if}
		<div class="card-main">
			<div class="card-title">{trip.title ?? trip.id}</div>
			<div class="card-dates">{formatDateRange(trip.startDate, trip.endDate)}</div>
		</div>
		{#if trip.role !== 'owner'}<span class="role">{trip.role === 'editor' ? t('role.canEdit') : t('role.viewOnly')}</span>{/if}
		<span class="chip {trip.status}">{t(statusKey[trip.status] ?? 'home.statusUpcoming')}</span>
	</a>
{/snippet}

<svelte:head>
	<title>{t('home.pageTitle')}</title>
</svelte:head>

<main>
	{#if data.user}
		<div class="head">
			<h1>{t('home.yourTrips')}</h1>
			<div class="actions">
				<a class="import-btn" href="/trips/import">{t('home.importItinerary')}</a>
				<a class="new" href="/trips/new">{t('home.newTrip')}</a>
			</div>
		</div>
		{#if owned.length === 0}
			<p class="empty">{t('home.noTrips')} <a href="/trips/new">{t('home.createFirst')}</a></p>
		{:else}
			<div class="cards">
				{#each owned as trip (trip.id)}{@render card(trip)}{/each}
			</div>
		{/if}

		{#if shared.length > 0}
			<h2 class="shared-hd">{t('home.sharedWithYou')}</h2>
			<div class="cards">
				{#each shared as trip (trip.id)}{@render card(trip)}{/each}
			</div>
		{/if}
	{:else}
		<h1>Trips</h1>
		<p>{t('landing.tagline')}</p>
		<p><a href="/auth/login/google">{t('header.signInGoogle')}</a> {t('landing.toGetStarted')}</p>
		<div class="landing-lang">
			<LocaleSwitcher />
		</div>
	{/if}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 1200px;
		margin: 2rem auto;
		padding: 0 1.5rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h1 {
		font-size: 1.5rem;
	}
	.shared-hd {
		font-size: 1.1rem;
		margin: 1.75rem 0 0.25rem;
		color: #444;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.new {
		font-size: 0.85rem;
		text-decoration: none;
		color: #2b4a2b;
		border: 1px solid #cbb;
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.import-btn {
		font-size: 0.85rem;
		text-decoration: none;
		color: #7a6e5f;
		border: 1px solid #e2ddd2;
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.empty {
		color: #666;
		margin-top: 1.5rem;
	}
	.landing-lang {
		margin-top: 1.5rem;
	}
	.cards {
		margin-top: 1.25rem;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	@media (min-width: 1024px) {
		.cards {
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}
	.card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #faf6ee;
		border: 1px solid #e2ddd2;
		border-radius: 12px;
		padding: 0.9rem 1rem;
		text-decoration: none;
		color: #1a1208;
	}
	.cover {
		font-size: 30px;
		width: 52px;
		height: 52px;
		border-radius: 12px;
		background: #efe9dc;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.card-main {
		flex: 1;
		min-width: 0;
	}
	.card-title {
		font-weight: 700;
	}
	.card-dates {
		font-size: 0.8rem;
		color: #7a6e5f;
		margin-top: 0.15rem;
	}
	.role {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #7a5a10;
		background: #f5edd5;
		border-radius: 999px;
		padding: 0.15rem 0.5rem;
	}
	.chip {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
	}
	.chip.past {
		background: #ede8e0;
		color: #7a6e5f;
	}
	.chip.active {
		background: #daf0e5;
		color: #1a5a34;
	}
	.chip.upcoming {
		background: #dce8f5;
		color: #1e3a5f;
	}
</style>
