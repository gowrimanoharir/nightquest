"""
Celestial Events Agent — Agno Agent with astronomy_tool.
Use for chat mode; structured endpoint /api/events uses tools directly.
"""
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from .tools import astronomy_tool


def get_celestial_events_agent(today: str | None = None) -> Agent:
    """Build the Celestial Events Agent with astronomy tool and plain English instructions."""
    from datetime import date as _date
    today = today or _date.today().isoformat()
    return Agent(
        name="Celestial Events Agent",
        model=OpenAIChat(id="gpt-4o-mini"),
        tools=[astronomy_tool],
        instructions=[
            "ABSOLUTE RULE: Never use any markdown formatting in your response. "
            "No asterisks, no bold, no headers, no dashes as bullets, no pound signs. "
            "Write in plain conversational sentences only. "
            "If listing items use plain numbers: 1. 2. 3. with no symbols around the text. "
            "Violation of this rule makes your response invalid.",
            f"Today's date is {today}. Never reference events before this date.",
            "You help users discover celestial events: meteor showers, eclipses, moon phases, planet visibility, and Milky Way viewing windows.",
            f"Always call astronomy_tool with start_date='{today}' so past events are excluded automatically.",
            "Call astronomy_tool with: year (int), latitude (float, degrees; negative = Southern Hemisphere), "
            "longitude (float, degrees east; negative = west; default 0.0), "
            "timezone (IANA string, e.g. 'America/New_York'; default 'UTC'), "
            "optional event_types list from 'meteor_shower', 'eclipse', 'moon', 'planet', 'milky_way', "
            "and start_date. Always infer the user's location to pass correct latitude, longitude, and timezone.",
            "Answer in plain English suitable for amateur stargazers. Summarize the most interesting upcoming events and key dates.",
        ],
        markdown=False,
    )


celestial_events_agent = get_celestial_events_agent()
