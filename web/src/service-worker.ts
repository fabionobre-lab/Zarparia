/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

// SvelteKit auto-registers this worker. `version` changes each build, which
// rotates the cache so old app shells are dropped.
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `trips-${version}`;
const PRECACHE = [...build, ...files]; // hashed JS/CSS + static assets (icons, manifest)

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return; // let weather/thumbnails/fonts hit the network

	// Immutable build assets and static files: cache-first.
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}

	// Pages and API GETs (dynamic): network-first, fall back to last cached copy
	// so a previously-viewed page/trip still opens offline.
	event.respondWith(
		(async () => {
			try {
				const res = await fetch(req);
				if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
				return res;
			} catch {
				const cached = await caches.match(req);
				if (cached) return cached;
				throw new Error('offline and not cached');
			}
		})()
	);
});
