<script lang="ts">
	// Mobile-only bottom app bar (variant A) — the app's only mobile chrome
	// (there is no top bar). Rendered by each app route and hidden at >=960px
	// via CSS, where the desktop sidebar takes over. The caller passes 1–3
	// primary items; the bar appends a "More" item that opens a bottom sheet
	// holding the rest of the chrome (feedback, account, guide, theme, language,
	// sign in/out) plus any page-specific rows (e.g. Photos on a trip).
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import NavIcon, { type IconName } from './NavIcon.svelte';
	import MoreSheet from './MoreSheet.svelte';
	import LocaleSwitcher from '$lib/i18n/LocaleSwitcher.svelte';
	import FeedbackDialog from '$lib/FeedbackDialog.svelte';
	import { t } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import { theme, setTheme, nextTheme } from '$lib/theme/store.svelte';
	import { purgeUserCaches } from '$lib/client/userCacheReset';

	type NavItem = {
		id: string;
		label: string;
		icon: IconName;
		href?: string;
		onclick?: () => void;
		current?: boolean;
	};
	type MoreRow = { id: string; label: string; icon: IconName; onclick: () => void };
	type SessionUser = { name?: string | null; email?: string | null; status?: string };

	let {
		items,
		moreRows = [],
		user = null,
		onAbout = undefined,
		aboutLabel = ''
	}: {
		items: NavItem[];
		moreRows?: MoreRow[];
		user?: SessionUser | null;
		onAbout?: (() => void) | undefined;
		aboutLabel?: string;
	} = $props();

	let moreOpen = $state(false);
	let feedbackOpen = $state(false);

	// Mirrors the desktop sidebar's approval gate: feedback is for approved
	// accounts only (pending/rejected users keep sign-out and the toggles).
	const showFeedback = $derived(!!user && user.status !== 'pending' && user.status !== 'rejected');

	// Admin-only Approvals entry, from the root layout's load data (present on
	// every page). Display-only gate: /admin/approvals re-checks isAdmin
	// server-side and 404s for everyone else.
	const admin = $derived(!!page.data.admin);

	const THEME_LABEL: Record<string, keyof Messages> = {
		system: 'theme.system',
		dark: 'theme.dark',
		light: 'theme.light'
	};

	function openFeedback() {
		moreOpen = false;
		feedbackOpen = true;
	}
	function doAbout() {
		moreOpen = false;
		onAbout?.();
	}
	function runRow(fn: () => void) {
		moreOpen = false;
		fn();
	}

	// Cached pages + photos hold the previous user's data; drop both on logout —
	// mirrors the header's onLogout so the sheet's Sign out behaves identically.
	// AWAITED before the form is submitted (a fire-and-forget delete raced the
	// logout navigation and could be abandoned); try/finally guarantees the
	// logout itself always proceeds even if the Cache API fails.
	async function onLogout(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		try {
			await purgeUserCaches(browser && 'caches' in window ? window.caches : null);
		} finally {
			form.submit(); // native submit: does not re-fire this handler
		}
	}

	// Hide the bar while the on-screen keyboard is open. A bar-bearing route can
	// reach a text input (the trip view's Share panel email field), and a fixed
	// bar floating over the keyboard is worse than no bar. visualViewport shrinks
	// by roughly the keyboard height, so a large gap vs. the layout viewport is a
	// reliable "keyboard is up" signal. No-op where visualViewport is missing.
	let keyboardOpen = $state(false);
	onMount(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const onResize = () => {
			keyboardOpen = window.innerHeight - vv.height > 150;
		};
		vv.addEventListener('resize', onResize);
		onResize();
		return () => vv.removeEventListener('resize', onResize);
	});
</script>

{#snippet barItem(it: NavItem)}
	{#if it.href}
		<a
			class="bar-item"
			class:current={it.current}
			href={it.href}
			aria-current={it.current ? 'page' : undefined}
		>
			<NavIcon name={it.icon} />
			<span class="bar-label">{it.label}</span>
		</a>
	{:else}
		<button
			type="button"
			class="bar-item"
			class:current={it.current}
			aria-current={it.current ? 'page' : undefined}
			onclick={it.onclick}
		>
			<NavIcon name={it.icon} />
			<span class="bar-label">{it.label}</span>
		</button>
	{/if}
{/snippet}

<nav class="bottom-bar" class:hidden={keyboardOpen} aria-label={t('nav.primaryLabel')}>
	{#each items as it (it.id)}
		{@render barItem(it)}
	{/each}
	<button
		type="button"
		class="bar-item"
		class:current={moreOpen}
		aria-haspopup="dialog"
		aria-expanded={moreOpen}
		onclick={() => (moreOpen = true)}
	>
		<NavIcon name="more" />
		<span class="bar-label">{t('nav.more')}</span>
	</button>
</nav>

<!-- In-flow spacer so page content (and the trip timeline's last block) can
     scroll clear of the fixed bar. Collapses to nothing at >=960px. -->
<div class="bar-spacer" aria-hidden="true"></div>

<MoreSheet bind:open={moreOpen} label={t('nav.moreLabel')} closeLabel={t('nav.close')}>
	{#each moreRows as r (r.id)}
		<button type="button" class="sheet-row" onclick={() => runRow(r.onclick)}>
			<NavIcon name={r.icon} />
			<span class="sheet-label">{r.label}</span>
		</button>
	{/each}

	{#if moreRows.length > 0}<div class="sheet-divider" role="separator"></div>{/if}

	{#if showFeedback}
		<button type="button" class="sheet-row" onclick={openFeedback}>
			<NavIcon name="feedback" />
			<span class="sheet-label">{t('feedback.button')}</span>
		</button>
		<a class="sheet-row" href="/account" onclick={() => (moreOpen = false)}>
			<svg
				class="mode-icon"
				aria-hidden="true"
				viewBox="0 0 24 24"
				width="22"
				height="22"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="8" r="4" />
				<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
			</svg>
			<span class="sheet-label">{t('header.account')}</span>
		</a>
	{/if}

	{#if admin}
		<a class="sheet-row" href="/admin/approvals" onclick={() => (moreOpen = false)}>
			<svg
				class="mode-icon"
				aria-hidden="true"
				viewBox="0 0 24 24"
				width="22"
				height="22"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="9" cy="8" r="4" />
				<path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
				<path d="m15.5 10.5 2.2 2.2 4.3-4.3" />
			</svg>
			<span class="sheet-label">{t('admin.approvals.heading')}</span>
		</a>
	{/if}

	<a class="sheet-row" href="/guide" onclick={() => (moreOpen = false)}>
		<NavIcon name="guide" />
		<span class="sheet-label">{t('nav.guide')}</span>
	</a>

	<button
		type="button"
		class="sheet-row"
		onclick={() => setTheme(nextTheme(theme()))}
		aria-label={t(THEME_LABEL[theme()] ?? 'theme.system')}
	>
		{#if theme() === 'light'}
			<svg class="mode-icon" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<circle cx="12" cy="12" r="4.2" />
				<path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
			</svg>
		{:else if theme() === 'dark'}
			<svg class="mode-icon" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
				<path d="M20 14.6A8 8 0 0 1 9.4 4a1 1 0 0 0-1.3-1.3A9.5 9.5 0 1 0 21.3 15.9 1 1 0 0 0 20 14.6z" />
			</svg>
		{:else}
			<svg class="mode-icon" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="9" />
				<path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none" />
			</svg>
		{/if}
		<span class="sheet-label">{t(THEME_LABEL[theme()] ?? 'theme.system')}</span>
	</button>

	<div class="sheet-row static">
		<NavIcon name="language" />
		<span class="sheet-label">{t('header.language')}</span>
		<span class="sheet-trailing"><LocaleSwitcher /></span>
	</div>

	{#if onAbout}
		<button type="button" class="sheet-row" onclick={doAbout}>
			<NavIcon name="about" />
			<span class="sheet-label">{aboutLabel || t('demo.about')}</span>
		</button>
	{/if}

	<div class="sheet-divider" role="separator"></div>

	{#if user}
		<form method="POST" action="/auth/logout" onsubmit={onLogout}>
			<button type="submit" class="sheet-row">
				<NavIcon name="signout" />
				<span class="sheet-label">{t('header.signOut')}</span>
			</button>
		</form>
	{:else}
		<a class="sheet-row" href="/auth/login/google">
			<NavIcon name="signin" />
			<span class="sheet-label">{t('header.signInGoogle')}</span>
		</a>
	{/if}
</MoreSheet>

{#if showFeedback}
	<FeedbackDialog bind:open={feedbackOpen} titleId="fb-title-nav" />
{/if}

<style>
	/* ── The bar ── */
	.bottom-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1001;
		display: flex;
		align-items: stretch;
		background: var(--surface);
		border-top: 1px solid var(--hairline);
		padding-bottom: env(safe-area-inset-bottom);
		font-family: system-ui, sans-serif;
	}
	.bottom-bar.hidden {
		display: none;
	}
	.bar-item {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		min-height: 56px;
		padding: 6px 4px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		text-decoration: none;
		font: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.bar-label {
		font-size: 11px;
		line-height: 1.1;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar-item.current {
		color: var(--accent-strong);
	}
	.bar-item:active {
		background: var(--surface-sunken);
	}
	@media (prefers-reduced-motion: no-preference) {
		.bar-item {
			transition: color var(--dur-fast) var(--ease-out);
		}
	}

	/* Reserve the bar's height in normal flow so nothing hides behind it. */
	.bar-spacer {
		height: calc(56px + env(safe-area-inset-bottom));
	}

	/* ── Sheet rows ── */
	.sheet-row {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		width: 100%;
		min-height: 52px;
		padding: 0.5rem 0.4rem;
		border: none;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 0.95rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.sheet-row.static {
		cursor: default;
	}
	.sheet-row:not(.static):active {
		background: var(--surface-sunken);
	}
	.sheet-label {
		flex: 1;
		min-width: 0;
	}
	.sheet-trailing {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
	}
	.mode-icon {
		display: block;
		flex-shrink: 0;
	}
	.sheet-divider {
		height: 1px;
		background: var(--hairline);
		margin: 0.3rem 0;
	}
	form {
		margin: 0;
	}

	/* ── Desktop: the bar and its spacer disappear entirely ── */
	@media (min-width: 960px) {
		.bottom-bar,
		.bar-spacer {
			display: none;
		}
	}
</style>
