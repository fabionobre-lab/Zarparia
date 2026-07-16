// Remote MCP server — stateless Streamable HTTP, hand-rolled JSON-RPC 2.0.
// One POST = one JSON response (no SSE needed for stateless request/response).
// Every request must carry a Bearer access token (gna_…) minted by the OAuth
// flow; the token resolves to a Zarparia user and all tools operate as them via
// the existing trips.ts data layer (no new trip SQL).
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { validateAccessToken } from '$lib/server/mcp/tokens';
import { limit, clientIp, ipKey, userKey } from '$lib/server/ratelimit';
import {
	listTripsForUser,
	getTripForUser,
	createTrip,
	updateTrip,
	deleteTrip
} from '$lib/server/trips';
import type { TripDoc } from '$lib/validateTrip';
import tripSchema from '$lib/trip.schema.json';

const SERVER_INFO = { name: 'zarparia-trips', version: '1.0.0' };
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const DEFAULT_PROTOCOL = '2025-06-18';

const INSTRUCTIONS =
	'Manage the user\'s Zarparia travel itineraries. A trip is a single JSON document. ' +
	'Before writing, call get_trip_schema to learn the document shape and see a minimal example. ' +
	'To edit an existing trip, call get_trip first, modify the returned doc, then call update_trip ' +
	'passing the same updatedAt back as base_updated_at so concurrent edits are detected. ' +
	'create_trip and update_trip return validation details when the doc is rejected — fix the doc and retry.';

// A minimal valid trip document, handed to the model alongside the schema so it
// has a concrete, working starting point.
const MINIMAL_EXAMPLE: TripDoc = {
	id: 'sample-trip',
	title: { en: 'Sample Trip' },
	languages: ['en'],
	defaultLanguage: 'en',
	segments: [
		{
			id: 'main',
			title: { en: 'Main' },
			plans: [
				{
					id: 'plan-a',
					days: [
						{
							date: '2026-05-01',
							title: { en: 'Arrival' },
							blocks: [{ time: '09:00', title: { en: 'Land at the airport' } }]
						}
					]
				}
			]
		}
	]
} as unknown as TripDoc;

const CORS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Expose-Headers': 'WWW-Authenticate'
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extraHeaders }
	});
}

type JsonRpcId = string | number | null;
function rpcResult(id: JsonRpcId, result: unknown) {
	return { jsonrpc: '2.0' as const, id, result };
}
function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
	return { jsonrpc: '2.0' as const, id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function textContent(payload: unknown, isError = false) {
	return {
		content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }],
		...(isError ? { isError: true } : {})
	};
}

// ── Tool definitions (kept light — full doc schema lives behind get_trip_schema) ──
const TOOLS = [
	{
		name: 'list_trips',
		description: 'List all trips the user can access (owned or shared), with id, title, status, dates and the user\'s role.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false }
	},
	{
		name: 'get_trip',
		description:
			'Fetch one trip: returns { doc, role, updatedAt }. Call this before update_trip and pass the returned updatedAt back as base_updated_at for optimistic concurrency.',
		inputSchema: {
			type: 'object',
			properties: { trip_id: { type: 'string', description: 'The trip id (slug).' } },
			required: ['trip_id'],
			additionalProperties: false
		}
	},
	{
		name: 'get_trip_schema',
		description: 'Return the JSON Schema for a trip document plus a minimal working example. Call before create_trip / update_trip.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false }
	},
	{
		name: 'create_trip',
		description:
			'Create a new trip. `doc` is a trip document (see get_trip_schema). Optional `id` sets the slug. On validation failure the errors are returned so you can fix the doc.',
		inputSchema: {
			type: 'object',
			properties: {
				doc: { type: 'object', description: 'The trip document. Shape is defined by get_trip_schema.' },
				id: { type: 'string', description: 'Optional URL slug (lowercase letters, digits, hyphens).' }
			},
			required: ['doc'],
			additionalProperties: false
		}
	},
	{
		name: 'update_trip',
		description:
			'Replace a trip document. Pass base_updated_at (from get_trip) to detect concurrent edits; a conflict means the trip changed — re-fetch with get_trip and reapply. Editors and owners only.',
		inputSchema: {
			type: 'object',
			properties: {
				trip_id: { type: 'string', description: 'The trip id (slug).' },
				doc: { type: 'object', description: 'The full replacement trip document (see get_trip_schema).' },
				base_updated_at: {
					type: 'string',
					description: 'The updatedAt value returned by get_trip. Omit to force-write without conflict detection.'
				}
			},
			required: ['trip_id', 'doc'],
			additionalProperties: false
		}
	},
	{
		name: 'delete_trip',
		description: 'Permanently delete a trip. DESTRUCTIVE and owner-only. Requires confirm=true.',
		inputSchema: {
			type: 'object',
			properties: {
				trip_id: { type: 'string', description: 'The trip id (slug).' },
				confirm: { type: 'boolean', description: 'Must be exactly true to proceed.' }
			},
			required: ['trip_id', 'confirm'],
			additionalProperties: false
		}
	}
];

async function callTool(
	db: D1Database,
	userId: string,
	name: string,
	args: Record<string, unknown>
): Promise<ReturnType<typeof textContent>> {
	switch (name) {
		case 'list_trips': {
			const trips = await listTripsForUser(db, userId);
			return textContent(
				trips.map((t) => ({
					id: t.id,
					title: t.title,
					status: t.status,
					startDate: t.startDate,
					endDate: t.endDate,
					role: t.role
				}))
			);
		}
		case 'get_trip': {
			const tripId = typeof args.trip_id === 'string' ? args.trip_id : '';
			if (!tripId) return textContent('trip_id is required.', true);
			const trip = await getTripForUser(db, userId, tripId);
			if (!trip) return textContent(`No trip "${tripId}" found, or you do not have access to it.`, true);
			return textContent({ doc: trip.doc, role: trip.role, updatedAt: trip.updatedAt });
		}
		case 'get_trip_schema': {
			return textContent({ schema: tripSchema, minimalExample: MINIMAL_EXAMPLE });
		}
		case 'create_trip': {
			if (!args.doc || typeof args.doc !== 'object' || Array.isArray(args.doc))
				return textContent('`doc` must be a trip document object. Call get_trip_schema first.', true);
			const desiredId = typeof args.id === 'string' ? args.id : undefined;
			const result = await createTrip(db, userId, args.doc as TripDoc, desiredId);
			if (!result.ok) {
				if (result.reason === 'invalid')
					return textContent({ error: 'Trip document failed validation.', details: result.errors }, true);
				return textContent(`Could not create trip (${result.reason}).`, true);
			}
			return textContent({ ok: true, id: result.id, updatedAt: result.updatedAt, doc: result.doc });
		}
		case 'update_trip': {
			const tripId = typeof args.trip_id === 'string' ? args.trip_id : '';
			if (!tripId) return textContent('trip_id is required.', true);
			if (!args.doc || typeof args.doc !== 'object' || Array.isArray(args.doc))
				return textContent('`doc` must be a trip document object. Call get_trip_schema first.', true);
			const base = typeof args.base_updated_at === 'string' ? args.base_updated_at : undefined;
			const result = await updateTrip(db, userId, tripId, args.doc as TripDoc, base);
			if (!result.ok) {
				switch (result.reason) {
					case 'invalid':
						return textContent({ error: 'Trip document failed validation.', details: result.errors }, true);
					case 'conflict':
						return textContent(
							'Conflict: the trip was modified since you fetched it. Re-fetch with get_trip and reapply your changes.',
							true
						);
					case 'not_found':
						return textContent(`No trip "${tripId}" found, or you do not have access to it.`, true);
					case 'forbidden':
						return textContent('You have view-only access to this trip and cannot edit it.', true);
				}
			}
			return textContent({ ok: true, id: result.id, updatedAt: result.updatedAt });
		}
		case 'delete_trip': {
			const tripId = typeof args.trip_id === 'string' ? args.trip_id : '';
			if (!tripId) return textContent('trip_id is required.', true);
			if (args.confirm !== true)
				return textContent('Refusing to delete: pass confirm=true to permanently delete this trip.', true);
			const result = await deleteTrip(db, userId, tripId);
			if (!result.ok) {
				if (result.reason === 'forbidden')
					return textContent('Only the trip owner can delete it.', true);
				return textContent(`No trip "${tripId}" found, or you do not have access to it.`, true);
			}
			return textContent({ ok: true, deleted: tripId });
		}
		default:
			return textContent(`Unknown tool: ${name}`, true);
	}
}

function wwwAuthenticate(origin: string): string {
	return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", error="invalid_token"`;
}

export const GET: RequestHandler = async () =>
	jsonResponse({ error: 'method_not_allowed', message: 'Use POST for JSON-RPC.' }, 405);

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: {
			...CORS,
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version'
		}
	});

export const POST: RequestHandler = async ({ request, platform, url }) => {
	const db = getDb(platform);

	// ── Rate limit (per IP, pre-auth) ──
	const ipRl = await limit(db, ipKey(clientIp(request), 'mcp'), { max: 120, windowSeconds: 60 });
	if (!ipRl.allowed) {
		return jsonResponse(
			rpcError(null, -32029, 'Rate limit exceeded. Please slow down.'),
			429,
			{ 'Retry-After': String(ipRl.retryAfterSeconds) }
		);
	}

	// ── Auth: Bearer access token required for every call ──
	const authz = request.headers.get('authorization') ?? '';
	const bearer = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7).trim() : '';
	if (!bearer) {
		return jsonResponse({ error: 'invalid_token', message: 'Missing Bearer access token.' }, 401, {
			'WWW-Authenticate': wwwAuthenticate(url.origin)
		});
	}
	const ctx = await validateAccessToken(db, bearer);
	if (!ctx) {
		return jsonResponse({ error: 'invalid_token', message: 'Access token is invalid or expired.' }, 401, {
			'WWW-Authenticate': wwwAuthenticate(url.origin)
		});
	}
	// Phase 3 approval gate: the token itself can be perfectly valid while the
	// account behind it is pending/rejected (grant predates the gate, or an
	// admin revoked approval after the token was issued). Re-checked on every
	// call — not just at OAuth-consent time — so approval status changes take
	// effect immediately without waiting for the token to expire.
	if (ctx.userStatus !== 'approved') {
		return jsonResponse(
			{ error: 'access_denied', message: 'This Zarparia account is not approved to use the connector.' },
			403
		);
	}

	// ── Rate limit (per user, post-auth) ──
	const userRl = await limit(db, userKey(ctx.userId, 'mcp'), { max: 60, windowSeconds: 60 });
	if (!userRl.allowed) {
		return jsonResponse(
			rpcError(null, -32029, 'Rate limit exceeded. Please slow down.'),
			429,
			{ 'Retry-After': String(userRl.retryAfterSeconds) }
		);
	}

	// ── Parse JSON-RPC ──
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return jsonResponse(rpcError(null, -32700, 'Parse error: body is not valid JSON.'), 200);
	}
	if (Array.isArray(body)) {
		return jsonResponse(
			rpcError(null, -32600, 'Batch requests are not supported by this stateless server.'),
			200
		);
	}
	if (!body || typeof body !== 'object') {
		return jsonResponse(rpcError(null, -32600, 'Invalid Request.'), 200);
	}

	const msg = body as { jsonrpc?: unknown; id?: JsonRpcId; method?: unknown; params?: unknown };
	const id: JsonRpcId = (msg.id ?? null) as JsonRpcId;
	const method = typeof msg.method === 'string' ? msg.method : '';
	const params = (msg.params && typeof msg.params === 'object' ? msg.params : {}) as Record<string, unknown>;

	// Notifications (no response expected) → 202 with empty body.
	if (method.startsWith('notifications/')) {
		return new Response(null, { status: 202, headers: CORS });
	}

	switch (method) {
		case 'initialize': {
			const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
			const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : DEFAULT_PROTOCOL;
			return jsonResponse(
				rpcResult(id, {
					protocolVersion,
					capabilities: { tools: { listChanged: false } },
					serverInfo: SERVER_INFO,
					instructions: INSTRUCTIONS
				})
			);
		}
		case 'ping':
			return jsonResponse(rpcResult(id, {}));
		case 'tools/list':
			return jsonResponse(rpcResult(id, { tools: TOOLS }));
		case 'tools/call': {
			const name = typeof params.name === 'string' ? params.name : '';
			const args = (params.arguments && typeof params.arguments === 'object'
				? params.arguments
				: {}) as Record<string, unknown>;
			if (!TOOLS.some((t) => t.name === name)) {
				return jsonResponse(rpcError(id, -32602, `Unknown tool: ${name}`));
			}
			try {
				const result = await callTool(db, ctx.userId, name, args);
				return jsonResponse(rpcResult(id, result));
			} catch (e) {
				const message = e instanceof Error ? e.message : 'Internal error running tool.';
				return jsonResponse(rpcResult(id, textContent(`Tool execution failed: ${message}`, true)));
			}
		}
		default:
			return jsonResponse(rpcError(id, -32601, `Method not found: ${method || '(none)'}`));
	}
};
