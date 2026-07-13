import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { protectedResourceMetadata } from '$lib/server/mcp/oauth';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async ({ url }) => {
	return json(protectedResourceMetadata(url.origin), { headers: CORS });
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' }
	});
