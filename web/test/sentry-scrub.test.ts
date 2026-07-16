// Phase 5.4 — Sentry client scaffold. scrubSentryEvent is a pure function
// (event in, event out) so this is a plain unit test with hand-built event
// fixtures — no live SDK, no DSN, no network involved.
import { describe, expect, it } from 'vitest';
import { scrubSentryEvent, initSentryIfConfigured } from '../src/lib/client/sentry';
import type { Breadcrumb, ErrorEvent as SentryEvent } from '@sentry/browser';

describe('scrubSentryEvent', () => {
	it('strips request body/cookies/headers/query_string, keeping only a query-stripped url', () => {
		const event: SentryEvent = {
			request: {
				url: 'https://zarparia.example/api/trips/abc123?token=secret&foo=bar',
				method: 'POST',
				data: { title: 'Our Portugal trip', notes: 'private itinerary details' },
				cookies: { session: 'abcdef' },
				headers: { authorization: 'Bearer supersecret' },
				query_string: 'token=secret&foo=bar'
			}
		};
		const scrubbed = scrubSentryEvent(event);
		expect(scrubbed?.request).toEqual({ url: 'https://zarparia.example/api/trips/abc123' });
	});

	it('leaves request undefined when the event has none', () => {
		const event: SentryEvent = { message: 'boom' };
		const scrubbed = scrubSentryEvent(event);
		expect(scrubbed?.request).toBeUndefined();
	});

	it('drops breadcrumb data unconditionally, even for a harmless-looking category', () => {
		const breadcrumbs: Breadcrumb[] = [
			{ category: 'navigation', type: 'navigation', level: 'info', timestamp: 123, data: { from: '/trips/abc', to: '/trips/def' } }
		];
		const scrubbed = scrubSentryEvent({ breadcrumbs });
		expect(scrubbed?.breadcrumbs?.[0]).toEqual({
			type: 'navigation',
			level: 'info',
			category: 'navigation',
			timestamp: 123
		});
		expect(scrubbed?.breadcrumbs?.[0]).not.toHaveProperty('data');
	});

	it('drops the message on risky-category breadcrumbs (xhr/fetch/console/ui.input)', () => {
		const breadcrumbs: Breadcrumb[] = [
			{ category: 'xhr', message: 'GET /api/trips/abc123 200', data: { url: '/api/trips/abc123' } },
			{ category: 'console', message: 'trip.title = "Portugal 2026"' },
			{ category: 'fetch', message: 'POST /api/photos/import' },
			{ category: 'ui.input', message: 'typed: Our Portugal trip' }
		];
		const scrubbed = scrubSentryEvent({ breadcrumbs });
		for (const b of scrubbed!.breadcrumbs!) {
			expect(b.message).toBeUndefined();
		}
	});

	it('drops the message on any breadcrumb whose text touches trip/photo/account/feedback content, regardless of category', () => {
		const breadcrumbs: Breadcrumb[] = [
			{ category: 'navigation', message: 'Navigated to /trips/abc123/edit' },
			{ category: 'ui.click', message: 'Clicked delete on /api/account' }
		];
		const scrubbed = scrubSentryEvent({ breadcrumbs });
		for (const b of scrubbed!.breadcrumbs!) {
			expect(b.message).toBeUndefined();
		}
	});

	it('keeps a query-stripped message on a safe, non-content navigation breadcrumb', () => {
		const breadcrumbs: Breadcrumb[] = [
			{ category: 'navigation', message: 'Navigated to /privacy?ref=footer' }
		];
		const scrubbed = scrubSentryEvent({ breadcrumbs });
		expect(scrubbed?.breadcrumbs?.[0].message).toBe('Navigated to /privacy?ref=footer'.split('?')[0]);
	});

	it('reduces the user object to a bare id, dropping email/username/ip_address/geo', () => {
		const event: SentryEvent = {
			user: {
				id: 'user-42',
				email: 'traveler@example.com',
				username: 'traveler',
				ip_address: '203.0.113.5',
				geo: { country_code: 'GB', region: 'England', city: 'London' }
			}
		};
		const scrubbed = scrubSentryEvent(event);
		expect(scrubbed?.user).toEqual({ id: 'user-42' });
	});

	it('drops the user object entirely when it has no id', () => {
		const event: SentryEvent = { user: { email: 'traveler@example.com' } };
		const scrubbed = scrubSentryEvent(event);
		expect(scrubbed?.user).toBeUndefined();
	});

	it('strips extra entirely', () => {
		const event: SentryEvent = {
			extra: { localStorageSnapshot: { 'zarparia.lastUid': 'user-42' }, other: 'value' }
		};
		const scrubbed = scrubSentryEvent(event);
		expect(scrubbed?.extra).toBeUndefined();
	});

	it('strips contexts.state but keeps other contexts', () => {
		const event: SentryEvent = {
			contexts: {
				state: { tripDraft: { title: 'Portugal 2026' } },
				browser: { name: 'Chrome', version: '120' }
			}
		};
		const scrubbed = scrubSentryEvent(event);
		expect(scrubbed?.contexts).not.toHaveProperty('state');
		expect(scrubbed?.contexts?.browser).toEqual({ name: 'Chrome', version: '120' });
	});

	it('keeps exception type/message/stack untouched', () => {
		const event: SentryEvent = {
			exception: {
				values: [
					{
						type: 'TypeError',
						value: "Cannot read properties of undefined (reading 'title')",
						stacktrace: { frames: [{ filename: 'app.js', lineno: 42 }] }
					}
				]
			}
		};
		const scrubbed = scrubSentryEvent(event);
		expect(scrubbed?.exception).toEqual(event.exception);
	});

	it('is a pure function: does not mutate the input event', () => {
		const event: SentryEvent = {
			request: { url: 'https://zarparia.example/api/trips?x=1', data: { secret: true } },
			user: { id: 'u1', email: 'a@b.com' }
		};
		const originalUrl = event.request!.url;
		scrubSentryEvent(event);
		expect(event.request!.url).toBe(originalUrl);
		expect(event.request!.data).toEqual({ secret: true });
		expect(event.user).toEqual({ id: 'u1', email: 'a@b.com' });
	});
});

describe('initSentryIfConfigured — dormant scaffold', () => {
	it('resolves without importing @sentry/browser when no DSN is passed', async () => {
		// No network, no SDK load, no throw — this is the "dormant" contract:
		// a deployment with no PUBLIC_SENTRY_DSN must behave as if this module
		// weren't wired in at all. (initPromise is memoized module-wide, so this
		// is the only call to initSentryIfConfigured in this file — a second
		// call, even with a DSN, would just return this cached no-op promise
		// rather than exercising the load path.)
		await expect(initSentryIfConfigured(undefined)).resolves.toBeUndefined();
	});
});
