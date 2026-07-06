# Trips — Fabio & Liana

A dependency-free, offline-capable travel itinerary PWA. One generic engine
renders any trip from a JSON config file. No npm, no build step: GitHub Pages
serves the repo as-is.

**Live:** https://fabionobre-lab.github.io/UK-Spring-2026/

| Page | Purpose |
|---|---|
| `index.html` | Trip picker — lists trips from `trips/manifest.json` |
| `app.html?trip=<id>` | Generic engine — renders `trips/<id>.json` |
| `legacy.html` | The original single-file UK Spring 2026 app (kept for one release; the pre-refactor original is also tagged `v1-single-file`) |

## Adding a trip

1. Write `trips/<id>.json` conforming to [`schema/trip.schema.json`](schema/trip.schema.json).
   Start from [`trips/rome-2026.json`](trips/rome-2026.json) (small) or
   [`trips/uk-spring-2026.json`](trips/uk-spring-2026.json) (full-featured). Minimal skeleton:

   ```json
   {
     "id": "my-trip",
     "title": { "en": "My Trip" },
     "languages": ["en"],
     "defaultLanguage": "en",
     "segments": [
       {
         "id": "city",
         "title": { "en": "City Name" },
         "subtitle": { "en": "1 – 3 January 2027" },
         "theme": "navy",
         "plans": [
           {
             "id": "main",
             "days": [
               {
                 "date": "2027-01-01",
                 "title": { "en": "Arrival" },
                 "blocks": [
                   { "time": "10:00", "dotColor": "#1e3a5f",
                     "title": { "en": "Do a thing" }, "tags": ["s"],
                     "description": { "en": "Details." },
                     "mapsUrl": "https://maps.google.com/?q=Somewhere" }
                 ]
               }
             ]
           }
         ]
       }
     ]
   }
   ```

2. Validate: `python -m pip install jsonschema` once, then
   `python tools/validate_trip.py`.
3. Add an entry to `trips/manifest.json`:

   ```json
   { "id": "my-trip", "title": { "en": "My Trip" },
     "dates": { "start": "2027-01-01", "end": "2027-01-03" },
     "status": "upcoming", "cover": "🗺️" }
   ```

4. Push. That's it — no engine edits. The service worker picks new trips up
   from the manifest automatically.

Schema notes:

- Every user-visible string is an object keyed by language code
  (`{"en": ..., "pt": ...}`). The language toggle appears only when
  `languages` has more than one entry; plan tabs appear only when a segment
  has more than one plan.
- Dates are ISO 8601 (`2026-04-15`). Weekday/date labels are derived from
  them via `Intl.DateTimeFormat` — never stored. The optional `locales` map
  controls formatting (e.g. `{"en": "en-GB"}` for "17 April" ordering).
- `theme` selects CSS custom properties in `assets/app.css`
  (`tartan` green, `navy` blue; unknown names fall back to tartan).
- Live weather (Open-Meteo, keyless) is fetched per segment's `weather`
  coordinates — `hourly` granularity gives per-block badges, `daily` gives
  day highs/lows. Trips whose last day is in the past skip live fetch and
  show each day's optional `staticWeather` instead.
- Photo spots pull thumbnails from Wikipedia by page title (`wiki`), with
  optional `fallbackImg`.

## Local testing

```
python -m http.server 8000
# open http://localhost:8000/
```

A server is required: the engine loads trip JSON with `fetch()`, which does
not work from `file://`.

## Deploying

Push to `main`. GitHub Pages serves the repo directly. When you change engine
files (`app.html`, `assets/`, `index.html`), bump `CACHE_VERSION` in
[`sw.js`](sw.js) so installed PWAs drop their cached shell.

## Architecture

- **Split assets** (`app.html` + `assets/app.css` + `assets/app.js`) rather
  than a single file: the service worker precaches the whole shell either
  way, so a single file would buy no offline benefit and cost readability.
- **Offline**: cache-first for the app shell and trip JSON (precached at
  service-worker install, trip list read from `trips/manifest.json`);
  network-first with cache fallback for weather, Wikipedia thumbnails, and
  fonts. A trip viewed once renders in airplane mode.
- `tools/` holds dev-only scripts (migration, validation, screenshot parity,
  icon generation) — nothing in it ships to the client.

See [`PROJECT_BIBLE.md`](PROJECT_BIBLE.md) for engine internals and the
decision log.
