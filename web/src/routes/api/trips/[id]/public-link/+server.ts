import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { roleFor } from '$lib/server/trips';
import { getPublicLink, enablePublicLink, revokePublicLink } from '$lib/server/public-links';

/** Build the shareable public URL from the request origin and a token. */
function shareUrl(origin: string, token: string): string {
	return `${origin}/s/${token}`;
}

// Owner-only on every verb (public-share-route-spec.md: "Revocation is
// owner-only" — creation/viewing follow the same rule, mirroring
// api/trips/[id]/share-link's owner gate for the collaborator link).

export const GET: RequestHandler = async ({ platform, locals, params, url }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if ((await roleFor(db, user.id, params.id)) !== 'owner') {
		return json({ error: 'Only the owner can view the public link.' }, { status: 403 });
	}
	const link = await getPublicLink(db, params.id);
	return json({ link: link ? { url: shareUrl(url.origin, link.token) } : null });
};

export const PUT: RequestHandler = async ({ platform, locals, params, url }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if ((await roleFor(db, user.id, params.id)) !== 'owner') {
		return json({ error: 'Only the owner can change the public link.' }, { status: 403 });
	}
	const link = await enablePublicLink(db, params.id);
	return json({ link: { url: shareUrl(url.origin, link.token) } });
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if ((await roleFor(db, user.id, params.id)) !== 'owner') {
		return json({ error: 'Only the owner can change the public link.' }, { status: 403 });
	}
	await revokePublicLink(db, params.id);
	return new Response(null, { status: 204 });
};
