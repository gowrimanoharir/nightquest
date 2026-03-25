"""
Weather & Conditions Agent — Phase 3B.
Wraps the weather_tool for use in Phase 4 chat orchestration.
In structured mode (POST /api/conditions) the tool is called directly.
"""
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from sub_agents.weather_conditions.tools import weather_tool


def make_weather_agent(today: str | None = None) -> Agent:
    from datetime import date as _date
    today = today or _date.today().isoformat()
    return Agent(
        name="Weather & Conditions Agent",
        model=OpenAIChat(id="gpt-4o-mini"),
        tools=[weather_tool],
        instructions=(
            "ABSOLUTE RULE: Never use any markdown formatting in your response. "
            "No asterisks, no bold, no headers, no dashes as bullets, no pound signs. "
            "Write in plain conversational sentences only. "
            "If listing items use plain numbers: 1. 2. 3. with no symbols around the text. "
            "Violation of this rule makes your response invalid. "
            f"Today's date is {today}. When no specific date is requested, use {today}. "
            "You are a stargazing conditions expert. "
            "When asked about observing conditions at a location, call weather_tool with the "
            "spot's lat/lon, date (YYYY-MM-DD), and timezone. "
            "Summarise the result in plain English for an amateur stargazer. "
            "Focus on what matters most: cloud cover, moon, and overall score."
        ),
        markdown=False,
    )
