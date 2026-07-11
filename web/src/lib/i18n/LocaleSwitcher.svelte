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
		flex-shrink: 0;
		border: 1px solid var(--hairline-strong);
		border-radius: 999px;
		overflow: hidden;
		background: var(--bg);
	}
	.ls-btn {
		font: inherit;
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		min-height: 32px;
		padding: 0.2rem 0.7rem;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		/* Root cause of the PT-label clipping: this button previously had no
		   flex-shrink guard, so when the header row ran out of space the flex
		   algorithm shrank it below its own text's min-content width — and
		   because the parent .locale-switch has overflow:hidden (for the pill's
		   rounded corners), the shrunk text was silently cut off mid-letter
		   instead of wrapping or reflowing. Buttons must never shrink smaller
		   than their label; the header now keeps this row from overflowing in
		   the first place, but this guard holds at any width. */
		flex-shrink: 0;
		white-space: nowrap;
	}
	.ls-btn.on {
		background: var(--accent);
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
		color: var(--accent-strong);
	}
</style>
