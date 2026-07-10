<script lang="ts">
	// Compact EN | PT UI-language toggle. Styled like the trip viewer's language
	// pill, but for light chrome (header + signed-out landing). aria-pressed marks
	// the active locale, mirroring the viewer toggle's semantics.
	import { LOCALES, LOCALE_SHORT } from './index';
	import { locale, setLocale, t } from './store.svelte';
</script>

<div class="locale-switch" role="group" aria-label={t('header.language')}>
	{#each LOCALES as l (l)}
		<button
			type="button"
			class="ls-btn"
			class:on={locale() === l}
			aria-pressed={locale() === l}
			onclick={() => setLocale(l)}
		>
			{LOCALE_SHORT[l]}
		</button>
	{/each}
</div>

<style>
	.locale-switch {
		display: inline-flex;
		border: 1px solid #cbb;
		border-radius: 999px;
		overflow: hidden;
		background: #faf6ee;
	}
	.ls-btn {
		font: inherit;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		min-height: 32px;
		padding: 0.2rem 0.7rem;
		border: none;
		background: transparent;
		color: #7a6e5f;
		cursor: pointer;
	}
	.ls-btn.on {
		background: #2b4a2b;
		color: #fff;
		font-weight: 600;
	}
	@media (max-width: 520px) {
		.ls-btn {
			min-height: 40px;
			padding: 0.2rem 0.6rem;
		}
	}
	.ls-btn:not(.on):hover {
		color: #2b4a2b;
	}
</style>
