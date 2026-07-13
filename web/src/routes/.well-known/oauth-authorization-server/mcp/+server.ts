// Some MCP clients append the resource path (/mcp) to the discovery URL.
// Serve the same authorization-server metadata here.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authServerMetadata } from '$lib/server/mcp/oauth';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async ({ url }) => {
	return json(authServerMetadata(url.origin), { headers: CORS });
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' }
	});
