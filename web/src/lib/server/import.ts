/** Paste-your-itinerary import: turn free-text into a saved Trip draft.
 *
 *  The heavy lifting is a single Anthropic Messages API call (raw fetch, no SDK
 *  — keeps the Worker lean) that returns a machine-parseable Trip via forced
 *  tool use. The parse/validate/retry pipeline is factored out of the network
 *  call so it can be unit-tested with a canned model response and no API key.
 *
 *  Never log the pasted text or the API key. */
import { validateTripDoc, type TripDoc } from '$lib/validateTrip';
import tripSchema from '$lib/trip.schema.json';

/** Model tier: sonnet-class, temperature-0 structured extraction at reasonable
 *  cost. Per the claude-api skill, the current Sonnet id is `claude-sonnet-5`.
 *  NB: Sonnet 5 rejects non-default sampling params (temperature/top_p) with a
 *  400, so we deliberately do NOT send `temperature: 0` — determinism was never
 *  guaranteed by it anyway. Thinking is disabled to keep this a fast, cheap
 *  extraction with a cleanly forced tool call. */
const MODEL = 'claude-sonnet-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 16000;
const TOOL_NAME = 'save_trip';

/** ~20k char cap on the pasted text (beyond this the endpoint returns 413). */
export const MAX_TEXT_CHARS = 20000;

export type ImportOutcome =
	| { ok: true; doc: TripDoc }
	| { ok: false; status: number; error: string };

/** Read the Anthropic key from the Worker env. Secrets aren't in the generated
 *  `Env` type (mirrors $lib/server/authenv), so read through a narrow cast.
 *  Returns null when unconfigured so the endpoint can answer 501. */
export function getAnthropicKey(platform: App.Platform | undefined): string | null {
	const env = (platform?.env ?? {}) as unknown as { ANTHROPIC_API_KEY?: string };
	const key = env.ANTHROPIC_API_KEY?.trim();
	return key ? key : null;
}

/** The trip JSON schema, minus meta keys, used as the tool's input_schema so
 *  the model is constrained toward a valid Trip. */
function toolInputSchema(): Record<string, unknown> {
	const { $schema: _s, $id: _i, ...rest } = tripSchema as Record<string, unknown>;
	return rest;
}

/** System prompt: embeds the schema contract plus the extraction rules. */
export function buildSystemPrompt(today: string): string {
	return `You convert a traveler's free-text itinerary (an email thread, notes, or a paragraph) into ONE Trip JSON document and return it by calling the \`${TOOL_NAME}\` tool. Respond ONLY by calling that tool.

Today's date is ${today}. Use it to resolve relative dates such as "next September", "in two weeks", or a month with no year.

The Trip document MUST conform to this JSON Schema:
${JSON.stringify(toolInputSchema())}

Rules:
- Language: use a single language "en". Set "languages": ["en"] and "defaultLanguage": "en". Every localized field is an object like { "en": "..." }. Only introduce another language if the source text is itself written in (or explicitly asks for) another language.
- Structure: segments[] -> each segment has plans[] -> each plan has days[] -> each day has blocks[]. Give every segment exactly one plan with id "main" unless the text genuinely describes alternative plans.
- Segments: group the trip by city / region / leg (typically one segment per place the traveler stays), ordered by travel order.
- ids: every "id" is a URL-safe slug of its title (lowercase, words joined by hyphens; segment and plan ids may also use underscores). The top-level trip "id" is a slug of the trip title.
- Dates: ISO "YYYY-MM-DD". Infer a plausible date for each day from arrival dates, stated durations, months, and seasons. If the year is not stated, infer it from today's date and the described season.
- Days: each day needs a "date", a short "title" (e.g. { "en": "Rome - Day 1" }) and at least one block.
- Blocks: each block needs at minimum a "time" and a "title". "time" may be a clock time ("09:00") or a part of day ("Morning"). Add a "description" when the text provides detail. Infer sensible times and ordering when the text implies a sequence.
- Do NOT invent geographic coordinates ("coords"), map URLs ("mapsUrl"), or photo spots. Omit any field you cannot ground in the source text — prefer omitting optional fields over guessing.
- Themes: set each segment's "theme" by cycling this list in order, starting from the first segment: "tartan", "navy", "tartan", "navy", ... (segment 1 = "tartan", segment 2 = "navy", and so on).
- Optionally set one "cover" emoji for the trip.
- Stay faithful to the source text; do not add destinations or activities it does not mention.`;
}

/** Extract the forced tool_use input from an Anthropic Messages response. */
export function extractToolInput(response: unknown): unknown | null {
	const content = (response as { content?: unknown })?.content;
	if (!Array.isArray(content)) return null;
	for (const block of content) {
		if (
			block &&
			typeof block === 'object' &&
			(block as { type?: string }).type === 'tool_use' &&
			(block as { name?: string }).name === TOOL_NAME
		) {
			return (block as { input?: unknown }).input ?? null;
		}
	}
	return null;
}

/** Pure pipeline: obtain a candidate Trip, validate it, and retry ONCE with the
 *  validation errors fed back before giving up with a 422. `produceDoc` is
 *  injected so this is testable with a canned response and no API key. */
export async function runImportPipeline(
	produceDoc: (priorErrors: string[] | null) => Promise<unknown>
): Promise<ImportOutcome> {
	let candidate = await produceDoc(null);
	let result = validateTripDoc(candidate);
	if (result.valid) return { ok: true, doc: candidate as TripDoc };

	// One retry, passing the validation errors back to the model.
	candidate = await produceDoc(result.errors);
	result = validateTripDoc(candidate);
	if (result.valid) return { ok: true, doc: candidate as TripDoc };

	return {
		ok: false,
		status: 422,
		error: result.errors[0] ?? 'The import could not be turned into a valid trip.'
	};
}

/** Call the Anthropic Messages API once and return the extracted Trip candidate.
 *  `fetchImpl` is injectable for testing; defaults to the platform fetch. */
async function callModel(
	apiKey: string,
	text: string,
	today: string,
	priorErrors: string[] | null,
	fetchImpl: typeof fetch
): Promise<unknown> {
	let userText =
		`Convert the following itinerary into a Trip and call ${TOOL_NAME}.\n\n----- ITINERARY -----\n${text}\n----- END ITINERARY -----`;
	if (priorErrors && priorErrors.length) {
		userText +=
			`\n\nYour previous attempt failed schema validation with these errors:\n` +
			priorErrors.map((e) => `- ${e}`).join('\n') +
			`\n\nProduce a corrected Trip that fixes them and call ${TOOL_NAME} again.`;
	}

	const res = await fetchImpl(ANTHROPIC_URL, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': ANTHROPIC_VERSION
		},
		body: JSON.stringify({
			model: MODEL,
			max_tokens: MAX_TOKENS,
			thinking: { type: 'disabled' },
			system: buildSystemPrompt(today),
			tools: [
				{
					name: TOOL_NAME,
					description: 'Save the itinerary as a Trip document.',
					input_schema: toolInputSchema()
				}
			],
			tool_choice: { type: 'tool', name: TOOL_NAME },
			messages: [{ role: 'user', content: userText }]
		})
	});

	if (!res.ok) {
		// Do not include the response body — it can echo request content.
		throw new Error(`anthropic_${res.status}`);
	}
	const data = await res.json();
	return extractToolInput(data);
}

/** Full import: call Claude, validate, retry once, and resolve to a Trip doc or
 *  a typed failure. The caller (endpoint) handles key/length checks and the
 *  actual persistence via createTrip. */
export async function importItinerary(opts: {
	apiKey: string;
	text: string;
	today: string;
	fetchImpl?: typeof fetch;
}): Promise<ImportOutcome> {
	const fetchImpl = opts.fetchImpl ?? fetch;
	try {
		return await runImportPipeline((priorErrors) =>
			callModel(opts.apiKey, opts.text, opts.today, priorErrors, fetchImpl)
		);
	} catch {
		// Network / upstream error — never surface internals or the pasted text.
		return { ok: false, status: 502, error: 'The import service failed. Please try again.' };
	}
}
