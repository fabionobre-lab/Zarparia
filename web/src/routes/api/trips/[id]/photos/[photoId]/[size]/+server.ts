import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { getDb } from '$lib/server/db';
import { roleFor } from '$lib/server/trips';
import { getTripIdForPublicToken } from '$lib/server/public-links';
import { getPhotosBucket, getTripPhoto, photoR2Key, type PhotoSize } from '$lib/server/photos';

/** Serve a cached photo rendition from R2. Access = access to the trip
 *  (session), or an active public-link token for THIS trip — same grant as
 *  the photo-list endpoint, needed so /s/[token] doesn't 401 on the actual
 *  image bytes after the list itself loads fine. */
export const GET: RequestHandler = async ({ locals, platform, params, request, url, setHeaders }) => {
	if (params.size !== 'thumb' && params.size !== 'disp') throw error(404, 'Unknown size');
	const size = params.size as PhotoSize;
	const db = getDb(platform);

	const publicToken = url.searchParams.get('token');
	if (publicToken) {
		const tripId = await getTripIdForPublicToken(db, publicToken);
		if (tripId !== params.id) throw error(404, 'Not found');
	} else {
		const user = requireUser(locals);
		const role = await roleFor(db, user.id, params.id);
		if (!role) throw error(404, 'Not found');
	}

	const photo = await getTripPhoto(db, params.id, params.photoId);
	if (!photo) throw error(404, 'Not found');

	const obj = await getPhotosBucket(platform).get(photoR2Key(params.id, params.photoId, size));
	if (!obj) throw error(404, 'Not found');

	// Cached copies are immutable (a photo row is never re-rendered), so let
	// the browser keep them; `private` blocks shared/CDN caches on both
	// grants. Session viewers get the long horizon; the anonymous token path
	// gets a short one so revoking a public link takes effect within the hour
	// even in a browser that already fetched the bytes (spec: revocation is
	// immediate — the 304 revalidation below still needs the live token).
	const etag = obj.httpEtag;
	setHeaders({
		'Cache-Control': publicToken
			? 'private, max-age=3600'
			: 'private, max-age=604800, immutable',
		ETag: etag,
		'Content-Type': photo.contentType ?? obj.httpMetadata?.contentType ?? 'image/jpeg'
	});
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304 });
	}
	return new Response(obj.body);
};
