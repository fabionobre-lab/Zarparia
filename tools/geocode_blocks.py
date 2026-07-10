"""Backfill `coords` (lat/lon) onto trip blocks that have a mapsUrl but no
coords yet, by geocoding the block's own destination query via Nominatim.

Scope: only blocks with a mapsUrl AND no existing coords are touched. Blocks
without mapsUrl are skipped by design (travel/logistics legs get no pin).
Waypoints and photoSpots are never geocoded — only the block's own
destination. Idempotent: rerunning does nothing for blocks that already have
coords, and geocode results are cached in tools/geocode_cache.json so reruns
of previously-missed/failed queries are free (cache hits, no network call).

Usage: python tools/geocode_blocks.py
"""
import json
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRIPS = ["uk-spring-2026", "rome-2026"]
CACHE_PATH = ROOT / "tools" / "geocode_cache.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q="
USER_AGENT = "trips-geocoder/1.0 (personal project)"
SLEEP_SECONDS = 1.0


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def extract_query(maps_url: str) -> str | None:
    """Pull the block's own destination query out of a Google Maps URL.
    Handles `?q=...` (used throughout this repo) and, defensively, a
    `/maps/dir/.../<dest>/` waypoint-route URL (take the last segment, i.e.
    the block's own destination, not earlier route waypoints)."""
    m = re.search(r"[?&]q=([^&]+)", maps_url)
    if m:
        return urllib.parse.unquote_plus(m.group(1))
    m = re.search(r"/maps/dir/([^?]+)", maps_url)
    if m:
        segments = [s for s in m.group(1).split("/") if s]
        if segments:
            return urllib.parse.unquote_plus(segments[-1])
    return None


def geocode(query: str, cache: dict) -> dict | None:
    """Return {"lat": float, "lon": float} or None (cached MISS or fresh MISS)."""
    if query in cache:
        return cache[query]

    url = NOMINATIM_URL + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    result = None
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if data:
            result = {
                "lat": round(float(data[0]["lat"]), 5),
                "lon": round(float(data[0]["lon"]), 5),
            }
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, ValueError, TimeoutError) as e:
        print(f"    ! request error for {query!r}: {e}", file=sys.stderr)
        result = None

    cache[query] = result
    time.sleep(SLEEP_SECONDS)
    return result


def process_trip(trip_id: str, cache: dict) -> dict:
    path = ROOT / "trips" / f"{trip_id}.json"
    trip = json.loads(path.read_text(encoding="utf-8"))

    stats = {"geocoded": 0, "cached": 0, "missed": 0, "skipped": 0}
    misses = []

    for segment in trip.get("segments", []):
        for plan in segment.get("plans", []):
            for day in plan.get("days", []):
                for block in day.get("blocks", []):
                    maps_url = block.get("mapsUrl")
                    if not maps_url:
                        stats["skipped"] += 1
                        continue
                    if "coords" in block:
                        stats["skipped"] += 1
                        continue

                    query = extract_query(maps_url)
                    if not query:
                        print(f"  MISS (no parsable query in {maps_url!r})")
                        stats["missed"] += 1
                        misses.append(maps_url)
                        continue

                    was_cached = query in cache
                    coords = geocode(query, cache)
                    if coords:
                        block["coords"] = coords
                        tag = "cached" if was_cached else "geocoded"
                        stats[tag] += 1
                        print(f"  {query} -> {coords['lat']},{coords['lon']} ({tag})")
                    else:
                        stats["missed"] += 1
                        misses.append(query)
                        print(f"  {query} -> MISS")

    path.write_text(json.dumps(trip, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"stats": stats, "misses": misses}


def main() -> int:
    cache = load_cache()
    overall_misses = []
    for trip_id in TRIPS:
        print(f"\n== {trip_id} ==")
        result = process_trip(trip_id, cache)
        save_cache(cache)  # persist after each trip so partial progress isn't lost
        s = result["stats"]
        print(
            f"-- {trip_id}: geocoded={s['geocoded']} cached={s['cached']} "
            f"missed={s['missed']} skipped={s['skipped']}"
        )
        for miss in result["misses"]:
            overall_misses.append((trip_id, miss))

    if overall_misses:
        print("\n== MISSES (flag for manual review; no invented coordinates) ==")
        for trip_id, q in overall_misses:
            print(f"  {trip_id}: {q}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
