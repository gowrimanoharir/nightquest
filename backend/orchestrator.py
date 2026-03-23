"""
Agno Team coordinator — Phase 4 chat mode.

Structured endpoints (/api/events, /api/spots, /api/conditions) call tools directly in api.py.
This module is used only by POST /api/chat.
"""
import json
import re
from datetime import date
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
    # 1. Markdown — absolute rule, checked first
    "ABSOLUTE RULE: Never use ** or * for bold or italic. Never use # for headers. "
    "Plain text and numbers only. No markdown of any kind.",

    # 2. Scope
    "You are ONLY a stargazing and astronomy assistant. "
    "If asked about anything unrelated to astronomy, night sky, celestial events, "
    "dark sky locations, or stargazing weather — politely decline and redirect.",

    # 3. Clarifying questions for vague queries
    "When a user asks a vague question like what is the best event or what should I see — "
    "ask 1 to 2 short clarifying questions first. "
    "Good ones: are you looking for something soon or further ahead? "
    "naked eye or telescope? happy to drive or prefer staying local? "
    "Only ask the most relevant 1-2. Once you have enough context recommend 1-2 specific "
    "events with a brief explanation and a next step.",

    # 4. Direct answers when context is sufficient
    "For specific questions where the user has given enough context — answer directly "
    "without clarifying questions.",

    # 5. Response length
    "Keep responses to 3 to 5 sentences maximum unless the user explicitly asks for more "
    "detail or a full list. Never dump all events as a numbered list unprompted.",

    # 6. Dark sky spots — always call agent first, retry at 300km if empty
    "CRITICAL: Never state there are no dark sky spots near a location without first calling "
    "the Dark Sky Location Agent. It has 277 sites. Always call it first. "
    "If nothing within the requested distance, call again with up to 300km and tell the user "
    "the nearest option and its distance.",

    # 7. Action card — mandatory when spots are returned
    "CRITICAL: Whenever the Dark Sky Location Agent returns spots, you MUST include this line "
    "at the end of your response on its own line with nothing else on that line:\n"
    "[ACTION:view_stargaze:View dark sky spots]\n"
    "Never list spots without this action line.",

    # 8. Night sky questions
    "When a user asks what the night sky is like tonight or what is visible — call the "
    "Celestial Events Agent for tonight using the location from context. "
    "Never say you are unable to describe the night sky.",

    # Date discipline
    "CRITICAL: Always use the EXACT year from TODAY'S DATE in the [CURRENT CONTEXT] section. "
    "Never use training data for specific event dates — always call the Celestial Events Agent "
    "with the correct year. Only include events that occur ON OR AFTER today's date.",

    # Context rules
    "If the context already contains a location — do NOT ask for it; use it directly.",
    "If the context already contains an active_event — do NOT ask which event; use it.",
    "If visibility_conditions.available is true — conditions are already loaded; do NOT "
    "re-fetch weather; summarise from context instead.",

    # view_spot action card
    "For navigating to a specific spot, include on its own line: "
    "[ACTION:view_spot:SpotName] "
    "Use exactly this format with colon separators and square brackets — no extra spaces.",

    # Context update — VERY restrictive
    "Only append a <context_update> block if the user's message EXPLICITLY states a NEW "
    "location (e.g. 'I'm in Tokyo'), a NEW specific date, a NEW event they selected, or a "
    "NEW specific spot they chose. Do NOT include it for general questions, "
    "event listings, condition summaries, or any response where the user did not volunteer "
    "new personal information. When in doubt — omit it.",
    "If you do include a <context_update>, append it at the very end of your response in "
    "EXACTLY this format:",
    "<context_update>{...full updated context JSON with ALL fields...}</context_update>",
    "All fields must be present — copy unchanged fields verbatim from [CURRENT CONTEXT]. "
    "Never set location to null if a location was already in context.",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_full_prompt(
    message: str,
    history: list[ChatMessage],
    context: Optional[ContextObject],
) -> str:
    """Combine today's date, current context, recent history, and the new user message."""
    parts: list[str] = []

    # Always inject today's date first so the AI knows the correct year
    parts.append(f"[TODAY'S DATE]\n{date.today().isoformat()}")

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

# Agno coordinate-mode internals that leak into response.content
# Pattern: {"member_id": "agent-name", "task": "..."}
_DELEGATION_JSON_RE = re.compile(
    r'\{[^{}]*?"member_id"\s*:\s*"[^"]*"[^{}]*?\}',
    re.DOTALL,
)
# Lines that start with "Delegating..." (the coordinator narrating its delegation)
_DELEGATING_LINE_RE = re.compile(r'^[ \t]*Delegat\w[^\n]*\n?', re.MULTILINE)


def _clean_orchestrator_noise(text: str) -> str:
    """Strip Agno coordinator delegation internals that leak into response.content."""
    text = _DELEGATION_JSON_RE.sub('', text)
    text = _DELEGATING_LINE_RE.sub('', text)
    # Collapse runs of blank lines left behind
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _parse_response(
    raw: str,
    current_context: Optional[ContextObject],
) -> tuple[str, bool, Optional[ContextObject]]:
    """
    Strip <context_update>...</context_update> block from reply.
    Returns (reply_text, context_updated, updated_or_current_context).

    Safeguards:
    - Never overwrites an existing location with null.
    - Discards the update if it is identical to the current context.
    """
    match = _CONTEXT_UPDATE_RE.search(raw)
    if not match:
        return raw.strip(), False, current_context

    reply = _CONTEXT_UPDATE_RE.sub("", raw).strip()
    try:
        data = json.loads(match.group(1))
        updated = ContextObject.model_validate(data)

        # Guard: never null out a location that already exists
        if current_context and current_context.location and updated.location is None:
            updated.location = current_context.location

        # Guard: discard no-op updates
        if current_context and updated.model_dump() == current_context.model_dump():
            return reply, False, current_context

        return reply, True, updated
    except Exception:
        # Malformed JSON — discard update, keep original context
        return reply, False, current_context


# ---------------------------------------------------------------------------
# Public factory
# ---------------------------------------------------------------------------

def make_chat_orchestrator() -> Team:
    """Build a fresh NightQuest chat orchestrator (one per request)."""
    today = date.today().isoformat()
    return Team(
        name="NightQuest Chat Orchestrator",
        mode="coordinate",
        model=OpenAIChat(id="gpt-4o-mini"),
        members=[
            get_celestial_events_agent(today=today),
            get_dark_sky_agent(today=today),
            make_weather_agent(today=today),
        ],
        instructions=_CHAT_INSTRUCTIONS,
        add_datetime_to_context=True,   # Agno injects current date into team context
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

    raw = _clean_orchestrator_noise(raw)
    return _parse_response(raw, context)
