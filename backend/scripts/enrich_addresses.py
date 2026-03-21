"""
One-time data enrichment script: adds formatted address to dark_sky_sites.json
using Nominatim reverse geocoding (nominatim.openstreetmap.org/reverse).

Address format: "Region/State, Country"
- Sites that already have non-empty state + country fields skip the API call.
- 1-second delay between requests to respect Nominatim rate limits.

Usage (from project root or backend/ directory):
    python backend/scripts/enrich_addresses.py [--dry-run]

The script updates dark_sky_sites.json in place.
A backup is written to dark_sky_sites.json.bak before any changes.
"""
from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path

import httpx

DATA_PATH = Path(__file__).parent.parent / "data" / "dark_sky_sites.json"
BACKUP_PATH = DATA_PATH.with_suffix(".json.bak")

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {
    "User-Agent": "NightQuest-DataEnrichment/1.0 (stargazing-planner)",
    "Accept": "application/json",
}

DELAY_SECONDS = 1.0


def _has_good_address(site: dict) -> bool:
    """Return True if the site already has usable state + country fields."""
    state = (site.get("state") or "").strip()
    country = (site.get("country") or "").strip()
    return bool(state and country)


def _format_address(state: str, country: str) -> str:
    """Combine state/region and country into display string."""
    parts = [p.strip() for p in [state, country] if p.strip()]
    return ", ".join(parts)


def reverse_geocode(lat: float, lon: float) -> tuple[str, str, str]:
    """
    Call Nominatim reverse geocoding. Returns (state, country, formatted_address).
    Falls back to empty strings on error.
    """
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "zoom": 5,          # region/state level — no street detail
        "addressdetails": 1,
    }
    try:
        r = httpx.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=10)
        r.raise_for_status()
        data = r.json()
        addr = data.get("address", {})

        # Extract state-level region
        state = (
            addr.get("state") or
            addr.get("province") or
            addr.get("region") or
            addr.get("county") or
            ""
        )
        # Extract country
        country = addr.get("country") or addr.get("country_code", "").upper()

        formatted = _format_address(state, country)
        return state, country, formatted
    except Exception as e:
        print(f"    Nominatim error ({lat}, {lon}): {e}")
        return "", "", ""


def main(dry_run: bool = False) -> None:
    print(f"Loading: {DATA_PATH}")
    with open(DATA_PATH, encoding="utf-8") as f:
        sites: list[dict] = json.load(f)

    print(f"Total sites: {len(sites)}")

    # Count how many need enrichment
    needs_api = [s for s in sites if not _has_good_address(s)]
    can_derive = [s for s in sites if _has_good_address(s) and not s.get("address")]
    print(f"  Need Nominatim call: {len(needs_api)}")
    print(f"  Can derive from existing fields: {len(can_derive)}")

    if dry_run:
        print("[Dry run] No changes written.")
        return

    # Back up before modifying
    shutil.copy2(DATA_PATH, BACKUP_PATH)
    print(f"Backup written: {BACKUP_PATH}")

    changed = 0

    for i, site in enumerate(sites):
        name = site.get("name", f"site-{i}")

        if site.get("address"):
            # Already enriched — skip
            continue

        if _has_good_address(site):
            # Derive from existing fields without an API call
            site["address"] = _format_address(
                site.get("state", ""), site.get("country", "")
            )
            changed += 1
            continue

        # Need Nominatim
        lat = site["lat"]
        lon = site["lon"]
        print(f"  [{i+1}/{len(sites)}] {name} ({lat}, {lon})")
        state, country, formatted = reverse_geocode(lat, lon)

        if formatted:
            site["address"] = formatted
            if state and not site.get("state"):
                site["state"] = state
            if country and not site.get("country"):
                site["country"] = country
            changed += 1
            print(f"    → {formatted}")
        else:
            print(f"    → (no address found)")

        time.sleep(DELAY_SECONDS)

    # Write updated JSON
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(sites, f, ensure_ascii=False, indent=2)

    print(f"\nDone — enriched {changed} sites. Updated: {DATA_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich dark_sky_sites.json with Nominatim addresses.")
    parser.add_argument("--dry-run", action="store_true", help="Show stats without making changes.")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
