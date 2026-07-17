<script lang="ts">
	import '../styles/tokens.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { env as publicEnv } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/nav/Sidebar.svelte';
	import FeedbackDialog from '$lib/FeedbackDialog.svelte';
	import { initLocale } from '$lib/i18n/store.svelte';
	import { initTheme } from '$lib/theme/store.svelte';
	import { syncUserMarker, safeLocalStorage } from '$lib/client/userCacheReset';
	import { initSentryIfConfigured } from '$lib/client/sentry';

	let { children, data } = $props();

	let feedbackOpen = $state(false);

	// ── App chrome: no top bar, anywhere ──
	// Desktop (≥960px) gets the persistent left sidebar on the routes below;
	// mobile gets the BottomBar each page renders itself. The remaining routes
	// carry their own self-contained chrome instead: the signed-out landing and
	// the pending/rejected gate (both route id `/`) render a centered card with
	// crest/EN|PT/theme, and the transient flows (join invite, OAuth consent,
	// the error boundary) are bare centered panels by design.
	// `/` is special: the sidebar is the approved signed-in home only.
	// Derived from route id + session here (not signalled up from children) so
	// the first SSR paint is already correct.
	const SIDEBAR_ROUTES = new Set([
		'/demo',
		'/trips/[id]',
		'/trips/[id]/edit',
		'/trips/new',
		'/trips/import',
		'/account',
		'/feedback',
		'/admin/approvals',
		'/guide',
		'/roadmap',
		'/privacy',
		'/terms'
	]);
	const routeId = $derived(page.route.id ?? '');
	const showSidebar = $derived(
		SIDEBAR_ROUTES.has(routeId) || (routeId === '/' && data.user?.status === 'approved')
	);

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

	onMount(() => {
		// Phase 5.4 — Sentry, dormant unless PUBLIC_SENTRY_DSN is set (see
		// lib/client/sentry.ts). Deferred to idle time, after first paint, so a
		// configured DSN never delays interactivity; requestIdleCallback isn't
		// available in every browser (notably Safari), hence the setTimeout
		// fallback.
		const idle: (cb: () => void) => void =
			typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb) => setTimeout(cb, 1);
		idle(() => {
			void initSentryIfConfigured(publicEnv.PUBLIC_SENTRY_DSN);
		});
	});

	// Detected user change (A never signed out; B signs in on this browser):
	// purge A's cached pages/photos before recording B as the device's last
	// user. A missing session deliberately does NOT purge — that would destroy
	// the owner's offline access, the whole point of the PWA caches.
	// (Out of scope: B browsing while A's session cookie is still live — see
	// src/lib/client/userCacheReset.ts.)
	$effect(() => {
		const uid = data.user?.id;
		if (!browser || !uid) return;
		void syncUserMarker(uid, {
			caches: 'caches' in window ? window.caches : null,
			storage: safeLocalStorage()
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout" class:sidebar-mode={showSidebar}>
	{#if showSidebar}
		<Sidebar user={data.user} admin={data.admin} onFeedback={() => (feedbackOpen = true)} />
	{/if}

	<div class="page-col">
		{@render children()}
	</div>
</div>

{#if data.user && data.user.status === 'approved'}
	<FeedbackDialog bind:open={feedbackOpen} />
{/if}

<style>
	/* ── App shell ──
	   There is no top bar anywhere: mobile chrome is the per-page BottomBar (or a
	   route's own self-contained card), desktop chrome is the left sidebar. On a
	   sidebar route the shell becomes a two-track grid (fixed 240px sidebar +
	   fluid content) at ≥960px; below that it stays block flow and the sidebar
	   removes itself, so mobile is untouched. */
	.page-col {
		min-width: 0;
	}
	@media (min-width: 960px) {
		.layout.sidebar-mode {
			display: grid;
			grid-template-columns: 240px minmax(0, 1fr);
			align-items: start;
		}
	}
</style>
