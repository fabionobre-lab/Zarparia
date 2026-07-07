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

## Editing trips

Trips are stored per-user in D1 and edited in-app (`/trips/new`,
`/trips/<id>/edit`). The trip JSON shape is the shared schema in
[`src/lib/trip.schema.json`](src/lib/trip.schema.json) (kept in sync with the
repo-root `schema/trip.schema.json`). Segment colors can be named (`theme`) or
custom (`themeColors`).
