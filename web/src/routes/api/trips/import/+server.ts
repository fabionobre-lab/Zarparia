import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireUser } from '$lib/server/guards';
import { createTrip } from '$lib/server/trips';
import { getAnthropicKey, importItinerary, MAX_TEXT_CHARS } from '$lib/server/import';
import { limit, userKey } from '$lib/server/ratelimit';

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	const user = requireUser(locals);
	const db = getDb(platform);

	// Each request can trigger up to two paid Anthropic calls (16k max_tokens) —
	// mirrors the photo-import per-minute + daily budget pattern.
	const minuteRl = await limit(db, userKey(user.id, 'trip-import:min'), { max: 3, windowSeconds: 60 });
	if (!minuteRl.allowed) {
		return json(
			{ error: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(minuteRl.retryAfterSeconds) } }
		);
	}
	const dailyRl = await limit(db, userKey(user.id, 'trip-import:day'), { max: 20, windowSeconds: 86400 });
	if (!dailyRl.allowed) {
		return json(
			{ error: 'rate_limited' },
			{ status: 429, headers: { 'Retry-After': String(dailyRl.retryAfterSeconds) } }
		);
	}

	const apiKey = getAnthropicKey(platform);
	if (!apiKey) {
		return json(
			{ error: 'Import is not configured. Set the ANTHROPIC_API_KEY secret.' },
			{ status: 501 }
		);
	}

	const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
	const text = typeof body?.text === 'string' ? body.text.trim() : '';
	if (!text) {
		return json({ error: 'Paste an itinerary to import.' }, { status: 400 });
	}
	if (text.length > MAX_TEXT_CHARS) {
		return json(
			{ error: `That itinerary is too long (max ${MAX_TEXT_CHARS} characters).` },
			{ status: 413 }
		);
	}

	// today's date drives relative-date resolution ("next September"); server-side
	// is fine here — it's just an anchor, not security-sensitive.
	const today = new Date().toISOString().slice(0, 10);

	const outcome = await importItinerary({ apiKey, text, today });
	if (!outcome.ok) {
		return json({ error: outcome.error }, { status: outcome.status });
	}

	const result = await createTrip(db, user.id, outcome.doc);
	if (!result.ok) {
		const first = result.reason === 'invalid' ? result.errors[0] : 'Could not save the imported trip.';
		return json({ error: first }, { status: result.reason === 'invalid' ? 422 : 500 });
	}
	return json({ id: result.id }, { status: 201 });
};
