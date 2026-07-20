# Zarparia ↔ Saldaria: budget integration spec

Status: **proposal / design** (approved direction 2026-07-20; no code yet).
Scope: how Zarparia's trip budget connects to Saldaria for actual-spend
tracking and cost-splitting, instead of Zarparia rebuilding either.

## 1. Principle — division of labour, not a merge

Zarparia and Saldaria are both trip-centric but point in opposite directions in
time. Neither should reimplement the other.

| | Owns | Direction |
|---|---|---|
| **Zarparia** | The **estimate** — cost per stop, day/plan/trip totals, the budget bar, plan-comparison — all inside the itinerary. | Before the trip (planning) |
| **Saldaria** | The **actuals** — real expenses, who-paid/who-owes, multi-currency balances, settle-up. | During / after (reconciliation) |

Consequence for the budget roadmap:

- **Phase 1 (shipped):** estimate + budget bar. Stays in Zarparia. No overlap.
- **Phase 2 (this spec):** "track actual spend" becomes a **Saldaria
  integration**, not a home-grown expense log.
- **Phase 3 (dropped from Zarparia):** multi-currency + group splitting is
  Saldaria's core; Zarparia delegates entirely.

## 2. The bridge: a Zarparia trip ↔ a Saldaria group

Both apps model a "trip"/group. The integration is a **1:1 link** between a
Zarparia trip and a Saldaria group, established once, then used for hand-off and
read-back.

### Data model (Zarparia side)

Add one optional link to the trip document (`trip.schema.json` /
`trip-engine.ts`):

```jsonc
// Option A — explicit (clearest):
"saldaria": { "groupId": "<id>" }        // resolve to a URL app-side

// Option B — generic (looser coupling, no sibling name in the public schema):
"ledger": { "provider": "saldaria", "id": "<id>", "url": "https://…" }
```

**Decision needed:** explicit `saldaria` field vs generic `ledger`. The public
Trips repo already avoids naming the net-wealth sibling; Saldaria is openly
cross-promoted on the house site, so naming it is defensible — but a generic
`ledger` keeps the schema decoupled and future-proof. Recommendation: **generic
`ledger`**, with `provider: "saldaria"` today.

Everything else Zarparia needs already exists: `trip.currency`, per-block
`cost`, and the rollups (`tripCostTotal`, `dayCostTotal`).

## 3. Integration surfaces (phased, cheapest first)

### P2a — deep-link hand-off (smallest useful step)
A **"Track spending in Saldaria"** action on a trip:
- If unlinked: create a Saldaria group from the trip (title, currency, members
  seeded from the trip's sharers), store the returned id in `trip.ledger`, then
  open it.
- If linked: open the existing group.

No read-back yet — Zarparia just launches the right Saldaria context. Delivers
the whole "log what we actually spent + split it" story via Saldaria's own UI.

### P2b — read-back (the payoff: estimate vs actual)
Fetch Saldaria's **actual total** for the linked group and show it beside the
estimate in the budget bar:

```
Estimated £515.50  ·  Actual £548.20  ·  +£32.70 vs estimate
```

This closes the estimate → actual → difference loop I called the core of
best-in-class budgeting — **without Zarparia storing a single expense row.**
Read-only; refreshed on trip open. Must degrade gracefully (see §6).

### P3 — split & settle
Fully delegated to Saldaria. Zarparia links out; it never renders balances or
settlements itself.

## 4. API contract (the family expenses/balances API)

The family already exposes a trip-scoped expenses service (the
`create_trip` / `add_member` / `add_expense` / `add_settlement` /
`get_balances` / `get_trip` surface). Mapping:

| Zarparia need | Saldaria call |
|---|---|
| Create the paired group | `create_trip` (name, base currency) |
| Seed the group's people | `add_member` per trip sharer |
| (optional) seed estimates as budget lines | out of scope P2; estimates stay in Zarparia |
| Read the actual total (P2b) | `get_trip` / `get_balances` → sum |

Zarparia **writes once** (create + seed on link) and thereafter **reads**.
Expenses are entered in Saldaria, never in Zarparia.

## 5. Identity & auth

The integration depends on a shared identity so a user's Zarparia trip and
Saldaria group belong to the same person/group.

- Zarparia is moving to **Firebase-as-IdP** (reverses the Google-only login),
  which is what the siblings already use → shared identity across the family
  becomes the enabling primitive. This spec assumes that lands first.
- Group membership is seeded from Zarparia's existing trip-sharing records
  (viewer/editor emails), so the same people are in both places.

## 6. Loose coupling & failure modes (non-negotiable)

- The budget bar's **estimate must render with zero dependency on Saldaria.**
  Read-back (P2b) is additive: if Saldaria is unreachable, unauthenticated, or
  the trip is unlinked, the bar shows the estimate alone — no error surfaced to
  the traveller.
- Read-back is best-effort and cached; never block trip render on it.
- No hard build/deploy dependency between the two apps.

## 7. Currency reconciliation

Zarparia's estimate is single-currency (`trip.currency`). Saldaria keeps
multi-currency actuals with a consolidated per-person balance. For the budget
bar's estimate-vs-actual line, use Saldaria's **consolidated total in the
trip's base currency** so the two figures are comparable; show a small "as
converted" hint, matching Saldaria's own presentation.

## 8. Privacy

- Only the linked group id (and optionally a URL) is stored on the trip;
  Zarparia never mirrors expense rows or balances.
- Linking is an explicit user action; the id is included in data export and
  removed on trip/account deletion like any other trip field.

## 9. Open decisions

1. `ledger` (generic) vs `saldaria` (explicit) field — recommend generic.
2. Does P2b read-back require the viewer to be a Saldaria member, or can the
   trip owner surface an aggregate total to all trip viewers? (privacy call)
3. Timing: gate on Firebase-as-IdP landing in Zarparia first.
4. Where the write-once "create + seed group" runs — client with the user's
   Saldaria session, or a Zarparia server-side call with a shared token.

## 10. Non-goals

- Zarparia will not store expenses, balances, or settlements.
- No two-way sync of the ledger; Zarparia reads an aggregate, nothing more.
- No multi-currency logic in Zarparia beyond formatting the single-currency
  estimate.
