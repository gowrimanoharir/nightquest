"""
Celestial Events tools — astronomy-engine wrapper.
All event dates are computed via real astronomy-engine calculations.
No hardcoded month/day values for showers, planets, or Milky Way windows.
"""
import math
from datetime import date as _date, datetime, timedelta, timezone as _tz
from typing import Any

import astronomy
from astronomy import (
    Time,
    Body,
    Observer,
    Refraction,
    SearchMoonQuarter,
    NextMoonQuarter,
    SearchLocalSolarEclipse,
    NextLocalSolarEclipse,
    SearchLunarEclipse,
    NextLunarEclipse,
    SearchRelativeLongitude,
    SearchSunLongitude,
    EclipseKind,
)

# ---------------------------------------------------------------------------
# Galactic center (Sgr A*) — J2000 equatorial coordinates
# RA 17h 45m 24s = 17.7567h   Dec −29° 00′ 29″ ≈ −29.0081°
# ---------------------------------------------------------------------------
_GC_RA  = 17.7567   # hours
_GC_DEC = -29.0081  # degrees

# Meteor shower peak solar longitudes (ecliptic J2000, established values).
# SearchSunLongitude uses these to find the exact peak date each year.
_METEOR_SHOWERS: list[tuple[str, float, str]] = [
    ("Quadrantids",  283.0, "Up to 120 meteors/hour; best in dark skies."),
    ("Lyrids",        31.5, "About 18 meteors/hour at peak."),
    ("Eta Aquarids",  46.0, "Up to 50 meteors/hour; best before dawn."),
    ("Perseids",     140.0, "Up to 100 meteors/hour; popular summer shower."),
    ("Orionids",     208.0, "About 20 meteors/hour."),
    ("Leonids",      235.0, "Variable; can produce storms every 33 years."),
    ("Geminids",     262.0, "Up to 120 meteors/hour; one of the best."),
    ("Ursids",       270.0, "About 10 meteors/hour."),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _time_to_iso_date(t: Time) -> str:
    return str(t)[:10]


def _utc_time_to_local_str(t: Time, timezone: str) -> str:
    """
    Convert an astronomy-engine Time to a human-readable local time string,
    e.g. '4:27 PM EST'. Falls back to 'HH:MM UTC' if the timezone is invalid.
    """
    try:
        import zoneinfo
        raw = str(t)[:19].replace("T", " ")
        utc_dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S").replace(tzinfo=_tz.utc)
        local_dt = utc_dt.astimezone(zoneinfo.ZoneInfo(timezone))
        h = local_dt.hour % 12 or 12
        ampm = "AM" if local_dt.hour < 12 else "PM"
        tz_abbr = local_dt.strftime("%Z")
        return f"{h}:{local_dt.minute:02d} {ampm} {tz_abbr}"
    except Exception:
        return str(t)[11:16] + " UTC"


# ---------------------------------------------------------------------------
# Moon phases
# ---------------------------------------------------------------------------

def get_moon_phases_for_year(year: int) -> list[dict[str, Any]]:
    """Return moon quarter events (New, First Quarter, Full, Third Quarter) for the year."""
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


# ---------------------------------------------------------------------------
# Solar eclipses — observer-specific type via SearchLocalSolarEclipse
# ---------------------------------------------------------------------------

def get_solar_eclipses_for_year(
    year: int, latitude: float, longitude: float, timezone: str = "UTC"
) -> list[dict[str, Any]]:
    """
    Return solar eclipses visible from the observer's exact location.
    The eclipse type (total / annular / partial) reflects what the observer
    actually sees, not the global eclipse type. Eclipses that peak with the
    Sun below the horizon are excluded.
    """
    events = []
    obs = Observer(latitude, longitude, 0.0)
    start = Time.Make(year, 1, 1, 0, 0, 0)
    kind_names = {
        EclipseKind.Total:   "Total Solar Eclipse",
        EclipseKind.Annular: "Annular Solar Eclipse",
        EclipseKind.Partial: "Partial Solar Eclipse",
    }
    try:
        e = SearchLocalSolarEclipse(start, obs)
        while True:
            date_str = _time_to_iso_date(e.peak.time)
            if int(date_str[:4]) > year:
                break
            # Only include if Sun is above the horizon and eclipse is perceptible
            if e.peak.altitude > 0 and e.obscuration > 0.001 and e.kind in kind_names:
                kind_name = kind_names[e.kind]
                pct = int(round(e.obscuration * 100))
                local_peak = _utc_time_to_local_str(e.peak.time, timezone)
                events.append({
                    "name": kind_name,
                    "date": date_str,
                    "type": "eclipse",
                    "description": (
                        f"{kind_name} visible from your location. "
                        f"Sun is {pct}% covered at peak ({local_peak})."
                    ),
                })
            e = NextLocalSolarEclipse(e.peak.time, obs)
    except Exception:
        pass
    return events


# ---------------------------------------------------------------------------
# Lunar eclipses
# ---------------------------------------------------------------------------

def get_lunar_eclipses_for_year(year: int, timezone: str = "UTC") -> list[dict[str, Any]]:
    """
    Return lunar eclipses for the year with peak time shown in the observer's
    local timezone (never UTC).
    """
    events = []
    start = Time.Make(year, 1, 1, 0, 0, 0)
    kind_names = {
        EclipseKind.Total:     "Total Lunar Eclipse",
        EclipseKind.Partial:   "Partial Lunar Eclipse",
        EclipseKind.Penumbral: "Penumbral Lunar Eclipse",
    }
    try:
        e = SearchLunarEclipse(start)
        while True:
            date_str = _time_to_iso_date(e.peak)
            if int(date_str[:4]) > year:
                break
            kind_name = kind_names.get(e.kind, "Lunar Eclipse")
            local_peak = _utc_time_to_local_str(e.peak, timezone)
            events.append({
                "name": kind_name,
                "date": date_str,
                "type": "eclipse",
                "description": (
                    f"{kind_name}. Peak at {local_peak}. "
                    "Visible wherever the Moon is above the horizon."
                ),
            })
            e = NextLunarEclipse(e.peak)
    except Exception:
        pass
    return events


# ---------------------------------------------------------------------------
# Meteor showers — real peak dates from solar longitude
# ---------------------------------------------------------------------------

def get_meteor_showers_for_year(year: int) -> list[dict[str, Any]]:
    """
    Calculate meteor shower peak dates from solar longitude using SearchSunLongitude.
    Each shower peaks when Earth passes through its debris stream — identified by
    the Sun reaching a specific ecliptic longitude. Dates vary by ±1–2 days per year.
    """
    events = []
    start = Time.Make(year, 1, 1, 0, 0, 0)
    for name, solar_lon, desc in _METEOR_SHOWERS:
        try:
            t = SearchSunLongitude(solar_lon, start, 366)
            if t is None:
                continue
            date_str = _time_to_iso_date(t)
            if int(date_str[:4]) != year:
                continue
            events.append({
                "name": f"{name} Meteor Shower",
                "date": date_str,
                "type": "meteor_shower",
                "description": desc,
            })
        except Exception:
            continue
    return events


# ---------------------------------------------------------------------------
# Milky Way windows — galactic center max altitude during the night
# ---------------------------------------------------------------------------

def _gc_max_alt_during_night(
    obs: Observer, year: int, month: int, day: int, lon: float
) -> float:
    """
    Maximum altitude of the galactic center (Sgr A*) across the observing night
    (8 PM to 4 AM local time), sampled every 30 minutes.

    Using the nightly maximum instead of the midnight snapshot ensures that
    August–October are included for northern latitudes (e.g. 43°N), where the
    core transits in early evening but has already descended below threshold by
    midnight — causing a false early season end when midnight-only is used.
    """
    utc_offset = lon / 15.0
    max_alt = -90.0
    for local_hour_offset in range(17):  # 17 steps × 0.5h = 8 PM to 4 AM
        local_hour = 20.0 + (local_hour_offset * 0.5)
        if local_hour >= 28.0:  # past 4 AM next day
            break
        actual_hour = local_hour % 24
        utc_hour = (actual_hour - utc_offset) % 24

        day_offset = 1 if local_hour >= 24.0 else 0
        d = _date(year, month, day) + timedelta(days=day_offset)

        h_int = int(utc_hour)
        m_int = int((utc_hour - h_int) * 60)
        try:
            t = Time.Make(d.year, d.month, d.day, h_int, m_int, 0)
            hor = astronomy.Horizon(t, obs, _GC_RA, _GC_DEC, Refraction.Normal)
            if hor.altitude > max_alt:
                max_alt = hor.altitude
        except Exception:
            continue
    return max_alt


def get_milky_way_windows_for_year(
    year: int,
    latitude: float,
    longitude: float = 0.0,
    min_alt: float = 10.0,
) -> list[dict[str, Any]]:
    """
    Return Milky Way season events based on when the galactic center (Sgr A*)
    reaches min_alt degrees above the horizon at any point during the night
    (8 PM – 4 AM local time), calculated for the observer's exact coordinates.

    Using nightly maximum (not midnight snapshot) correctly extends the season
    into August–October for northern latitudes where the core is visible in early
    evening but has set by midnight. Observers above ~61°N receive no events.
    Returns up to five milestones: season open, rising, peak, late, closing.
    """
    obs = Observer(latitude, longitude, 0.0)
    start = _date(year, 1, 1)

    # Sample nightly maximum altitude for every day of the year
    day_alts: list[tuple[str, float]] = []
    for offset in range(366):
        d = start + timedelta(days=offset)
        if d.year != year:
            break
        try:
            alt = _gc_max_alt_during_night(obs, d.year, d.month, d.day, longitude)
            day_alts.append((d.isoformat(), alt))
        except Exception:
            continue

    above = [(iso, alt) for iso, alt in day_alts if alt >= min_alt]
    if not above:
        return []

    peak_iso, peak_alt = max(above, key=lambda x: x[1])
    peak_month = int(peak_iso[5:7])

    # Build a month → best (iso, alt) lookup for quick milestone selection
    month_best: dict[int, tuple[str, float]] = {}
    for iso, alt in above:
        m = int(iso[5:7])
        if m not in month_best or alt > month_best[m][1]:
            month_best[m] = (iso, alt)

    used: set[str] = set()
    milestones: list[tuple[str, str]] = []

    def _add(iso: str, desc: str) -> None:
        if iso not in used:
            milestones.append((iso, desc))
            used.add(iso)

    # 1. Season opens — first day above threshold
    _add(
        above[0][0],
        f"Galactic center first clears {int(min_alt)}\u00b0 altitude during the night. "
        "Milky Way season opens for your latitude.",
    )

    # 2. Rising — best day two calendar months before peak
    rising_month = ((peak_month - 3) % 12) + 1
    if rising_month in month_best:
        _add(
            month_best[rising_month][0],
            "Core climbing higher each night. Good pre-midnight viewing begins from dark sites.",
        )

    # 3. Peak — day of maximum altitude
    if peak_alt < 20.0:
        peak_desc = (
            f"Galactic core reaches ~{int(peak_alt)}\u00b0 altitude during the night "
            "— best viewed in early evening from dark sites with a clear southern horizon."
        )
    else:
        peak_desc = (
            f"Peak season. Galactic core reaches {int(peak_alt)}\u00b0 altitude during the night "
            "— best dark-sky opportunity of the year from your latitude."
        )
    _add(peak_iso, peak_desc)

    # 4. Late — best day two calendar months after peak
    late_month = ((peak_month + 1) % 12) + 1
    if late_month in month_best:
        _add(
            month_best[late_month][0],
            "Core still visible during the night. Last wide viewing window before the season ends.",
        )

    # 5. Closing — last day above threshold
    _add(
        above[-1][0],
        f"Galactic center drops below {int(min_alt)}\u00b0 during the night. "
        "Season closing for your latitude.",
    )

    return [
        {
            "name": "Milky Way Season",
            "date": iso,
            "type": "milky_way",
            "description": desc,
        }
        for iso, desc in milestones
    ]


# ---------------------------------------------------------------------------
# Planet oppositions — calculated per year via SearchRelativeLongitude
# ---------------------------------------------------------------------------

def get_planet_events_for_year(year: int) -> list[dict[str, Any]]:
    """
    Return actual opposition dates for Mars, Jupiter, and Saturn using
    SearchRelativeLongitude(body, 180°, start). A planet is omitted when its
    opposition falls outside the requested year (Mars can skip years entirely).
    """
    events = []
    planets: list[tuple[Body, str, str]] = [
        (
            Body.Mars,
            "Mars Opposition",
            "Mars at opposition — at its brightest and visible all night. "
            "Good opportunity for surface features through a telescope.",
        ),
        (
            Body.Jupiter,
            "Jupiter Opposition",
            "Jupiter at opposition — brilliant and visible all night. "
            "Excellent for cloud bands, the Great Red Spot, and its four Galilean moons.",
        ),
        (
            Body.Saturn,
            "Saturn Opposition",
            "Saturn at opposition — rings at their best. Visible all night at its brightest.",
        ),
    ]
    start = Time.Make(year, 1, 1, 0, 0, 0)
    for body, name, desc in planets:
        try:
            t = SearchRelativeLongitude(body, 180.0, start)
            if t is None:
                continue
            date_str = _time_to_iso_date(t)
            if int(date_str[:4]) != year:
                continue  # Opposition falls in a different year — omit
            events.append({
                "name": name,
                "date": date_str,
                "type": "planet",
                "description": desc,
            })
        except Exception:
            continue
    return events


# ---------------------------------------------------------------------------
# Main tool entry points
# ---------------------------------------------------------------------------

def astronomy_tool(
    year: int,
    latitude: float,
    longitude: float = 0.0,
    timezone: str = "UTC",
    event_types: list[str] | None = None,
    start_date: str | None = None,
) -> list[dict[str, Any]]:
    """
    Get celestial events for a given year and observer location.

    Args:
        year:        Calendar year (e.g. 2026).
        latitude:    Observer latitude in decimal degrees (negative = Southern Hemisphere).
        longitude:   Observer longitude in decimal degrees (east positive). Default 0.
        timezone:    IANA timezone string for local time display, e.g. 'America/New_York'.
        event_types: Optional filter — list from 'meteor_shower', 'eclipse', 'moon',
                     'planet', 'milky_way'. Omit to return all types.
        start_date:  ISO date (YYYY-MM-DD). Events before this date are excluded.
                     Defaults to today.

    Returns:
        Sorted list of event dicts with keys: name, date (ISO), type, description.
    """
    cutoff = start_date or _date.today().isoformat()

    all_events: list[dict[str, Any]] = []
    all_events.extend(get_moon_phases_for_year(year))
    all_events.extend(get_solar_eclipses_for_year(year, latitude, longitude, timezone))
    all_events.extend(get_lunar_eclipses_for_year(year, timezone))
    all_events.extend(get_meteor_showers_for_year(year))
    all_events.extend(get_milky_way_windows_for_year(year, latitude, longitude))
    all_events.extend(get_planet_events_for_year(year))

    if event_types:
        all_events = [e for e in all_events if e["type"] in event_types]

    all_events.sort(key=lambda e: (e["date"], e["name"]))
    all_events = [e for e in all_events if e["date"] >= cutoff]
    return all_events


def get_events_for_year(
    year: int,
    latitude: float,
    longitude: float = 0.0,
    timezone: str = "UTC",
    filters: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Structured helper for POST /api/events.
    Returns all celestial events for the year and observer location.
    """
    return astronomy_tool(
        year=year,
        latitude=latitude,
        longitude=longitude,
        timezone=timezone,
        event_types=filters or None,
    )
