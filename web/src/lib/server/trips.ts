import { validateTripDoc, type TripDoc } from '$lib/validateTrip';

export type Role = 'owner' | 'editor' | 'viewer';

export interface TripListItem {
	id: string;
	title: string | null;
	status: string;
	startDate: string | null;
	endDate: string | null;
	role: Role;
	updatedAt: string;
}

/** Result of a write: either the trip, or a typed failure. */
export type WriteResult =
	| { ok: true; id: string; doc: TripDoc }
	| { ok: false; reason: 'invalid'; errors: string[] }
	| { ok: false; reason: 'not_found' }
	| { ok: false; reason: 'forbidden' };

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
	const today = new Date().toISOString().slice(0, 10);
	let status = 'upcoming';
	if (end && end < today) status = 'past';
	else if (start && start <= today && end && today <= end) status = 'active';
	const title = doc.title?.[doc.defaultLanguage] ?? Object.values(doc.title ?? {})[0] ?? doc.id;
	return { title, status, start, end };
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
	const rows = await db
		.prepare(
			`SELECT id, title, status, startDate, endDate, role, updatedAt FROM (
				SELECT t.id AS id, t.title AS title, t.status AS status,
				       t.start_date AS startDate, t.end_date AS endDate,
				       'owner' AS role, t.updated_at AS updatedAt
				FROM trips t WHERE t.owner_id = ?1
				UNION ALL
				SELECT t.id, t.title, t.status, t.start_date, t.end_date,
				       ts.permission, t.updated_at
				FROM trips t JOIN trip_shares ts ON ts.trip_id = t.id
				WHERE ts.user_id = ?1
			) ORDER BY (startDate IS NULL), startDate DESC`
		)
		.bind(userId)
		.all<TripListItem>();
	return rows.results;
}

export async function getTripForUser(
	db: D1Database,
	userId: string,
	tripId: string
): Promise<{ doc: TripDoc; role: Role } | null> {
	const role = await roleFor(db, userId, tripId);
	if (!role) return null;
	const row = await db.prepare('SELECT doc FROM trips WHERE id = ?').bind(tripId).first<{ doc: string }>();
	if (!row) return null;
	return { doc: JSON.parse(row.doc) as TripDoc, role };
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
	const id = await uniqueId(db, base);
	doc.id = id;
	const meta = deriveMeta(doc);
	const now = new Date().toISOString();
	await db
		.prepare(
			`INSERT INTO trips (id, owner_id, doc, title, status, start_date, end_date, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(id, userId, JSON.stringify(doc), meta.title, meta.status, meta.start, meta.end, now, now)
		.run();
	return { ok: true, id, doc };
}

export async function updateTrip(
	db: D1Database,
	userId: string,
	tripId: string,
	doc: TripDoc
): Promise<WriteResult> {
	const role = await roleFor(db, userId, tripId);
	if (!role) return { ok: false, reason: 'not_found' };
	if (role === 'viewer') return { ok: false, reason: 'forbidden' };
	const { valid, errors } = validateTripDoc(doc);
	if (!valid) return { ok: false, reason: 'invalid', errors };

	doc.id = tripId; // id is immutable
	const meta = deriveMeta(doc);
	await db
		.prepare(
			`UPDATE trips SET doc = ?, title = ?, status = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ?`
		)
		.bind(JSON.stringify(doc), meta.title, meta.status, meta.start, meta.end, new Date().toISOString(), tripId)
		.run();
	return { ok: true, id: tripId, doc };
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
