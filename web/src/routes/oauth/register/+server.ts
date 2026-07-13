// RFC 7591 Dynamic Client Registration — open registration for public clients.
// Accepts client_name + redirect_uris (JSON body). Issues a client_id (uuid),
// no client secret. This endpoint is called cross-origin by MCP clients; it is
// exempted from the origin-CSRF guard in hooks.server.ts and reads JSON, so the
// SvelteKit form-CSRF path never applies.
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { registerClient } from '$lib/server/mcp/oauth';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = getDb(platform);
	const body = (await request.json().catch(() => null)) as {
		client_name?: unknown;
		redirect_uris?: unknown;
	} | null;
	if (!body || typeof body !== 'object') {
		return json(
			{ error: 'invalid_client_metadata', error_description: 'Body must be a JSON object.' },
			{ status: 400, headers: CORS }
		);
	}

	const result = await registerClient(db, body);
	if (!result.ok || !result.client) {
		return json(
			{ error: result.error ?? 'invalid_client_metadata', error_description: result.error_description },
			{ status: 400, headers: CORS }
		);
	}

	return json(
		{
			client_id: result.client.client_id,
			client_id_issued_at: result.client_id_issued_at,
			client_name: result.client.client_name ?? undefined,
			redirect_uris: result.client.redirect_uris,
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'none'
		},
		{ status: 201, headers: CORS }
	);
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' }
	});
