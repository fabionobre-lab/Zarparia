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
- **B — Auth** ✅ Google OAuth (Arctic) with PKCE, D1-backed sessions
  (token hashed at rest, sliding renewal), `hooks.server.ts` resolves the
  cookie to `locals.user`, login/logout routes, `requireUser` guard. A
  **dev-only** `/auth/dev-login` route (gated on `DEV_AUTH=1` in `.dev.vars`)
  establishes a session without Google so Phases C–E are buildable locally
  before OAuth credentials exist. Verified end-to-end against local D1.
- **C — Trips API + engine** ✅ Owner/share-scoped CRUD with server-side schema
  validation; dev seed of the example trips; the render engine ported to a Svelte
  component (`TripView.svelte`, escaped text — no innerHTML/XSS on shared trips)
  with a home trip-list and `/trips/[id]` view. Verified locally: multi-tenant
  isolation, and faithful rendering of both trips incl. plan tabs, diffs, bilingual
  text, birthday banner, weather, and Wikipedia thumbnails. (Offline SW caching
  deferred to Phase F.)
- **D — Editor** ✅ Full nested structured-form editor (trip → segments → plans
  → days → blocks) with per-language inputs, add/remove/reorder at every level,
  tag-vocabulary editing, a **live preview** using TripView, and client-side
  schema validation before save. `/trips/new` and `/trips/[id]/edit`; empty
  fields pruned before POST/PUT. Verified: render, live reactivity, validation
  errors on empty save, and valid save→redirect.
- **E — Sharing** ✅ Owner shares a trip by email (viewer/editor); share
  management API + SharePanel on the trip page; home splits "Your trips" vs
  "Shared with you". Permission boundaries enforced (viewer can't edit,
  non-owner can't manage shares). Target must have signed in once (pending
  email invites are a future enhancement). Verified with two users locally.
- **F — Polish** ✅ Custom per-trip theme colors (segment `themeColors`,
  editor color pickers, applied as CSS-var overrides in TripView); PWA —
  web manifest + icons + a SvelteKit service worker (precache app shell,
  network-first-with-cache-fallback for pages/API). Verified: colors live-update
  the preview; offline reload serves both the logged-out shell and a
  previously-viewed trip. Cutover: platform branch merged to `main`.
- **G — Google Photos** ✅ Link photos from the user's Google Photos library
  onto the itinerary. Google's Photos APIs deliberately never expose GPS, so
  placement is **by capture time**: photo `createTime` → wall-clock date/time
  in the trip's timezone → itinerary day → block whose time window contains it
  (`src/lib/photo-mapping.ts`, pure + tested against the UK trip incl. the BST
  midnight rollover). Selection uses the **Picker API** (the only sanctioned
  path since the 2025 Library API restrictions): incremental OAuth consent
  reusing the login client/redirect (`/auth/photos/connect`, short-lived token
  in an httpOnly cookie — nothing at rest), picker session opened in Google's
  UI, then a client-driven batched import (5/page, sized to the Workers
  subrequest budget) that caches two renditions per photo in **R2**
  (`trips-photos`: ≤360px strip/marker thumb + ≤1600px lightbox) because
  picker baseUrls die within the hour, and indexes rows in `trip_photos`
  (migration 0005; placement columns + `manual_override`). UI: a Photos panel
  on the trip page (connect → pick → live import progress), thumbnail strips
  per block and per day in TripView, photo markers with count badges at block
  coordinates on the day map, a lightbox with prev/next, move-to-day
  correction (recorded as manual override) and remove, and an editor-only
  "Photos not on the itinerary" strip for unmatched dates. Photos-only for
  now (videos are skipped and reported). Verified locally end-to-end minus
  the Google round-trip itself (needs real OAuth creds): auth-gated serving
  with ETag/304, reassign validation, delete incl. R2 cleanup, SSR strips.

## Deployment status

**Live at https://trips.fabionobre-ai.workers.dev** (Cloudflare Workers + D1
`trips`, West Europe, account fabionobre.ai@gmail.com). Verified: remote D1
health, home page, dev-login correctly disabled in prod. **Google login is not
yet functional** — it needs the OAuth client + secrets below.

## What Fabio must provision (blocks Google login in production)

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

4. **Google Photos linking** (Phase G) additionally needs, once:
   `npx wrangler r2 bucket create trips-photos`, and enabling the
   **Google Photos Picker API** on the same Google Cloud project (APIs &
   Services → Library). No new OAuth client or redirect URI — the photos
   consent flow reuses `/auth/callback/google`.

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
