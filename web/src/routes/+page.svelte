<script lang="ts">
	let health = $state<string>('checking…');
	$effect(() => {
		fetch('/api/health')
			.then((r) => r.json() as Promise<{ tables: string[] }>)
			.then((d) => (health = `ok — tables: ${d.tables.join(', ')}`))
			.catch((e) => (health = `error: ${e}`));
	});
</script>

<main>
	<h1>Trips</h1>
	<p>Backend skeleton (Phase A). Database health: <code>{health}</code></p>
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
	}
</style>
