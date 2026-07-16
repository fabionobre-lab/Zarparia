#!/usr/bin/env node
/**
 * Tiny local verification script for the backup worker.
 *
 * Prerequisites (see README.md "Local development & verification"):
 *   1. `npm run db:migrate:local` — bootstrap the local D1 with the web app's schema.
 *   2. Seed a couple of rows, e.g. `npx wrangler d1 execute trips --local --file=scripts/seed-local.sql`.
 *   3. `npm run dev` (wrangler dev --test-scheduled) running in another terminal.
 *
 * What it does:
 *   1. POSTs /trigger with the TRIGGER_TOKEN from .dev.vars.
 *   2. Downloads the resulting R2 object via `wrangler r2 object get --local`.
 *   3. Gunzips it and sanity-checks structure (schema present, rate_limits
 *      excluded, tables is an object of arrays).
 *
 * Usage: node scripts/verify-local.mjs [--port 8787]
 */

import { readFile, mkdtemp, rm, readFile as readFileSync } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

async function readDevVars() {
	const raw = await readFileSync(path.resolve('.dev.vars'), 'utf-8');
	const vars = {};
	for (const line of raw.split('\n')) {
		const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (m) vars[m[1]] = m[2];
	}
	return vars;
}

async function main() {
	const port = (() => {
		const i = process.argv.indexOf('--port');
		return i >= 0 ? process.argv[i + 1] : '8787';
	})();

	const devVars = await readDevVars();
	const token = devVars.TRIGGER_TOKEN;
	if (!token) throw new Error('.dev.vars is missing TRIGGER_TOKEN — copy .dev.vars.example first');

	console.log(`POST http://127.0.0.1:${port}/trigger ...`);
	const res = await fetch(`http://127.0.0.1:${port}/trigger`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) {
		throw new Error(`/trigger returned ${res.status}: ${await res.text()}`);
	}
	const summary = await res.json();
	console.log('Trigger response:', JSON.stringify(summary, null, 2));

	const scratchDir = await mkdtemp(path.join(tmpdir(), 'zarparia-backup-verify-'));
	const localFile = path.join(scratchDir, 'downloaded.json.gz');
	execFileSync(
		'npx',
		['wrangler', 'r2', 'object', 'get', `zarparia-backups/${summary.key}`, '--local', '--file', localFile],
		{ stdio: 'inherit', shell: process.platform === 'win32' }
	);

	const raw = await readFile(localFile);
	const json = gunzipSync(raw).toString('utf-8');
	const backup = JSON.parse(json);

	const checks = [
		['has createdAt', typeof backup.createdAt === 'string'],
		['has schema array', Array.isArray(backup.schema) && backup.schema.length > 0],
		['schema excludes rate_limits', !backup.schema.some((s) => s.includes('rate_limits'))],
		['has tables object', backup.tables && typeof backup.tables === 'object'],
		['tables excludes rate_limits', !('rate_limits' in backup.tables)],
		['tables row counts match trigger summary', Object.entries(summary.tables).every(([t, n]) => (backup.tables[t]?.length ?? -1) === n)]
	];

	let allPass = true;
	for (const [name, pass] of checks) {
		console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`);
		if (!pass) allPass = false;
	}

	await rm(scratchDir, { recursive: true, force: true });

	if (!allPass) {
		console.error('\nVerification FAILED');
		process.exit(1);
	}
	console.log('\nVerification PASSED');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
