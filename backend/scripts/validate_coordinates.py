"""
Coordinate validation script for dark_sky_sites.json.

For each site, calls Nominatim reverse geocoding and runs two checks:

  1. WATER CHECK  — does the coordinate land in a water body?
  2. NAME MISMATCH — are the significant name words completely absent from the
                     Nominatim result AND the state/country is also wrong?

The check is tiered:
  - [WATER]        coordinate lands in a body of water — always flagged
  - [MISMATCH]     significant name words absent AND state/country also wrong
                   → likely a genuinely wrong coordinate
  - [NOTE]         significant name words absent BUT state/country match our data
                   → probably a Nominatim coverage gap, lower priority

Usage (from project root or backend/):
    python backend/scripts/validate_coordinates.py [--limit N] [--offset N]

Options:
    --limit N    Only check the first N sites (useful for testing)
    --offset N   Skip the first N sites (useful to resume after a crash)
    --notes      Also print the [NOTE] list at the end (off by default)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import httpx

# Force UTF-8 output on Windows (prevents CP1252 crash on non-ASCII Nominatim results)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]

DATA_PATH = Path(__file__).parent.parent / "data" / "dark_sky_sites.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {
    "User-Agent": "NightQuest-Validation/1.0 (stargazing-planner)",
    "Accept": "application/json",
}
DELAY_SECONDS = 1.1

# ---------------------------------------------------------------------------
# Too-generic words that must NOT count as a name match on their own
# ---------------------------------------------------------------------------
STOP_WORDS = {
    "dark", "sky", "skies", "preserve", "park", "reserve", "site", "area",
    "region", "national", "provincial", "state", "county", "city", "town",
    "village", "the", "of", "and", "de", "la", "le", "los", "las", "san",
    "nature", "natural", "sanctuary", "heritage", "international",
    "observatory", "observatoire", "centre", "center", "place",
    "north", "south", "east", "west", "upper", "lower", "new", "old",
    "great", "little", "big", "mount", "mountain", "lake", "river",
    "valley", "bay", "cape", "island", "islands", "forest",
    "usa", "uk", "us", "canada", "australia",
}

# Country/state synonyms — normalise so "USA" == "United States", etc.
COUNTRY_ALIASES = {
    "usa": "united states",
    "us": "united states",
    "u.s.": "united states",
    "u.s.a.": "united states",
    "uk": "united kingdom",
    "u.k.": "united kingdom",
    # Nominatim returns native-language country names
    "deutschland": "germany",
    "polska": "poland",
    "espana": "spain",
    "espagna": "spain",
    "france": "france",
    "österreich": "austria",
    "magyarország": "hungary",
    "ceska republika": "czech republic",
    "slovensko": "slovakia",
    "nederland": "netherlands",
}

# ---------------------------------------------------------------------------
# Water-body OSM types
# ---------------------------------------------------------------------------
WATER_TYPES = {"water", "sea", "ocean", "bay", "strait", "wetland", "coastline"}
WATER_CATEGORIES = {"waterway"}
WATER_ADDR_KEYS = {"water", "sea", "ocean", "bay", "strait", "river", "canal"}


def _is_water(data: dict) -> bool:
    osm_type = data.get("type", "").lower()
    category = data.get("category", "").lower()
    addr = data.get("address", {})

    if osm_type in WATER_TYPES:
        return True
    if category == "natural" and osm_type in WATER_TYPES:
        return True
    if category in WATER_CATEGORIES:
        return True
    for key in addr:
        if key.lower() in WATER_ADDR_KEYS:
            return True

    display = data.get("display_name", "").lower()
    water_kw = ["sea of ", "ocean", "gulf of ", "strait of ", "bay of "]
    first_part = display.split(",")[0].strip().lower()
    if any(kw in first_part for kw in water_kw):
        return True

    return False


def _significant_words(name: str) -> list[str]:
    tokens = re.findall(r"[a-zA-ZA-\xff]+", name.lower())
    return [t for t in tokens if len(t) >= 4 and t not in STOP_WORDS]


def _haystack(data: dict) -> str:
    display = data.get("display_name", "").lower()
    addr_vals = " ".join(
        str(v).lower() for v in data.get("address", {}).values()
    )
    return display + " " + addr_vals


def _name_matches(site_name: str, data: dict) -> bool:
    """True if at least one significant word from site_name is in Nominatim result."""
    haystack = _haystack(data)
    sig = _significant_words(site_name)
    if not sig:
        return True
    return any(word in haystack for word in sig)


def _state_country_matches(site: dict, data: dict) -> bool:
    """
    True if the state or country stored in our dataset matches the
    Nominatim address (case-insensitive, handles common aliases).
    """
    addr = data.get("address", {})
    nom_vals = {str(v).lower() for v in addr.values()}
    nom_country = addr.get("country", "").lower()
    # normalise aliases
    nom_country = COUNTRY_ALIASES.get(nom_country, nom_country)
    nom_vals.add(nom_country)
    nom_state = addr.get("state", "").lower()
    nom_vals.add(nom_state)

    for field in ("state", "country"):
        our_val = (site.get(field) or "").lower().strip()
        if not our_val:
            continue
        our_val = COUNTRY_ALIASES.get(our_val, our_val)
        if our_val in nom_vals:
            return True
        # partial match: e.g. "Texas" in "Texas, United States"
        if any(our_val in v for v in nom_vals):
            return True

    return False


def reverse_geocode(lat: float, lon: float) -> dict | None:
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1,
        "zoom": 16,  # street level — better POI coverage than 10, less noisy than 18
    }
    try:
        r = httpx.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=12)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"    ERROR ({lat}, {lon}): {e}")
        return None


def main(limit: int | None = None, offset: int = 0, show_notes: bool = False) -> None:
    with open(DATA_PATH, encoding="utf-8") as f:
        sites: list[dict] = json.load(f)

    total = len(sites)
    working = sites[offset:]
    if limit is not None:
        working = working[:limit]

    print(f"Validating {len(working)} of {total} sites "
          f"(offset={offset}, limit={limit if limit else 'all'})...\n")

    water_flags: list[dict] = []
    mismatch_flags: list[dict] = []   # state/country also wrong
    note_flags: list[dict] = []       # state/country ok, just no name in Nominatim
    errors: list[dict] = []

    for i, site in enumerate(working):
        idx = offset + i + 1
        name = site.get("name", f"site-{idx}")
        lat = site["lat"]
        lon = site["lon"]

        print(f"[{idx}/{total}] {name} ({lat}, {lon})", end="  ", flush=True)

        data = reverse_geocode(lat, lon)

        if data is None:
            print("-> ERROR")
            errors.append({"index": idx, "name": name, "lat": lat, "lon": lon})
            time.sleep(DELAY_SECONDS)
            continue

        display = data.get("display_name", "(no result)")
        is_water = _is_water(data)
        name_ok = _name_matches(name, data)
        geo_ok = _state_country_matches(site, data)

        flags = []

        if is_water:
            flags.append("WATER")
            water_flags.append({
                "index": idx, "name": name, "lat": lat, "lon": lon,
                "osm_type": data.get("type"),
                "osm_category": data.get("category"),
                "display_name": display,
            })

        if not name_ok:
            sig_words = _significant_words(name)
            entry = {
                "index": idx, "name": name, "lat": lat, "lon": lon,
                "keywords": sig_words,
                "nominatim_state": data.get("address", {}).get("state", ""),
                "nominatim_country": data.get("address", {}).get("country", ""),
                "display_name": display,
            }
            if not geo_ok:
                flags.append("MISMATCH")
                mismatch_flags.append(entry)
            else:
                flags.append("note")
                note_flags.append(entry)

        status = ", ".join(f for f in flags if f != "note") or "OK"
        if "note" in flags and not any(f in flags for f in ("WATER", "MISMATCH")):
            status = "(note)"
        print(f"-> {status}")
        if flags and flags != ["note"]:
            print(f"    Nominatim: {display[:110]}")
        elif "note" in flags and show_notes:
            print(f"    Nominatim: {display[:110]}")

        time.sleep(DELAY_SECONDS)

    # ── Summary ──────────────────────────────────────────────────────────────

    print("\n" + "=" * 70)
    print(f"VALIDATION COMPLETE  ({len(working)} sites checked)")
    print("=" * 70)

    # --- WATER ---
    print(f"\n[WATER] {len(water_flags)} sites - coordinate lands in a water body")
    print("-" * 60)
    if water_flags:
        for f in water_flags:
            print(f"  [{f['index']}] {f['name']}")
            print(f"       lat={f['lat']}, lon={f['lon']}")
            print(f"       osm type={f['osm_type']}, category={f['osm_category']}")
            print(f"       Nominatim: {f['display_name'][:110]}")
    else:
        print("  (none)")

    # --- MISMATCH (high priority) ---
    print(f"\n[NAME MISMATCH] {len(mismatch_flags)} sites - name words absent AND state/country wrong")
    print("-" * 60)
    if mismatch_flags:
        for f in mismatch_flags:
            print(f"  [{f['index']}] {f['name']}")
            print(f"       lat={f['lat']}, lon={f['lon']}")
            print(f"       Keywords checked: {f['keywords']}")
            print(f"       Nominatim state: {f['nominatim_state']} | "
                  f"country: {f['nominatim_country']}")
            print(f"       Nominatim: {f['display_name'][:110]}")
    else:
        print("  (none)")

    # --- NOTES (low priority, off by default) ---
    if show_notes:
        print(f"\n[NOTES] {len(note_flags)} sites - name words absent but state/country match "
              "(likely Nominatim coverage gap, lower priority)")
        print("-" * 60)
        if note_flags:
            for f in note_flags:
                print(f"  [{f['index']}] {f['name']}")
                print(f"       lat={f['lat']}, lon={f['lon']}")
                print(f"       Keywords: {f['keywords']}")
                print(f"       Nominatim: {f['display_name'][:110]}")
        else:
            print("  (none)")
    else:
        print(f"\n[NOTES] {len(note_flags)} sites have no name overlap but correct "
              "state/country - likely Nominatim coverage gaps.")
        print("        Re-run with --notes to see full list.")

    # --- ERRORS ---
    if errors:
        print(f"\n[ERRORS] {len(errors)} sites could not be checked")
        print("-" * 60)
        for e in errors:
            print(f"  [{e['index']}] {e['name']}  ({e['lat']}, {e['lon']})")

    print(f"\nSummary: {len(water_flags)} water, "
          f"{len(mismatch_flags)} mismatches, "
          f"{len(note_flags)} notes, "
          f"{len(errors)} errors")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Validate dark_sky_sites.json coordinates via Nominatim."
    )
    parser.add_argument("--limit", type=int, default=None,
                        help="Only check the first N sites.")
    parser.add_argument("--offset", type=int, default=0,
                        help="Skip the first N sites (resume after a crash).")
    parser.add_argument("--notes", action="store_true",
                        help="Print the low-priority notes list too.")
    args = parser.parse_args()
    main(limit=args.limit, offset=args.offset, show_notes=args.notes)
