"""Validate all trip files in trips/ against schema/trip.schema.json,
and cross-check trips/manifest.json entries point at existing files.

Usage: python tools/validate_trip.py          (requires: python -m pip install jsonschema)
"""
import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parent.parent
schema = json.loads((ROOT / "schema" / "trip.schema.json").read_text(encoding="utf-8"))

failed = False
manifest = json.loads((ROOT / "trips" / "manifest.json").read_text(encoding="utf-8"))
for entry in manifest:
    f = ROOT / "trips" / f"{entry['id']}.json"
    if not f.exists():
        print(f"MANIFEST ERROR: {entry['id']} has no {f.name}")
        failed = True

for f in sorted((ROOT / "trips").glob("*.json")):
    if f.name == "manifest.json":
        continue
    trip = json.loads(f.read_text(encoding="utf-8"))
    try:
        jsonschema.validate(trip, schema, format_checker=jsonschema.FormatChecker())
    except jsonschema.ValidationError as e:
        print(f"{f.name}: INVALID — {e.message} (at {'/'.join(map(str, e.absolute_path))})")
        failed = True
        continue
    if trip["id"] != f.stem:
        print(f"{f.name}: INVALID — id {trip['id']!r} does not match filename")
        failed = True
        continue
    print(f"{f.name}: OK")

sys.exit(1 if failed else 0)
