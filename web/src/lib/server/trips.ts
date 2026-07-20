import { validateTripDoc, type TripDoc } from '$lib/validateTrip';
import type { ThemeColors } from '$lib/trip-engine';

export type Role = 'owner' | 'editor' | 'viewer';

export interface TripListItem {
	id: string;
	title: string | null;
	status: string;
	startDate: string | null;
	endDate: string | null;
	role: Role;
	updatedAt: string;
	/** Emoji cover, parsed from the stored doc (no denormalized column for it). */
	cover?: string;
	/** First segment's theme, parsed from the stored doc (no denormalized column
	 *  for it), so the home list can render a themed card without fetching the
	 *  full trip doc for every card. */
	theme?: string;
	themeColors?: ThemeColors;
}

/** Result of a write: either the trip, or a typed failure. */
export type WriteResult =
	| { ok: true; id: string; doc: TripDoc; updatedAt: string }
	| { ok: false; reason: 'invalid'; errors: string[] }
	| { ok: false; reason: 'not_found' }
	| { ok: false; reason: 'forbidden' }
	| { ok: false; reason: 'conflict' };

function allDates(doc: TripDoc): string[] {
	const dates: string[] = [];
	for (const seg of doc.segments ?? [])
		for (const plan of seg.plans ?? [])
			for (const day of plan.days ?? []) if (day?.date) dates.push(day.date);
	return dates.sort();
}

/** Denormalize title/status/date-range from the doc for cheap listing. */
function deriveMeta(doc: TripDoc) {
	const dates = allDates(doc);
	const start = dates[0] ?? null;
	const end = dates[dates.length - 1] ?? null;
	const status = statusFor(start, end);
	const title = doc.title?.[doc.defaultLanguage] ?? Object.values(doc.title ?? {})[0] ?? doc.id;
	return { title, status, start, end };
}

/** Derive a trip's status from its date range, same rules as deriveMeta.
 *  Computed at read time so a stored 'upcoming' can't go stale. */
function statusFor(start: string | null, end: string | null): string {
	const today = new Date().toISOString().slice(0, 10);
	if (end && end < today) return 'past';
	if (start && start <= today && end && today <= end) return 'active';
	return 'upcoming';
}

function slugify(s: string): string {
	const base = s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
	return base || 'trip';
}

async function uniqueId(db: D1Database, base: string): Promise<string> {
	let id = base;
	let n = 1;
	while (await db.prepare('SELECT 1 FROM trips WHERE id = ?').bind(id).first()) {
		id = `${base}-${++n}`;
	}
	return id;
}

/** null = no access; otherwise the caller's role on the trip. */
export async function roleFor(db: D1Database, userId: string, tripId: string): Promise<Role | null> {
	const owner = await db
		.prepare('SELECT owner_id AS ownerId FROM trips WHERE id = ?')
		.bind(tripId)
		.first<{ ownerId: string }>();
	if (!owner) return null;
	if (owner.ownerId === userId) return 'owner';
	const share = await db
		.prepare('SELECT permission FROM trip_shares WHERE trip_id = ? AND user_id = ?')
		.bind(tripId, userId)
		.first<{ permission: Role }>();
	return share?.permission ?? null;
}

export async function listTripsForUser(db: D1Database, userId: string): Promise<TripListItem[]> {
	// Pulls the full `doc` blob alongside the denormalized columns so the
	// optional cover emoji (not worth its own column/migration) can be read
	// off it directly — trips are stored as JSON, so no schema change needed.
	const rows = await db
		.prepare(
			`SELECT id, title, status, startDate, endDate, role, updatedAt, doc FROM (
				SELECT t.id AS id, t.title AS title, t.status AS status,
				       t.start_date AS startDate, t.end_date AS endDate,
				       'owner' AS role, t.updated_at AS updatedAt, t.doc AS doc
				FROM trips t WHERE t.owner_id = ?1
				UNION ALL
				SELECT t.id, t.title, t.status, t.start_date, t.end_date,
				       ts.permission, t.updated_at, t.doc
				FROM trips t JOIN trip_shares ts ON ts.trip_id = t.id
				WHERE ts.user_id = ?1
			) ORDER BY (startDate IS NULL), startDate DESC`
		)
		.bind(userId)
		.all<TripListItem & { doc: string }>();
	// status/start_date/end_date are denormalized at write time and never
	// refreshed, so recompute status from the dates on read.
	return rows.results.map(({ doc, ...r }) => {
		let cover: string | undefined;
		let theme: string | undefined;
		let themeColors: ThemeColors | undefined;
		try {
			const parsed = JSON.parse(doc) as {
				cover?: string;
				segments?: Array<{ theme?: string; themeColors?: ThemeColors }>;
			};
			cover = parsed.cover;
			theme = parsed.segments?.[0]?.theme;
			themeColors = parsed.segments?.[0]?.themeColors;
		} catch {
			cover = undefined;
		}
		return { ...r, status: statusFor(r.startDate, r.endDate), cover, theme, themeColors };
	});
}

export async function getTripForUser(
	db: D1Database,
	userId: string,
	tripId: string
): Promise<{ doc: TripDoc; role: Role; updatedAt: string } | null> {
	const role = await roleFor(db, userId, tripId);
	if (!role) return null;
	const row = await db
		.prepare('SELECT doc, updated_at AS updatedAt FROM trips WHERE id = ?')
		.bind(tripId)
		.first<{ doc: string; updatedAt: string }>();
	if (!row) return null;
	return { doc: JSON.parse(row.doc) as TripDoc, role, updatedAt: row.updatedAt };
}

/** Trip doc by id, with NO access check — for the public /s/[token] route,
 *  which authorizes via a public-link token (see server/public-links.ts)
 *  rather than a user id, so roleFor/getTripForUser don't apply. Callers must
 *  already have verified the token before reaching here. */
export async function getTripDocById(db: D1Database, tripId: string): Promise<TripDoc | null> {
	const row = await db.prepare('SELECT doc FROM trips WHERE id = ?').bind(tripId).first<{ doc: string }>();
	return row ? (JSON.parse(row.doc) as TripDoc) : null;
}

export async function createTrip(
	db: D1Database,
	userId: string,
	doc: TripDoc,
	desiredId?: string
): Promise<WriteResult> {
	const { valid, errors } = validateTripDoc(doc);
	if (!valid) return { ok: false, reason: 'invalid', errors };

	const base =
		desiredId && /^[a-z0-9][a-z0-9-]*$/.test(desiredId)
			? desiredId
			: slugify(doc.title?.[doc.defaultLanguage] ?? 'trip');
	const meta = deriveMeta(doc);
	const now = new Date().toISOString();

	// Two concurrent creates can pick the same id between uniqueId's SELECT and
	// the INSERT, tripping the PK constraint — retry with a fresh id on collision.
	for (let attempt = 0; attempt < 5; attempt++) {
		const id = await uniqueId(db, base);
		doc.id = id;
		try {
			await db
				.prepare(
					`INSERT INTO trips (id, owner_id, doc, title, status, start_date, end_date, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(id, userId, JSON.stringify(doc), meta.title, meta.status, meta.start, meta.end, now, now)
				.run();
			return { ok: true, id, doc, updatedAt: now };
		} catch (e) {
			if (attempt < 4 && e instanceof Error && /UNIQUE/i.test(e.message)) continue;
			throw e;
		}
	}
	// Unreachable: the loop either returns or throws.
	throw new Error('Could not allocate a unique trip id.');
}

export async function updateTrip(
	db: D1Database,
	userId: string,
	tripId: string,
	doc: TripDoc,
	baseUpdatedAt?: string
): Promise<WriteResult> {
	const role = await roleFor(db, userId, tripId);
	if (!role) return { ok: false, reason: 'not_found' };
	if (role === 'viewer') return { ok: false, reason: 'forbidden' };
	const { valid, errors } = validateTripDoc(doc);
	if (!valid) return { ok: false, reason: 'invalid', errors };

	doc.id = tripId; // id is immutable
	const meta = deriveMeta(doc);
	const now = new Date().toISOString();
	// Optimistic concurrency: when the caller passes the updated_at it loaded,
	// only write if the row hasn't changed since — otherwise report a conflict
	// so two editors don't silently clobber each other.
	const sql = baseUpdatedAt
		? `UPDATE trips SET doc = ?, title = ?, status = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ? AND updated_at = ?`
		: `UPDATE trips SET doc = ?, title = ?, status = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ?`;
	const stmt = db.prepare(sql);
	const bound = baseUpdatedAt
		? stmt.bind(JSON.stringify(doc), meta.title, meta.status, meta.start, meta.end, now, tripId, baseUpdatedAt)
		: stmt.bind(JSON.stringify(doc), meta.title, meta.status, meta.start, meta.end, now, tripId);
	const res = await bound.run();
	if (baseUpdatedAt && res.meta.changes === 0) return { ok: false, reason: 'conflict' };
	return { ok: true, id: tripId, doc, updatedAt: now };
}

export async function deleteTrip(
	db: D1Database,
	userId: string,
	tripId: string
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'forbidden' }> {
	const role = await roleFor(db, userId, tripId);
	if (!role) return { ok: false, reason: 'not_found' };
	if (role !== 'owner') return { ok: false, reason: 'forbidden' };
	await db.prepare('DELETE FROM trips WHERE id = ?').bind(tripId).run();
	return { ok: true };
}
