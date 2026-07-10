/* Service worker: offline caching for the trip engine.
   - HTML pages (index/app + navigations) and trip JSON: network-first,
     so deployed content changes and newly added trips reach installed users;
     the last successful response is cached and served when offline.
   - Other same-origin assets (assets/, icons, manifest.webmanifest): cache-first
     (precached on install), since they are versioned via CACHE_VERSION.
   - Cross-origin (weather, Wikipedia thumbnails, fonts): network-first with
     cache fallback, so previously seen data still renders in airplane mode.
   Bump CACHE_VERSION when engine files change to invalidate old caches. */
'use strict';

const CACHE_VERSION = 'trips-v6';
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

// HTML pages and trip JSON change between deploys, so they must revalidate.
function isDynamic(request, url) {
  if (request.mode === 'navigate') return true;
  if (/\.html$/.test(url.pathname)) return true;
  // Match at any depth: on GitHub Pages the site lives under /<repo>/, so the
  // pathname is e.g. /UK-Spring-2026/trips/uk-spring-2026.json.
  if (/\/trips\/[^/]+\.json$/.test(url.pathname)) return true;
  return false;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === location.origin) {
    if (isDynamic(e.request, url)) {
      // network-first: fetch fresh; cache good responses; fall back when offline.
      // ignoreSearch so app.html?trip=x falls back to the cached app.html shell.
      e.respondWith((async () => {
        try {
          const r = await fetch(e.request);
          if (r.ok) (await caches.open(CACHE_VERSION)).put(e.request, r.clone());
          return r;
        } catch (err) {
          const hit = await caches.match(e.request, { ignoreSearch: true });
          if (hit) return hit;
          throw err;
        }
      })());
      return;
    }
    // cache-first for versioned assets (assets/, icons, manifest.webmanifest)
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
      if (r.ok) (await caches.open(CACHE_VERSION + '-rt')).put(e.request, r.clone());
      return r;
    } catch (err) {
      const hit = await caches.match(e.request);
      if (hit) return hit;
      throw err;
    }
  })());
});
