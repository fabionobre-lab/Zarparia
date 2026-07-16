/**
 * Scheduled D1 → R2 backup worker for Zarparia (LAUNCH_PLAN.md Phase 5.1).
 *
 * Runs daily (see wrangler.jsonc triggers.crons), dumps every user table in
 * the `trips` D1 database plus its schema to a single gzipped JSON object in
 * the private `zarparia-backups` R2 bucket, then prunes objects older than
 * RETENTION_DAYS as a belt-and-braces backstop to the R2 lifecycle rule
 * (see README.md for the primary, bucket-level mechanism).
 *
 * A POST /trigger endpoint (Bearer-token gated) exists for smoke-testing
 * after deploy and ad-hoc pre-migration backups; everything else 404s.
 */

const PAGE_SIZE = 500;
const RETENTION_DAYS = 35;
const BACKUP_PREFIX = 'backups/';

// Ephemeral counter state (see web/migrations/0008_rate_limits.sql) — not
// worth backing up, and it churns constantly.
const EXCLUDED_TABLES = new Set(['rate_limits']);

interface SchemaRow {
	type: string;
	name: string;
	tbl_name: string;
	sql: string | null;
}

interface BackupPayload {
	createdAt: string;
	schema: string[];
	tables: Record<string, Record<string, unknown>[]>;
}

interface BackupSummary {
	key: string;
	tables: Record<string, number>;
	bytesGzipped: number;
	deletedOldObjects: string[];
}

/** Enumerate real, non-internal, non-excluded table names via sqlite_master. */
async function listUserTables(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT DISTINCT tbl_name AS name
			 FROM sqlite_master
			 WHERE type = 'table'
			   AND name NOT LIKE 'sqlite_%'
			   AND name NOT LIKE '_cf_%'
			   AND name != 'd1_migrations'
			 ORDER BY rowid`
		)
		.all<{ name: string }>();
	return results.map((r) => r.name).filter((name) => !EXCLUDED_TABLES.has(name));
}

/** Dump every CREATE TABLE / CREATE INDEX statement, in original creation
 *  order (which already respects foreign-key dependency order, since the
 *  migrations were applied in order), for the tables we're backing up. */
async function dumpSchema(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT type, name, tbl_name, sql
			 FROM sqlite_master
			 WHERE sql IS NOT NULL
			   AND tbl_name NOT LIKE 'sqlite_%'
			   AND tbl_name NOT LIKE '_cf_%'
			   AND tbl_name != 'd1_migrations'
			 ORDER BY rowid`
		)
		.all<SchemaRow>();
	return results.filter((row) => !EXCLUDED_TABLES.has(row.tbl_name) && row.sql).map((row) => row.sql as string);
}

/** Dump a single table's rows, paginated to bound per-query memory. */
async function dumpTable(db: D1Database, table: string): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = [];
	let offset = 0;
	for (;;) {
		// Table name comes from sqlite_master (trusted, not user input), and D1
		// doesn't support binding identifiers, so it's quoted and interpolated.
		const { results } = await db
			.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`)
			.bind(PAGE_SIZE, offset)
			.all<Record<string, unknown>>();
		rows.push(...results);
		if (results.length < PAGE_SIZE) break;
		offset += PAGE_SIZE;
	}
	return rows;
}

function backupKeyForDate(date: Date): string {
	const isoDate = date.toISOString().slice(0, 10); // YYYY-MM-DD
	return `${BACKUP_PREFIX}${isoDate}/backup.json.gz`;
}

async function gzipJson(payload: BackupPayload): Promise<ArrayBuffer> {
	const json = JSON.stringify(payload);
	const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
	return await new Response(stream).arrayBuffer();
}

/** Delete backup objects older than RETENTION_DAYS. Belt-and-braces: the
 *  primary mechanism is the R2 lifecycle rule (see README.md) — this just
 *  makes sure retention holds even if that rule is ever missing/misconfigured. */
async function pruneOldBackups(bucket: R2Bucket, now: Date): Promise<string[]> {
	const cutoff = now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
	const deleted: string[] = [];
	let cursor: string | undefined;
	do {
		const listing = await bucket.list({ prefix: BACKUP_PREFIX, cursor });
		for (const obj of listing.objects) {
			const match = /^backups\/(\d{4}-\d{2}-\d{2})\//.exec(obj.key);
			if (!match) continue;
			const objDate = Date.parse(`${match[1]}T00:00:00Z`);
			if (!Number.isNaN(objDate) && objDate < cutoff) {
				await bucket.delete(obj.key);
				deleted.push(obj.key);
			}
		}
		cursor = listing.truncated ? listing.cursor : undefined;
	} while (cursor);
	return deleted;
}

async function runBackup(env: Env, now: Date): Promise<BackupSummary> {
	const tableNames = await listUserTables(env.DB);

	// Fail closed: dump everything into memory first, and only write to R2 once
	// every table has succeeded, so a mid-run failure never produces a partial
	// (silently-incomplete) backup object.
	const tables: Record<string, Record<string, unknown>[]> = {};
	for (const table of tableNames) {
		try {
			tables[table] = await dumpTable(env.DB, table);
		} catch (err) {
			console.error(`Backup aborted: failed to dump table "${table}"`, err);
			throw new Error(`backup aborted: table "${table}" failed to dump`, { cause: err });
		}
	}

	let schema: string[];
	try {
		schema = await dumpSchema(env.DB);
	} catch (err) {
		console.error('Backup aborted: failed to dump schema', err);
		throw new Error('backup aborted: schema dump failed', { cause: err });
	}

	const payload: BackupPayload = {
		createdAt: now.toISOString(),
		schema,
		tables
	};

	const gzipped = await gzipJson(payload);
	const key = backupKeyForDate(now);

	await env.BACKUPS.put(key, gzipped, {
		httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' },
		customMetadata: { createdAt: payload.createdAt, tableCount: String(tableNames.length) }
	});

	const deletedOldObjects = await pruneOldBackups(env.BACKUPS, now);

	const rowCounts: Record<string, number> = {};
	for (const [name, rows] of Object.entries(tables)) rowCounts[name] = rows.length;

	return { key, tables: rowCounts, bytesGzipped: gzipped.byteLength, deletedOldObjects };
}

/** Timing-safe Bearer-token check, mirroring Cloudflare's documented pattern
 *  (developers.cloudflare.com/workers/examples/protect-against-timing-attacks):
 *  never branch on length mismatch, so the response time doesn't leak the
 *  secret's length. */
function isAuthorized(request: Request, env: Env): boolean {
	const header = request.headers.get('Authorization') ?? '';
	const prefix = 'Bearer ';
	if (!header.startsWith(prefix)) return false;
	const presented = header.slice(prefix.length);

	const encoder = new TextEncoder();
	const presentedBuf = encoder.encode(presented);
	const expectedBuf = encoder.encode(env.TRIGGER_TOKEN ?? '');

	const lengthsMatch = presentedBuf.byteLength === expectedBuf.byteLength;
	return lengthsMatch
		? crypto.subtle.timingSafeEqual(presentedBuf, expectedBuf)
		: !crypto.subtle.timingSafeEqual(presentedBuf, presentedBuf);
}

export default {
	async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(
			runBackup(env, new Date(event.scheduledTime)).then(
				(summary) => {
					console.log('Backup complete', JSON.stringify(summary));
				},
				(err) => {
					console.error('Scheduled backup failed', err);
					throw err;
				}
			)
		);
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (request.method !== 'POST' || url.pathname !== '/trigger') {
			return new Response('Not found', { status: 404 });
		}
		if (!env.TRIGGER_TOKEN || !isAuthorized(request, env)) {
			return new Response('Unauthorized', { status: 401 });
		}
		try {
			const summary = await runBackup(env, new Date());
			return new Response(JSON.stringify(summary, null, 2), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		} catch (err) {
			console.error('Manual backup trigger failed', err);
			return new Response(JSON.stringify({ error: 'backup_failed' }), {
				status: 500,
				headers: { 'content-type': 'application/json' }
			});
		}
	}
} satisfies ExportedHandler<Env>;
