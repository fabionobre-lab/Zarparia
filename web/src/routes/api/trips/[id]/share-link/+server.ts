import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { roleFor } from '$lib/server/trips';
import {
	getShareLink,
	upsertShareLink,
	deleteShareLink,
	type ShareLinkRole
} from '$lib/server/share-links';

/** Build the shareable join URL from the request origin and a token. */
function joinUrl(origin: string, token: string): string {
	return `${origin}/join/${token}`;
}

export const GET: RequestHandler = async ({ platform, locals, params, url }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if ((await roleFor(db, user.id, params.id)) !== 'owner') {
		return json({ error: 'Only the owner can view the link.' }, { status: 403 });
	}
	const link = await getShareLink(db, params.id);
	return json({ link: link ? { url: joinUrl(url.origin, link.token), role: link.role } : null });
};

export const PUT: RequestHandler = async ({ platform, locals, params, url, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if ((await roleFor(db, user.id, params.id)) !== 'owner') {
		return json({ error: 'Only the owner can change the link.' }, { status: 403 });
	}
	const body = (await request.json().catch(() => null)) as { role?: string } | null;
	const role: ShareLinkRole = body?.role === 'editor' ? 'editor' : 'viewer';

	const link = await upsertShareLink(db, params.id, role);
	return json({ link: { url: joinUrl(url.origin, link.token), role: link.role } });
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	const user = requireUser(locals);
	const db = getDb(platform);
	if ((await roleFor(db, user.id, params.id)) !== 'owner') {
		return json({ error: 'Only the owner can change the link.' }, { status: 403 });
	}
	await deleteShareLink(db, params.id);
	return new Response(null, { status: 204 });
};
