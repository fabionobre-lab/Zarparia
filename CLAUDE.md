## House rules

- A user-visible feature is not done until its /guide entry is updated (and /roadmap if it changes the public plan).

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
