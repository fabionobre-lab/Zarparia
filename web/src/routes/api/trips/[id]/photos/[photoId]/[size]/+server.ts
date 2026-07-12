import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/guards';
import { getDb } from '$lib/server/db';
import { roleFor } from '$lib/server/trips';
import { getPhotosBucket, getTripPhoto, photoR2Key, type PhotoSize } from '$lib/server/photos';

/** Serve a cached photo rendition from R2. Access = access to the trip. */
export const GET: RequestHandler = async ({ locals, platform, params, request, setHeaders }) => {
	const user = requireUser(locals);
	if (params.size !== 'thumb' && params.size !== 'disp') throw error(404, 'Unknown size');
	const size = params.size as PhotoSize;

	const db = getDb(platform);
	const role = await roleFor(db, user.id, params.id);
	if (!role) throw error(404, 'Not found');
	const photo = await getTripPhoto(db, params.id, params.photoId);
	if (!photo) throw error(404, 'Not found');

	const obj = await getPhotosBucket(platform).get(photoR2Key(params.id, params.photoId, size));
	if (!obj) throw error(404, 'Not found');

	// Cached copies are immutable (a photo row is never re-rendered), so let
	// the browser keep them; `private` because access is per-user.
	const etag = obj.httpEtag;
	setHeaders({
		'Cache-Control': 'private, max-age=604800, immutable',
		ETag: etag,
		'Content-Type': photo.contentType ?? obj.httpMetadata?.contentType ?? 'image/jpeg'
	});
	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304 });
	}
	return new Response(obj.body);
};
