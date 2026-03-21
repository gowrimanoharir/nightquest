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


def get_milky_way_windows_for_year(year: int, latitude: float) -> list[dict[str, Any]]:
    """
    Return Milky Way core visibility events matched to the observer's hemisphere.

    Galactic center (Sgr A*, dec ≈ −29°) seasonal windows:
      Northern (lat > 0): visible Mar–Oct, peak Jun–Sep (core transits in south)
      Southern (lat < 0): visible Feb–Oct, peak May–Aug; center passes near zenith,
                          providing the most prominent views on Earth
    """
    is_southern = latitude < 0
    hemisphere = "Southern" if is_southern else "Northern"

    if is_southern:
        # Feb–Oct window; peak May–Aug when center transits near zenith
        windows = [
            (2, "opens",   "Galactic center rises in the east after midnight; Southern season opens."),
            (4, "rising",  "Core climbs higher each night; excellent pre-midnight viewing begins."),
            (5, "peak",    f"Peak season. Galactic center transits near zenith at midnight — "
                           f"Southern latitudes enjoy the most dramatic views on Earth."),
            (7, "peak",    "Core still near zenith at dusk; long evening windows for dark-sky photography."),
            (9, "late",    "Galactic center sets in the southwest; last wide evening window of the year."),
        ]
    else:
        # Mar–Oct window; peak Jun–Sep when core transits high in south
        windows = [
            (3, "opens",   "Galactic center rises before dawn; Northern season opens."),
            (5, "rising",  "Core clears the horizon earlier each night; good pre-midnight viewing."),
            (7, "peak",    f"Peak season. Galactic core transits high in the south around midnight — "
                           f"best dark-sky opportunity of the year."),
            (9, "late",    "Core sets in the southwest; last strong evening window before season ends."),
            (10, "closing", "Galactic center visible low in the west after dark. Season closing."),
        ]

    events = []
    for month, phase, desc in windows:
        label_phase = {
            "opens":   "Season Opens",
            "rising":  "Core Rising",
            "peak":    "Core Peak",
            "late":    "Late Season",
            "closing": "Season Closing",
        }[phase]
        events.append({
            "name": f"Milky Way {label_phase} ({hemisphere} Hemisphere)",
            "date": f"{year}-{month:02d}-15",
            "type": "milky_way",
            "description": desc,
        })
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
    latitude: float,
    event_types: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Get celestial events for a given year and observer latitude. Optionally filter by event_type.
    event_types: optional list of 'meteor_shower', 'eclipse', 'moon', 'planet', 'milky_way'.
    Returns list of events with name, date (ISO), type, description.
    """
    all_events: list[dict[str, Any]] = []
    all_events.extend(get_moon_phases_for_year(year))
    all_events.extend(get_solar_eclipses_for_year(year))
    all_events.extend(get_lunar_eclipses_for_year(year))
    all_events.extend(get_meteor_showers_for_year(year))
    all_events.extend(get_milky_way_windows_for_year(year, latitude))
    all_events.extend(get_planet_events_for_year(year))

    if event_types:
        all_events = [e for e in all_events if e["type"] in event_types]

    # Sort by date
    all_events.sort(key=lambda e: (e["date"], e["name"]))
    return all_events


def get_events_for_year(
    year: int,
    latitude: float,
    filters: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Structured helper for POST /api/events: same as astronomy_tool but always
    returns list of events with name, date, type, description.
    """
    return astronomy_tool(year=year, latitude=latitude, event_types=filters or None)
