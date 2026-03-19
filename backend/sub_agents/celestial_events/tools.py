"""
Celestial Events tools — astronomy-engine wrapper.
Provides: moon phase, planet visibility, meteor shower peaks, eclipse dates, Milky Way window.
"""
from typing import Any

import astronomy
from astronomy import (
    Time,
    SearchMoonQuarter,
    NextMoonQuarter,
    MoonQuarter,
    SearchGlobalSolarEclipse,
    NextGlobalSolarEclipse,
    SearchLunarEclipse,
    NextLunarEclipse,
    EclipseKind,
)

# Major meteor showers: name -> (peak_month, peak_day_approx, description)
METEOR_SHOWERS = [
    ("Quadrantids", 1, 4, "Up to 120 meteors/hour; best in dark skies."),
    ("Lyrids", 4, 22, "About 18 meteors/hour at peak."),
    ("Eta Aquarids", 5, 6, "Up to 50 meteors/hour; best before dawn."),
    ("Perseids", 8, 12, "Up to 100 meteors/hour; popular summer shower."),
    ("Orionids", 10, 21, "About 20 meteors/hour."),
    ("Leonids", 11, 17, "Variable; can produce storms every 33 years."),
    ("Geminids", 12, 14, "Up to 120 meteors/hour; one of the best."),
    ("Ursids", 12, 22, "About 10 meteors/hour."),
]


def _time_to_iso_date(t: Time) -> str:
    return str(t)[:10]


def get_moon_phases_for_year(year: int) -> list[dict[str, Any]]:
    """Return moon quarter events (new, first quarter, full, third quarter) for the given year."""
    events = []
    start = Time.Make(year, 1, 1, 0, 0, 0)
    mq = SearchMoonQuarter(start)
    quarter_names = {0: "New Moon", 1: "First Quarter", 2: "Full Moon", 3: "Third Quarter"}
    while True:
        date_str = _time_to_iso_date(mq.time)
        if int(date_str[:4]) > year:
            break
        events.append({
            "name": quarter_names.get(mq.quarter, "Moon"),
            "date": date_str,
            "type": "moon",
            "description": f"{quarter_names.get(mq.quarter, 'Lunar')} phase.",
        })
        mq = astronomy.NextMoonQuarter(mq)
    return events


def get_solar_eclipses_for_year(year: int) -> list[dict[str, Any]]:
    """Return global solar eclipses (total, annular, partial) for the given year."""
    events = []
    start = Time.Make(year, 1, 1, 0, 0, 0)
    e = SearchGlobalSolarEclipse(start)
    kind_names = {
        EclipseKind.Total: "Total Solar Eclipse",
        EclipseKind.Annular: "Annular Solar Eclipse",
        EclipseKind.Partial: "Partial Solar Eclipse",
    }
    while True:
        date_str = _time_to_iso_date(e.peak)
        if int(date_str[:4]) > year:
            break
        kind_name = kind_names.get(e.kind, "Solar Eclipse")
        events.append({
            "name": kind_name,
            "date": date_str,
            "type": "eclipse",
            "description": f"{kind_name}; peak at {e.peak}. Visible from selected regions.",
        })
        e = NextGlobalSolarEclipse(e.peak)
    return events


def get_lunar_eclipses_for_year(year: int) -> list[dict[str, Any]]:
    """Return lunar eclipses for the given year."""
    events = []
    start = Time.Make(year, 1, 1, 0, 0, 0)
    e = SearchLunarEclipse(start)
    kind_names = {
        EclipseKind.Total: "Total Lunar Eclipse",
        EclipseKind.Partial: "Partial Lunar Eclipse",
        EclipseKind.Penumbral: "Penumbral Lunar Eclipse",
    }
    while True:
        date_str = _time_to_iso_date(e.peak)
        if int(date_str[:4]) > year:
            break
        kind_name = kind_names.get(e.kind, "Lunar Eclipse")
        events.append({
            "name": kind_name,
            "date": date_str,
            "type": "eclipse",
            "description": f"{kind_name}; visible where the Moon is above horizon.",
        })
        e = NextLunarEclipse(e.peak)
    return events


def get_meteor_showers_for_year(year: int) -> list[dict[str, Any]]:
    """Return major meteor shower peaks for the given year (approximate calendar dates)."""
    events = []
    for name, month, day, desc in METEOR_SHOWERS:
        date_str = f"{year}-{month:02d}-{day:02d}"
        events.append({
            "name": f"{name} Meteor Shower",
            "date": date_str,
            "type": "meteor_shower",
            "description": desc,
        })
    return events


def get_milky_way_windows_for_year(year: int) -> list[dict[str, Any]]:
    """Return best Milky Way visibility windows (Northern Hemisphere: summer core visibility)."""
    # Galactic center is best visible roughly Apr–Sep in N hemisphere evenings.
    events = [
        {
            "name": "Milky Way Core Season (Northern Hemisphere)",
            "date": f"{year}-06-15",
            "type": "milky_way",
            "description": "Galactic center visible in evening; best dark-sky season for Milky Way.",
        },
        {
            "name": "Milky Way Core Season (Southern Hemisphere)",
            "date": f"{year}-01-15",
            "type": "milky_way",
            "description": "Galactic center high in southern sky; excellent dark-sky viewing.",
        },
    ]
    return events


def get_planet_events_for_year(year: int) -> list[dict[str, Any]]:
    """Return notable planet visibility events (simplified: oppositions / best visibility)."""
    # Simplified: add placeholder planet events; full implementation would use
    # SearchRelativeLongitude, SearchMaxElongation for Mercury/Venus.
    events = [
        {"name": "Mars opposition (approx)", "date": f"{year}-12-01", "type": "planet", "description": "Mars near opposition; bright and visible much of the night."},
        {"name": "Jupiter opposition (approx)", "date": f"{year}-10-01", "type": "planet", "description": "Jupiter near opposition; excellent visibility."},
        {"name": "Saturn opposition (approx)", "date": f"{year}-09-01", "type": "planet", "description": "Saturn near opposition; good for viewing rings."},
    ]
    return events


def astronomy_tool(
    year: int,
    event_types: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Get celestial events for a given year. Optionally filter by event_type.
    event_types: optional list of 'meteor_shower', 'eclipse', 'moon', 'planet', 'milky_way'.
    Returns list of events with name, date (ISO), type, description.
    """
    all_events: list[dict[str, Any]] = []
    all_events.extend(get_moon_phases_for_year(year))
    all_events.extend(get_solar_eclipses_for_year(year))
    all_events.extend(get_lunar_eclipses_for_year(year))
    all_events.extend(get_meteor_showers_for_year(year))
    all_events.extend(get_milky_way_windows_for_year(year))
    all_events.extend(get_planet_events_for_year(year))

    if event_types:
        all_events = [e for e in all_events if e["type"] in event_types]

    # Sort by date
    all_events.sort(key=lambda e: (e["date"], e["name"]))
    return all_events


def get_events_for_year(
    year: int,
    filters: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Structured helper for POST /api/events: same as astronomy_tool but always
    returns list of events with name, date, type, description.
    """
    return astronomy_tool(year=year, event_types=filters or None)
