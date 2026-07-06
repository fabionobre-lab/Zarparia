# PROJECT BIBLE — Generic Trip Engine

Reference for anyone (human or AI) working on this codebase. The README
covers day-to-day usage; this file covers internals and history.

> The original PROJECT_BIBLE.md documented the pre-refactor single-file app.
> It was never committed (it briefly contained a GitHub PAT and was deleted
> during the July 2026 security cleanup), so this is a fresh document. The
> old app itself is preserved at `legacy.html` and at tag `v1-single-file`.

## What this is

A static, dependency-free travel itinerary PWA on GitHub Pages. A generic
engine (`app.html` + `assets/`) renders any trip described by a JSON file in
`trips/`. The first trip, UK Spring 2026 (10 days: London pre-trip /
Edinburgh with two plan variants / London road trip), was migrated from a
hardcoded single-file app with verified pixel/content parity.

## File map

```
index.html               trip picker; lists trips/manifest.json
app.html                 engine shell (static HTML skeleton)
assets/app.css           engine styles; themes as CSS custom properties
assets/app.js            engine logic; no trip data
trips/manifest.json      [{ id, title, dates{start,end}, status, cover }]
trips/<id>.json          one file per trip (schema/trip.schema.json)
schema/trip.schema.json  JSON Schema (2020-12), strict additionalProperties
manifest.webmanifest     PWA manifest (icons in assets/)
sw.js                    service worker; CACHE_VERSION at top
legacy.html              pre-refactor single-file app (remove after a release)
tools/                   dev-only scripts, nothing ships:
  extract_trip.py        one-time D/T -> trip JSON migration (auditable)
  normalize_encoding.py  one-time \uXXXX -> UTF-8 normalization
  validate_trip.py       schema + manifest validation for trips/*.json
  capture_baseline.cjs   Playwright screenshot matrix for parity checks
  make_icons.cjs         renders the PWA icons from an inline SVG
```

## Engine internals (assets/app.js)

**State**: `trip` (loaded JSON), `lang`, `dayIdx` (global index across all
segments), `planBySeg` (segment id → selected plan id), `flatDays` (flattened
[segment, day] list for nav), `isPast`, per-segment weather caches, Wikipedia
thumbnail cache.

**Rendering** is innerHTML string-building, one day at a time, mirroring the
original app: day header (derived date label, title, note, weather summary,
optional banner) → route card → timeline blocks → footer. `renderHero()`
applies the segment theme class and rebuilds the language toggle / plan tabs;
`renderNav()` rebuilds day buttons with separators between segments.

**Interaction globals** `setL(lang)`, `setV(planId)`, `sd(dayIdx)` are kept
window-level on purpose — the parity capture tool drives them, same as it
drove the old app.

**Dates**: day labels ("Friday, 10 April" / "Sexta-feira, 10 de abril") are
composed from `Intl.DateTimeFormat.formatToParts` — weekday, then `', '`,
then the remaining parts (the explicit comma matches the original app's
labels; plain `format()` in en-GB gives "Friday 10 April"). Short nav labels
are the first 3 chars of the long weekday, capitalized ("sexta-feira" →
"Sex"). Locale per language comes from the trip's optional `locales` map.

**Weather** (Open-Meteo, no key):
- Per segment `weather{lat, lon, granularity, timezone}`; date range derived
  from the selected plan's first/last day.
- `hourly`: per-block badges matched to the block's hour (minutes ≥30 round
  up), day summary = high/low + dominant weather code over 07:00–22:00.
- `daily`: one high/low/emoji per day, also used for per-block badges.
- Past trips (last day < today) skip fetching entirely and render each day's
  `staticWeather` if present. Live fetch failures fall back the same way.

**Plan variants**: a segment with >1 plan gets tabs in the hero. Blocks may
carry `diff{kind: added|changed|kept, reason}` annotations; they render only
on plans that define `diffLabels` (the merged UK plan), prefixed by the
per-kind label from the trip data.

**Route card**: collects `q=` place queries from block `mapsUrl`s plus
`waypoints[].query`, builds `google.com/maps/dir/<q1>/<q2>/...` with
`?travelmode=` from the day's `routeMode`. Needs ≥2 places to render. Stop
names truncate at 20 chars.

**Photo spots**: Wikipedia REST `page/summary/<wiki>` thumbnails, cached in
memory, `fallbackImg` on error, re-render on arrival. Spot names are
single-language strings (not localized) — carried over from the original.

**Tags**: block tags are keys into the trip-level `tags` vocabulary
(label per language + `style` ∈ sight/food/birthday/booking/logistics/fullday
mapped to chip colors in CSS).

**Theming**: `.theme-<name>` on `.shell` sets `--hero-bg`, `--hero-eyebrow`,
`--accent`, plus a hero background pattern. Defined: `tartan` (green + gold
grid), `navy` (blue + diagonal). Unknown names fall back to tartan defaults.
Adding a theme is an engine (CSS) change by design — trips reference themes
by name.

## Service worker (sw.js)

- Same-origin: cache-first with `ignoreSearch` (so `app.html?trip=x` hits the
  precached `app.html`); misses are cached at runtime.
- Install precaches the shell plus every `trips/<id>.json` named in
  `trips/manifest.json` — adding a trip never touches sw.js.
- Cross-origin (weather, Wikipedia/Wikimedia, fonts): network-first, cache
  fallback — last-seen data renders offline.
- **Bump `CACHE_VERSION` whenever engine files change**, or installed PWAs
  keep serving the old shell.

## Parity testing

`tools/capture_baseline.cjs` screenshots every UI state (for the UK trip:
10 days × 2 languages × 2 plans = 40). It blocks Open-Meteo and
Wikipedia/Wikimedia requests (and service workers, whose fetches bypass
Playwright routing) for determinism, allows Google Fonts, and expands the
internal scroll area for full-page shots. Needs playwright installed
somewhere reachable (`NODE_PATH=... node tools/capture_baseline.cjs
[fileOrUrl] [outDir]`; engine URLs need a local server).

Migration evidence (July 2026, screenshot sets kept locally, gitignored):
against the post-encoding baseline, the engine produced 28/40 byte-identical
text states; the other 12 differed only by the intended static-weather
display. Days 8–9 were pixel-identical; Edinburgh days matched below the
(new) plan tabs to ≤13 antialiased pixels.

## Facts that keep getting corrected

- Home base is **South Hampstead, NW6 3RS** — *not* Kilburn. This has been
  wrong before; keep it right in any text you touch.
- UK Spring 2026 happened (April 2026). It is an archive trip: render
  fidelity matters, live data does not.

## Key decisions log

Pre-refactor decisions (reconstructed — the original log was lost with the
old bible):

- **No framework, no build step, no npm at runtime.** GitHub Pages serves
  files as-is. Hard constraint, reaffirmed for the refactor.
- Bilingual EN/PT-BR from day one; PT is Brazilian Portuguese.
- Open-Meteo for weather (keyless), Wikipedia REST for photo thumbnails,
  Google Maps deep links + multi-stop day-route URLs.
- Edinburgh kept two plan variants ("Liana's plan" vs the executed merged
  plan) with per-block diff annotations.

Refactor decisions (July 2026):

1. **Trip data as JSON, engine generic** — segments/days iterated, no index
   math; plan variants and languages are counts, not special cases.
2. **Split assets** over single-file `app.html`: the SW precaches the shell
   either way; split wins on maintainability.
3. **Day labels derived from ISO dates** via Intl formatToParts (explicit
   comma joins to match the original's label style); `locales` map in trip
   JSON because bare `en` formats US-style.
4. **Dead per-day `wx` data repurposed** as `staticWeather` for past-trip
   display (the old app stored it but never read it).
5. **Warnings/notes dereferenced inline** into blocks (old app kept them as
   keys into the translations table); trip-specific strings (tag labels,
   diff prefixes, footers) live in trip JSON so the engine stays generic.
6. **Strict schema** (`additionalProperties: false`) and a strict extractor
   (unknown keys abort) — both caught real undocumented fields during
   migration (`kmTotal`, `wx`).
7. **Encoding normalized first** (all `\uXXXX` → literal UTF-8) as its own
   phase; this fixed a live CSS bug (`content:'📷'` is JS syntax,
   not CSS — placeholders showed literal text instead of 📷).
8. Migration bugs *not* reproduced: the old app's init-theme bug (green hero
   on the first London render) and stale day-of-week labels for non-current
   segments after language switch.
9. PWA: cache-first shell per plan; trip list drives precaching; manual
   `CACHE_VERSION` bump on engine changes.
10. `legacy.html` kept for one release post-cutover; pre-refactor app tagged
    `v1-single-file`.
