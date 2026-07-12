/**
 * Maps a photo's capture timestamp onto a trip's itinerary. Pure — no DOM, no
 * bindings — so it runs in the Worker at import time and is unit-testable.
 *
 * The Google Photos APIs never expose GPS (a deliberate privacy stance), so
 * time is the join key: capture instant → wall-clock date/time in the trip's
 * timezone → itinerary day → block whose time window contains it.
 */
import {
	type Trip,
	type Segment,
	type Plan,
	tripTimezone,
	isoDateInTZ,
	minutesSinceMidnightInTZ,
	parseBlockTimeMinutes
} from './trip-engine';

export interface PhotoPlacement {
	segmentId: string;
	planId: string;
	/** YYYY-MM-DD of the matched itinerary day. */
	dayDate: string;
	/** Index into the day's blocks array, or null when the photo falls before
	 *  the first timed block (renders in the day-level strip instead). */
	blockIndex: number | null;
}

/** The plan a photo should be matched against: the segment's default plan
 *  (same rule the viewer uses when no tab is selected). */
function defaultPlan(seg: Segment): Plan | undefined {
	return seg.plans.find((p) => p.id === seg.defaultPlan) ?? seg.plans[0];
}

/** Timezone to interpret a capture instant in while matching against `seg`:
 *  the segment's own weather timezone when set, else any segment's (the
 *  creation wizard applies one zone trip-wide), else UTC. */
function segmentTimezone(trip: Trip, seg: Segment): string {
	return seg.weather?.timezone ?? tripTimezone(trip) ?? 'UTC';
}

/** Last block whose start time is at or before `minutes` since midnight.
 *  Blocks with unparseable times ("morning", "") are skipped — they never
 *  open a window of their own. Returns null when the photo precedes every
 *  timed block. */
export function blockIndexForMinutes(
	blocks: { time: string }[],
	minutes: number
): number | null {
	let match: number | null = null;
	for (let i = 0; i < blocks.length; i++) {
		const t = parseBlockTimeMinutes(blocks[i].time);
		if (t !== null && t <= minutes) match = i;
	}
	return match;
}

/**
 * Place one capture instant (ISO 8601, normally UTC from Google) on the trip.
 * Segments/days are scanned in itinerary order; the first day whose date
 * equals the capture date (in that segment's timezone) wins. Returns null for
 * photos taken outside every itinerary day — callers store those as
 * "unmatched" rather than dropping them.
 */
export function mapPhotoToTrip(trip: Trip, creationTimeISO: string): PhotoPlacement | null {
	const instant = new Date(creationTimeISO);
	if (Number.isNaN(instant.getTime())) return null;
	for (const seg of trip.segments ?? []) {
		const plan = defaultPlan(seg);
		if (!plan) continue;
		const tz = segmentTimezone(trip, seg);
		const localDate = isoDateInTZ(instant, tz);
		for (const day of plan.days ?? []) {
			if (day.date !== localDate) continue;
			const minutes = minutesSinceMidnightInTZ(instant, tz);
			return {
				segmentId: seg.id,
				planId: plan.id,
				dayDate: day.date,
				blockIndex: blockIndexForMinutes(day.blocks ?? [], minutes)
			};
		}
	}
	return null;
}
