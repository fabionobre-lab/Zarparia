<script lang="ts">
	let { data } = $props();
</script>

<main>
	<h1>Trips</h1>
	{#if data.user}
		<p>Signed in as <strong>{data.user.email}</strong>.</p>
		<p>Your trips will appear here (Phase C).</p>
	{:else}
		<p>A place for your travel itineraries.</p>
		<p><a href="/auth/login/google">Sign in with Google</a> to get started.</p>
	{/if}
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 40rem;
		margin: 3rem auto;
		padding: 0 1.25rem;
	}
	h1 {
		font-size: 1.6rem;
	}
</style>
