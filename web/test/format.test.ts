// Weather temperatures render with a true minus (U+2212), not the ASCII
// hyphen, so negatives line up with tabular-nums figures elsewhere.
import { describe, expect, it } from 'vitest';
import { formatTemp, MINUS, walkMinutes } from '../src/lib/format';

describe('formatTemp', () => {
	it('renders a positive temperature with no sign', () => {
		expect(formatTemp(3)).toBe('3°C');
	});

	it('renders a negative temperature with the true minus glyph', () => {
		expect(formatTemp(-3)).toBe(`${MINUS}3°C`);
		expect(formatTemp(-3)).not.toContain('-3');
	});

	it('rounds to the nearest whole degree', () => {
		expect(formatTemp(2.6)).toBe('3°C');
		expect(formatTemp(-2.6)).toBe(`${MINUS}3°C`);
	});

	it('treats -0 as non-negative', () => {
		expect(formatTemp(-0.2)).toBe('0°C');
	});
});

// Inter-stop walking-time hint: 4.6 km/h, rounded to 5-minute granularity,
// hidden entirely below that threshold (Phase 6 item 3).
describe('walkMinutes', () => {
	it('estimates walking time at 4.6 km/h, rounded to 5 minutes', () => {
		expect(walkMinutes(1.1)).toBe(15);
		expect(walkMinutes(2.3)).toBe(30);
	});

	it('returns null for a zero or negative distance', () => {
		expect(walkMinutes(0)).toBeNull();
		expect(walkMinutes(-1)).toBeNull();
	});

	it('returns null when the rounded estimate is under 5 minutes', () => {
		expect(walkMinutes(0.05)).toBeNull();
	});

	it('includes the boundary case that rounds up to exactly 5 minutes', () => {
		expect(walkMinutes(0.3)).toBe(5);
	});
});
