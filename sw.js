/* Service worker: offline caching for the trip engine.
   - App shell + trip JSON: cache-first (precached on install; the trip list
     comes from trips/manifest.json so new trips need no sw.js edit).
   - Cross-origin (weather, Wikipedia thumbnails, fonts): network-first with
     cache fallback, so previously seen data still renders in airplane mode.
   Bump CACHE_VERSION when engine files change to invalidate old caches. */
'use strict';

const CACHE_VERSION = 'trips-v1';
const SHELL = [
  './',
  'index.html',
  'app.html',
  'assets/app.css',
  'assets/app.js',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'manifest.webmanifest',
  'trips/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(SHELL);
    try {
      const r = await fetch('trips/manifest.json');
      const trips = await r.json();
      await cache.addAll(trips.map((t) => 'trips/' + t.id + '.json'));
    } catch (err) { /* trip files cache lazily on first view instead */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE_VERSION && key !== CACHE_VERSION + '-rt') await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    // cache-first; ignoreSearch so app.html?trip=x hits the precached app.html
    e.respondWith((async () => {
      const hit = await caches.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) (await caches.open(CACHE_VERSION)).put(e.request, r.clone());
      return r;
    })());
    return;
  }

  // cross-origin: network-first, fall back to last cached copy
  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      (await caches.open(CACHE_VERSION + '-rt')).put(e.request, r.clone());
      return r;
    } catch (err) {
      const hit = await caches.match(e.request);
      if (hit) return hit;
      throw err;
    }
  })());
});
