// Shared display formatting helpers for numeric figures rendered with
// tabular-nums styling (weather temperatures today; extend here, not inline,
// if another negative-capable figure shows up).

/** True minus (U+2212), not the ASCII hyphen — it matches the width and
 *  weight of digits in tabular figures, so a negative doesn't visually
 *  shrink next to its positive neighbours. Display-only: never feed
 *  formatted strings back into parsing/storage. */
export const MINUS = '−';

/** Whole-degree Celsius temperature, e.g. "3°C" / "−3°C". Rounds to the
 *  nearest degree and swaps the ASCII hyphen for MINUS on negative values. */
export function formatTemp(celsius: number): string {
	const v = Math.round(celsius);
	return (v < 0 ? MINUS : '') + Math.abs(v) + '°C';
}
