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

/** Average walking speed (km/h) used for the timeline's inter-stop
 *  walking-time hints (Phase 6 item 3, first half — hint only, no route
 *  optimization). */
const WALK_KMH = 4.6;

/** Walking-time estimate in minutes for a distance in km, assuming
 *  {@link WALK_KMH}, rounded to 5-minute granularity. Returns `null` when the
 *  distance is 0/negative or the rounded estimate is under 5 minutes (not
 *  worth showing next to the distance). */
export function walkMinutes(km: number): number | null {
	if (!(km > 0)) return null;
	const raw = (km / WALK_KMH) * 60;
	const rounded = Math.round(raw / 5) * 5;
	return rounded >= 5 ? rounded : null;
}
