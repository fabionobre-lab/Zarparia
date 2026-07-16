<script lang="ts">
	// Bottom sheet that slides up from the bar. Kept in the DOM at all times
	// (visibility toggles) so SSR and the client agree; focus is trapped while
	// open, Escape and a scrim tap both close it, and body scroll is locked so
	// the page behind doesn't move. Motion respects prefers-reduced-motion via a
	// CSS media query (the transform/opacity transitions simply drop out).
	import type { Snippet } from 'svelte';
	import NavIcon from './NavIcon.svelte';

	let {
		open = $bindable(false),
		label,
		closeLabel,
		children
	}: {
		open?: boolean;
		label: string;
		closeLabel: string;
		children: Snippet;
	} = $props();

	let panelEl = $state<HTMLDivElement | null>(null);
	let restoreFocus: HTMLElement | null = null;

	function close() {
		open = false;
	}

	function focusables(): HTMLElement[] {
		if (!panelEl) return [];
		return Array.from(
			panelEl.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => el.offsetParent !== null);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
			return;
		}
		if (e.key !== 'Tab') return;
		const items = focusables();
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement as HTMLElement | null;
		if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	// Drive focus + scroll-lock off the open flag. On open, remember the trigger
	// so focus returns to it on close (the More button in the bar).
	$effect(() => {
		if (open) {
			restoreFocus = document.activeElement as HTMLElement | null;
			document.body.style.overflow = 'hidden';
			// Wait a frame so the panel is visible/tabbable before focusing.
			requestAnimationFrame(() => focusables()[0]?.focus());
		} else {
			document.body.style.overflow = '';
			restoreFocus?.focus?.();
			restoreFocus = null;
		}
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<div class="sheet-root" class:open aria-hidden={!open}>
	<button type="button" class="scrim" tabindex="-1" aria-label={closeLabel} onclick={close}></button>
	<div
		bind:this={panelEl}
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-label={label}
		tabindex="-1"
		onkeydown={onKeydown}
	>
		<div class="handle">
			<span class="grabber" aria-hidden="true"></span>
			<button type="button" class="close" aria-label={closeLabel} onclick={close}>
				<NavIcon name="close" size={20} />
			</button>
		</div>
		<div class="rows">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.sheet-root {
		position: fixed;
		inset: 0;
		z-index: 1100;
		visibility: hidden;
		pointer-events: none;
	}
	.sheet-root.open {
		visibility: visible;
		pointer-events: auto;
	}
	.scrim {
		position: absolute;
		inset: 0;
		border: none;
		padding: 0;
		width: 100%;
		height: 100%;
		background: rgba(10, 7, 3, 0.5);
		opacity: 0;
		cursor: default;
	}
	.sheet-root.open .scrim {
		opacity: 1;
	}
	.panel {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--surface);
		border-top-left-radius: 18px;
		border-top-right-radius: 18px;
		border-top: 1px solid var(--hairline);
		box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.22);
		padding: 0.4rem 0.9rem calc(0.9rem + env(safe-area-inset-bottom));
		max-height: 85vh;
		overflow-y: auto;
		transform: translateY(100%);
		font-family: system-ui, sans-serif;
	}
	.sheet-root.open .panel {
		transform: translateY(0);
	}
	@media (prefers-reduced-motion: no-preference) {
		.scrim {
			transition: opacity var(--dur-base) var(--ease-out);
		}
		.panel {
			transition: transform var(--dur-slow) var(--ease-out);
		}
	}
	.handle {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 40px;
	}
	.grabber {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: var(--hairline-strong);
	}
	.close {
		position: absolute;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: 999px;
	}
	.close:hover {
		color: var(--accent-strong);
	}
	.rows {
		display: flex;
		flex-direction: column;
	}
</style>
