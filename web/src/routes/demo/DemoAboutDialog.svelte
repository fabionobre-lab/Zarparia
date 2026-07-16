<script lang="ts">
	import { t } from '$lib/i18n/store.svelte';

	// `open` is bindable so the banner's About button can reopen it. A native
	// <dialog> gives us the modal focus trap, Escape-to-close, and
	// focus-return-to-trigger for free (same pattern as FeedbackDialog).
	let { open = $bindable(false) }: { open?: boolean } = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (open && !el.open) {
			el.showModal();
		} else if (!open && el.open) {
			el.close();
		}
	});
</script>

<dialog
	bind:this={dialogEl}
	class="about"
	aria-modal="true"
	aria-labelledby="demo-about-title"
	onclose={() => (open = false)}
>
	<div class="hd">
		<span class="tag">{t('demo.aboutTag')}</span>
		<button type="button" class="x" onclick={() => (open = false)} aria-label={t('demo.close')}>✕</button>
	</div>

	<h2 id="demo-about-title">{t('demo.aboutTitle')}</h2>
	<p>{t('demo.aboutIntro')}</p>
	<p>{t('demo.aboutInteractive')}</p>

	<h3>{t('demo.tryHeading')}</h3>
	<ul>
		<li>{t('demo.tryPlans')}</li>
		<li>{t('demo.tryLanguage')}</li>
		<li>{t('demo.trySchedule')}</li>
	</ul>

	<div class="row">
		<a class="exit" href="/">{t('demo.back')}</a>
		<button type="button" class="go" onclick={() => (open = false)}>{t('demo.startExploring')}</button>
	</div>
</dialog>

<style>
	.about {
		box-sizing: border-box;
		width: min(480px, calc(100vw - 2rem));
		border: 1px solid var(--hairline-strong);
		border-radius: 14px;
		padding: 1.1rem 1.3rem 1.2rem;
		background: var(--surface);
		color: var(--text);
		font-family: system-ui, sans-serif;
	}
	.about::backdrop {
		background: rgba(10, 7, 3, 0.55);
	}
	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	.tag {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.x {
		font: inherit;
		font-size: 1rem;
		line-height: 1;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0.25rem;
	}
	h2 {
		font-size: 1.25rem;
		margin: 0 0 0.6rem;
	}
	p {
		font-size: 0.92rem;
		line-height: 1.55;
		margin: 0 0 0.7rem;
	}
	h3 {
		font-size: 0.85rem;
		margin: 1rem 0 0.4rem;
	}
	ul {
		margin: 0;
		padding-left: 1.1rem;
	}
	li {
		font-size: 0.88rem;
		line-height: 1.5;
		margin-bottom: 0.35rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 1.1rem;
	}
	.exit {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.go {
		font: inherit;
		font-size: 0.88rem;
		font-weight: 600;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 999px;
		padding: 0.5rem 1.3rem;
		cursor: pointer;
	}
</style>
