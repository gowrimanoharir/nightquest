"""
Celestial Events Agent — Agno Agent with astronomy_tool.
Use for chat mode; structured endpoint /api/events uses tools directly.
"""
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from .tools import astronomy_tool


def get_celestial_events_agent() -> Agent:
    """Build the Celestial Events Agent with astronomy tool and plain English instructions."""
    return Agent(
        name="Celestial Events Agent",
        model=OpenAIChat(id="gpt-4o-mini"),
        tools=[astronomy_tool],
        instructions=[
            "You help users discover celestial events: meteor showers, eclipses, moon phases, planet visibility, and Milky Way viewing windows.",
            "Use the astronomy_tool with a year, the user's latitude (float, degrees; negative = Southern Hemisphere), and an optional event_types list: 'meteor_shower', 'eclipse', 'moon', 'planet', 'milky_way'.",
            "Always ask for or infer the user's location before calling astronomy_tool so you can pass the correct latitude. Southern latitudes (e.g. -22.9 for Atacama) produce different Milky Way windows than Northern ones.",
            "Answer in plain English suitable for amateur stargazers. Avoid jargon; explain dates and what to look for.",
            "When you have event data from the tool, summarize the most interesting events and mention key dates.",
        ],
        markdown=True,
    )


celestial_events_agent = get_celestial_events_agent()
