# Zarparia — CLAUDE.md

> **The repo folder is `C:\AI\TravelApp\UK-Spring-2026`.** Product names in this
> family do not match folder names. See `C:\AI\AriaNobre\FAMILY-STANDARDS.md` §00.

App orientation (stack, commands, architecture, data/backups): `web/CLAUDE.md`.

**Session rule (Fabio, 2026-08-17): load the `/simple-english` skill (STE
pragmatic mode) at session start.** Its rules bind every reply to Fabio and
every user-facing string in this app. A SessionStart hook in
`.claude/settings.json` injects a reminder; the rule holds even when the hook
fails.

## Who this is for — read before any design decision

Zarparia is a **multi-user public product, not a personal tool**. Open
self-serve signup, gated by owner approval while pre-launch. **Users are
worldwide** — primary markets UK, Brazil and USA, but anyone anywhere, in any
timezone, on any device. It is one product in the **Aria Nobre product family**
(with Nobria, Saldaria, Ferosia), built by one company: "family" here always
means that product line, never anyone's household. Fabio is owner and operator,
and the house rules below are about how he wants the work done.

So: never design for one user, one region or one device. Data identical for
every user belongs in one global store fetched once, not per user, per device
or per edge location. A design that works for the owner today and degrades as
real users arrive is a bug, not a tradeoff.

Canonical statement, and the place to correct it: `FAMILY-STANDARDS.md` §00 in
`C:\AI\AriaNobre`. It is repeated here because a `CLAUDE.md` only loads for the
repo being worked in, so cross-repo corrections do not propagate on their own.

## House rules

- A user-visible feature is not done until its /guide entry is updated (and /roadmap if it changes the public plan).
- Primary deploy path: push to `main` — GitHub Actions verifies (svelte-check +
  vitest) then deploys the Worker (`.github/workflows/deploy.yml`). Pushing to
  main IS deploying; ask Fabio before pushing.
- Manual fallback: deploy ONLY via `cd web && npm run deploy` as a single command. The Bash shell
  resets to the repo root on every call (no config there), so the `cd web` must
  ride along each time. Never run a bare `npx wrangler deploy` — from the root it
  finds no config and drops into wrangler's setup wizard, which auto-answers "yes"
  non-interactively and scaffolds junk (root `wrangler.jsonc`, `.gitignore` edits)
  while trying to deploy the whole repo as static assets.

## Aria Nobre family design contract

Zarparia (the SvelteKit app in `web/`) is part of the Aria Nobre app family
(with Nobria and Saldaria). Shared design tokens and UI/UX rules live in
`C:\AI\AriaNobre\design\DESIGN.md` and `design\aria-nobre-tokens.css` (synced
here as `web/src/styles/aria-nobre-tokens.css` — GENERATED, never edit; edit
the source and run `node design/sync-tokens.mjs` from the AriaNobre repo).
Accent: green; buttons stay pill-shaped (logged voice exception). The repo-root
static engine is FROZEN and exempt from the family contract. Focus ring:
gold-600 light / gold-300 dark, family-wide.

Round-2 audit, verification and phased plan: `AriaNobre/UI-UX-AUDIT-2026-07-17-R2.md`,
`UI-UX-AUDIT-R2-VERIFICATION.md`, `DESIGN-CONSISTENCY-PLAN-R2.md` (decisions
approved 2026-07-17; Phases 1–4 implemented on this app's `claude/design-r2-p0`).
