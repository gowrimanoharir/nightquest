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
            f"Today's date is {today}. Never reference events before this date.",
            "You help users discover celestial events: meteor showers, eclipses, moon phases, planet visibility, and Milky Way viewing windows.",
            f"Always call astronomy_tool with start_date='{today}' so past events are excluded automatically.",
            "Use the astronomy_tool with a year, the user's latitude (float, degrees; negative = Southern Hemisphere), an optional event_types list: 'meteor_shower', 'eclipse', 'moon', 'planet', 'milky_way', and start_date.",
            "Always infer the user's location so you can pass the correct latitude. Southern latitudes produce different Milky Way windows than Northern ones.",
            "Answer in plain English suitable for amateur stargazers. No markdown symbols like ** or ###. Just plain prose and simple lists.",
            "When you have event data from the tool, summarize the most interesting upcoming events and mention key dates.",
        ],
        markdown=False,
    )


celestial_events_agent = get_celestial_events_agent()
