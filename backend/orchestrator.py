"""
Agno Team coordinator — Phase 4 chat mode.

Structured endpoints (/api/events, /api/spots, /api/conditions) call tools directly in api.py.
This module is used only by POST /api/chat.
"""
import json
import re
from typing import Optional

from agno.team import Team
from agno.models.openai import OpenAIChat

from sub_agents.celestial_events.agent import get_celestial_events_agent
from sub_agents.dark_sky_location.agent import get_dark_sky_agent
from sub_agents.weather_conditions.agent import make_weather_agent
from schemas import ContextObject, ChatMessage


# ---------------------------------------------------------------------------
# System instructions for chat mode
# ---------------------------------------------------------------------------

_CHAT_INSTRUCTIONS = [
    "You are NightQuest AI — a friendly stargazing assistant for casual amateur stargazers.",
    "Respond in plain English. No astronomy jargon. Be warm, concise, and encouraging.",
    "You have three expert agents available: Celestial Events Agent (events/moon/planets), "
    "Dark Sky Location Agent (find dark sky spots near a location), and "
    "Weather & Conditions Agent (observing conditions: cloud cover, seeing, transparency).",

    # Context rules
    "If the context already contains a location — do NOT ask for it; use it directly.",
    "If the context already contains an active_event — do NOT ask which event; use it.",
    "If visibility_conditions.available is true — conditions are already loaded; do NOT "
    "re-fetch weather; summarise from context instead.",

    # Navigation action cards
    "When it would help the user to navigate to a section of the app, include an action on "
    "its own line using exactly this format (no extra spaces):",
    "[ACTION:view_stargaze:View dark sky spots]",
    "[ACTION:view_spot:SpotName]",
    "Only include an action line when it genuinely helps — not in every response.",

    # Context update format
    "If this conversation reveals new stateful info (user mentions a city, selects an event, "
    "picks a date, or references a specific spot), append a context_update block at the very "
    "end of your response in EXACTLY this format — nothing else after it:",
    "<context_update>{...full updated context JSON...}</context_update>",
    "The JSON inside must be a valid ContextObject with ALL fields present "
    "(copy unchanged fields from current context). "
    "If nothing changed, do NOT include the block.",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_full_prompt(
    message: str,
    history: list[ChatMessage],
    context: Optional[ContextObject],
) -> str:
    """Combine current context, recent history, and the new user message."""
    parts: list[str] = []

    if context:
        lines: list[str] = []
        if context.location:
            loc = context.location
            lines.append(f"User location: {loc.name or f'{loc.lat},{loc.lon}'}"
                         + (f" (tz: {loc.timezone})" if loc.timezone else ""))
        lines.append(f"Current tab: {context.tab}")
        if context.active_event:
            ev = context.active_event
            lines.append(f"Active event: {ev.name} on {ev.date} ({ev.type})")
        if context.date:
            lines.append(f"Selected date: {context.date}")
        if context.active_spot:
            sp = context.active_spot
            lines.append(f"Active spot: {sp.name} (Bortle {sp.bortle}, {sp.distance} km away)")
        if context.spots:
            names = ", ".join(s.name for s in context.spots[:3])
            lines.append(f"Spots in list: {names}" + (" …" if len(context.spots) > 3 else ""))
        if context.visibility_conditions and context.visibility_conditions.available:
            vc = context.visibility_conditions
            lines.append("Visibility conditions: already loaded — do NOT re-fetch")
            if vc.score is not None:
                lines.append(f"  Conditions score: {vc.score}/100 ({vc.label})")
        parts.append("[CURRENT CONTEXT]\n" + "\n".join(lines))

    if history:
        history_text = "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}"
            for m in history[-10:]
        )
        parts.append(f"[CONVERSATION HISTORY]\n{history_text}")

    parts.append(f"[USER MESSAGE]\n{message}")
    return "\n\n".join(parts)


_CONTEXT_UPDATE_RE = re.compile(
    r"<context_update>\s*(.*?)\s*</context_update>",
    re.DOTALL,
)


def _parse_response(
    raw: str,
    current_context: Optional[ContextObject],
) -> tuple[str, bool, Optional[ContextObject]]:
    """
    Strip <context_update>...</context_update> block from reply.
    Returns (reply_text, context_updated, updated_or_current_context).
    """
    match = _CONTEXT_UPDATE_RE.search(raw)
    if not match:
        return raw.strip(), False, current_context

    reply = _CONTEXT_UPDATE_RE.sub("", raw).strip()
    try:
        data = json.loads(match.group(1))
        updated = ContextObject.model_validate(data)
        return reply, True, updated
    except Exception:
        # Malformed JSON — discard update, keep original context
        return reply, False, current_context


# ---------------------------------------------------------------------------
# Public factory
# ---------------------------------------------------------------------------

def make_chat_orchestrator() -> Team:
    """Build a fresh NightQuest chat orchestrator (one per request)."""
    return Team(
        name="NightQuest Chat Orchestrator",
        mode="coordinate",
        model=OpenAIChat(id="gpt-4o-mini"),
        members=[
            get_celestial_events_agent(),
            get_dark_sky_agent(),
            make_weather_agent(),
        ],
        instructions=_CHAT_INSTRUCTIONS,
        markdown=False,
        show_members_responses=False,
    )


# ---------------------------------------------------------------------------
# Main entry point called by api.py
# ---------------------------------------------------------------------------

async def chat(
    message: str,
    history: list[ChatMessage],
    context: Optional[ContextObject],
) -> tuple[str, bool, Optional[ContextObject]]:
    """
    Run the chat orchestrator and return (reply, context_updated, context).
    Called from POST /api/chat in api.py.
    """
    orchestrator = make_chat_orchestrator()
    full_prompt = _build_full_prompt(message, history, context)

    response = await orchestrator.arun(full_prompt)

    raw: str = ""
    if response is not None:
        if hasattr(response, "content") and isinstance(response.content, str):
            raw = response.content
        else:
            raw = str(response)

    if not raw:
        raw = "I'm sorry, I couldn't process that request. Please try again."

    return _parse_response(raw, context)
