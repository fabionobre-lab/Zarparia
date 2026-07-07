/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';

// SvelteKit auto-registers this worker.
//
// Two caches, on purpose:
//  - STATIC (`trips-<version>`): hashed build assets + static files, precached on
//    install. `version` changes each build; activate deletes only OLD versioned
//    static caches, so a fresh deploy drops stale hashed chunks.
//  - RUNTIME (`runtime`, UNVERSIONED): survives deploys and holds successful
//    same-origin page/navigation responses, so the installed PWA still opens
//    offline after a deploy.
//
// Never cached: anything under /api/ or /auth/ (per-user data + auth). Those
// always go straight to the network, in both directions.
const sw = self as unknown as ServiceWorkerGlobalScope;
const STATIC = `trips-${version}`;
const RUNTIME = 'runtime';
// hashed JS/CSS + static assets (icons, manifest) + any prerendered pages
const PRECACHE = [...build, ...files, ...prerendered];

function isPrivate(url: URL): boolean {
	return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(STATIC).then((cache) => cache.addAll(PRECACHE)).then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop old versioned static caches only; keep the runtime cache across deploys.
			for (const key of await caches.keys()) {
				if (key !== STATIC && key !== RUNTIME) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== location.origin) return; // let weather/thumbnails/fonts hit the network
	if (isPrivate(url)) return; // per-user + auth data: never touch the cache, either way

	// Immutable build assets and static files: cache-first.
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}

	// Pages/navigations (dynamic SSR): network-first, cache into the durable runtime
	// cache, and fall back to the last cached copy — then '/' — when offline.
	event.respondWith(
		(async () => {
			try {
				const res = await fetch(req);
				if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
				return res;
			} catch {
				const cached = await caches.match(req);
				if (cached) return cached;
				const home = await caches.match('/');
				if (home) return home;
				throw new Error('offline and not cached');
			}
		})()
	);
});
