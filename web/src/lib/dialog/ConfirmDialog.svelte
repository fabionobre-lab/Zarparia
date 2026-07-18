<script lang="ts">
	// Styled replacement for window.confirm(), built on the app's existing
	// native <dialog> pattern (see FeedbackDialog.svelte) — Phase 3 task 3.
	// Cancel is auto-focused (DESIGN.md's safety rule: never the danger
	// action); Escape and backdrop click both cancel, matching native
	// confirm()'s "no means no" default.
	let {
		open = $bindable(false),
		title,
		body,
		confirmLabel,
		cancelLabel,
		onconfirm,
		oncancel,
		titleId = 'confirm-dialog-title'
	}: {
		open?: boolean;
		title: string;
		body: string;
		confirmLabel: string;
		cancelLabel: string;
		onconfirm: () => void;
		oncancel?: () => void;
		titleId?: string;
	} = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let cancelEl = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (open && !el.open) {
			el.showModal();
			// Cancel is the safe default focus target on any destructive confirm.
			cancelEl?.focus();
		} else if (!open && el.open) {
			el.close();
		}
	});

	function cancel() {
		oncancel?.();
		open = false;
	}
	function confirm() {
		onconfirm();
		open = false;
	}
	// The native <dialog> closes itself on Escape only — backdrop clicks need
	// manual wiring (a click on the backdrop targets the <dialog> element
	// itself, since the panel's own content is what's inside it). Both paths
	// route through the same cancel() so callers' oncancel always fires
	// consistently and `open` never drifts out of sync.
	function onClose() {
		if (open) cancel();
	}
	function onBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) cancel();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="confirm"
	aria-modal="true"
	aria-labelledby={titleId}
	onclose={onClose}
	onclick={onBackdropClick}
>
	<h2 id={titleId}>{title}</h2>
	<p>{body}</p>
	<div class="actions">
		<button type="button" class="cancel" bind:this={cancelEl} onclick={cancel}>{cancelLabel}</button>
		<button type="button" class="danger" onclick={confirm}>{confirmLabel}</button>
	</div>
</dialog>

<style>
	.confirm {
		box-sizing: border-box;
		width: min(380px, calc(100vw - 2rem));
		border: none;
		border-radius: var(--radius-lg);
		padding: 1.1rem 1.2rem;
		background: var(--surface);
		color: var(--text);
		font-family: var(--font-ui);
		box-shadow: var(--elevation-3);
	}
	.confirm::backdrop {
		background: var(--scrim);
	}
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.5rem;
	}
	p {
		margin: 0;
		font-size: 0.88rem;
		color: var(--text-muted);
		line-height: 1.5;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1.1rem;
	}
	.actions button {
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		border-radius: var(--radius-button);
		padding: 0.5rem 1.1rem;
		cursor: pointer;
	}
	.cancel {
		border: 1px solid var(--hairline-strong);
		background: var(--surface);
		color: var(--text);
	}
	.danger {
		/* Fill-safe danger pair, NOT var(--an-danger): the canon danger token's
		   dark branch is oxblood-300 (#C68A96), the TEXT-safe step — white text
		   on it is 2.81:1. Fills use oxblood-600 in dark (white on #7A3646 =
		   8.59:1), mirroring Nobria's --color-danger-fill convention. */
		border: 1px solid light-dark(var(--an-oxblood-700), var(--an-oxblood-600));
		background: light-dark(var(--an-oxblood-700), var(--an-oxblood-600));
		color: #fff;
	}
</style>
