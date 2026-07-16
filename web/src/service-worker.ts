/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';
import { RUNTIME_CACHE, PHOTOS_CACHE } from '$lib/cacheNames';

// SvelteKit auto-registers this worker.
//
// Four caches, on purpose:
//  - STATIC (`trips-<version>`): hashed build assets + static files, precached on
//    install. `version` changes each build; activate deletes only OLD versioned
//    static caches, so a fresh deploy drops stale hashed chunks.
//  - RUNTIME (`runtime`, UNVERSIONED): survives deploys and holds successful
//    same-origin page/navigation responses, so the installed PWA still opens
//    offline after a deploy.
//  - PHOTOS (`photos`, UNVERSIONED): the per-trip photo list plus the image
//    bytes behind it. Photo bytes are content-addressed and never rewritten in
//    place, so they are cache-first.
//  - EXTERNAL (`external`, UNVERSIONED): the third-party reads a trip page needs
//    to look finished — OSM map tiles, open-meteo forecasts, Wikipedia
//    thumbnails. Nothing here is per-user.
//
// RUNTIME and PHOTOS hold per-user data. Their names live in $lib/cacheNames
// because the client purges them by name on sign-out / detected user change /
// account deletion (see src/lib/client/userCacheReset.ts); EXTERNAL and
// STATIC are shared and survive.
//
// Never cached: anything under /auth/, and every /api/ route except the photo
// reads named above. Auth and per-user writes always go straight to the network.
const sw = self as unknown as ServiceWorkerGlobalScope;
const STATIC = `trips-${version}`;
const RUNTIME = RUNTIME_CACHE;
const PHOTOS = PHOTOS_CACHE;
const EXTERNAL = 'external';
const OURS = new Set([STATIC, RUNTIME, PHOTOS, EXTERNAL]);
// hashed JS/CSS + static assets (icons, manifest) + any prerendered pages
const PRECACHE = [...build, ...files, ...prerendered];

// Map tiles are unbounded — a few minutes of panning can run to thousands. Cap
// the cache and evict in insertion order (Cache.keys() is FIFO). Not true LRU:
// a tile you keep revisiting still ages out, and re-fetches when online.
const EXTERNAL_LIMIT = 800;
// Thumbnails warmed per trip when we precache. Enough for a photo-heavy trip
// without pulling a whole library over cellular; the rest cache as you view them.
const WARM_THUMBS_PER_TRIP = 120;

/** Photo reads: the trip's photo list, and the `/thumb` + `/disp` image bytes. */
const PHOTO_LIST = /^\/api\/trips\/[^/]+\/photos$/;
const PHOTO_BYTES = /^\/api\/trips\/[^/]+\/photos\/[^/]+\/(thumb|disp)$/;

/** Same-origin paths that must never be served from, or written to, a cache. */
function isPrivate(url: URL): boolean {
	if (url.pathname.startsWith('/auth/')) return true;
	if (!url.pathname.startsWith('/api/')) return false;
	return !PHOTO_LIST.test(url.pathname) && !PHOTO_BYTES.test(url.pathname);
}

/** Third-party hosts a trip page reads, and which cache tier they belong in. */
function isExternal(url: URL): boolean {
	return (
		url.hostname.endsWith('.tile.openstreetmap.org') ||
		url.hostname === 'api.open-meteo.com' ||
		url.hostname === 'en.wikipedia.org' ||
		url.hostname === 'upload.wikimedia.org'
	);
}

async function trim(cacheName: string, limit: number): Promise<void> {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();
	for (const stale of keys.slice(0, keys.length - limit)) await cache.delete(stale);
}

async function cacheFirst(cacheName: string, req: Request, limit?: number): Promise<Response> {
	const cache = await caches.open(cacheName);
	const hit = await cache.match(req);
	if (hit) return hit;
	const res = await fetch(req);
	// Opaque cross-origin responses (status 0) still replay fine from the cache
	// as an <img>/tile src, so keep them; only skip genuine errors.
	if (res.ok || res.type === 'opaque') {
		await cache.put(req, res.clone());
		if (limit) await trim(cacheName, limit);
	}
	return res;
}

async function networkFirst(cacheName: string, req: Request): Promise<Response> {
	try {
		const res = await fetch(req);
		if (res.ok) (await caches.open(cacheName)).put(req, res.clone());
		return res;
	} catch (err) {
		const cached = await caches.match(req);
		if (cached) return cached;
		throw err;
	}
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(STATIC).then((cache) => cache.addAll(PRECACHE)).then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop old versioned static caches only; keep the durable caches across deploys.
			for (const key of await caches.keys()) {
				if (!OURS.has(key)) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);

	if (url.origin !== location.origin) {
		if (isExternal(url)) event.respondWith(cacheFirst(EXTERNAL, req, EXTERNAL_LIMIT));
		return; // anything else third-party: straight to the network
	}
	if (isPrivate(url)) return; // per-user writes + auth: never touch the cache, either way

	// Immutable build assets and static files: cache-first.
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}

	// Photo bytes never change under a given id: cache-first, so an opened trip
	// keeps its images offline without re-fetching them on every visit.
	if (PHOTO_BYTES.test(url.pathname)) {
		event.respondWith(cacheFirst(PHOTOS, req));
		return;
	}
	// The photo list does change (imports add rows): network-first.
	if (PHOTO_LIST.test(url.pathname)) {
		event.respondWith(networkFirst(PHOTOS, req));
		return;
	}

	// Pages/navigations (dynamic SSR): network-first, cache into the durable runtime
	// cache, and fall back to the last cached copy — then '/' — when offline.
	event.respondWith(
		(async () => {
			try {
				return await networkFirst(RUNTIME, req);
			} catch {
				const home = await caches.match('/');
				if (home) return home;
				throw new Error('offline and not cached');
			}
		})()
	);
});

// ── Precaching the user's trips ────────────────────────────────────────────
// A trip page is only in RUNTIME if you opened it while online, which is no use
// if you install the app and then board a plane. On each online app load the
// client posts `warm-offline`; we walk the user's trips and pull each page, its
// photo list, and a bounded set of thumbnails into the cache.
//
// Everything here is best-effort: a failed fetch just means that trip stays
// online-only, so warming never rejects and never blocks the page.
async function warmTrip(id: string): Promise<void> {
	const page = `/trips/${encodeURIComponent(id)}`;
	await networkFirst(RUNTIME, new Request(page)).catch(() => undefined);

	const listUrl = `/api/trips/${encodeURIComponent(id)}/photos`;
	const res = await fetch(listUrl).catch(() => null);
	if (!res?.ok) return;
	(await caches.open(PHOTOS)).put(new Request(listUrl), res.clone());

	const body = (await res.json().catch(() => null)) as { photos?: { id: string }[] } | null;
	const photos = body?.photos?.slice(0, WARM_THUMBS_PER_TRIP) ?? [];
	const cache = await caches.open(PHOTOS);
	for (const photo of photos) {
		const thumb = `${listUrl}/${encodeURIComponent(photo.id)}/thumb`;
		if (await cache.match(thumb)) continue; // already warm from a previous run
		await cacheFirst(PHOTOS, new Request(thumb)).catch(() => undefined);
	}
}

async function warmOffline(): Promise<void> {
	// Not cached (it's a private /api/ read) — we only want the ids.
	const res = await fetch('/api/trips').catch(() => null);
	if (!res?.ok) return; // signed out or offline: nothing to warm
	const body = (await res.json().catch(() => null)) as { trips?: { id: string }[] } | null;
	for (const trip of body?.trips ?? []) await warmTrip(trip.id);
}

sw.addEventListener('message', (event) => {
	if ((event.data as { type?: string } | null)?.type !== 'warm-offline') return;
	event.waitUntil(warmOffline());
});
