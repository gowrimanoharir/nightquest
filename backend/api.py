"""
FastAPI server + all endpoints.
Phase 1: POST /api/events (Celestial Events in structured mode); CORS for local frontend.
Phase 3A: POST /api/spots (Dark Sky Location Agent in structured mode).
Phase 3B: POST /api/conditions; /api/spots now re-ranks by composite conditions score.
Phase 4: POST /api/chat (Agno Team orchestrator); GET /api/prompts (context-driven).
Phase 6: GET /api/bortle — Bortle class at arbitrary lat/lon from World Atlas 2015 SQM data.
         GET /api/geoip  — Server-side IP geolocation via ipwho.is (avoids browser CORS blocks).
"""
from datetime import datetime, timezone
import asyncio
import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from schemas import (
    EventsRequest, EventsResponse, CelestialEvent,
    SpotsRequest, SpotsResponse, DarkSpotSite, ConditionsSummary,
    ConditionsRequest, ConditionsResponse, ConditionFactor,
    ChatRequest, ChatResponse, PromptsResponse,
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
    tz = request.location.timezone or _derive_timezone(
        request.location.lat, request.location.lon
    )
    events_raw = get_events_for_year(
        year=request.year,
        latitude=request.location.lat,
        longitude=request.location.lon,
        timezone=tz,
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
# GET /api/bortle  (Phase 6)
# ---------------------------------------------------------------------------

def _population_to_bortle(max_pop_within_20km: int) -> int:
    """
    Estimates Bortle class from the largest populated place within 20 km.
    Calibrated so Burlington ON (~190k) → Bortle 7, Toronto core → Bortle 9,
    rural/dark sites → Bortle 2.
    """
    if max_pop_within_20km >= 500_000: return 9   # major city core
    if max_pop_within_20km >= 200_000: return 8   # large city / inner suburb
    if max_pop_within_20km >= 100_000: return 7   # medium city (e.g. Burlington ON)
    if max_pop_within_20km >= 30_000:  return 6   # small city / outer suburb
    if max_pop_within_20km >= 8_000:   return 5   # town
    if max_pop_within_20km >= 1_500:   return 4   # village
    if max_pop_within_20km >= 300:     return 3   # hamlet / dark rural
    return 2                                       # remote / pristine


@app.get("/api/bortle")
async def get_bortle(
    lat: float = Query(..., description="Latitude in decimal degrees"),
    lon: float = Query(..., description="Longitude in decimal degrees"),
):
    """
    Estimates Bortle class (1–9) at an arbitrary lat/lon using OpenStreetMap
    population data via the Overpass API (no API key required).

    Queries populated places within 20 km, takes the highest population found,
    and maps it to a Bortle class. Bortle 1 = pristine dark sky;
    Bortle 9 = inner-city sky glow. Returns null on upstream failure.
    """
    import httpx
    overpass_query = (
        f"[out:json][timeout:10];\n"
        f"(\n"
        f'  node["place"~"^(city|town|suburb|borough|quarter)$"]'
        f'["population"](around:20000,{lat},{lon});\n'
        f'  way["place"~"^(city|town|suburb|borough|quarter)$"]'
        f'["population"](around:20000,{lat},{lon});\n'
        f'  relation["place"~"^(city|town|suburb|borough|quarter)$"]'
        f'["population"](around:20000,{lat},{lon});\n'
        f");\n"
        f"out tags;"
    )
    try:
        loop = asyncio.get_event_loop()
        r = await loop.run_in_executor(
            None,
            lambda: httpx.post(
                "https://overpass-api.de/api/interpreter",
                data=overpass_query,
                timeout=12,
                headers={"User-Agent": "NightQuest/1.0"},
            ),
        )
        r.raise_for_status()
        elements = r.json().get("elements", [])
        max_pop = 0
        for e in elements:
            pop_str = e.get("tags", {}).get("population", "")
            try:
                # Strip any formatting: "190,000" / "190 000" / "190000"
                pop = int("".join(c for c in pop_str if c.isdigit()))
                if pop > max_pop:
                    max_pop = pop
            except (ValueError, AttributeError):
                pass
        return {"bortle": _population_to_bortle(max_pop)}
    except Exception:
        return {"bortle": None}


# ---------------------------------------------------------------------------
# GET /api/geoip  (Phase 6)
# ---------------------------------------------------------------------------

@app.get("/api/geoip")
async def get_geoip():
    """
    Server-side IP geolocation via ipwho.is.
    Avoids browser CORS/privacy blocks by proxying through the backend.
    Returns simplified location fields or HTTP 503 on failure.
    """
    import httpx
    from fastapi import HTTPException
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get("https://ipwho.is/")
            r.raise_for_status()
            data = r.json()
        return {
            "lat": data["latitude"],
            "lon": data["longitude"],
            "city": data.get("city"),
            "region": data.get("region"),
            "country": data.get("country"),
        }
    except Exception:
        raise HTTPException(status_code=503, detail={"error": "unavailable"})


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


# ---------------------------------------------------------------------------
# POST /api/chat  (Phase 4)
# ---------------------------------------------------------------------------

_OFF_TOPIC_REPLY = (
    "I'm only able to help with stargazing and astronomy questions! "
    "Is there something about the night sky I can help you with?"
)

_CLASSIFIER_SYSTEM = (
    "You are a topic classifier for a stargazing app. Reply with exactly one word: 'yes' or 'no'.\n"
    "Is the message related to astronomy, stargazing, celestial events, moon phases, "
    "planets, meteor showers, eclipses, dark sky locations, night sky photography, "
    "observatories, telescopes, or weather conditions for stargazing?\n"
    "Answer 'yes' for borderline cases (e.g. light pollution, camping for stargazing, "
    "astrophotography gear). Answer 'no' only when the topic is clearly unrelated to astronomy.\n"
    "IMPORTANT: Short conversational replies ('yes', 'no', 'sure', 'ok', 'tell me more', "
    "'sounds good', 'great') ALWAYS answer 'yes' when there is any prior conversation context — "
    "they are follow-ups to whatever was already being discussed."
)


async def _is_astronomy_related(message: str, history: list = None) -> bool:
    """Lightweight pre-check: returns False if the message is clearly off-topic.
    Passes last 3 history messages for context so short follow-ups are not blocked."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI()

    # Build user content: include recent history so classifier has conversation context
    history_snippet = ""
    if history:
        recent = history[-3:]
        history_snippet = "Conversation so far:\n" + "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content[:200]}"
            for m in recent
        ) + "\n\n"

    user_content = f"{history_snippet}New message: {message[:400]}"

    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _CLASSIFIER_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        max_tokens=3,
        temperature=0,
    )
    answer = resp.choices[0].message.content.strip().lower()
    return answer.startswith("y")


@app.post("/api/chat", response_model=ChatResponse)
async def post_chat(request: ChatRequest) -> ChatResponse:
    """
    Chat mode: Agno Team orchestrator. Reads full context, decides which agents to invoke,
    returns conversational reply + optional context update.
    Only sets context_updated: true when context fields actually changed.
    """
    if not await _is_astronomy_related(request.message, request.history):
        return ChatResponse(
            reply=_OFF_TOPIC_REPLY,
            context_updated=False,
            context=request.context,
        )

    from orchestrator import chat as orchestrator_chat  # lazy import — avoids startup cost

    reply, context_updated, updated_context = await orchestrator_chat(
        message=request.message,
        history=request.history,
        context=request.context,
    )
    return ChatResponse(
        reply=reply,
        context_updated=context_updated,
        context=updated_context,
    )


# ---------------------------------------------------------------------------
# GET /api/prompts  (Phase 4)
# ---------------------------------------------------------------------------

def _generate_prompts(
    tab: Optional[str],
    location: Optional[str],
    event: Optional[str],
    spot: Optional[str],
) -> list[str]:
    """
    Return 3-4 context-driven suggested prompts.
    Pure logic — no AI call needed for deterministic suggestions.
    """
    loc = location or "my location"

    if tab == "stargaze" and spot and event:
        return [
            f"Is it worth driving to {spot} for the {event}?",
            "What time should I arrive for the best viewing?",
            "What should I bring for this observing session?",
            "Will the weather be clear on this date?",
        ]

    if tab == "stargaze" and spot:
        return [
            f"How are conditions at {spot} tonight?",
            "What time should I arrive?",
            "Is it worth the drive this weekend?",
            "What can I see from this location?",
        ]

    if tab == "explore" and event:
        return [
            f"Can I see the {event} from {loc}?",
            f"Where should I go for the best view of the {event}?",
            "What time is the best viewing window?",
            "Do I need a telescope for this?",
        ]

    if tab == "stargaze" and location:
        return [
            f"What's visible tonight from {loc}?",
            "Where are the nearest dark sky spots?",
            "How is the moon tonight?",
            "What time does the Milky Way rise tonight?",
        ]

    if location:
        return [
            "What's coming up in the sky this month?",
            f"What's the best event I can see from {loc}?",
            "When is the next full moon?",
            "Are there any meteor showers coming up?",
        ]

    # No context at all — general discovery prompts
    return [
        "What celestial events are coming up this year?",
        "What's the best stargazing event to see?",
        "When is the next meteor shower?",
        "Where should I go to see the night sky?",
    ]


@app.get("/api/prompts", response_model=PromptsResponse)
async def get_prompts(
    tab: Optional[str] = Query(default=None),
    location: Optional[str] = Query(default=None),
    event: Optional[str] = Query(default=None),
    spot: Optional[str] = Query(default=None),
) -> PromptsResponse:
    """
    Returns 3-4 context-driven suggested prompts.
    Context passed as query params: tab, location, event, spot.
    """
    prompts = _generate_prompts(tab, location, event, spot)
    return PromptsResponse(prompts=prompts)
