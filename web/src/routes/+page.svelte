<script lang="ts">
	let { data } = $props();

	const locale = 'en-GB';
	function fmtRange(start: string | null, end: string | null): string {
		if (!start || !end) return '';
		const f = (iso: string) =>
			new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
				new Date(iso + 'T00:00:00Z')
			);
		return `${f(start)} – ${f(end)}`;
	}
	const statusLabel: Record<string, string> = { past: 'Past', active: 'Now', upcoming: 'Upcoming' };
</script>

<main>
	{#if data.user}
		<div class="head">
			<h1>Your trips</h1>
			<a class="new" href="/trips/new">+ New trip</a>
		</div>
		{#if data.trips.length === 0}
			<p class="empty">No trips yet. <a href="/trips/new">Create your first one.</a></p>
		{:else}
			<div class="cards">
				{#each data.trips as t (t.id)}
					<a class="card" href="/trips/{t.id}">
						<div class="card-main">
							<div class="card-title">{t.title ?? t.id}</div>
							<div class="card-dates">{fmtRange(t.startDate, t.endDate)}</div>
						</div>
						{#if t.role !== 'owner'}<span class="role">{t.role}</span>{/if}
						<span class="chip {t.status}">{statusLabel[t.status] ?? t.status}</span>
					</a>
				{/each}
			</div>
		{/if}
	{:else}
		<h1>Trips</h1>
		<p>A place for your travel itineraries.</p>
		<p><a href="/auth/login/google">Sign in with Google</a> to get started.</p>
	{/if}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 40rem;
		margin: 2rem auto;
		padding: 0 1.25rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h1 {
		font-size: 1.5rem;
	}
	.new {
		font-size: 0.85rem;
		text-decoration: none;
		color: #2b4a2b;
		border: 1px solid #cbb;
		border-radius: 999px;
		padding: 0.35rem 0.8rem;
	}
	.empty {
		color: #666;
		margin-top: 1.5rem;
	}
	.cards {
		margin-top: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
