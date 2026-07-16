# Trips platform (`web/`)

SvelteKit on Cloudflare Workers + D1. Multi-user (Google sign-in), in-app trip
editor, per-user sharing, offline PWA. See [`../PLATFORM_PLAN.md`](../PLATFORM_PLAN.md)
for architecture and the data model.

**Live:** https://trips.fabionobre-ai.workers.dev

## Local development

```bash
npm install
npm run db:migrate:local         # apply migrations to the local D1
cp .dev.vars.example .dev.vars   # DEV_AUTH=1 enables /auth/dev-login (no Google needed)
npm run dev                      # http://localhost:5173
```

`/auth/dev-login?email=you@example.com` starts a session without Google (only
when `DEV_AUTH=1`). Seed the example trips into your account with a POST to
`/api/dev/seed`.

Other scripts: `npm run check` (typecheck), `npm run build`, `npm run preview`
(build + `wrangler dev`, exercises the service worker + local D1).

> Note: changing `database_id` in `wrangler.jsonc` repoints the **local** D1 as
> well, so rerun `npm run db:migrate:local` afterwards.

## Deploy

```bash
npm run db:migrate:remote        # first time / when migrations change
npm run deploy                   # build + wrangler deploy
```

Google login in production needs a Google OAuth **Web application** client with
redirect URI `https://<host>/auth/callback/google`, then:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Never set `DEV_AUTH` in production (it would let anyone forge a session).

**Deploy order matters:** always run `npm run db:migrate:remote` **before**
`npm run deploy`. New Worker code can read columns/tables a pending migration
adds — deploying the Worker first breaks all requests (sign-ins included)
until the migration lands (see LAUNCH_PLAN.md:84 for the incident this rule
comes from).

### Rollback

```bash
npx wrangler deployments list             # find the previous version-id
npx wrangler rollback [version-id]        # revert the Worker to it
```

`wrangler rollback` only reverts the **Worker code** — it does not touch D1.

> **CRITICAL:** D1 migrations in this app are forward-only — there are no
> down migrations in `web/migrations/`. If a bad *migration* (not just bad
> Worker code) shipped, rolling back the Worker is **not enough**: the schema
> stays changed underneath the old code, which can be just as broken. In that
> case, restore the D1 database from the backup worker instead — see the
> restore procedure in
> [`../workers/backup/README.md`](../workers/backup/README.md#restore-procedure-tested-locally--see-local-verification-below).
> Rolling back the Worker is the right first move only when the deployed
> *code* is bad and the schema is fine.

### Monitoring & alerting

Manual, one-time setup steps still owed (not code — external accounts):

1. **Uptime monitor** — free [UptimeRobot](https://uptimerobot.com) monitor:
   - Type: HTTP(s), URL `https://trips.fabionobre-ai.workers.dev/api/health`
   - Alert condition: keyword check for `"ok":true` missing from the response
     (or simpler: alert on status code != 200)
   - Interval: 5 minutes
2. **Client error monitoring (optional)** — the client Sentry scaffold
   (`web/src/lib/client/sentry.ts`) is dormant until a DSN is configured:
   ```bash
   npx wrangler secret put PUBLIC_SENTRY_DSN
   ```
   (or set it as a dashboard variable). Until set, no Sentry code runs or
   loads.
3. **Backup worker exceptions (optional)** — Cloudflare dashboard →
   Workers & Pages → `zarparia-backup` → Notifications → add a "Worker
   exceptions" notification so a failed nightly backup surfaces without
   having to check manually.

### Google Photos linking

Linking photos to trips additionally needs, one time:

```bash
npx wrangler r2 bucket create trips-photos   # cached photo renditions
```

and, in the Google Cloud project that owns the OAuth client, enable the
**Google Photos Picker API** (APIs & Services → Library). No new OAuth client
or redirect URI is needed — the photos consent flow reuses
`/auth/callback/google`.

## Editing trips

Trips are stored per-user in D1 and edited in-app (`/trips/new`,
`/trips/<id>/edit`). The trip JSON shape is the shared schema in
[`src/lib/trip.schema.json`](src/lib/trip.schema.json) (kept in sync with the
repo-root `schema/trip.schema.json`). Segment colors can be named (`theme`) or
custom (`themeColors`).
