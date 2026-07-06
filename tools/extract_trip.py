"""Phase 2: extract the hardcoded trip data out of index.html into
trips/uk-spring-2026.json in the generic trip schema (schema/trip.schema.json).

Deterministic and auditable: output is a pure function of index.html plus the
explicit config tables below (dates, titles, weather coords) which mirror
values hardcoded in the engine JS (TRIP_DATES, fetchWeather, footer strings).

Strategy: the `T` (translations) and `D` (trip data) object literals are
extracted by bracket matching and evaluated with node (they are plain JS data,
no functions), then transformed field-by-field:
    day:   de/dp dropped (derived from date), te/tp -> title, ne/np -> note,
           bday+bne/bnp -> banner, rm -> routeMode, kmTotal -> kmTotal,
           wx -> staticWeather (dead data in the old app: stored per-day but
           never read; kept as the past-trip weather display), bl -> blocks
    block: t -> time, dot -> dotColor, ie/ip -> title, tg -> tags,
           me/mp -> description, url -> mapsUrl, km -> km (dropped when 0),
           wa/no -> warning/note (dereferenced from T inline),
           wp -> waypoints, ps -> photoSpots, df -> diff
Unknown keys anywhere abort the run so nothing is silently dropped.

Requires node on PATH (dev-time only). Validates the output against
schema/trip.schema.json when the `jsonschema` package is installed.

Usage: python tools/extract_trip.py
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ── Config mirroring engine-hardcoded values ─────────────────────────────
SEGMENT_DATES = {
    "london_pre": ["2026-04-10", "2026-04-11", "2026-04-12"],   # LONPRE_DATES
    "edinburgh": ["2026-04-15", "2026-04-16", "2026-04-17", "2026-04-18", "2026-04-19"],  # TRIP_DATES
    "london": ["2026-04-25", "2026-04-26"],                     # LONDON_DATES
}
WEATHER = {  # from fetchWeather()
    "edinburgh": {"lat": 55.9533, "lon": -3.1883, "granularity": "hourly", "timezone": "Europe/London"},
    "london_pre": {"lat": 51.5074, "lon": -0.1278, "granularity": "daily", "timezone": "Europe/London"},
    "london": {"lat": 51.5074, "lon": -0.1278, "granularity": "daily", "timezone": "Europe/London"},
}
FOOTERS = {  # from render(), same text in both languages
    "london_pre": "London · April 2026 · Fabio & Liana",
    "edinburgh": "Edinburgh April 2026 · Fabio & Liana",
    "london": "Edinburgh & London · April 2026",
}
# gtag() css-class letters -> named chip styles
TAG_STYLE = {"s": "sight", "f": "food", "b": "birthday", "c": "booking", "w": "logistics", "m": "fullday"}
TAG_CLS = {"s": "s", "fr": "s", "lun": "f", "din": "f", "bkf": "f", "cof": "f", "rel": "f", "spe": "f",
           "cel": "b", "bdy": "b", "bkd": "c", "sk": "c", "tra": "w", "log": "w", "dep": "w", "drv": "w",
           "ful": "m", "mu": "s", "nat": "s", "par": "s", "arc": "s", "vpt": "s", "grd": "s", "pal": "s"}
DIFF_KIND = {"add": "added", "chg": "changed", "kp": "kept"}

DAY_KEYS = {"de", "dp", "te", "tp", "ne", "np", "bday", "rm", "bl", "bne", "bnp", "wx", "kmTotal"}
BLOCK_KEYS = {"t", "dot", "ie", "ip", "tg", "me", "mp", "url", "km", "wa", "no", "wp", "ps", "df"}


def extract_object(src: str, varname: str) -> str:
    """Return the {...} literal assigned to `var <varname>=`, via bracket matching
    that is aware of single/double-quoted strings and backslash escapes."""
    m = re.search(r"\bvar %s=\{" % varname, src)
    if not m:
        sys.exit(f"could not find `var {varname}={{` in index.html")
    i = src.index("{", m.start())
    start, depth, in_str, esc = i, 0, None, False
    while True:
        c = src[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == in_str:
                in_str = None
        elif c in "'\"":
            in_str = c
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return src[start : i + 1]
        i += 1


def eval_with_node(t_src: str, d_src: str) -> dict:
    js = f"var T={t_src};var D={d_src};process.stdout.write(JSON.stringify({{T:T,D:D}}));"
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js)
        tmp = f.name
    try:
        r = subprocess.run(["node", tmp], capture_output=True, text=True, encoding="utf-8")
        if r.returncode != 0:
            sys.exit(f"node failed:\n{r.stderr}")
        return json.loads(r.stdout)
    finally:
        Path(tmp).unlink()


def loc(en, pt):
    return {"en": en, "pt": pt}


def conv_block(b: dict, T: dict) -> dict:
    unknown = set(b) - BLOCK_KEYS
    if unknown:
        sys.exit(f"unknown block keys {unknown} in {b.get('ie')!r}")
    out = {"time": b["t"], "dotColor": b["dot"], "title": loc(b["ie"], b["ip"])}
    if b.get("tg"):
        out["tags"] = b["tg"]
    if b.get("me") or b.get("mp"):
        out["description"] = loc(b["me"], b["mp"])
    if b.get("url"):
        out["mapsUrl"] = b["url"]
    if b.get("km"):
        out["km"] = b["km"]
    for src_key, dst_key in (("wa", "warning"), ("no", "note")):
        if b.get(src_key):
            key = b[src_key]
            if key not in T["en"] or key not in T["pt"]:
                sys.exit(f"{src_key} key {key!r} not in T")
            out[dst_key] = loc(T["en"][key], T["pt"][key])
    if b.get("wp"):
        out["waypoints"] = [{"query": w["q"], "name": loc(w["ne"], w["np"])} for w in b["wp"]]
    if b.get("ps"):
        spots = []
        for p in b["ps"]:
            s = {"name": p["n"], "mapsUrl": p["l"]}
            if p.get("wiki"):
                s["wiki"] = p["wiki"]
            if p.get("img"):
                s["fallbackImg"] = p["img"]
            spots.append(s)
        out["photoSpots"] = spots
    if b.get("df"):
        out["diff"] = {"kind": DIFF_KIND[b["df"]["k"]], "reason": loc(b["df"]["en"], b["df"]["pt"])}
    return out


def conv_days(days: list, dates: list, T: dict) -> list:
    if len(days) != len(dates):
        sys.exit(f"day count {len(days)} != date count {len(dates)}")
    out = []
    for day, date in zip(days, dates):
        unknown = set(day) - DAY_KEYS
        if unknown:
            sys.exit(f"unknown day keys {unknown} on {date}")
        d = {"date": date, "title": loc(day["te"], day["tp"]), "note": loc(day["ne"], day["np"])}
        if day.get("rm"):
            d["routeMode"] = day["rm"]
        if day.get("bday"):
            d["banner"] = loc(day["bne"], day["bnp"])
        if day.get("kmTotal"):
            d["kmTotal"] = day["kmTotal"]
        if day.get("wx"):
            d["staticWeather"] = day["wx"]
        d["blocks"] = [conv_block(b, T) for b in day["bl"]]
        out.append(d)
    return out


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    data = eval_with_node(extract_object(html, "T"), extract_object(html, "D"))
    T, D = data["T"], data["D"]
    assert set(D) == {"liana", "merged", "london", "london_pre"}, set(D)

    tags = {}
    for key, en_label in T["en"]["tags"].items():
        tags[key] = {"label": loc(en_label, T["pt"]["tags"][key]), "style": TAG_STYLE[TAG_CLS[key]]}

    def seg(seg_id, title_key, sub_key, theme, plans):
        return {
            "id": seg_id,
            "title": loc(T["en"][title_key], T["pt"][title_key]),
            "subtitle": loc(T["en"][sub_key], T["pt"][sub_key]),
            "theme": theme,
            "weather": WEATHER[seg_id],
            "footer": loc(FOOTERS[seg_id], FOOTERS[seg_id]),
            "plans": plans,
        }

    diff_labels = {
        "added": loc(T["en"]["da"], T["pt"]["da"]),
        "changed": loc(T["en"]["dc"], T["pt"]["dc"]),
        "kept": loc(T["en"]["dk"], T["pt"]["dk"]),
    }
    edinburgh = seg("edinburgh", "tt_edin", "sub", "tartan", [
        {"id": "liana", "label": loc("Liana's Plan", "Plano da Liana"),
         "days": conv_days(D["liana"]["days"], SEGMENT_DATES["edinburgh"], T)},
        {"id": "merged", "label": loc("Alternative Plan", "Plano Alternativo"), "diffLabels": diff_labels,
         "days": conv_days(D["merged"]["days"], SEGMENT_DATES["edinburgh"], T)},
    ])
    edinburgh["defaultPlan"] = "merged"

    trip = {
        "id": "uk-spring-2026",
        "title": loc("UK Spring 2026", "Reino Unido – Primavera 2026"),
        "eyebrow": loc(T["en"]["ey"], T["pt"]["ey"]),
        "languages": ["en", "pt"],
        "defaultLanguage": "en",
        "home": {"name": "Home (South Hampstead)", "postcode": "NW6 3RS", "lat": 51.543, "lon": -0.183},
        "tags": tags,
        "segments": [
            seg("london_pre", "tt_lonpre", "sub_lonpre", "navy",
                [{"id": "main", "days": conv_days(D["london_pre"]["days"], SEGMENT_DATES["london_pre"], T)}]),
            edinburgh,
            seg("london", "tt_london", "sub_london", "navy",
                [{"id": "main", "days": conv_days(D["london"]["days"], SEGMENT_DATES["london"], T)}]),
        ],
    }

    out = ROOT / "trips" / "uk-spring-2026.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(trip, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

    n_days = sum(len(p["days"]) for s in trip["segments"] for p in s["plans"])
    n_blocks = sum(len(d["blocks"]) for s in trip["segments"] for p in s["plans"] for d in p["days"])
    print(f"wrote {out.relative_to(ROOT)}: {len(trip['segments'])} segments, {n_days} plan-days, {n_blocks} blocks")

    try:
        import jsonschema
    except ImportError:
        print("jsonschema not installed - skipping validation (python -m pip install jsonschema)")
        return
    schema = json.loads((ROOT / "schema" / "trip.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(trip, schema, format_checker=jsonschema.FormatChecker())
    print("schema validation: OK")


if __name__ == "__main__":
    main()
