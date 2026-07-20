// Weather temperatures render with a true minus (U+2212), not the ASCII
// hyphen, so negatives line up with tabular-nums figures elsewhere.
import { describe, expect, it } from 'vitest';
import { formatTemp, MINUS } from '../src/lib/format';

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
