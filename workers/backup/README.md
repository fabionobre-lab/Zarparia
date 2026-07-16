# zarparia-backup

Scheduled D1 → R2 backup worker for the Zarparia trips app (LAUNCH_PLAN.md Phase 5.1).

Runs daily at 03:00 UTC (`triggers.crons` in `wrangler.jsonc`), dumps every user
table in the `trips` D1 database (read-only) plus its schema to one gzipped
JSON object per day in the private `zarparia-backups` R2 bucket, then prunes
objects older than 35 days as a belt-and-braces backstop to the bucket's R2
lifecycle rule. `rate_limits` is intentionally excluded — it's ephemeral
counter state, not user data.

A `POST /trigger` endpoint (Bearer-token gated, constant-time compare) exists
for post-deploy smoke tests and ad-hoc pre-migration backups. Everything else
returns 404.

Retention: **35 days**, matching the number committed in the live privacy
policy (LAUNCH_PLAN.md 0.3 / `web/src/lib/legal/`). If that number ever
changes, update it in three places: the privacy policy copy, the R2 lifecycle
rule (below), and `RETENTION_DAYS` in `src/index.ts`.

---

## Deploy recipe

Run from `workers/backup/`. None of this has been run by the build — the
bucket does not exist yet and nothing has been deployed.

```bash
npm install

# 1. Create the private bucket (does not exist yet).
npx wrangler r2 bucket create zarparia-backups

# 2. Set the lifecycle rule — the PRIMARY retention mechanism (the worker's
#    in-code prune is a backstop, not a replacement). 35 days, scoped to the
#    backups/ prefix so nothing else dropped in the bucket is auto-expired.
npx wrangler r2 bucket lifecycle add zarparia-backups expire-after-35-days backups/ --expire-days 35

# Verify it stuck:
npx wrangler r2 bucket lifecycle list zarparia-backups

# 3. Set the manual-trigger secret (interactive prompt; generate a long random
#    value, e.g. `openssl rand -hex 32`, and store it in the password manager
#    per LAUNCH_PLAN.md 0.4).
npx wrangler secret put TRIGGER_TOKEN

# 4. Deploy.
npx wrangler deploy

# 5. Smoke test against the deployed worker.
curl -X POST https://zarparia-backup.<your-subdomain>.workers.dev/trigger \
  -H "Authorization: Bearer <the TRIGGER_TOKEN you just set>"
# Expect 200 + a JSON summary: { key, tables: {...counts}, bytesGzipped, deletedOldObjects }

# Confirm the object landed:
npx wrangler r2 object get zarparia-backups/backups/<YYYY-MM-DD>/backup.json.gz --file /tmp/check.json.gz
```

The cron trigger itself needs no separate registration step beyond `wrangler
deploy` — it's declared in `wrangler.jsonc` (`triggers.crons`) and Cloudflare
schedules it as part of the deploy.

### Rotating / auditing the trigger token

```bash
npx wrangler secret put TRIGGER_TOKEN   # overwrites with a new value
npx wrangler secret list                # confirms it's set (never shows the value)
```

---

## Restore procedure (tested locally — see "Local verification" below)

1. **Fetch the backup object** you want to restore from R2:

   ```bash
   npx wrangler r2 object get zarparia-backups/backups/<YYYY-MM-DD>/backup.json.gz \
     --remote --file ./backup.json.gz
   ```

2. **Convert it to a `.sql` file** with `restore.mjs`:

   ```bash
   node restore.mjs backup.json.gz --out restore.sql
   ```

   `restore.mjs` gunzips the object, then emits `restore.sql`: the schema
   (`CREATE TABLE` / `CREATE INDEX`) first, in the original migration order
   (which is already foreign-key-safe — `users` before `trips` before
   `trip_shares`, etc.), followed by batched `INSERT` statements per table in
   that same order. `rate_limits` was never backed up, so it isn't restored —
   recreate it from `web/migrations/0008_rate_limits.sql` if you're rebuilding
   a database from scratch (it'll just start empty, which is correct — it's a
   rolling counter).

3. **Apply it to the target D1 database.**

   - **New database** (disaster recovery / fresh environment):

     ```bash
     npx wrangler d1 create trips-restored
     # put the new database_id into a wrangler.jsonc that binds it, then:
     npx wrangler d1 execute trips-restored --remote --file restore.sql
     ```

   - **Existing database** (rare — e.g. restoring into a scratch/staging DB
     that already has the schema): drop the tables first so `CREATE TABLE`
     doesn't collide, then apply. There's a ready-made drop script for local
     testing at `scripts/drop-all.sql`; for a real target, review it against
     the current schema first since it's a destructive statement list.

     ```bash
     npx wrangler d1 execute <target-db> --remote --file scripts/drop-all.sql
     npx wrangler d1 execute <target-db> --remote --file restore.sql
     ```

4. **Verify**: row counts per table should match the `tables` object in the
   backup JSON (or the `/trigger` response summary from the run that produced
   it).

   ```bash
   npx wrangler d1 execute <target-db> --remote --command \
     "SELECT 'users' t, count(*) c FROM users UNION ALL SELECT 'trips', count(*) FROM trips"
   ```

**Foreign-key note**: `restore.sql` wraps the load in
`PRAGMA foreign_keys = OFF` / `... = ON` — D1/SQLite enforces FKs per-statement
by default, and since table order already matches dependency order this is
mostly a safety margin, not a requirement. If you ever restore a *subset* of
tables (e.g. just `trips` without `users`), leave FKs off or expect failures on
rows referencing missing parents.

---

## Local development & verification

Everything below runs against **local** D1/R2 simulation only — nothing
touches the real bucket or database.

```bash
npm install
cp .dev.vars.example .dev.vars    # sets TRIGGER_TOKEN for local dev

# Bootstrap a local D1 with the web app's real schema (points at
# ../../web/migrations via migrations_dir in wrangler.jsonc).
npm run db:migrate:local

# Seed a couple of rows across the tables that matter (users, trips, a share,
# feedback, plus a rate_limits row to prove it's excluded).
npx wrangler d1 execute trips --local --file=scripts/seed-local.sql

# Terminal 1: start the worker with scheduled-event support.
npm run dev            # wrangler dev --test-scheduled, http://127.0.0.1:8787

# Terminal 2: run the manual trigger + gunzip round-trip check.
npm run backup:verify-local -- --port 8787
```

`scripts/verify-local.mjs` POSTs `/trigger`, downloads the resulting object
via `wrangler r2 object get --local`, gunzips it, and asserts: `createdAt`
present, non-empty `schema`, `schema`/`tables` both exclude `rate_limits`, and
the per-table row counts in the downloaded object match the `/trigger`
response summary.

To exercise the scheduled handler itself (not just `/trigger`), hit
`wrangler dev`'s scheduled-test route:

```bash
curl "http://127.0.0.1:8787/__scheduled?cron=0+3+*+*+*"
```

### What was actually verified while building this (2026-07-16, local only)

- Applied all 8 `web/migrations/*.sql` to a local D1 for this worker
  (`npm run db:migrate:local`) — all succeeded.
- Seeded 2 users, 2 trips, 1 trip_shares row, 1 feedback row, 1 rate_limits row.
- `POST /trigger` with no/wrong Authorization → `401`; wrong path/method → `404`.
- `POST /trigger` with the correct token → `200`, summary reported
  `users: 2, trips: 2, trip_shares: 1, feedback: 1`, all other backed-up
  tables `0`, `rate_limits` absent from the summary entirely.
- Downloaded the resulting `backup.json.gz` via `wrangler r2 object get
  --local`, gunzipped it in Node: `createdAt` present, 21 schema statements,
  none mentioning `rate_limits`, table row counts matching the seed exactly.
- Retention: manually `wrangler r2 object put --local` a fake object dated
  `2026-01-01` (>35 days old) and one dated `2026-06-20` (26 days old, inside
  the window). Re-ran `/trigger`: response's `deletedOldObjects` listed only
  the `2026-01-01` object; a follow-up `wrangler r2 object get` confirmed it
  was gone and the `2026-06-20` object was still present.
- Failure handling: temporarily forced the `feedback` table dump to throw,
  confirmed `/trigger` returned `500` and — by comparing the SHA-256 of the
  existing `backups/2026-07-16/backup.json.gz` object before and after the
  failed run — that the object was byte-for-byte unchanged (no partial
  overwrite). Reverted the fault injection and confirmed a normal run
  succeeds again.
- **Restore round-trip**: ran `restore.mjs` against the downloaded backup to
  produce `restore.sql`, dropped all 10 backed-up tables in the local D1
  (`scripts/drop-all.sql`), applied `restore.sql`, and re-queried row counts:
  `users: 2, trips: 2, trip_shares: 1, feedback: 1` — exact match to the
  pre-drop counts, and spot-checked `users` content (ids/emails/names)
  matched the seed data.
- `npx tsc --noEmit` clean throughout.

---

## Design notes / deviations for the orchestrator

- **Backup format**: one JSON object per day (`backups/<YYYY-MM-DD>/backup.json.gz`),
  gzipped via `CompressionStream('gzip')`. The whole payload is built in memory
  before writing (D1 reads are paginated 500 rows/query to bound *query*
  memory, but the final JSON assembly is not streamed to R2) — fine at beta
  scale per the task brief; flag for follow-up if the DB grows enough that the
  full-JSON-in-memory approach becomes a real constraint (Workers have a
  128 MB memory ceiling).
- **Manual trigger auth**: `crypto.subtle.timingSafeEqual`, following
  Cloudflare's documented pattern exactly (never branch on length mismatch —
  compare `presentedBuf` against itself when lengths differ, so response time
  doesn't leak the secret's length).
- **TRIGGER_TOKEN typing**: it's a Worker secret, so `wrangler types` doesn't
  generate it (secrets aren't in `wrangler.jsonc`). Declared via a small
  ambient `src/env.d.ts` that merges into the global `Env` interface — same
  convention the web app uses for `GOOGLE_CLIENT_SECRET`/`ADMIN_EMAIL`
  (`web/src/lib/server/authenv.ts`, `admin.ts`), just via declaration merging
  since this worker's `Env` *is* its whole binding surface.
- **`d1_databases.database_id`** in `wrangler.jsonc` is the same id as
  `web/wrangler.jsonc` (`92ea4a9d-25c9-4039-912b-b711af1da8a6`) — intentional,
  per the task brief ("the SAME D1 database"). This worker only ever runs
  `SELECT` against it.
- **Not done (explicitly out of scope per the task)**: creating the
  `zarparia-backups` bucket, setting the lifecycle rule, setting the
  `TRIGGER_TOKEN` secret, registering the cron, or deploying. All of that is
  the "Deploy recipe" above, for the orchestrator to run.
- **Open question for the orchestrator**: the deploy recipe assumes the
  worker gets its own `workers.dev` subdomain
  (`zarparia-backup.<subdomain>.workers.dev`) for the `/trigger` smoke test —
  confirm that's fine to expose (Bearer-token gated, no other route
  responds) or whether it should be pinned to a route/zone once the custom
  domain lands in Phase 7.
