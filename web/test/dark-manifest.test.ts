// Two web manifests ship so the Android 3-button navigation bar follows the
// theme (one manifest holds one colour). They must never drift apart: they
// differ ONLY in theme_color and background_color. Files load with ?raw
// because tests run inside workerd, which has no node:fs.
import { describe, expect, it } from 'vitest';
import lightRaw from '../static/manifest.webmanifest?raw';
import darkRaw from '../static/manifest-dark.webmanifest?raw';
import { isDarkTheme, manifestHref, MANIFEST_DARK, MANIFEST_LIGHT } from '../src/lib/theme';

const light = JSON.parse(lightRaw) as Record<string, unknown>;
const dark = JSON.parse(darkRaw) as Record<string, unknown>;
const COLOUR_KEYS = ['theme_color', 'background_color'];

function withoutColours(m: Record<string, unknown>): Record<string, unknown> {
	const copy = { ...m };
	for (const k of COLOUR_KEYS) delete copy[k];
	return copy;
}

describe('manifest pair', () => {
	it('light and dark are equal except theme_color and background_color', () => {
		expect(withoutColours(dark)).toEqual(withoutColours(light));
	});

	it('light uses the light canon and dark uses the dark canon', () => {
		expect(light.theme_color).toBe('#F5F2EC');
		expect(light.background_color).toBe('#F5F2EC');
		expect(dark.theme_color).toBe('#141B28');
		expect(dark.background_color).toBe('#141B28');
	});

	it('both carry the same id, so they are one app', () => {
		expect(light.id).toBe('/');
		expect(dark.id).toBe('/');
	});
});

describe('manifest link choice', () => {
	it('picks the dark manifest only for the dark theme in use', () => {
		expect(manifestHref(true)).toBe(MANIFEST_DARK);
		expect(manifestHref(false)).toBe(MANIFEST_LIGHT);
	});

	it('a pinned mode wins over the OS, and system follows the OS', () => {
		expect(isDarkTheme('dark', false)).toBe(true);
		expect(isDarkTheme('light', true)).toBe(false);
		expect(isDarkTheme('system', true)).toBe(true);
		expect(isDarkTheme('system', false)).toBe(false);
	});
});
