// Shared busy-button affordance (Phase 3 task 4) — a Svelte action so a
// submitting button disables and announces `aria-busy` consistently, instead
// of every dialog/panel re-deriving the same two lines. Deliberately does
// NOT own the button's visible label — each call site already swaps its own
// label text (`{busy ? t('x.working') : t('x.submit')}`), which stays local
// because the wording is app/action-specific.
//
// `disable` defaults to true (the action sets `disabled` itself, matching
// the common case where a button's only disable condition IS the busy flag —
// see SharePanel.svelte's submit/copy/remove buttons). Pass `disable: false`
// where the button's `disabled` binding already encodes other conditions
// alongside busy (e.g. FeedbackDialog's `canSubmit`), so the action only adds
// `aria-busy` without fighting the template's own disabled logic.
export interface BusyButtonParams {
	busy: boolean;
	disable?: boolean;
}

export function busyButton(node: HTMLButtonElement, params: boolean | BusyButtonParams) {
	function apply(p: boolean | BusyButtonParams) {
		const { busy, disable = true } = typeof p === 'boolean' ? { busy: p } : p;
		if (busy) node.setAttribute('aria-busy', 'true');
		else node.removeAttribute('aria-busy');
		if (disable) node.disabled = busy;
	}
	apply(params);
	return {
		update(p: boolean | BusyButtonParams) {
			apply(p);
		}
	};
}
