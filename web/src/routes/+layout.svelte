<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<a class="brand" href="/">Trips</a>
	<nav>
		{#if data.user}
			<span class="who">{data.user.name ?? data.user.email}</span>
			<form method="POST" action="/auth/logout">
				<button type="submit">Sign out</button>
			</form>
		{:else}
			<a class="signin" href="/auth/login/google">Sign in with Google</a>
		{/if}
	</nav>
</header>

{@render children()}

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid #e2ddd2;
		font-family: system-ui, sans-serif;
	}
	.brand {
		font-weight: 700;
		font-size: 1.1rem;
		text-decoration: none;
		color: #2b4a2b;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.who {
		font-size: 0.85rem;
		color: #555;
	}
	.signin,
	button {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.35rem 0.8rem;
		border: 1px solid #cbb;
		border-radius: 999px;
		background: #faf6ee;
		color: #1a1208;
		text-decoration: none;
		cursor: pointer;
	}
	form {
		margin: 0;
	}
</style>
