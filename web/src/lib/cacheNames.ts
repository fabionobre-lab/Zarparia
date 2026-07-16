/**
 * Names of the service worker's Cache Storage caches that hold PER-USER data
 * (see src/service-worker.ts for the full four-cache design). They live in a
 * standalone module because two very different bundles need the exact same
 * strings: the service worker (which writes these caches) and the client app
 * (which purges them on sign-out / user change — src/lib/client/userCacheReset.ts).
 * The versioned STATIC cache and the shared EXTERNAL cache are deliberately
 * not listed: neither holds anything per-user.
 */
export const RUNTIME_CACHE = 'runtime';
export const PHOTOS_CACHE = 'photos';

/** Every cache that may hold a signed-in user's data. */
export const USER_CACHES: readonly string[] = [RUNTIME_CACHE, PHOTOS_CACHE];
