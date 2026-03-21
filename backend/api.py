"""
FastAPI server + all endpoints.
Phase 1: POST /api/events (Celestial Events in structured mode); CORS for local frontend.
"""
from datetime import datetime, timezone
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas import EventsRequest, EventsResponse, CelestialEvent
from sub_agents.celestial_events.tools import get_events_for_year

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
