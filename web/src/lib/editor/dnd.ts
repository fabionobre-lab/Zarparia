import { flushSync } from 'svelte';
import { dndzone } from 'svelte-dnd-action';

/**
 * Stable synthetic ids for drag-and-drop. svelte-dnd-action requires every
 * item to carry a unique `id`, but Day and Block have no id field and the trip
 * schema is `additionalProperties: false`, so we must never write one into the
 * model. Instead we key ids off object identity in a WeakMap: the id survives
 * reorders (same object → same id) yet is never serialized.
 */
const ids = new WeakMap<object, string>();
let counter = 0;

export function dndId(obj: object): string {
	let id = ids.get(obj);
	if (id === undefined) {
		id = `dnd-${++counter}`;
		ids.set(obj, id);
	}
	return id;
}

/** Unwrap dnd items (incl. the drag shadow, which carries a real `item`) back
 *  to the underlying model objects, preserving their order. */
export function fromItems<T>(items: Array<{ item: T }>): T[] {
	return items.map((w) => w.item);
}

/**
 * Handle-initiated drag for svelte-dnd-action under Svelte 5 runes.
 *
 * The library only attaches its `mousedown`/`touchstart` drag-start listener to
 * an item while that zone's `dragDisabled` is false; otherwise grabbing the row
 * does nothing (which is what we want — the row's <summary> must stay clickable
 * to expand). To restrict dragging to the grip only, we keep `dragDisabled`
 * true and flip it to false the instant the grip is pressed.
 *
 * Runes flush action updates asynchronously, so a plain assignment would attach
 * the listener too late for the current gesture. We press via `pointerdown`
 * (which fires before `mousedown`/`touchstart`) and `flushSync()` so the
 * listener is in place before the drag-start event arrives. A one-shot
 * `pointerup` re-arms `dragDisabled` so a mere click on the grip can't leave the
 * whole row draggable.
 */
export function grabHandle(setDisabled: (v: boolean) => void): void {
	setDisabled(false);
	flushSync();
	const rearm = () => {
		window.removeEventListener('pointerup', rearm);
		// Defer past the library's own pointerup/finalize so we never flip
		// dragDisabled mid-drop (which aborts the reorder). This only matters as a
		// safety net for a click on the grip that never became a drag; a real drag
		// re-arms in its finalize handler.
		setTimeout(() => setDisabled(true), 0);
	};
	window.addEventListener('pointerup', rearm);
}

/** Subtle, consistent flip animation for all editor drag zones. */
export const FLIP_MS = 150;

export { dndzone };
