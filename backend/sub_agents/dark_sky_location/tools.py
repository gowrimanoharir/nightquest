"""
Dark Sky Location tools for Phase 3A.
- distance_tool: haversine calculation between two lat/lon points
- dark_sky_lookup_tool: load dark_sky_sites.json, filter by distance, rank by Bortle + distance
"""
import json
import math
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent.parent / "data" / "dark_sky_sites.json"

_SITES_CACHE: list[dict] | None = None


def _load_sites() -> list[dict]:
    global _SITES_CACHE
    if _SITES_CACHE is None:
        with open(DATA_PATH, encoding="utf-8") as f:
            _SITES_CACHE = json.load(f)
    return _SITES_CACHE


def distance_tool(lat1: float, lon1: float, lat2: float, lon2: float) -> dict:
    """
    Haversine distance between two lat/lon points.
    Returns dict with 'km' and 'miles' (both rounded to 1 decimal).
    """
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    km = R * c
    return {"km": round(km, 1), "miles": round(km * 0.621371, 1)}


def dark_sky_lookup_tool(
    lat: float,
    lon: float,
    max_distance_km: float = 200.0,
    event_type: str | None = None,  # reserved for future weighting; not filtered on
) -> list[dict]:
    """
    Load dark sky sites from dataset, filter to those within max_distance_km of
    the given coordinates, then rank by composite score:
      - Bortle rating weight: 60%  (lower Bortle = darker sky = better)
      - Distance weight:      40%  (closer = better)

    Returns list of site dicts sorted by score descending, each augmented with:
      distance_km, distance_miles, score (0–100), rank (1-based).
    """
    sites = _load_sites()

    results: list[dict] = []
    for site in sites:
        d = distance_tool(lat, lon, site["lat"], site["lon"])
        if d["km"] > max_distance_km:
            continue
        entry = dict(site)
        entry["distance_km"] = d["km"]
        entry["distance_miles"] = d["miles"]
        results.append(entry)

    if not results:
        return []

    # Normalise distance: furthest site in the result set scores 0, closest scores 1
    max_dist = max(r["distance_km"] for r in results)

    for r in results:
        bortle = r.get("bortle_estimate") or 5  # default mid-scale if unknown
        # bortle 1 (best) → bortle_score 100 ; bortle 9 (worst) → 0
        bortle_score = (9 - bortle) / 8 * 100
        # distance_score: 0 km → 100; max_dist → 0
        dist_score = (1 - r["distance_km"] / max(max_dist, 1)) * 100
        r["score"] = round(bortle_score * 0.6 + dist_score * 0.4, 1)

    results.sort(key=lambda x: x["score"], reverse=True)

    for i, r in enumerate(results):
        r["rank"] = i + 1

    return results
