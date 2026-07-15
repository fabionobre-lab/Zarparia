<script lang="ts">
	import '../styles/tokens.css';
	import favicon from '$lib/assets/favicon.svg';
	import markSvg from '$lib/assets/zarparia-mark-cc.svg?raw';
	import wordSvg from '$lib/assets/zarparia-wordmark-cc.svg?raw';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import LocaleSwitcher from '$lib/i18n/LocaleSwitcher.svelte';
	import ThemeToggle from '$lib/theme/ThemeToggle.svelte';
	import FeedbackDialog from '$lib/FeedbackDialog.svelte';
	import { initLocale, t } from '$lib/i18n/store.svelte';
	import { initTheme } from '$lib/theme/store.svelte';

	let { children, data } = $props();

	let feedbackOpen = $state(false);

	// Seed the UI locale synchronously (SSR + client) before children render, so
	// the first paint is in the right language and there is no flash of English.
	// Intentionally reads the initial value only — after this, setLocale() from
	// the switcher is the client-side source of truth (the cookie keeps SSR in
	// sync on the next request).
	// svelte-ignore state_referenced_locally
	initLocale(data.locale);
	// Seed the theme mode the same way (SSR stamped <html data-theme> already;
	// this keeps the store's reactive icon in sync from the first render).
	// svelte-ignore state_referenced_locally
	initTheme(data.theme);

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

		// Ask the worker to pull this user's trips into the cache, so an installed
		// app opens a trip you never visited on this device. Only worth doing while
		// signed in and online; the worker itself is best-effort and won't throw.
		const warm = () => {
			if (!data.user || !navigator.onLine) return;
			navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'warm-offline' }));
		};
		warm();
		// Coming back online is the other moment worth warming: it's the likely
		// last chance before signal goes away again.
		addEventListener('online', warm);

		return () => {
			navigator.serviceWorker.removeEventListener('controllerchange', onChange);
			removeEventListener('online', warm);
		};
	});

	// Cached pages and photos hold the previous user's data; drop both on logout.
	// The external cache (map tiles, weather, Wikipedia) isn't per-user, so it stays.
	function onLogout() {
		if (browser && 'caches' in window) {
			caches.delete('runtime');
			caches.delete('photos');
		}
		// no preventDefault: the normal POST to /auth/logout still proceeds.
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<div class="bar">
		<div class="left">
			<a class="brand" href="/" aria-label="Zarparia — home">
				{@html markSvg}
				<span class="wordmark">{@html wordSvg}</span>
			</a>
			<LocaleSwitcher />
			<ThemeToggle />
		</div>
		<nav>
			{#if data.user}
				<button
					type="button"
					class="feedback"
					onclick={() => (feedbackOpen = true)}
					aria-label={t('feedback.button')}
					title={t('feedback.button')}
				>
					<svg class="feedback-icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9.5L5 19.5V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z" />
					</svg>
					<span class="feedback-label">{t('feedback.button')}</span>
				</button>
				<span class="who">{data.user.name ?? data.user.email}</span>
				<form method="POST" action="/auth/logout" onsubmit={onLogout}>
					<button type="submit" class="signout">{t('header.signOut')}</button>
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
		border-bottom: 1px solid var(--hairline);
		font-family: system-ui, sans-serif;
		background: var(--surface);
	}
	.bar {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.75rem 1.5rem;
	}
	.left {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.brand {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		text-decoration: none;
		color: var(--brand-ink);
	}
	.brand :global(svg) {
		display: block;
		width: auto;
	}
	.brand > :global(svg) {
		height: 30px;
	}
	.wordmark :global(svg) {
		height: 17px;
	}
	nav {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0.75rem;
	}
	.feedback {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}
	.feedback-icon {
		display: none;
		flex-shrink: 0;
	}
	.who {
		font-size: 0.85rem;
		color: var(--text-muted);
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
		/* Feedback collapses to an icon-only ghost circle; the text label
		   (still present for screen readers via aria-label) is visually hidden. */
		.feedback {
			width: 40px;
			padding: 0;
			justify-content: center;
			border-radius: 999px;
		}
		.feedback-icon {
			display: inline-flex;
		}
		.feedback-label {
			display: none;
		}
		/* Sign out drops its pill chrome for a quiet text link — one fewer
		   bordered control competing for the row's limited width. */
		.signout {
			border: none;
			background: transparent;
			padding: 0 0.15rem;
			color: var(--text-muted);
			text-decoration: underline;
			text-underline-offset: 0.15em;
		}
	}
	.feedback {
		border-color: var(--hairline);
		background: transparent;
		color: var(--text-muted);
	}
	.signin,
	button {
		font: inherit;
		font-size: 0.85rem;
		padding: 0.35rem 0.8rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		background: var(--bg);
		color: var(--text);
		text-decoration: none;
		cursor: pointer;
	}
	form {
		margin: 0;
	}
</style>
