<script lang="ts">
	// Accessible tooltip — Svelte 5 port of Nobria's src/screens/Tip.tsx.
	//
	//  - Desktop (hover-capable pointer): reveals on hover after a short dwell.
	//  - Touch: TAP toggles it open/closed; a tap elsewhere or Escape closes it.
	//  - Keyboard: the trigger is a button (Enter/Space toggles). Tabbing to it
	//    also reveals the tip via :focus-visible (this is the one behavior that
	//    intentionally diverges from the React source, per this port's task:
	//    plain focus must reveal, not just Enter/Space), and Escape or moving
	//    focus away hides it again.
	//
	// Unlike the React version, the popover is NOT portaled to document.body —
	// it's a plain absolutely-positioned child, CSS `position: fixed` isn't
	// needed for the two call sites this ports to (small badges, not deeply
	// nested inside overflow:hidden ancestors) — kept simple per the task note.
	let {
		text,
		wide = false,
		children
	}: { text: string; wide?: boolean; children: import('svelte').Snippet } = $props();

	let open = $state(false);
	let el: HTMLSpanElement | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const hoverCapable =
		typeof window !== 'undefined' &&
		window.matchMedia('(hover: hover) and (pointer: fine)').matches;

	function close() {
		open = false;
	}
	function toggle() {
		open = !open;
	}

	function onClick(e: MouseEvent) {
		// stopPropagation so tapping the tip inside a clickable ancestor opens
		// the tip without also triggering the ancestor's own click handler.
		e.stopPropagation();
		if (hoverCapable) close();
		else toggle();
	}
	function onMouseEnter() {
		if (!hoverCapable) return;
		timer = setTimeout(() => {
			open = true;
		}, 350);
	}
	function onMouseLeave() {
		if (!hoverCapable) return;
		clearTimeout(timer);
		open = false;
	}
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			e.stopPropagation();
			toggle();
		}
	}
	function onFocusIn() {
		open = true;
	}
	function onFocusOut() {
		open = false;
	}

	// While open: a tap/click outside, Escape, or any scroll/resize dismisses it.
	$effect(() => {
		if (!open) return;
		const onDoc = (e: Event) => {
			if (el && !el.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		const onMove = () => {
			open = false;
		};
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('touchstart', onDoc, { passive: true });
		document.addEventListener('keydown', onKey);
		window.addEventListener('scroll', onMove, true);
		window.addEventListener('resize', onMove);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('touchstart', onDoc);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('scroll', onMove, true);
			window.removeEventListener('resize', onMove);
		};
	});
</script>

<span
	bind:this={el}
	class="tip"
	class:open
	tabindex="0"
	role="button"
	aria-expanded={open}
	onclick={onClick}
	onmouseenter={onMouseEnter}
	onmouseleave={onMouseLeave}
	onkeydown={onKeyDown}
	onfocusin={onFocusIn}
	onfocusout={onFocusOut}
>
	{@render children()}
	<span class="tip-pop" class:wide role="tooltip">
		{text}
	</span>
</span>

<style>
	.tip {
		position: relative;
		display: inline-flex;
		cursor: pointer;
	}

	.tip-pop {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 40;
		width: 240px;
		padding: var(--space-2);
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius-sm);
		font-size: var(--type-small);
		line-height: 1.4;
		font-weight: 400;
		white-space: normal;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
		opacity: 0;
		visibility: hidden;
		transform: translateY(-2px);
		pointer-events: none;
	}
	.tip-pop.wide {
		width: 320px;
	}

	/* Revealed when JS sets .open (hover-dwell, tap/click toggle, Enter/Space,
	   or focusin) ... */
	.tip.open .tip-pop,
	/* ... and, redundantly/independently, on genuine keyboard focus — this is
	   the hard requirement: tabbing to the trigger must reveal the tip even if
	   the focusin handler above were ever removed, and blur/Escape (which both
	   clear `open`) hide it again since :focus-visible stops matching too. */
	.tip:focus-visible .tip-pop {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}

	@media (prefers-reduced-motion: no-preference) {
		.tip-pop {
			transition:
				opacity 120ms ease-out,
				transform 120ms ease-out,
				visibility 120ms;
		}
	}
</style>
