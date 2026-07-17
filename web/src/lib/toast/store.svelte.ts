// Reactive toast state for Svelte 5 runes — Phase 3 port of the family toast
// (Nobria/Saldaria; see C:\AI\AriaNobre\design\DESIGN.md's "Toasts" section
// and C:\AI\Rachid\src\hooks\useToast.jsx, the reference implementation).
//
// Mirrors lib/theme/store.svelte.ts's shape: a single module-level $state
// object plus plain exported functions, no context/provider needed since
// there's exactly one toast host, mounted once in the root +layout.svelte.
//
// Max one toast visible at a time — a new toast() call replaces whatever is
// currently showing (matching Saldaria's "no queue" convention). Each toast
// gets an incrementing id so a rapid replace doesn't let a stale timer
// dismiss the new toast early.

export type ToastKind = 'success' | 'danger';

export interface ToastOptions {
	kind?: ToastKind;
	/** Optional action button (e.g. "Undo"). Firing it does NOT auto-dismiss —
	 *  callers that want dismiss-on-action should call dismissToast() themselves. */
	actionLabel?: string;
	onAction?: () => void;
	/** ms before auto-dismiss. Defaults per DESIGN.md: 3.2s success / 5s danger
	 *  / 7s when an action button is present (gives time to notice + act). */
	durationMs?: number;
}

export interface ToastState {
	id: number;
	message: string;
	kind: ToastKind;
	actionLabel?: string;
	onAction?: () => void;
	durationMs: number;
}

const DEFAULT_SUCCESS_MS = 3200;
const DEFAULT_DANGER_MS = 5000;
const WITH_ACTION_MS = 7000;

let current = $state<ToastState | null>(null);
let nextId = 0;

/** The currently visible toast, or null. Reactive when read in a component. */
export function activeToast(): ToastState | null {
	return current;
}

/** Show a toast, replacing any toast already visible. */
export function showToast(message: string, options: ToastOptions = {}): void {
	const kind: ToastKind = options.kind === 'danger' ? 'danger' : 'success';
	const durationMs =
		options.durationMs ??
		(options.actionLabel ? WITH_ACTION_MS : kind === 'danger' ? DEFAULT_DANGER_MS : DEFAULT_SUCCESS_MS);
	nextId += 1;
	current = {
		id: nextId,
		message,
		kind,
		actionLabel: options.actionLabel,
		onAction: options.onAction,
		durationMs
	};
}

export function dismissToast(): void {
	current = null;
}

/** Callable helper for call sites: `toast('Trip saved.')` (defaults to
 *  success) or `toast.danger('...', { actionLabel, onAction })`. */
function toastFn(message: string, options: ToastOptions = {}): void {
	showToast(message, options);
}
toastFn.success = (message: string, options: Omit<ToastOptions, 'kind'> = {}) =>
	showToast(message, { ...options, kind: 'success' });
toastFn.danger = (message: string, options: Omit<ToastOptions, 'kind'> = {}) =>
	showToast(message, { ...options, kind: 'danger' });

export const toast = toastFn;
