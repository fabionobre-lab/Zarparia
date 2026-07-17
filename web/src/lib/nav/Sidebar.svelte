<script lang="ts">
	// Persistent desktop (≥960px) left sidebar — the app's only desktop chrome
	// (there is no top bar): brand → primary navigation (+ the mounted trip's day
	// rail) → pinned utilities. Hidden below 960px (the BottomBar takes over
	// there). Rendered by
	// the root +layout.svelte, so it reads page-provided context (the trip rail and
	// the demo's About opener) through the tripNav module store rather than props.
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import markSvg from '$lib/assets/zarparia-mark-cc.svg?raw';
	import wordSvg from '$lib/assets/zarparia-wordmark-cc.svg?raw';
	import NavIcon, { type IconName } from './NavIcon.svelte';
	import LocaleSwitcher from '$lib/i18n/LocaleSwitcher.svelte';
	import { t } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import { theme, setTheme, nextTheme } from '$lib/theme/store.svelte';
	import { purgeUserCaches } from '$lib/client/userCacheReset';
	import { tripNav, sidebarAbout } from './tripNav.svelte';

	type SessionUser = { name?: string | null; email?: string | null; status?: string };

	let {
		user = null,
		admin = false,
		onFeedback
	}: {
		user?: SessionUser | null;
		admin?: boolean;
		onFeedback: () => void;
	} = $props();

	// Approval gate mirrors the BottomBar's More sheet: Feedback + Account are
	// for approved accounts only; theme/language + sign-out (or sign-in) are
	// always present.
	const approved = $derived(!!user && user.status === 'approved');
	const routeId = $derived(page.route.id ?? '');

	const navItems = $derived<{ id: string; label: string; icon: IconName; href: string; active: boolean }[]>([
		{ id: 'trips', label: t('nav.trips'), icon: 'trips', href: '/', active: routeId === '/' },
		{ id: 'new', label: t('nav.newTrip'), icon: 'newTrip', href: '/trips/new', active: routeId === '/trips/new' },
		{ id: 'import', label: t('nav.import'), icon: 'import', href: '/trips/import', active: routeId === '/trips/import' }
	]);

	const trip = $derived(tripNav());
	const about = $derived(sidebarAbout());

	const THEME_LABEL: Record<string, keyof Messages> = {
		system: 'theme.system',
		dark: 'theme.dark',
		light: 'theme.light'
	};

	// Mirror the header/BottomBar logout: purge this user's cached pages + photos
	// before the native form POST navigates, so the next account on this device
	// can't read them offline. try/finally guarantees the logout still proceeds.
	async function onLogout(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		try {
			await purgeUserCaches(browser && 'caches' in window ? window.caches : null);
		} finally {
			form.submit();
		}
	}
</script>

<aside class="sidebar">
	<!-- Zone 1 — brand -->
	<a class="brand" href="/" aria-label="Zarparia — home">
		{@html markSvg}
		<span class="wordmark">{@html wordSvg}</span>
	</a>

	<!-- Zone 2 — navigation (+ trip rail), scrolls within the sidebar -->
	<div class="mid">
		<nav class="primary" aria-label={t('nav.primaryLabel')}>
			{#each navItems as it (it.id)}
				<a class="nav-row" class:active={it.active} href={it.href} aria-current={it.active ? 'page' : undefined}>
					<NavIcon name={it.icon} size={20} />
					<span class="nav-label">{it.label}</span>
				</a>
			{/each}
		</nav>

		{#if trip}
			<hr class="divider" />
			<nav class="rail" aria-label={trip.label}>
				{#each trip.segments as seg (seg.id)}
					<div class="rail-seg">
						<div class="rail-seg-hdr">
							<div class="rail-seg-title">{seg.title}</div>
							{#if seg.subtitle}<div class="rail-seg-sub">{seg.subtitle}</div>{/if}
						</div>
						{#if seg.pills.length}
							<div class="rail-pills" role="group" aria-label={seg.title}>
								{#each seg.pills as p (p.id)}
									<button
										type="button"
										class="rail-pill"
										class:on={p.on}
										aria-pressed={p.on}
										onclick={() => trip.selectPlan(seg.id, p.id)}
									>
										{p.label}
									</button>
								{/each}
							</div>
						{/if}
						<div class="rail-days">
							{#each seg.days as d (d.gi)}
								<button
									type="button"
									class="rail-day"
									class:on={d.active}
									class:today={d.today}
									aria-current={d.active ? 'date' : undefined}
									onclick={() => trip.selectDay(d.gi)}
								>
									<span class="rail-day-date">
										<span class="rail-dow">{d.dateLabel}</span>
										{#if d.today}<span class="rail-today-dot" aria-hidden="true"></span>{/if}
									</span>
									<span class="rail-day-title">{d.title}</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</nav>
		{/if}
	</div>

	<!-- Zone 3 — utilities, pinned to the bottom -->
	<div class="utils">
		{#if approved}
			<button type="button" class="util-row" onclick={onFeedback}>
				<NavIcon name="feedback" size={20} />
				<span class="util-label">{t('feedback.button')}</span>
			</button>
			<a class="util-row" class:active={routeId === '/account'} href="/account" aria-current={routeId === '/account' ? 'page' : undefined}>
				<svg class="util-glyph" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="8" r="4" />
					<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
				</svg>
				<span class="util-label">{t('header.account')}</span>
			</a>
		{/if}

		{#if admin}
			<!-- Admin-only entry point to the sign-up approval queue. Display-only
			     gate: /admin/approvals re-checks isAdmin server-side and 404s for
			     everyone else. -->
			<a class="util-row" class:active={routeId === '/admin/approvals'} href="/admin/approvals" aria-current={routeId === '/admin/approvals' ? 'page' : undefined}>
				<svg class="util-glyph" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="9" cy="8" r="4" />
					<path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
					<path d="m15.5 10.5 2.2 2.2 4.3-4.3" />
				</svg>
				<span class="util-label">{t('admin.approvals.heading')}</span>
			</a>
		{/if}

		<a class="util-row" class:active={routeId === '/guide'} href="/guide" aria-current={routeId === '/guide' ? 'page' : undefined}>
			<NavIcon name="guide" size={20} />
			<span class="util-label">{t('nav.guide')}</span>
		</a>

		<button
			type="button"
			class="util-row"
			onclick={() => setTheme(nextTheme(theme()))}
			aria-label={t(THEME_LABEL[theme()] ?? 'theme.system')}
		>
			{#if theme() === 'light'}
				<svg class="util-glyph" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<circle cx="12" cy="12" r="4.2" />
					<path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
				</svg>
			{:else if theme() === 'dark'}
				<svg class="util-glyph" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
					<path d="M20 14.6A8 8 0 0 1 9.4 4a1 1 0 0 0-1.3-1.3A9.5 9.5 0 1 0 21.3 15.9 1 1 0 0 0 20 14.6z" />
				</svg>
			{:else}
				<svg class="util-glyph" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="9" />
					<path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none" />
				</svg>
			{/if}
			<span class="util-label">{t(THEME_LABEL[theme()] ?? 'theme.system')}</span>
		</button>

		<div class="util-row static">
			<NavIcon name="language" size={20} />
			<span class="util-label">{t('header.language')}</span>
			<span class="util-trailing"><LocaleSwitcher /></span>
		</div>

		{#if about && !approved}
			<button type="button" class="util-row" onclick={about.open}>
				<NavIcon name="about" size={20} />
				<span class="util-label">{about.label}</span>
			</button>
		{/if}

		<hr class="divider" />

		{#if user}
			<div class="who">{user.name ?? user.email}</div>
			<form method="POST" action="/auth/logout" onsubmit={onLogout}>
				<button type="submit" class="util-row">
					<NavIcon name="signout" size={20} />
					<span class="util-label">{t('header.signOut')}</span>
				</button>
			</form>
		{:else}
			<a class="util-row" href="/auth/login/google">
				<NavIcon name="signin" size={20} />
				<span class="util-label">{t('header.signInGoogle')}</span>
			</a>
		{/if}
	</div>
</aside>

<style>
	.sidebar {
		/* Below the desktop breakpoint the BottomBar is the chrome; the sidebar is
		   removed entirely (the root layout stops the grid too). */
		display: none;
	}
	@media (min-width: 960px) {
		.sidebar {
			display: flex;
			flex-direction: column;
			position: sticky;
			top: 0;
			height: 100vh;
			box-sizing: border-box;
			background: var(--surface);
			border-right: 1px solid var(--hairline);
			font-family: var(--font-ui);
		}
	}

	/* ── Zone 1: brand ── */
	.brand {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--text);
		padding: 1.1rem 1rem 0.9rem;
		border-bottom: 1px solid var(--hairline);
	}
	.brand :global(svg) {
		display: block;
		width: auto;
	}
	.brand > :global(svg) {
		height: 28px;
	}
	/* App-chrome brand lockup (DESIGN.md): wordmark at a matching visual cap
	   height to the ≈28px crest. The wordmark SVG's own viewBox is tightly
	   cropped around its full glyph extent (ascender tittle to descender),
	   so its cap height (the "Z"'s baseline-to-top) is only ~55% of the
	   rendered box height — 16px here previously gave an ~9px cap height,
	   visibly dwarfed by the crest. 30px brings the cap height to ~16px,
	   in line with the family's other rails. */
	.wordmark :global(svg) {
		height: 30px;
	}

	/* ── Zone 2: navigation + trip rail (scrolls) ── */
	.mid {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		padding: 0.6rem 0.5rem;
	}
	.primary {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nav-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 40px;
		padding: 0.4rem 0.65rem;
		border: none;
		border-radius: var(--radius-md);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 0.9rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.nav-label {
		min-width: 0;
	}
	.nav-row:hover {
		background: color-mix(in srgb, var(--accent-strong) 8%, transparent);
	}
	.nav-row.active {
		background: color-mix(in srgb, var(--accent-strong) 12%, transparent);
		color: var(--accent-strong);
		font-weight: 600;
	}
	.divider {
		height: 1px;
		border: none;
		background: var(--hairline);
		margin: 0.6rem 0.3rem;
	}

	/* Trip rail — same visual language as TripView's former ≥1200 day rail. */
	.rail {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 0 0.15rem 0.3rem;
	}
	.rail-seg {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rail-seg-hdr {
		padding: 0 6px 2px;
	}
	.rail-seg-title {
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		font-weight: 600;
		color: var(--accent-strong);
	}
	.rail-seg-sub {
		font-size: 10.5px;
		color: var(--text-muted);
		margin-top: 1px;
		line-height: 1.3;
	}
	.rail-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin: 2px 4px 6px;
	}
	.rail-pill {
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		color: var(--text-muted);
		border-radius: var(--radius-pill);
		padding: 4px 10px;
		font-family: inherit;
		font-size: 11px;
		cursor: pointer;
		line-height: 1.2;
	}
	.rail-pill.on {
		background: var(--accent);
		border-color: var(--accent);
		color: #fff;
		font-weight: 500;
	}
	.rail-pill:not(.on):hover {
		border-color: var(--accent-strong);
		color: var(--accent-strong);
		background: color-mix(in srgb, var(--accent-strong) 8%, transparent);
	}
	.rail-days {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.rail-day {
		display: flex;
		flex-direction: column;
		gap: 1px;
		width: 100%;
		min-height: 40px;
		box-sizing: border-box;
		padding: 6px 10px;
		border: none;
		border-radius: var(--radius-md);
		background: none;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		color: var(--text);
	}
	.rail-day-date {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.rail-day-title {
		font-family: 'Source Serif 4', serif;
		font-size: 13px;
		font-weight: 500;
		line-height: 1.25;
		color: var(--text);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.rail-today-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--accent-strong);
		flex-shrink: 0;
	}
	.rail-day.on {
		background: var(--accent);
	}
	.rail-day.on .rail-day-date {
		color: rgba(255, 255, 255, 0.75);
	}
	.rail-day.on .rail-day-title {
		color: #fff;
	}
	.rail-day.on .rail-today-dot {
		background: #fff;
	}
	.rail-day:not(.on):hover {
		background: color-mix(in srgb, var(--accent-strong) 8%, transparent);
	}

	/* ── Zone 3: utilities (pinned bottom) ── */
	.utils {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0.5rem 0.5rem 0.75rem;
		border-top: 1px solid var(--hairline);
	}
	.util-row {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		min-height: 40px;
		padding: 0.35rem 0.65rem;
		border: none;
		border-radius: var(--radius-md);
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 0.88rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}
	.util-row.static {
		cursor: default;
	}
	.util-row:not(.static):hover {
		background: color-mix(in srgb, var(--accent-strong) 8%, transparent);
	}
	.util-row.active {
		background: color-mix(in srgb, var(--accent-strong) 12%, transparent);
		color: var(--accent-strong);
		font-weight: 600;
	}
	.util-label {
		flex: 1;
		min-width: 0;
	}
	.util-glyph {
		display: block;
		flex-shrink: 0;
	}
	.util-trailing {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
	}
	.who {
		font-size: 0.78rem;
		color: var(--text-muted);
		padding: 0.25rem 0.65rem 0.15rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	form {
		margin: 0;
	}

	/* Focus states: the global gold ring (tokens.css) covers these now —
	   see DESIGN.md's focus-ring rule (family signature, no per-app accent). */

	@media (prefers-reduced-motion: no-preference) {
		.nav-row,
		.util-row,
		.rail-day,
		.rail-pill {
			transition:
				background 0.15s ease,
				color 0.15s ease,
				border-color 0.15s ease;
		}
	}
</style>
