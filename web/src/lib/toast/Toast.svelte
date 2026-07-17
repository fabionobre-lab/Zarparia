<script lang="ts">
	// Bottom-anchored confirmation toast — family anatomy (DESIGN.md's
	// "Toasts" section): left accent bar (forest success / oxblood danger),
	// optional action button, close button, aria-live region, reduced-motion
	// safe entrance. Ported from Saldaria's Toast.jsx (C:\AI\Rachid\src\
	// components\Toast.jsx) onto Svelte 5 runes.
	//
	// Mounted exactly once, from the root +layout.svelte, reading the single
	// module-level store below it — no per-page host, so toasts never
	// pixel-stack or double-announce (same rationale as Saldaria's
	// ToastProvider).
	import { activeToast, dismissToast } from './store.svelte';
	import { t } from '$lib/i18n/store.svelte';

	let toast = $derived(activeToast());
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		clearTimeout(timer);
		const current = toast;
		if (!current) return;
		timer = setTimeout(dismissToast, current.durationMs);
		return () => clearTimeout(timer);
	});

	function runAction() {
		toast?.onAction?.();
		dismissToast();
	}
</script>

<!-- The aria-live region itself is always present (not conditionally mounted)
     so screen readers pick up the announcement reliably; its content is
     empty when there's nothing to say. -->
<div class="toast-region" aria-live="polite" role="status">
	{#if toast}
		{#key toast.id}
			<div class="toast" class:danger={toast.kind === 'danger'}>
				<span class="msg">{toast.message}</span>
				{#if toast.actionLabel}
					<button type="button" class="action" onclick={runAction}>{toast.actionLabel}</button>
				{/if}
				<button type="button" class="close" aria-label={t('toast.dismiss')} onclick={dismissToast}>✕</button>
			</div>
		{/key}
	{/if}
</div>

<style>
	.toast-region {
		position: fixed;
		left: 50%;
		bottom: calc(1rem + env(safe-area-inset-bottom));
		transform: translateX(-50%);
		z-index: 1050; /* above the BottomBar (1001), below sheet/dialog overlays (1100+) */
		max-width: calc(100vw - 2rem);
		pointer-events: none;
	}
	/* Clear the mobile BottomBar (see tokens.css's --bb-h) — but only on
	   routes that actually render one: BottomBar is opted into per-route and
	   stamps `has-bottombar` on <body> while mounted (see BottomBar.svelte).
	   Bar-less routes (account, join, admin, legal...) keep the plain
	   safe-area offset, as does desktop where the bar is hidden. */
	@media (max-width: 959.98px) {
		:global(body.has-bottombar) .toast-region {
			bottom: calc(var(--bb-h) + 1rem + env(safe-area-inset-bottom));
		}
	}
	.toast {
		position: relative;
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		max-width: min(92vw, 420px);
		padding: 0.65rem 0.9rem 0.65rem 1.1rem;
		border-radius: var(--radius-pill);
		/* --an-surface-raised (family canon, aria-nobre-tokens.css) rather than
		   this app's own --surface — Zarparia has no local "raised" alias, and
		   DESIGN.md's toast anatomy specifically calls for the raised step. */
		background: var(--an-surface-raised);
		color: var(--text);
		box-shadow: var(--elevation-2);
		font-family: var(--font-ui);
		font-size: 0.85rem;
	}
	/* Left accent bar — forest (success) / oxblood (danger), per DESIGN.md. */
	.toast::before {
		content: '';
		position: absolute;
		left: 0.45rem;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 3px;
		border-radius: var(--radius-pill);
		background: var(--an-success);
	}
	.toast.danger::before {
		background: var(--an-danger);
	}
	.msg {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.action {
		flex-shrink: 0;
		font: inherit;
		font-weight: 600;
		background: none;
		border: none;
		padding: 0.15rem 0.3rem;
		color: var(--accent-strong);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.close {
		flex-shrink: 0;
		font: inherit;
		font-size: 0.9rem;
		line-height: 1;
		background: none;
		border: none;
		padding: 0.2rem;
		color: var(--text-muted);
		cursor: pointer;
	}
	.close:hover {
		color: var(--text);
	}
	@media (prefers-reduced-motion: no-preference) {
		.toast {
			animation: toast-in var(--dur-slow, 240ms) var(--ease-out, ease-out);
		}
	}
	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
