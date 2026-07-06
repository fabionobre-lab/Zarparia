# Trips Platform — Multi-User Build Plan

The static itinerary PWA (root `index.html`, `app.html`, `trips/*.json`) is being
extended into a multi-user web app under `web/`. The static site stays live on
GitHub Pages until the new app is ready to cut over.

## Decisions (locked)

- **Stack**: SvelteKit on **Cloudflare Workers** (one Worker serves SSR frontend
  + API, same origin — clean auth cookies), **D1** for data.
- **Auth**: **Google Sign-In** (OAuth), sessions stored server-side in D1.
- **Editor**: full structured form UI over `schema/trip.schema.json`.
- **Sharing**: per-trip, by user, viewer/editor permissions (multi-tenant).
- Supersedes the old "no backend / no build / deploy by push to Pages"
  constraints — deploy is now `wrangler deploy`. GitHub remains source control.

## Data model (`web/migrations/0001_init.sql`)

`users` (Google identity) · `sessions` (server-side, hashed token) ·
`trips` (owner_id + `doc` JSON conforming to the trip schema + denormalized
title/status/dates) · `trip_shares` (trip_id, user_id, viewer|editor).
Every trip query is scoped to owner or an accepted share.

## Phases

- **A — Backend skeleton** ✅ SvelteKit+Workers+D1, schema, `/api/health`,
  session hook + `/api/me` stubs. Verified locally.
- **B — Auth**: Google OAuth (Arctic), session create/verify/destroy in D1,
  `hooks.server.ts` resolves the cookie to `locals.user`, login/logout routes,
  route guards.
- **C — Trips API**: CRUD scoped to owner/shares; server-side schema validation;
  seed the existing `trips/*.json` to the first account; engine renders from the
  API; offline caching.
- **D — Editor**: full form UI, live preview via the engine, client-side
  validation.
- **E — Sharing**: share by email, permission levels, "shared with me".
- **F — Polish**: custom per-trip theme colors, offline editor, migration
  cleanup, cutover.

## What Fabio must provision (blocks Phase B deploy)

1. **Cloudflare account** + CLI login: from `web/`, run `npx wrangler login`.
2. **Create the D1 database**: `npx wrangler d1 create trips`, then paste the
   printed `database_id` into `web/wrangler.jsonc` (replacing the placeholder),
   and `npm run db:migrate:remote`.
3. **Google OAuth app** (Google Cloud Console → APIs & Services → Credentials →
   OAuth client ID → Web application):
   - Authorized redirect URI (local): `http://localhost:5173/auth/callback/google`
   - Authorized redirect URI (prod): `https://<your-domain>/auth/callback/google`
   - Give me the **Client ID** (safe to share); put the **Client secret** into
     Worker secrets via `npx wrangler secret put GOOGLE_CLIENT_SECRET` (never in
     the repo). For local dev it goes in `web/.dev.vars` (gitignored).

Local development needs none of this except a Google OAuth client for testing
the login flow; everything else runs against local D1.

## Local dev quickref (from `web/`)

```
npm install
npm run db:migrate:local      # apply migrations to local D1
npm run dev                   # vite dev at http://localhost:5173
npm run check                 # typecheck
npm run build                 # production build (adapter-cloudflare)
```
