"""
Dark Sky Location Agent — Agno Agent with dark_sky_lookup_tool and distance_tool.
Used for chat mode; structured endpoint /api/spots calls tools directly.
"""
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from .tools import dark_sky_lookup_tool, distance_tool


def get_dark_sky_agent() -> Agent:
    """Build the Dark Sky Location Agent."""
    return Agent(
        name="Dark Sky Location Agent",
        model=OpenAIChat(id="gpt-4o-mini"),
        tools=[dark_sky_lookup_tool, distance_tool],
        instructions=[
            "You help users find the best dark sky spots near them for stargazing.",
            "Use dark_sky_lookup_tool with the user's latitude and longitude, a max_distance_km, and optionally an event_type.",
            "Rank spots by composite score: Bortle rating counts 60% (lower Bortle = darker sky = better), distance counts 40% (closer = better).",
            "Explain what Bortle class means in plain English: Bortle 1-2 is pristine dark sky, 3-4 is rural, 5+ has light pollution.",
            "Mention if a site is IDA-certified — those are the gold standard for dark skies.",
            "Answer in plain English for casual stargazers. No technical jargon.",
            "When asked for directions or travel time, use the distance figures from the tool.",
        ],
        markdown=True,
    )


dark_sky_agent = get_dark_sky_agent()
