"""
Enrich dark_sky_sites.json with real Bortle scores from VIIRS 2024 GeoTIFF.

Samples radiance (nW/cm²/sr) at each site's lat/lon and converts to Bortle scale:
  <= 0.11  → 1  (Exceptional dark sky)
  <= 0.33  → 2  (Truly dark sky)
  <= 1.0   → 3  (Rural sky)
  <= 3.0   → 4  (Rural/suburban transition)
  <= 9.0   → 5  (Suburban sky)
  <= 18.0  → 6  (Bright suburban sky)
  <= 30.0  → 7  (Suburban/urban transition)
  <= 60.0  → 8  (City sky)
  >  60.0  → 9  (Inner-city sky)

Run from repo root: python backend/scripts/update_bortle.py
Deletes the GeoTIFF after completion.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import rowcol

REPO_ROOT = Path(__file__).parent.parent.parent
GEOTIFF_PATH = REPO_ROOT / "viirs_2024_raw.tif"
DATA_PATH = REPO_ROOT / "backend" / "data" / "dark_sky_sites.json"

THRESHOLDS = [
    (0.11, 1),
    (0.33, 2),
    (1.0,  3),
    (3.0,  4),
    (9.0,  5),
    (18.0, 6),
    (30.0, 7),
    (60.0, 8),
]


def radiance_to_bortle(value: float) -> int:
    for threshold, bortle in THRESHOLDS:
        if value <= threshold:
            return bortle
    return 9


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    if not GEOTIFF_PATH.exists():
        print(f"ERROR: GeoTIFF not found at {GEOTIFF_PATH}")
        sys.exit(1)

    sites: list[dict] = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    print(f"Loaded {len(sites)} sites from {DATA_PATH.name}")

    updated = 0
    skipped = 0
    errors = 0

    with rasterio.open(GEOTIFF_PATH) as src:
        print(f"GeoTIFF CRS: {src.crs}")
        print(f"GeoTIFF bands: {src.count}, dtype: {src.dtypes[0]}")
        print(f"Bounds: {src.bounds}\n")

        # Read the first band into memory for fast point sampling
        data = src.read(1).astype(np.float32)
        nodata = src.nodata

        for site in sites:
            lat = site.get("lat")
            lon = site.get("lon")
            name = site.get("name", "?")

            if lat is None or lon is None:
                print(f"  SKIP (no coords): {name}")
                skipped += 1
                continue

            try:
                # Convert lat/lon → pixel row/col using the raster's transform
                row, col = rowcol(src.transform, lon, lat)

                # Bounds check
                if not (0 <= row < data.shape[0] and 0 <= col < data.shape[1]):
                    print(f"  OUT OF BOUNDS: {name} ({lat}, {lon}) → row={row}, col={col}")
                    skipped += 1
                    continue

                radiance = float(data[row, col])

                # Treat nodata / negative / NaN as unknown → keep existing or set to None
                if nodata is not None and radiance == nodata:
                    print(f"  NODATA: {name}")
                    skipped += 1
                    continue
                if np.isnan(radiance) or radiance < 0:
                    print(f"  INVALID ({radiance:.4f}): {name}")
                    skipped += 1
                    continue

                bortle = radiance_to_bortle(radiance)
                old = site.get("bortle_estimate")
                site["bortle_estimate"] = bortle

                change = f"{old} → {bortle}" if old != bortle else f"{bortle} (unchanged)"
                print(f"  [{change:>12}]  {radiance:7.3f} nW  {name}")
                updated += 1

            except Exception as exc:
                print(f"  ERROR ({exc}): {name}")
                errors += 1

    print(f"\nResults: {updated} updated, {skipped} skipped, {errors} errors")
    print(f"Total sites: {len(sites)}")

    DATA_PATH.write_text(
        json.dumps(sites, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved → {DATA_PATH}")

    # Clean up GeoTIFF
    os.remove(GEOTIFF_PATH)
    print(f"Deleted GeoTIFF: {GEOTIFF_PATH.name}")


if __name__ == "__main__":
    main()
