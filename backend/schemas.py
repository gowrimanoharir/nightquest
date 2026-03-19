"""
Shared Pydantic data models for NightQuest API.
Single source of truth; frontend and backend use the same shapes.
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field


# --- Location & context ---
class Location(BaseModel):
    lat: float
    lon: float
    name: Optional[str] = None
    source: Optional[Literal["gps", "ip", "timezone", "manual"]] = None
    timezone: Optional[str] = None  # always backend-derived


# --- Celestial events ---
class CelestialEvent(BaseModel):
    name: str
    date: str  # ISO date
    type: Literal["meteor_shower", "eclipse", "moon", "planet", "milky_way"]
    description: Optional[str] = None


# --- Dark sky spots (IDA dataset & API response) ---
class DarkSpotSite(BaseModel):
    name: str
    lat: float
    lon: float
    bortle_estimate: Optional[int] = None
    certified: Optional[bool] = None
    website: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None  # or region


# --- Visibility conditions (8 factors) ---
class ConditionFactor(BaseModel):
    name: str
    score: Optional[int] = None
    max_score: Optional[int] = None
    status: Optional[Literal["good", "moderate", "poor"]] = None
    detail: Optional[str] = None


class VisibilityConditions(BaseModel):
    available: bool = False
    for_date: Optional[str] = None
    for_location: Optional[Location] = None
    score: Optional[int] = None
    label: Optional[str] = None  # Excellent / Good / Fair / Poor
    factors: list[ConditionFactor] = Field(default_factory=list)
    moon: Optional[dict] = None
    ai_take: Optional[str] = None
    data_type: Optional[Literal["forecast", "historical_average"]] = None


# --- Context object (full app state) ---
class ActiveEvent(BaseModel):
    name: str
    date: str
    type: Literal["meteor_shower", "eclipse", "moon", "planet", "milky_way"]


class ActiveSpot(BaseModel):
    name: str
    lat: float
    lon: float
    bortle: Optional[int] = None
    distance: Optional[float] = None
    certified: Optional[bool] = None
    website: Optional[str] = None


class ContextObject(BaseModel):
    tab: Literal["explore", "stargaze"] = "explore"
    location: Optional[Location] = None
    date: Optional[str] = None  # single ISO date
    active_event: Optional[ActiveEvent] = None
    spots: list[DarkSpotSite] = Field(default_factory=list)
    active_spot: Optional[ActiveSpot] = None
    visibility_conditions: Optional[VisibilityConditions] = None


# --- Chat API ---
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)
    context: Optional[ContextObject] = None


class ChatResponse(BaseModel):
    reply: str
    context_updated: bool = False
    context: Optional[ContextObject] = None


# --- Structured endpoints ---
class EventsRequest(BaseModel):
    location: Location
    year: int
    filters: list[Literal["meteor_shower", "eclipse", "moon", "planet", "milky_way"]] = Field(
        default_factory=list
    )


class EventsResponse(BaseModel):
    events: list[CelestialEvent]
    generated_at: Optional[str] = None


class SpotsRequest(BaseModel):
    location: Location
    date: str
    event_type: Optional[str] = None
    distance_km: Optional[float] = None


class SpotsResponse(BaseModel):
    spots: list[DarkSpotSite]


class ConditionsRequest(BaseModel):
    spot: Location  # lat, lon
    date: str
    timezone: str


class ConditionsResponse(BaseModel):
    score: int
    label: str
    factors: list[ConditionFactor]
    moon: Optional[dict] = None
    ai_take: Optional[str] = None
    data_type: Optional[Literal["forecast", "historical_average"]] = None
