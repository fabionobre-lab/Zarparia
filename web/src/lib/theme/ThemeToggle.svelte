<script lang="ts">
	// Ghost icon button that cycles system → dark → light. The icon reflects the
	// CURRENT mode (auto glyph / moon / sun); the aria-label + title come from the
	// typed i18n catalog so both are localized. Styled to sit next to the locale
	// switcher in the header (light chrome) and adapt in dark mode via tokens.
	import { t } from '$lib/i18n/store.svelte';
	import type { Messages } from '$lib/i18n';
	import { theme, setTheme, nextTheme } from './store.svelte';

	const LABEL_KEY: Record<string, keyof Messages> = {
		system: 'theme.system',
		dark: 'theme.dark',
		light: 'theme.light'
	};
	const label = $derived(t(LABEL_KEY[theme()] ?? 'theme.system'));
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={() => setTheme(nextTheme(theme()))}
	aria-label={label}
	title={label}
>
	{#if theme() === 'light'}
		<!-- sun -->
		<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
			<circle cx="12" cy="12" r="4.2" />
			<path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
		</svg>
	{:else if theme() === 'dark'}
		<!-- moon -->
		<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
			<path d="M20 14.6A8 8 0 0 1 9.4 4a1 1 0 0 0-1.3-1.3A9.5 9.5 0 1 0 21.3 15.9 1 1 0 0 0 20 14.6z" />
		</svg>
	{:else}
		<!-- auto (half-filled circle) -->
		<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="9" />
			<path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none" />
		</svg>
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		min-height: 34px;
		padding: 0;
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.theme-toggle:hover {
		color: var(--accent-strong);
		border-color: var(--accent-strong);
	}
	@media (prefers-reduced-motion: no-preference) {
		.theme-toggle {
			transition:
				color var(--dur-fast) var(--ease-out),
				border-color var(--dur-fast) var(--ease-out),
				transform var(--dur-fast) var(--ease-out);
		}
		.theme-toggle:active {
			transform: scale(0.92);
		}
	}
	@media (max-width: 520px) {
		.theme-toggle {
			width: 40px;
			height: 40px;
			min-height: 40px;
		}
	}
</style>
