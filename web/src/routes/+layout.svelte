<script lang="ts">
	// Aria Nobre family canon (C:\AI\AriaNobre\design\DESIGN.md) — must load
	// BEFORE tokens.css so this app's semantic remap (Phase 1 of
	// DESIGN-CONSISTENCY-PLAN.md) can reference --an-* custom properties.
	import '../styles/aria-nobre-tokens.css';
	import '../styles/tokens.css';
	// Self-hosted fonts (offline-first: no Google Fonts network request).
	// Only the weights actually used in the app are imported, and only the
	// 'latin' subset (en-GB/pt-BR locales only — Portuguese diacritics live in
	// the Latin-1 Supplement range the 'latin' subset already covers), mirroring
	// Saldaria's rationale (C:\AI\Rachid\src\main.jsx). Inter is the UI-chrome
	// font (adopted here for Phase 3's chrome sweep; today's chrome still says
	// system-ui in most components — see DESIGN-CONSISTENCY-PLAN.md Phase 3).
	// Source Serif 4 replaces Playfair Display for trip content + headings
	// (decision point 3); 700 is imported in addition to the spec's 400/500/600
	// because trip headings (.trip-title, .dh-title) use font-weight: 700 and
	// would otherwise synthetic-bold.
	import '@fontsource/inter/latin-400.css';
	import '@fontsource/inter/latin-500.css';
	import '@fontsource/inter/latin-600.css';
	import '@fontsource/source-serif-4/latin-400.css';
	import '@fontsource/source-serif-4/latin-500.css';
	import '@fontsource/source-serif-4/latin-600.css';
	import '@fontsource/source-serif-4/latin-700.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import { page, navigating } from '$app/state';
	import { env as publicEnv } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/nav/Sidebar.svelte';
	import FeedbackDialog from '$lib/FeedbackDialog.svelte';
	import Toast from '$lib/toast/Toast.svelte';
	import TripListSkeleton from '$lib/ui/skeletons/TripListSkeleton.svelte';
	import DaySkeleton from '$lib/ui/skeletons/DaySkeleton.svelte';
	import { initLocale, t } from '$lib/i18n/store.svelte';
	import { initTheme } from '$lib/theme/store.svelte';
	import { syncUserMarker, safeLocalStorage } from '$lib/client/userCacheReset';
	import { initSentryIfConfigured } from '$lib/client/sentry';

	let { children, data } = $props();

	let feedbackOpen = $state(false);

	// Site-wide Open Graph defaults (moved out of the static app.html so a
	// route's load fn can override them — a static tag can't be overridden,
	// only duplicated). Override source is `data.og` — { title?, description?,
	// image?, url? } — returned from any route's load (see routes/demo for the
	// first per-route override). Routes' own svelte:head blocks only set
	// <title>; that's untouched, this is og:title/description/image/url +
	// the plain description meta.
	const og = $derived({
		title: page.data.og?.title ?? 'Zarparia — Chart your journey.',
		description:
			page.data.og?.description ??
			'Zarparia — plan and share travel itineraries. Early-access, invite-only beta.',
		// TODO(Phase 7): swap for the custom domain once it lands.
		image: page.data.og?.image ?? `${page.url.origin}/icon-512.png`,
		// Strip query/hash: the canonical URL for a route, not whatever params
		// happened to be on this particular request.
		url: page.data.og?.url ?? `${page.url.origin}${page.url.pathname}`
	});

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

	// Client-side navigation skeletons (Phase 3 task 4): SvelteKit keeps the
	// OUTGOING page mounted until the destination's `load()` resolves, so a
	// layout-level overlay — keyed on the destination route id — is the only
	// place that can show a "the new page is loading" state at all. Limited to
	// the two initial-content-load routes named in scope: the home trip list
	// and a trip's day content; every other route just shows the stale page
	// until the swap (unchanged, existing behaviour).
	const navTarget = $derived.by(() => {
		const to = navigating.to?.route.id;
		if (to === '/') return 'list';
		if (to === '/trips/[id]') return 'day';
		return null;
	});
	// Flash guard: only show the skeleton if the navigation is still pending
	// after 150ms — instant/cached transitions swap directly with no skeleton
	// blink. The timer is cancelled (via $effect cleanup) the moment
	// `navigating` resolves or the target changes.
	let navSkeleton = $state<'list' | 'day' | null>(null);
	$effect(() => {
		const target = navTarget;
		if (!target) {
			navSkeleton = null;
			return;
		}
		const timer = setTimeout(() => {
			navSkeleton = target;
		}, 150);
		return () => {
			clearTimeout(timer);
			navSkeleton = null;
		};
	});
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
	<meta name="description" content={og.description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Zarparia" />
	<meta property="og:title" content={og.title} />
	<meta property="og:description" content={og.description} />
	<meta property="og:image" content={og.image} />
	<meta property="og:url" content={og.url} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<div class="layout" class:sidebar-mode={showSidebar}>
	{#if showSidebar}
		<Sidebar user={data.user} admin={data.admin} onFeedback={() => (feedbackOpen = true)} />
	{/if}

	<div class="page-col">
		{#if navSkeleton}
			<div class="nav-skeleton" role="status" aria-label={t('nav.loading')}>
				{#if navSkeleton === 'list'}
					<TripListSkeleton />
				{:else}
					<DaySkeleton />
				{/if}
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>
</div>

{#if data.user && data.user.status === 'approved'}
	<FeedbackDialog bind:open={feedbackOpen} />
{/if}

<Toast />

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
	.nav-skeleton {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 1.5rem 3rem;
	}
	@media (min-width: 960px) {
		.layout.sidebar-mode {
			display: grid;
			grid-template-columns: 240px minmax(0, 1fr);
			align-items: start;
		}
		/* Family "Demo banner" anatomy (DESIGN.md): the strip is pinned
		   full-width and fixed above this grid (see routes/demo/+page.svelte),
		   so it no longer occupies flow space. Push BOTH columns — sidebar and
		   content — down by its measured height (published as --demo-banner-h)
		   so nothing starts underneath it. No-op (0px) on every other route,
		   where <body> never gets the has-demo-banner class. */
		:global(body.has-demo-banner) .layout.sidebar-mode {
			padding-top: var(--demo-banner-h, 0px);
		}
	}
</style>
