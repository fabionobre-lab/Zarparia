# Public share route — spec

Status: spec only, not implemented. Reference: `DESIGN-CONSISTENCY-PLAN-R2.md`
Phase 6 item 1 ("Per-route OG" — per-trip OG is contingent on this route
existing; `/demo` shipped as the only OG payoff available today).

## Problem

`/trips/[id]` is auth-gated: `src/routes/trips/[id]/+page.server.ts:10`
redirects any visitor without an approved session to `/`. A trip link pasted
into a chat or unfurled by a crawler never reaches trip content — no per-trip
OG, no read-only preview, no growth loop from sharing. This spec defines a
route that serves trip content to anonymous visitors without touching the
auth-gated app.

## Relationship to the existing share-link system

`trip_share_links` (`migrations/0003_share_links.sql`,
`src/lib/server/share-links.ts`) already exists, but it's a **collaborator**
invite: redeeming a token requires sign-in (`redeemShareLink`) and grants a
`trip_shares` row with `viewer`/`editor` permission inside the authed app. It
is not usable as-is for anonymous public viewing — reuse its token-generation
pattern (`generateToken()`, 32 random bytes base64url) and its
one-token-per-trip shape, but the public route needs its own table so
enabling public sharing can never be confused with granting collaborator
access.

## Share-token model

- New table, e.g. `trip_public_links`: `trip_id` (PK, FK → `trips.id` cascade
  delete), `token` (unique, same generator as `trip_share_links`),
  `created_at`, `revoked_at` (nullable).
- One active public token per trip (mirrors the collaborator link's
  one-row-per-trip shape) — simplest to reason about and to revoke. A second
  "regenerate" action deletes-and-reinserts rather than allowing multiple
  live tokens, so an old leaked link can't keep working after rotation.
- Read-only, always: no role column. The public route never grants write
  access, so there's nothing analogous to `trip_shares` on this path.
- Revocation is owner-only, from the trip's existing settings surface
  (alongside the collaborator link toggle) — set `revoked_at` (or hard
  delete; soft-delete gives an audit trail for "was this ever public").
- Token itself is the only credential — unguessable (256 bits of entropy,
  same as the existing token) stands in for auth. No expiry by default;
  add one later only if abuse shows up.

## Route shape

`/s/[token]` — deliberately not `/trips/[id]?share=...` or nested under
`/trips`, so it never inherits `/trips`' auth-gated layout logic and reads
unambiguously as "public" in server logs/analytics. Lookup is token → trip_id
(`SELECT trip_id FROM trip_public_links WHERE token = ? AND revoked_at IS
NULL`), same query shape as `getShareLink`.

## What the SSR page exposes

- `+page.server.ts`: on miss/revoked token, 404 (not a redirect — there's no
  "sign in and it'll appear" story here, unlike `/trips/[id]`'s redirect to
  `/`). On hit, load the trip doc read-only — same shape as
  `trips/[id]/+page.server.ts` (`{ trip, role: 'viewer' }`) minus anything
  owner-only.
- `+page.svelte`: reuse `TripView` in its existing read-only mode
  (`photosEditable={false}`, same as `/demo`) — no editor chrome, no
  Sidebar/BottomBar account affordances, no "Feedback" dialog. A visitor who
  isn't signed in must never see any UI implying they can act on the trip.
  A lightweight "Made with Zarparia" + sign-up CTA replaces the app chrome,
  same spot the demo banner occupies today.
- Photos: same photosEditable=false path as `/demo`; confirm the client-side
  `/api/trips/[id]/photos` fetch path checks the public-token grant, not
  session auth, before serving photos for a token-loaded trip — otherwise a
  public page silently 401s on photos.
- No account UI, no admin surfaces, no write endpoints reachable from this
  route at all (defense in depth beyond just not rendering the buttons).

## Per-trip OG on this route

Same `data.og` mechanism as `/demo` (Phase 6 item 1, already shipped):
`+page.server.ts` returns `og: { title, description, image?, url }`.
- `title`: EN trip title + " — Zarparia" (mirrors the demo page's
  `loc(trip, trip.title, 'en')` — OG consumers don't carry Accept-Language).
- `description`: trip `eyebrow` (EN) if set, else a generic "A trip planned
  with Zarparia" fallback — do not synthesize destination/date-range copy
  from segment data without a design pass.
- `image`: **open question.** No per-trip image exists today. Options:
  (a) static Zarparia OG card for all shared trips (fast, no data risk); (b)
  generate a card server-side from the trip's cover emoji/title (real
  per-trip visual, more build cost, needs a rendering approach — e.g.
  Workers-compatible image generation); (c) first uploaded photo, once
  photo-delete Undo (Phase 6 item 1b) and privacy review below land. Default
  recommendation: ship with (a), revisit (b)/(c) once the route has traffic
  worth the investment.
- `url`: `${url.origin}/s/${token}` — the canonical share URL, not
  `/trips/[id]`, so an unfurl links back to the same public page.

## Privacy considerations

- Photos and precise locations (`home`, block `coords`) are exactly the
  content an owner may not want indexed/crawled even when they're fine
  sharing the itinerary text. Sharing must be **opt-in per trip** (the
  `trip_public_links` row existing at all *is* the opt-in — no default-on
  migration path for existing trips).
- Public pages are crawlable by design (that's the point of the OG work) —
  add `X-Robots-Tag`/`robots` meta as a per-trip toggle only if an owner
  wants the link semi-private (shareable but not search-indexed); default
  should be indexable, since discovery is the growth-loop goal.
- Consider stripping or approximating `home`/precise `coords` on the public
  render even when the rest of the trip is shown, unless the owner opts
  into "show exact locations publicly" separately — home address in
  particular is a different sensitivity class than "we went to Edinburgh."
- Revoking must take effect immediately (no CDN/cache TTL that outlives a
  revoke) since revocation is the owner's only recourse if they change their
  mind.

## Rollout order

1. `trip_public_links` migration + `share-links`-style server module
   (create/revoke/lookup), no UI yet.
2. `/s/[token]` route: SSR load + read-only `TripView` render, no OG yet —
   ship and verify the auth boundary (no write endpoints reachable, no
   account UI leaks) before adding growth-loop surface area.
3. Per-trip OG on the route (this doc's OG section) — the actual payoff this
   spec exists for.
4. Owner-facing toggle: enable/disable/regenerate the public link from trip
   settings, next to the existing collaborator share-link control.
5. Image strategy (OG open question above) and the indexability toggle, once
   1–4 are live and real sharing behavior is observable.

Dependency: none of this blocks on Phase 6 item 1b (photo-delete Undo), but
step 5's option (c) does.
