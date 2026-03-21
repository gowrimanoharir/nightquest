"""
FastAPI server + all endpoints.
Phase 1: POST /api/events (Celestial Events in structured mode); CORS for local frontend.
Phase 3A: POST /api/spots (Dark Sky Location Agent in structured mode).
"""
from datetime import datetime, timezone
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas import EventsRequest, EventsResponse, CelestialEvent, SpotsRequest, SpotsResponse, DarkSpotSite
from sub_agents.celestial_events.tools import get_events_for_year
from sub_agents.dark_sky_location.tools import dark_sky_lookup_tool

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


@app.post("/api/spots", response_model=SpotsResponse)
async def post_spots(request: SpotsRequest) -> SpotsResponse:
    """
    Structured mode: fixed pipeline, deterministic JSON.
    Returns dark sky spots ranked by Bortle (60%) + distance (40%).
    Conditions ranking (Phase 3B) will replace this initial score.
    """
    results = dark_sky_lookup_tool(
        lat=request.location.lat,
        lon=request.location.lon,
        max_distance_km=request.distance_km if request.distance_km else 200.0,
        event_type=request.event_type,
    )
    spots = [
        DarkSpotSite(
            name=r["name"],
            lat=r["lat"],
            lon=r["lon"],
            bortle_estimate=r.get("bortle_estimate"),
            certified=r.get("certified"),
            website=r.get("website"),
            country=r.get("country"),
            state=r.get("state"),
            distance=r.get("distance_km"),
            score=r.get("score"),
            rank=r.get("rank"),
        )
        for r in results
    ]
    return SpotsResponse(spots=spots)
