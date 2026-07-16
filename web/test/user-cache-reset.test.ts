// Cross-user leak audit, Finding 2 — per-user offline-cache reset. The module
// takes `caches`/`localStorage` as injected deps, so these are pure unit
// tests with tiny fakes; the Svelte wiring (layout effect, submit handlers)
// is exercised manually, not here.
import { describe, expect, it } from 'vitest';
import {
	LAST_UID_KEY,
	purgeUserCaches,
	syncUserMarker,
	purgeOnAccountDeleted
} from '../src/lib/client/userCacheReset';
import { RUNTIME_CACHE, PHOTOS_CACHE, USER_CACHES } from '../src/lib/cacheNames';

/** Fake CacheStorage.delete that records names, with an ordered event log
 *  shared with the fake storage so tests can assert purge-before-marker. */
function fakeCaches(log: string[] = []) {
	const deleted: string[] = [];
	return {
		deleted,
		log,
		caches: {
			delete: (name: string) => {
				deleted.push(name);
				log.push(`cache-delete:${name}`);
				return Promise.resolve(true);
			}
		}
	};
}

function fakeStorage(initial: Record<string, string> = {}, log: string[] = []) {
	const map = new Map(Object.entries(initial));
	return {
		map,
		log,
		storage: {
			getItem: (key: string) => map.get(key) ?? null,
			setItem: (key: string, value: string) => {
				map.set(key, value);
				log.push(`set:${key}=${value}`);
			},
			removeItem: (key: string) => {
				map.delete(key);
				log.push(`remove:${key}`);
			}
		}
	};
}

describe('cache name constants', () => {
	it('USER_CACHES covers exactly the two per-user caches the service worker writes', () => {
		expect(USER_CACHES).toEqual([RUNTIME_CACHE, PHOTOS_CACHE]);
		expect(RUNTIME_CACHE).toBe('runtime');
		expect(PHOTOS_CACHE).toBe('photos');
	});
});

describe('purgeUserCaches', () => {
	it('deletes both per-user caches', async () => {
		const { caches, deleted } = fakeCaches();
		await purgeUserCaches(caches);
		expect(deleted.sort()).toEqual(['photos', 'runtime']);
	});

	it('is a no-op without a Cache API (SSR, ancient browsers)', async () => {
		await expect(purgeUserCaches(null)).resolves.toBeUndefined();
		await expect(purgeUserCaches(undefined)).resolves.toBeUndefined();
	});

	it('never rejects even when the Cache API throws — sign-out must proceed', async () => {
		const throwing = { delete: () => Promise.reject(new Error('quota')) };
		await expect(purgeUserCaches(throwing)).resolves.toBeUndefined();
		const throwingSync = {
			delete: () => {
				throw new Error('sync fail');
			}
		};
		await expect(purgeUserCaches(throwingSync as never)).resolves.toBeUndefined();
	});
});

describe('syncUserMarker', () => {
	it('purges and updates the marker when the signed-in uid differs from the stored one', async () => {
		const { caches, deleted } = fakeCaches();
		const { storage, map } = fakeStorage({ [LAST_UID_KEY]: 'user-a' });
		const purged = await syncUserMarker('user-b', { caches, storage });
		expect(purged).toBe(true);
		expect(deleted.sort()).toEqual(['photos', 'runtime']);
		expect(map.get(LAST_UID_KEY)).toBe('user-b');
	});

	it('does NOT purge when the same uid signs in again', async () => {
		const { caches, deleted } = fakeCaches();
		const { storage, map } = fakeStorage({ [LAST_UID_KEY]: 'user-a' });
		const purged = await syncUserMarker('user-a', { caches, storage });
		expect(purged).toBe(false);
		expect(deleted).toEqual([]);
		expect(map.get(LAST_UID_KEY)).toBe('user-a');
	});

	it('does NOT purge when signed out — the owner keeps offline access', async () => {
		const { caches, deleted } = fakeCaches();
		const { storage, map } = fakeStorage({ [LAST_UID_KEY]: 'user-a' });
		expect(await syncUserMarker(null, { caches, storage })).toBe(false);
		expect(await syncUserMarker(undefined, { caches, storage })).toBe(false);
		expect(deleted).toEqual([]);
		// Marker untouched: the device still remembers its last user.
		expect(map.get(LAST_UID_KEY)).toBe('user-a');
	});

	it('purges on first sign-in with no marker (caches may predate the marker scheme)', async () => {
		const { caches, deleted } = fakeCaches();
		const { storage, map } = fakeStorage();
		const purged = await syncUserMarker('user-a', { caches, storage });
		expect(purged).toBe(true);
		expect(deleted.sort()).toEqual(['photos', 'runtime']);
		expect(map.get(LAST_UID_KEY)).toBe('user-a');
	});

	it('updates the marker only AFTER the purge completes', async () => {
		const log: string[] = [];
		const { caches } = fakeCaches(log);
		const { storage } = fakeStorage({ [LAST_UID_KEY]: 'user-a' }, log);
		await syncUserMarker('user-b', { caches, storage });
		const markerIdx = log.indexOf(`set:${LAST_UID_KEY}=user-b`);
		expect(markerIdx).toBeGreaterThan(-1);
		for (const name of ['runtime', 'photos']) {
			expect(log.indexOf(`cache-delete:${name}`)).toBeLessThan(markerIdx);
		}
	});

	it('still purges when localStorage is unavailable, and survives storage throws', async () => {
		const { caches, deleted } = fakeCaches();
		expect(await syncUserMarker('user-a', { caches, storage: null })).toBe(true);
		expect(deleted.sort()).toEqual(['photos', 'runtime']);

		const hostile = {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('denied');
			},
			removeItem: () => {
				throw new Error('denied');
			}
		};
		const second = fakeCaches();
		await expect(syncUserMarker('user-a', { caches: second.caches, storage: hostile })).resolves.toBe(true);
	});
});

describe('purgeOnAccountDeleted', () => {
	it('purges both caches and removes the marker', async () => {
		const { caches, deleted } = fakeCaches();
		const { storage, map } = fakeStorage({ [LAST_UID_KEY]: 'user-a' });
		await purgeOnAccountDeleted({ caches, storage });
		expect(deleted.sort()).toEqual(['photos', 'runtime']);
		expect(map.has(LAST_UID_KEY)).toBe(false);
	});

	it('never rejects even when everything is missing or hostile', async () => {
		await expect(purgeOnAccountDeleted({ caches: null, storage: null })).resolves.toBeUndefined();
		const hostileStorage = {
			getItem: () => null,
			setItem: () => {},
			removeItem: () => {
				throw new Error('denied');
			}
		};
		const throwingCaches = { delete: () => Promise.reject(new Error('quota')) };
		await expect(
			purgeOnAccountDeleted({ caches: throwingCaches, storage: hostileStorage })
		).resolves.toBeUndefined();
	});
});
