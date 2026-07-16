# Zarparia — Launch Readiness Plan

Phased implementation plan to take Zarparia from "works for me and friends" to open to a wider audience.
Derived from a repo audit (2026-07-16) plus the launch-prep exercise done for the sibling app (patterns marked ♻️ are direct reuses).

**Ordering principle:** everything through Phase 6 runs entirely on free tiers (Workers free plan, D1/R2 free allotments, free monitoring). All recurring-cost items — domain, email sending, ICO fee — and the work hard-blocked on them are deferred to Phase 7, the paid tail before full public launch.

**Status legend:** `[ ]` pending · `[x]` done · `[~]` in progress

---

## Phase 0 — Decisions (free, unblocks everything else)

- [ ] **0.1 Beta model decision** — who gets in and how.
  - Decide: manual approval of every signup (recommended for v1, matches Phase 3 build) vs. open signup; invite-only vs. public "request access."
  - Decide: monetization intent for v1? (Assumed **no** — no billing phase in this plan. Revisit later if that changes.)
- [x] **0.2 Google OAuth app status check** — DONE 2026-07-16 (project `tripmanager-502009`, new Google Auth Platform console):
  - Was: Testing, 2 test users. Actions taken: declared scopes (email/profile/openid non-sensitive + `photospicker.mediaitems.readonly` sensitive), branding URLs (home /privacy /terms) + app name → Zarparia, then **published to In production**.
  - `fabionobre-ai.workers.dev` was accepted as the authorized domain — publishing was NOT blocked on the custom domain (risk retired).
  - Current state: sign-in open to any Google account (approval gate is the bouncer); Photos-connect flow shows Google's "unverified app" interstitial and unapproved-sensitive-scope grants are capped at 100 lifetime until verification is run (Verification centre — optional, do when the interstitial/cap matters). No logo uploaded (deliberate: brand review once, on the real domain, Phase 7).
- [x] **0.3 Backup retention decision** — DECIDED: 35 days (2026-07-16, baked into the privacy policy). — pick the backup retention window (the sibling app used 35 days ♻️). The privacy policy text (1.1) and the backup lifecycle rule (5.1) both depend on this number.
- [ ] **0.4 Secrets inventory** — list all production secrets (Google OAuth client secret, session keys, API keys) in a password manager so they are rotatable. ♻️ the sibling app advisory. (Bitwarden free tier suffices.)

**Exit criteria:** beta model decided, OAuth constraints known, retention number picked.

---

## Phase 1 — Legal pack (free)

Served from the current URL for now; URLs migrate transparently when the domain lands in Phase 7.

- [x] **1.1 Privacy policy** — BUILT 2026-07-16 (`/privacy`, content in `web/src/lib/legal/`) — ✅ owner approved 2026-07-16. — new route (e.g. `/privacy`), bilingual (en + pt) like the rest of the app.
  - Must cover, honestly and plainly ♻️ (the sibling app draft is the template, adapted):
    - What is stored: account (email, name, avatar from Google), trips/itineraries incl. locations and dates, shared-trip grants, feedback, **cached Google Photos images in R2**, OAuth tokens for the MCP connector.
    - Processors: Cloudflare (Workers/D1/R2), Google (sign-in, Photos). EU–US Data Privacy Framework language.
    - Cookies: `session`, `trips.locale`, `trips.theme` — all essential, no tracking cookies (this section doubles as the cookie disclosure).
    - User rights: export and deletion via the in-app flows (built in Phase 2 — same release, so the policy never overpromises).
    - Backup retention window — the number decided in 0.3.
    - Google Photos specifics: what is cached, that disconnecting/deleting removes cached copies.
  - Owner sign-off required before real signups. ♻️ "Review these before real users sign up."
- [x] **1.2 Terms of service** — BUILT 2026-07-16 (`/terms`) — ✅ owner approved 2026-07-16. — new route (e.g. `/terms`), bilingual.
  - Early-access framing, acceptable use, liability limits, England & Wales governing law. ♻️
  - Include a "travel information is not advice; verify bookings/times yourself" disclaimer. (No FCA angle needed — simpler than the sibling app.)
  - Support: state the in-app feedback button as the v1 support channel; a `support@` address is added in Phase 7.
- [x] **1.3 Footer + sign-in linkage** — BUILT 2026-07-16 (landing footer, consent line on auth card, links on pending screen + /account). — legal footer (Privacy · Terms) on the landing page and app layout; "By signing in you agree to the Terms and Privacy Policy" on the auth card. ♻️
- [ ] **1.4 Consent screen text fields** — fill in what the free/testing tier allows now (app name, support email, policy/terms URLs if workers.dev is accepted per 0.2). Logo upload and publishing deferred to Phase 7 to avoid Google's brand review running twice. ♻️

**Exit criteria:** both docs live and linked from every entry point.

---

## Phase 2 — GDPR rights: export & deletion (free)

The two CRITICAL gaps. Ship as one unit with tests. ♻️ the sibling app lesson: the deletion cascade had zero test coverage until the pre-ship review — write the regression tests in the same PR here.

- [x] **2.1 Data export** — BUILT 2026-07-16 (`GET /api/account/export`, /account page). — `GET /api/account/export` + a Settings entry point.
  - Contents: user profile, all owned trips (full JSON docs), share grants given/received, feedback submitted, photo metadata; photos themselves as a manifest of R2 objects (or zipped download if size is manageable). JSON, machine-readable (GDPR Art. 20 portability).
  - Guard with `requireUser()`; no admin bypass into other users' exports.
- [x] **2.2 Shared-trip ownership policy** — DECIDED + documented in the legal pages: owned trips die with the account (warned in dialog); received shares revoked. — decide and document before building deletion:
  - Trips the deleted user **owns** that others can edit: deleted with the account; warn in the confirmation dialog. (Ownership transfer is v2.)
  - Shares the deleted user **received**: revoke silently.
- [x] **2.3 Account deletion** — BUILT 2026-07-16 (`DELETE /api/account`, type-to-confirm, ordered idempotent cascade incl. R2; feedback rows deleted, not anonymized). — `DELETE /api/account` + confirmation UI (type-to-confirm).
  - Cascade order matters — a half-deleted account must not still authenticate: revoke OAuth tokens/codes + sessions FIRST, then trips → trip_shares → trip_share_links → trip_photos rows → R2 objects (`photos/<trip_id>/…`) → feedback (or anonymize to keep triage history) → user row LAST.
  - R2 cleanup must be idempotent/re-runnable if the request dies mid-way.
- [x] **2.4 Tests** — vitest + @cloudflare/vitest-pool-workers set up (first tests in the repo); 31 tests green across gate/export/delete/legal. — export completeness (every table with user data represented), deletion cascade order, no cross-user reads in either path, idempotent re-run of a failed deletion. ♻️ the sibling app added ~73 tests in its equivalent pass.

**Exit criteria:** a user can self-serve export and full erasure; both paths tested.

---

## Phase 3 — Access gating: new-user approval (free)

Currently any verified Google account gets an account instantly (`web/src/routes/auth/callback/google/+server.ts` → `upsertGoogleUser`). ♻️ the sibling app pattern: pending state + owner approval, enforced server-side on every data path — the gate is the security wall, not a UI convention. Bonus in the free-first ordering: the gate itself is the main abuse control while WAF rate limiting waits in Phase 7.

- [x] **3.1 Schema** — BUILT 2026-07-16 (migration 0007, existing users backfilled approved). — add `status` (`pending` | `approved` | `rejected`) + `approved_at` to `users`. Existing users backfilled as `approved`.
- [x] **3.2 Enforcement in guards** — BUILT (requireUser 403s non-approved; inline-redirect routes patched; /feedback load + oauth/token issuance also gated after review). — `requireUser()` (web/src/lib/server/guards.ts) rejects non-approved users on every data endpoint, including `/mcp` and photo routes. One choke point, not per-route checks.
- [x] **3.3 Pending screen** — BUILT (bilingual, legal links, browser-verified end-to-end with a fresh pending user). — friendly "your access request is being reviewed" page after first sign-in; no app data loads behind it.
- [x] **3.4 Admin approvals view** — BUILT (`/admin/approvals`, isAdmin double-gated, approve/reject/undo). — extend the existing admin surface (`web/src/lib/server/admin.ts`, `ADMIN_EMAIL`, feedback page pattern): list pending users, approve/reject. Notification is manual/out-of-band until email lands in Phase 7.
- [x] **3.5 MCP + Photos scope check** — BUILT (status re-checked on every /mcp call AND at token issuance; photos routes covered by guards). — verify a pending user's existing OAuth grant or Photos session cannot exercise tools (covered by 3.2 if `/mcp` token validation resolves the user through the same approval check — verify explicitly; ♻️ the sibling app re-checked approval each MCP session).
- [x] **3.6 Tests** — green (see 2.4). — pending user: can sign in, cannot read/write any trip/photo/MCP data; approval flips access without re-login weirdness.

**Exit criteria:** unknown Google accounts land in pending; only admin-approved users touch data. ✅ Met locally 2026-07-16 (adversarial review: no critical/high findings).

> ⚠️ **DEPLOY RUNBOOK NOTE (from the security review):** migration 0007 MUST be applied to the remote D1 (`npm run db:migrate:remote`) **before** the new Worker deploys. The new code reads `users.status` in session validation — deploying the Worker first breaks all sign-ins until the migration lands.

---

## Phase 4 — Trust & self-serve understanding (free)

♻️ the sibling app verdict on the guide: "close to a prerequisite, not a nice-to-have" — approval gates and demos assume a stranger understands the app without the owner explaining it.

- [ ] **4.1 User guide** — dedicated nav destination (e.g. `/guide`).
  - Structure ♻️: **Getting started · The screens · How do I… · Glossary**; bilingual; content in its own module (not the main i18n dictionary); lazy-loaded chunk; "Learn more" deep links from empty states.
  - Deliberately NOT: first-run tour, search, external docs site, PDF. ♻️ (evidence-based call)
  - Adopt the house rule in CLAUDE.md: *a user-visible feature is not done until its Guide entry is updated.* ♻️
- [ ] **4.2 Public roadmap page** — e.g. `/roadmap`, sourced from triaged feedback.
  - Mechanism ♻️: bundled JSON snapshot regenerated at triage time and committed — no live DB exposure, and it structurally enforces that **only admin-triaged items ever go public** (the sibling app had a real incident validating this).
  - Triage-note hygiene ♻️: notes are user-visible — plain language, no commit hashes/internal jargon.
- [ ] **4.3 Onboarding pass** — first-run empty states for a brand-new approved user (no trips yet): create-first-trip prompt, demo link, guide link.

**Exit criteria:** a stranger can be approved, land, and understand the app unaided.

---

## Phase 5 — Ops hardening (free tiers only)

- [x] **5.1 Backups** — DEPLOYED 2026-07-16 (worker `zarparia-backup`, cron 0 3 * * *, version 2ca4b920; bucket `zarparia-backups` + 35-day lifecycle rule live; TRIGGER_TOKEN secret set — value in Fabio's password manager; production smoke backup taken + downloaded + content-verified). BUILT + locally verified 2026-07-16 (`workers/backup/`: daily cron, gzipped full-D1 dump to R2 `zarparia-backups`, 35-day in-worker pruning + documented R2 lifecycle rule, Bearer-gated manual /trigger, `restore.mjs` round-trip tested — backup → drop tables → restore → counts + content match). Deploy recipe in `workers/backup/README.md`.
  - D1: `wrangler d1 export` / D1 export API to a private R2 bucket; lifecycle rule matching the retention window from 0.3. R2 free tier (10 GB) is ample at beta scale.
  - R2 photos: skip for now — recacheable from Google Photos; the D1 photo index is what matters and rides along in the D1 export.
  - Document the restore procedure and test one restore. ♻️
- [x] **5.2 App-level rate limiting** — DONE 2026-07-16. D1-backed fixed-window counters (`web/src/lib/server/ratelimit.ts`, `migrations/0008_rate_limits.sql`) — the native Workers Rate Limiting binding was evaluated and rejected: it's an "unsafe" (non-stable) binding with undocumented Free-plan availability and no documented way to exercise it under `@cloudflare/vitest-pool-workers`, unlike D1 which reuses the app's existing binding and test harness.
  - Wired per-IP and/or per-user on: `POST /oauth/token` (20/min/ip), `GET /oauth/authorize` (30/min/ip), `POST /oauth/register` (5/min/ip), `/mcp` (120/min/ip + 60/min/user), `POST /api/feedback` (5/min/user), `/auth/login/google` + `/auth/callback/google` (shared 20/min/ip), `/join/[token]` (30/min/ip), photo picker-session + import (30/min/user).
  - Per-user daily photo-import cap: 200/day (`user:<id>:photo-import:day`), protecting R2 storage.
  - Fails open on any D1 error (availability over strictness); 10 new tests in `web/test/ratelimit.test.ts` (53 total incl. pre-existing 43).
  - Note: coarser than WAF rules but adequate while the approval gate (Phase 3) keeps the user population small and known. Phase 7 upgrades this.
- [x] **5.3 Cross-user leak audit** — DONE 2026-07-16 (opus, three-vector ♻️). Vectors 2 (server in-memory state) and 3 (server authorization incl. share-role escalation, MCP scoping, is-demo smell) CLEAN. Vector 1 found two HIGHs — both FIXED same day (73 tests green): (a) offline PWA caches leaked a prior user's trips on shared devices → awaited purge on sign-out + purge-on-user-change marker (`web/src/lib/client/userCacheReset.ts`); (b) `gp_access` Google Photos token cookie survived sign-out → cleared at all three session-end points AND bound to user id server-side (mismatch = inert + auto-cleared). Info items: trip slugs are guessable (mitigated by the cache fix; entropy suffix optional later); set ADMIN_EMAIL explicitly in prod env.
  1. **Client storage**: every localStorage/sessionStorage/IndexedDB key and the PWA offline cache — namespaced per user? What happens on account switch on a shared device? (Zarparia has real offline caching — the highest-risk vector here.)
  2. **In-memory/module caches**: any server- or client-side cache keyed without the user id.
  3. **Server authorization**: every endpoint re-checked for owner/role checks (incl. share-link role escalation, MCP tool scoping).
  - ♻️ Code-review smell to hunt: gating on "is demo" where the real question is "is this the owner."
- [x] **5.4 Error monitoring** — BUILT 2026-07-16 (dormant scaffold ♻️): `web/src/lib/client/sentry.ts` exports a pure, unit-tested `scrubSentryEvent` `beforeSend` hook (strips request/response bodies, cookies/headers, and query strings; drops breadcrumbs touching trip/photo/account/feedback content or in risky categories — `data` is dropped from every breadcrumb unconditionally; reduces `user` to a bare id; strips `extra` and `contexts.state`) plus `initSentryIfConfigured(dsn)`, wired from the root layout's `onMount` on `requestIdleCallback` (post-first-paint, never on the critical path — DSN is read from `$env/dynamic/public` in the `.svelte` file and passed in, so the module stays testable under `@cloudflare/vitest-pool-workers`). Package: `@sentry/browser`, not `@sentry/sveltekit` — no server-side instrumentation or build-time source-map plugin wanted; nothing wired server-side, per plan. Confirmed code-split via the `vite build` manifest: `@sentry/browser` is a `dynamicImports`-only chunk, absent from the entry bundle. Stays fully dormant (no import, no network) until `PUBLIC_SENTRY_DSN` is set — not set anywhere yet, so inert in every environment today. 12 new tests (`web/test/sentry-scrub.test.ts`).
- [x] **5.5 Health endpoint** — BUILT 2026-07-16: `GET /api/health` made public (was behind `requireUser`, previously leaking table names to any signed-in user) — now returns only `{ ok: true }` after a `SELECT 1` D1 ping, or `{ ok: false }`/503 on failure. Rate-limited 30/min/ip via the existing `ratelimit.ts` — see the code comment for the write-amplification reasoning: `limit()` always writes a counter row per call whether allowed or denied, so the limiter check runs BEFORE the ping, meaning a client already over budget gets a fast 429 without a second D1 hit. 4 new tests (`web/test/health.test.ts`). Free UptimeRobot check itself is a manual external-account step, not code — still open for Fabio.
- [~] **5.6 Dependency & security pass** — `npm audit` DONE 2026-07-16 in both `web/` and `workers/backup/`: `workers/backup/` is clean (0 vulnerabilities). `web/` has 3 low-severity findings, all the same advisory (`cookie` <0.7.0, GHSA-pxg6-pf52-xh8x) via `@sveltejs/kit` → `@sveltejs/adapter-cloudflare` — no non-breaking fix exists yet: even the latest patch (`@sveltejs/kit@2.69.3`, newer than the installed 2.69.1) still pins `cookie@^0.6.0`; the fix only lands in `@sveltejs/kit@3.0.0` (currently a prerelease, a semver-major bump), and `npm audit fix --force`'s own suggestion — downgrading to `@sveltejs/kit@0.0.30` — is not viable. Left as-is (no `--force`); revisit once SvelteKit 3.0 stabilizes. Also set `ADMIN_EMAIL` explicitly in `wrangler.jsonc` `vars` (the 5.3 leak-audit info item) — verified `.dev.vars` still overrides it for local dev. Still open: the pre-ship review of auth/share-link/MCP-token constant-time comparisons.
- [ ] **5.7 Analytics (optional)** — Cloudflare Web Analytics: cookieless, free, no consent banner needed. ♻️

**Exit criteria:** backed up, rate-limited (app-level), monitored, and audited for cross-user leaks — all at £0/mo.

---

## Phase 6 — Soft launch (free)

Everything needed to onboard a **small, gated beta cohort** exists at this point, at zero recurring cost.

- [ ] **6.1 Pre-beta review** — legal docs owner-approved, deletion cascade re-tested against the final schema, backups restoring, pending-user gate verified live.
- [ ] **6.2 Roadmap & guide freshness** — regenerate the roadmap snapshot; confirm the guide covers Phases 1–5 (house rule 4.1 should make this a no-op).
- [ ] **6.3 Invite the first cohort** — approve in small batches (friends/family + trusted testers, within the ≤100-user OAuth testing cap if 0.2 found the consent screen unpublished); notify manually. Watch Sentry/uptime/feedback for a couple of weeks.

**Exit criteria:** real third-party users using the app safely, before any money is spent.

---

## Phase 7 — Paid tail: subscriptions & wider public launch

All recurring-cost items, deliberately last. Sequence within the phase matters: domain first, since everything else here hangs off it.

- [ ] **7.1 Custom domain** (~£10/yr) — buy and attach to the Worker; workers.dev redirects or is disabled.
  - Unblocks: WAF rules, sender email, consent-screen branding, general trust. ♻️ the sibling app called this "the keystone blocker" — in this plan it's deferred by design; the approval gate + app-level limits carry the beta until now.
- [ ] **7.2 WAF/edge rate limiting** — replace/augment the Phase 5.2 app-level limits with Cloudflare rate-limiting rules on the sensitive surfaces.
- [ ] **7.3 Consent-screen branding (residual)** — publish already done in 0.2 (2026-07-16). Remaining here: logo upload + Google brand review on the real domain, swap authorized domain/URLs from workers.dev, and run the Photos-scope verification in the Verification centre (clears the interstitial + the 100-user sensitive-scope cap).
- [ ] **7.4 Email** (free-to-cheap, needs the domain) — Cloudflare Email Routing for `support@` → personal inbox (free); Email Sending for transactional mail (check current pricing/plan requirements; `cloudflare-email-service` skill covers config + SPF/DKIM/DMARC).
  - Approval notification email ("you're in") — closes the loop on Phase 3's manual gate.
  - Share-invite email — notify a user when a trip is shared with them.
  - Update the Terms with the `support@` address and a response-time expectation. ♻️
- [ ] **7.5 ICO registration** (~£60/yr) — UK data protection fee, tier 1.
  - ⚠️ Deferred as a cost item per plan ordering, but note: this is a **legal duty, not a nicety** — as a data controller for third-party users' personal data (trips, photos, locations) the fee is due once real strangers are onboarded, unless an exemption applies. Treat "end of plan" as *at or before* opening beyond the trusted soft-launch cohort, and verify the exemption question when this item starts.
- [ ] **7.6 Full public launch** — consent screen published, domain live, limits upgraded, ICO done → widen approvals / open the request-access flow to the public.

**Exit criteria:** publicly launched on a real domain, legally registered, with hardened limits and working comms.

---

## Already in place (no action)

- Google-only OAuth sign-in with verified-email check; sessions hashed in D1.
- Per-user auth guards on all state-changing API endpoints; owner-only share management.
- MCP connector on OAuth 2.1 (PKCE, rotating refresh tokens, hashed storage).
- Admin role (`ADMIN_EMAIL`) + feedback submission/triage surface — the seed for Phases 3 and 4.2.
- Demo page with About dialog — the "value before credentials" asset. ♻️
- PWA/offline support; Cloudflare Workers observability flag enabled.
- Cookie footprint is already minimal and essential-only (no consent banner needed, just disclosure).

## Explicitly out of scope for v1 (deliberate, revisit later)

- Monetization/billing (the sibling app's Stripe-webhook-flips-approval pattern is the design to reuse if that changes).
- App-store distribution (Play TWA / iOS wrapper).
- Trip-ownership transfer on account deletion (v1: owned trips die with the account, with a warning).
- Additional sign-in providers.

## Dependency graph (what blocks what)

```
0.3 retention number ──► 1.1 privacy policy, 5.1 backup lifecycle
2.x export/delete ──► referenced by 1.1 (rights mechanism) — ship Phase 1+2 together or in quick succession
3.x approval gate ──► 6.3 soft launch; is also the interim abuse control until 7.2
7.1 domain ──► 7.2 WAF limits, 7.3 consent branding/publish, 7.4 email
7.3 consent publish ──► lifting the ~100-user testing cap (if 0.2 confirms it applies) ──► 7.6 full launch
7.5 ICO ──► due at/before widening past the trusted cohort
```

## Cost profile

- **Phases 0–6 (through soft launch): £0/mo.** Workers/D1/R2 free tiers, Sentry free tier, UptimeRobot free, Cloudflare Web Analytics free.
- **Phase 7 (public launch): ~£70/yr** — domain ~£10/yr + ICO ~£60/yr; email at or near free; Cloudflare paid plan only if beta-scale usage ever outgrows free allotments.
