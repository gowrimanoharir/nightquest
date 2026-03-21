"""
FastAPI server + all endpoints.
Phase 1: POST /api/events (Celestial Events in structured mode); CORS for local frontend.
Phase 3A: POST /api/spots (Dark Sky Location Agent in structured mode).
Phase 3B: POST /api/conditions; /api/spots now re-ranks by composite conditions score.
"""
from datetime import datetime, timezone
import asyncio
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    EventsRequest, EventsResponse, CelestialEvent,
    SpotsRequest, SpotsResponse, DarkSpotSite, ConditionsSummary,
    ConditionsRequest, ConditionsResponse, ConditionFactor,
)
from sub_agents.celestial_events.tools import get_events_for_year
from sub_agents.dark_sky_location.tools import dark_sky_lookup_tool
from sub_agents.weather_conditions.tools import weather_tool

load_dotenv()

app = FastAPI(title="NightQuest API", version="0.1.0")

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:8081").strip().split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/events", response_model=EventsResponse)
async def post_events(request: EventsRequest) -> EventsResponse:
    """
    Structured mode: fixed pipeline, deterministic JSON.
    Returns celestial events (meteor showers, eclipses, moon phases, planet, milky_way) for the given year and location.
    """
    events_raw = get_events_for_year(
        year=request.year,
        latitude=request.location.lat,
        filters=request.filters if request.filters else None,
    )
    events = [
        CelestialEvent(
            name=e["name"],
            date=e["date"],
            type=e["type"],
            description=e.get("description"),
        )
        for e in events_raw
    ]
    return EventsResponse(
        events=events,
        generated_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Phase 3B helpers
# ---------------------------------------------------------------------------

def _derive_timezone(lat: float, lon: float) -> str:
    """Best-effort IANA timezone from lat/lon via timezonefinder (if installed)."""
    try:
        from timezonefinder import TimezoneFinder  # type: ignore
        tf = TimezoneFinder()
        tz = tf.timezone_at(lat=lat, lng=lon)
        return tz or "UTC"
    except Exception:
        return "UTC"


async def _fetch_conditions_async(
    lat: float, lon: float, date_str: str, timezone_str: str, spot_name: str
) -> dict:
    """Run weather_tool in a thread pool so FastAPI stays non-blocking."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, weather_tool, lat, lon, date_str, timezone_str, spot_name
    )


# ---------------------------------------------------------------------------
# POST /api/spots  (updated Phase 3B — re-ranks by conditions score)
# ---------------------------------------------------------------------------

@app.post("/api/spots", response_model=SpotsResponse)
async def post_spots(request: SpotsRequest) -> SpotsResponse:
    """
    Structured mode. Returns dark sky spots ranked by composite score:
      Phase 3A initial: Bortle 60% + distance 40%
      Phase 3B: overrides with full 8-factor conditions score after fetching weather.
    """
    # 1. Initial lookup (Bortle + distance ranking)
    results = dark_sky_lookup_tool(
        lat=request.location.lat,
        lon=request.location.lon,
        max_distance_km=request.distance_km if request.distance_km else 200.0,
        event_type=request.event_type,
    )

    if not results:
        return SpotsResponse(spots=[])

    # 2. Derive timezone from user location (used as proxy — spot TZ fetched individually)
    user_tz = _derive_timezone(request.location.lat, request.location.lon)

    # 3. Fetch conditions for up to 10 spots in parallel
    top_results = results[:10]
    cond_tasks = [
        _fetch_conditions_async(
            r["lat"], r["lon"], request.date,
            _derive_timezone(r["lat"], r["lon"]),
            r["name"],
        )
        for r in top_results
    ]
    try:
        conditions_list = await asyncio.gather(*cond_tasks, return_exceptions=True)
    except Exception:
        conditions_list = [None] * len(top_results)

    # 4. Merge conditions score into results and re-rank
    for i, (r, cond) in enumerate(zip(top_results, conditions_list)):
        if isinstance(cond, dict):
            r["conditions_score"] = cond["score"]
            r["conditions_label"] = cond["label"]
            r["conditions_data_type"] = cond["data_type"]
            r["cloud_pct"] = next(
                (f["score"] / f["max_score"] * 100 for f in cond["factors"] if f["name"] == "Cloud Cover"),
                None
            )
            moon_factor = next((f for f in cond["factors"] if f["name"] == "Darkness"), None)
            r["moon_illumination"] = cond["moon"].get("illumination") if cond.get("moon") else None
            wind_factor = next((f for f in cond["factors"] if f["name"] == "Wind"), None)
            r["wind_kmh"] = None  # derived below from raw value not available here; set to None
        else:
            r["conditions_score"] = None

    # Re-rank top results by conditions score; remaining keep Bortle+dist score
    top_with_cond = [r for r in top_results if r.get("conditions_score") is not None]
    top_without_cond = [r for r in top_results if r.get("conditions_score") is None]
    rest = results[10:]

    top_with_cond.sort(key=lambda x: x["conditions_score"], reverse=True)
    ranked = top_with_cond + top_without_cond + rest

    # Re-assign ranks
    for i, r in enumerate(ranked):
        r["rank"] = i + 1

    # 5. Build response
    spots = []
    for r in ranked:
        cond_summary = None
        if r.get("conditions_score") is not None:
            cond_summary = ConditionsSummary(
                score=r["conditions_score"],
                label=r.get("conditions_label", ""),
                data_type=r.get("conditions_data_type"),
                cloud_pct=r.get("cloud_pct"),
                moon_illumination=r.get("moon_illumination"),
                wind_kmh=r.get("wind_kmh"),
            )
        spots.append(
            DarkSpotSite(
                name=r["name"],
                lat=r["lat"],
                lon=r["lon"],
                bortle_estimate=r.get("bortle_estimate"),
                certified=r.get("certified"),
                website=r.get("website"),
                country=r.get("country"),
                state=r.get("state"),
                address=r.get("address"),
                distance=r.get("distance_km"),
                score=float(r.get("conditions_score") or r.get("score") or 0),
                rank=r.get("rank"),
                conditions_summary=cond_summary,
            )
        )

    return SpotsResponse(spots=spots)


# ---------------------------------------------------------------------------
# POST /api/conditions  (Phase 3B)
# ---------------------------------------------------------------------------

@app.post("/api/conditions", response_model=ConditionsResponse)
async def post_conditions(request: ConditionsRequest) -> ConditionsResponse:
    """
    Returns full 8-factor visibility conditions for a specific spot + date.
    Backend derives current local time from timezone + system clock.
    Input: spot lat/lon, date (YYYY-MM-DD), timezone (IANA string).
    """
    spot_name = ""  # name is not sent in the request per API contract
    cond = await _fetch_conditions_async(
        lat=request.spot.lat,
        lon=request.spot.lon,
        date_str=request.date,
        timezone_str=request.timezone,
        spot_name=spot_name,
    )

    factors = [
        ConditionFactor(
            name=f["name"],
            score=f["score"],
            max_score=f["max_score"],
            status=f["status"],
            detail=f["detail"],
        )
        for f in cond["factors"]
    ]

    return ConditionsResponse(
        score=cond["score"],
        label=cond["label"],
        factors=factors,
        moon=cond["moon"],
        ai_take=cond["ai_take"],
        data_type=cond["data_type"],
    )
