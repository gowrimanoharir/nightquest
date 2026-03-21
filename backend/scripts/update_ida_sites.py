"""
Merges Wikidata IDA-certified dark sky places into dark_sky_sites.json.
- Adds ~60 new IDA places missing from the dataset
- Marks existing matches as certified:true and fills missing website
- Derives bortle_estimate from IDA place type prefix
Run: python scripts/update_ida_sites.py
"""
import json
import re
import requests
from difflib import SequenceMatcher
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / "data" / "dark_sky_sites.json"

BORTLE_BY_TYPE = {
    "sanctuaries": 1,
    "reserves": 2,
    "parks": 2,
    "communities": 4,
    "urban-night-sky-places": 5,
    "unsp": 5,
}

WIKIDATA_QUERY = """
SELECT DISTINCT ?place ?placeLabel ?coord ?countryLabel ?idaId ?website WHERE {
  ?place wdt:P4977 ?idaId .
  OPTIONAL { ?place wdt:P625 ?coord . }
  OPTIONAL { ?place wdt:P17 ?country . }
  OPTIONAL { ?place wdt:P856 ?website . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY ?placeLabel
"""


def fetch_wikidata() -> list[dict]:
    print("Fetching Wikidata IDA places...")
    r = requests.get(
        "https://query.wikidata.org/sparql",
        params={"query": WIKIDATA_QUERY, "format": "json"},
        headers={"User-Agent": "NightQuest/1.0 (dark sky research)"},
        timeout=60,
    )
    rows = r.json()["results"]["bindings"]

    # Deduplicate by IDA ID, prefer rows that have coordinates
    seen: dict[str, dict] = {}
    for row in rows:
        ida_id = row.get("idaId", {}).get("value", "")
        if not ida_id:
            continue
        if ida_id not in seen or (row.get("coord") and not seen[ida_id].get("coord")):
            seen[ida_id] = row

    places = []
    for ida_id, row in seen.items():
        coord_raw = row.get("coord", {}).get("value", "")
        name = row.get("placeLabel", {}).get("value", "")
        country = row.get("countryLabel", {}).get("value", "")
        website = row.get("website", {}).get("value", "")

        # Skip rows with no label or no coords
        if not name or name.startswith("Q") or not coord_raw:
            continue

        # Parse "Point(lng lat)" → lat, lon
        m = re.match(r"Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)", coord_raw)
        if not m:
            continue
        lon, lat = float(m.group(1)), float(m.group(2))

        # Derive place type prefix from IDA ID
        type_prefix = ida_id.split("/")[0] if "/" in ida_id else "parks"
        bortle = BORTLE_BY_TYPE.get(type_prefix, 2)

        places.append({
            "name": name,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "bortle_estimate": bortle,
            "certified": True,
            "website": website or None,
            "country": country or None,
            "state": None,
            "_ida_id": ida_id,
            "_type": type_prefix,
        })

    print(f"  -> {len(places)} unique IDA places with coordinates")
    return places


def name_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def find_match(name: str, existing: list[dict]) -> dict | None:
    best_score = 0.0
    best = None
    for site in existing:
        score = name_similarity(name, site["name"])
        if score > best_score:
            best_score = score
            best = site
    return best if best_score >= 0.75 else None


def main():
    existing: list[dict] = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    print(f"Existing dataset: {len(existing)} sites")

    wikidata_places = fetch_wikidata()

    added = 0
    updated = 0
    skipped = 0

    for wp in wikidata_places:
        match = find_match(wp["name"], existing)
        if match:
            changed = False
            # Ensure certified flag is set
            if not match.get("certified"):
                match["certified"] = True
                changed = True
            # Fill missing website
            if not match.get("website") and wp.get("website"):
                match["website"] = wp["website"]
                changed = True
            # Fill missing country
            if not match.get("country") and wp.get("country"):
                match["country"] = wp["country"]
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
        else:
            # New entry — strip internal keys before adding
            new_site = {k: v for k, v in wp.items() if not k.startswith("_")}
            existing.append(new_site)
            added += 1
            print(f"  ADD [{wp['_type']:12}] {wp['name']} ({wp.get('country','?')})")

    print(f"\nResults: {added} added, {updated} updated, {skipped} already correct")
    print(f"New total: {len(existing)} sites")

    # Write back
    DATA_PATH.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved -> {DATA_PATH}")


if __name__ == "__main__":
    main()
