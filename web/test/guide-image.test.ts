// Unit tests for guideImageUrl() — resolves a GuideImage to a renderable
// https URL, or undefined when neither `file` nor a usable `url` is set.
import { describe, expect, it } from 'vitest';
import { guideImageUrl } from '../src/lib/trip-engine';

describe('guideImageUrl()', () => {
	it('resolves a Commons file to the Special:Redirect thumbnail URL at the given width', () => {
		const url = guideImageUrl({ file: 'Example.jpg' }, 330);
		expect(url).toBe(
			'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Example.jpg&width=330'
		);
	});

	it('encodes special characters in the file name', () => {
		const url = guideImageUrl({ file: 'A photo (1).jpg' }, 500);
		expect(url).toBe(
			'https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/' +
				encodeURIComponent('A photo (1).jpg') +
				'&width=500'
		);
	});

	it('passes an https url straight through, unchanged', () => {
		const url = guideImageUrl({ url: 'https://example.com/photo.jpg' }, 960);
		expect(url).toBe('https://example.com/photo.jpg');
	});

	it('prefers url over file when both are set', () => {
		const url = guideImageUrl({ url: 'https://example.com/photo.jpg', file: 'Example.jpg' }, 960);
		expect(url).toBe('https://example.com/photo.jpg');
	});

	it('rejects a non-https url', () => {
		const url = guideImageUrl({ url: 'http://example.com/photo.jpg' }, 330);
		expect(url).toBeUndefined();
	});

	it('returns undefined when neither file nor url is set', () => {
		const url = guideImageUrl({ credit: 'Jane Doe' }, 330);
		expect(url).toBeUndefined();
	});

	it('returns undefined for an undefined image', () => {
		expect(guideImageUrl(undefined, 330)).toBeUndefined();
	});
});
