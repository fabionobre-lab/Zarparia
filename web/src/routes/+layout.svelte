<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import LocaleSwitcher from '$lib/i18n/LocaleSwitcher.svelte';
	import FeedbackDialog from '$lib/FeedbackDialog.svelte';
	import { initLocale, t } from '$lib/i18n/store.svelte';

	let { children, data } = $props();

	let feedbackOpen = $state(false);

	// Seed the UI locale synchronously (SSR + client) before children render, so
	// the first paint is in the right language and there is no flash of English.
	// Intentionally reads the initial value only — after this, setLocale() from
	// the switcher is the client-side source of truth (the cookie keeps SSR in
	// sync on the next request).
	// svelte-ignore state_referenced_locally
	initLocale(data.locale);

	onMount(() => {
		if (!('serviceWorker' in navigator)) return;
		// When a new SW takes control after a deploy, hashed route chunks the open
		// tab lazily loads have vanished (404). Reload to pick up the new build.
		// Guard: only reload if a SW already controlled this page at setup, so the
		// first install doesn't trigger a reload loop.
		const hadController = !!navigator.serviceWorker.controller;
		const onChange = () => {
			if (hadController) location.reload();
		};
		navigator.serviceWorker.addEventListener('controllerchange', onChange);
		return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange);
	});

	// Cached pages hold the previous user's data; drop the runtime cache on logout.
	function onLogout() {
		if (browser && 'caches' in window) caches.delete('runtime');
		// no preventDefault: the normal POST to /auth/logout still proceeds.
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<div class="bar">
		<div class="left">
			<a class="brand" href="/">Trips</a>
			<LocaleSwitcher />
		</div>
		<nav>
			{#if data.user}
				<button type="button" class="feedback" onclick={() => (feedbackOpen = true)}>{t('feedback.button')}</button>
				<span class="who">{data.user.name ?? data.user.email}</span>
				<form method="POST" action="/auth/logout" onsubmit={onLogout}>
					<button type="submit">{t('header.signOut')}</button>
				</form>
			{:else}
				<a class="signin" href="/auth/login/google">{t('header.signInGoogle')}</a>
			{/if}
		</nav>
	</div>
</header>

{@render children()}

{#if data.user}
	<FeedbackDialog bind:open={feedbackOpen} />
{/if}

<style>
	header {
		border-bottom: 1px solid #e2ddd2;
		font-family: system-ui, sans-serif;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.75rem 1.5rem;
	}
	.left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 12ch;
	}
	@media (max-width: 520px) {
		.bar {
			padding: 0.6rem 0.85rem;
			gap: 0.5rem;
		}
		.left {
			gap: 0.5rem;
		}
		nav {
			gap: 0.5rem;
		}
		/* Below ~520px the name is the biggest offender: drop it, keep Sign out. */
		.who {
			display: none;
		}
		/* Keep every tappable control at a comfortable touch height. */
		.signin,
		.feedback,
		nav button {
			min-height: 40px;
			display: inline-flex;
			align-items: center;
		}
	}
	.feedback {
		border-color: #e2ddd2;
		background: transparent;
		color: #7a6e5f;
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
