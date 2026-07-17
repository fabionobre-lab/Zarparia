---
name: verify
description: Build, launch and drive the Zarparia web app (web/) locally to verify a change end-to-end.
---

# Verify a change in the running app

All commands from `web/`.

## Build + launch

```bash
npm install                      # npm ci may fail: lockfile lags the date-versioned @cloudflare/workers-types
printf 'DEV_AUTH=1\n' > .dev.vars   # enables /auth/dev-login (gitignored; never set in prod)
npm run db:migrate:local         # apply D1 migrations to the local sqlite
npm run build                    # vitest AND wrangler both serve .svelte-kit/cloudflare/_worker.js — rebuild after every source change
npx wrangler dev --port 8788     # serves the BUILT worker; no HMR — rebuild + restart to pick up changes
```

`npm test` also needs `npm run build` first (tests import the built worker).

## Sessions

- Dev login (any email, creates the user if missing): `GET /auth/dev-login?email=you@example.com`
- `fabionobre.ai@gmail.com` matches the default ADMIN_EMAIL → auto-approved + admin (Approvals entry, /admin/approvals).
- Any other email → status `pending` → the `/` gate screen. Approve it via /admin/approvals in an admin session.

## Drive

Playwright: chromium at `/opt/pw-browsers/chromium` (use `executablePath`, don't download). `playwright-core` in the scratchpad is enough.

- Mobile chrome = per-page `nav.bottom-bar` (viewport ≤959px, e.g. 390x844); desktop chrome = `aside.sidebar` (≥960px). There is no top bar anywhere.
- In-app navigation is SPA — after `click()`, use `waitForURL()`; `waitForLoadState('networkidle')` alone reads the old page.
