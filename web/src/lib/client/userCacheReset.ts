/**
 * Cross-user leak audit, Finding 2 — per-user client-state reset for the
 * offline PWA caches.
 *
 * The service worker keeps two UNVERSIONED caches of per-user data (RUNTIME:
 * SSR pages, PHOTOS: photo lists + image bytes — see src/lib/cacheNames.ts
 * and src/service-worker.ts). Left alone, they survive sign-out, so the next
 * account on the same browser could read the previous user's trips offline.
 *
 * Three moments purge them, all AWAITED so navigation can't abandon the work:
 *  1. Explicit sign-out — both Sign out handlers (+layout.svelte and
 *     lib/nav/BottomBar.svelte) prevent the form's default submit, await
 *     purgeUserCaches(), then submit programmatically.
 *  2. Detected user change — the root layout calls syncUserMarker() with the
 *     signed-in uid; when it differs from the localStorage marker left by the
 *     previous user, the caches are purged BEFORE the marker is updated.
 *     This covers "A never signed out; B signs in on the same browser".
 *     A missing session does NOT purge: signed-out-but-cached is exactly the
 *     legitimate offline-PWA use case for the device's owner.
 *  3. Account deletion — the /account page calls purgeOnAccountDeleted()
 *     after the server confirms, which also drops the marker.
 *
 * Deliberately OUT of scope: user B using the device while user A's session
 * cookie is still live. That is shared-session reality — the browser IS
 * signed in as A — and cannot be fixed client-side.
 *
 * `caches` / `localStorage` are injected so this logic is unit-testable
 * outside a browser; every function here swallows storage/cache failures —
 * cache hygiene must never block sign-out or navigation.
 */
import { USER_CACHES } from '$lib/cacheNames';

export const LAST_UID_KEY = 'zarparia.lastUid';

/** The subset of CacheStorage / Storage this module needs — keeps test fakes tiny. */
export type CacheDeleter = Pick<CacheStorage, 'delete'>;
export type MarkerStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** `window.localStorage` can throw on ACCESS (not just use) under some
 *  privacy modes — resolve it defensively once, at the call site. */
export function safeLocalStorage(): MarkerStorage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

/** Delete every per-user cache. Resolves once all deletions settle; never
 *  rejects (a failed purge must not block the sign-out that triggered it). */
export async function purgeUserCaches(cachesObj: CacheDeleter | null | undefined): Promise<void> {
	if (!cachesObj) return;
	try {
		await Promise.all(USER_CACHES.map((name) => cachesObj.delete(name)));
	} catch {
		// Cache API unavailable/failing: nothing more we can do client-side.
	}
}

/**
 * Reconcile the "last signed-in user" marker with the current session.
 * Call whenever a SIGNED-IN uid is known (root layout effect).
 *
 * - Same uid as the marker: no-op.
 * - Different uid (or no marker yet — the caches may predate the marker):
 *   purge the per-user caches FIRST, then record the new uid. Ordering
 *   matters: if the purge is interrupted, the stale marker makes the next
 *   load retry it instead of considering the hand-over done.
 * - No uid (signed out): no-op by design — see module comment.
 *
 * Returns true when a purge ran (for tests/telemetry).
 */
export async function syncUserMarker(
	currentUid: string | null | undefined,
	deps: { caches: CacheDeleter | null | undefined; storage: MarkerStorage | null | undefined }
): Promise<boolean> {
	if (!currentUid) return false;
	let last: string | null = null;
	try {
		last = deps.storage?.getItem(LAST_UID_KEY) ?? null;
	} catch {
		last = null;
	}
	if (last === currentUid) return false;

	await purgeUserCaches(deps.caches);
	try {
		deps.storage?.setItem(LAST_UID_KEY, currentUid);
	} catch {
		// Marker not persisted: worst case the purge re-runs next load.
	}
	return true;
}

/** After the server confirms account deletion: purge the caches and drop the
 *  marker (there is no "last user" any more). Never rejects. */
export async function purgeOnAccountDeleted(deps: {
	caches: CacheDeleter | null | undefined;
	storage: MarkerStorage | null | undefined;
}): Promise<void> {
	await purgeUserCaches(deps.caches);
	try {
		deps.storage?.removeItem(LAST_UID_KEY);
	} catch {
		// Ignore: the caches are already purged, which is the part that matters.
	}
}
