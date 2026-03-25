"""
Weather & Conditions tools — Phase 3B.

weather_tool:
  - For dates 0–16 days: live forecast via Open-Meteo forecast API
  - For dates >16 days: historical averages via Open-Meteo archive API
    (averages same calendar date across the 5 previous years)

Derives all 8 visibility factors:
  1. Cloud Cover       (30 pts)  — cloudcover %
  2. Transparency      (20 pts)  — visibility + humidity
  3. Atmospheric Seeing(20 pts)  — wind at 850 hPa pressure level
  4. Darkness / Moon   (15 pts)  — moon illumination from astronomy-engine
  5. Smoke / AQI       ( 5 pts)  — PM2.5 from Open-Meteo air quality API
  6. Wind              ( 4 pts)  — surface wind speed
  7. Humidity          ( 3 pts)  — relative humidity
  8. Temperature       ( 3 pts)  — comfort range 5–25 °C

Returns a dict matching ConditionsResponse schema.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

# ---------------------------------------------------------------------------
# Factor weights
# ---------------------------------------------------------------------------
WEIGHTS = {
    "Cloud Cover": 30,
    "Transparency": 20,
    "Atmospheric Seeing": 20,
    "Darkness": 15,
    "Smoke / AQI": 5,
    "Wind": 4,
    "Humidity": 3,
    "Temperature": 3,
}

# ---------------------------------------------------------------------------
# Score helpers
# ---------------------------------------------------------------------------

def _status(fraction: float) -> str:
    """fraction of max score achieved → good / moderate / poor."""
    if fraction >= 0.75:
        return "good"
    if fraction >= 0.45:
        return "moderate"
    return "poor"


def _cloud_factor(cloud_pct: float) -> dict:
    max_pts = WEIGHTS["Cloud Cover"]
    pts = round((1 - cloud_pct / 100) * max_pts)
    if cloud_pct < 20:
        detail = f"Clear ({int(cloud_pct)}% cloud cover)"
    elif cloud_pct < 50:
        detail = f"Mostly clear ({int(cloud_pct)}% cloud cover)"
    elif cloud_pct < 80:
        detail = f"Partly cloudy ({int(cloud_pct)}% cloud cover)"
    else:
        detail = f"Overcast ({int(cloud_pct)}% cloud cover)"
    return {"name": "Cloud Cover", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


def _transparency_factor(visibility_m: float, humidity_pct: float) -> dict:
    max_pts = WEIGHTS["Transparency"]
    # Visibility: 0–24 000 m; above 24 km treated as perfect
    vis_score = min(visibility_m / 24_000, 1.0)
    # Humidity: 0–100 %; higher is worse
    hum_score = 1 - humidity_pct / 100
    pts = round((vis_score * 0.6 + hum_score * 0.4) * max_pts)
    if pts >= 16:
        detail = f"Excellent — visibility {int(visibility_m/1000)} km, humidity {int(humidity_pct)}%"
    elif pts >= 10:
        detail = f"Good — visibility {int(visibility_m/1000)} km, humidity {int(humidity_pct)}%"
    elif pts >= 6:
        detail = f"Fair — visibility {int(visibility_m/1000)} km, humidity {int(humidity_pct)}%"
    else:
        detail = f"Poor — visibility {int(visibility_m/1000)} km, humidity {int(humidity_pct)}%"
    return {"name": "Transparency", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


def _seeing_factor(wind_850hpa_kmh: float) -> dict:
    max_pts = WEIGHTS["Atmospheric Seeing"]
    # Wind at 850 hPa: < 10 km/h excellent; > 50 km/h poor
    if wind_850hpa_kmh < 10:
        pts = max_pts
        detail = f"Excellent — low jet-stream activity ({int(wind_850hpa_kmh)} km/h at altitude)"
    elif wind_850hpa_kmh < 25:
        frac = 1 - (wind_850hpa_kmh - 10) / 40
        pts = round(frac * max_pts)
        detail = f"Good — moderate upper-atmosphere winds ({int(wind_850hpa_kmh)} km/h at altitude)"
    elif wind_850hpa_kmh < 50:
        frac = max(0, 1 - (wind_850hpa_kmh - 10) / 60)
        pts = round(frac * max_pts)
        detail = f"Fair — elevated upper winds may affect seeing ({int(wind_850hpa_kmh)} km/h)"
    else:
        pts = 0
        detail = f"Poor — strong jet-stream activity ({int(wind_850hpa_kmh)} km/h at altitude)"
    return {"name": "Atmospheric Seeing", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


def _darkness_factor(moon_illumination: float, rise_time: str, set_time: str) -> dict:
    max_pts = WEIGHTS["Darkness"]
    # 0 % illuminated (new moon) = full 15 pts; 100 % = 0 pts
    pts = round((1 - moon_illumination / 100) * max_pts)
    if moon_illumination < 15:
        detail = f"New moon — {int(moon_illumination)}% illuminated, excellent darkness"
    elif moon_illumination < 50:
        detail = f"Crescent moon — {int(moon_illumination)}% illuminated"
    elif moon_illumination < 85:
        detail = f"Quarter/gibbous moon — {int(moon_illumination)}% illuminated, moderate interference"
    else:
        detail = f"Near full moon — {int(moon_illumination)}% illuminated, significant light pollution"
    return {"name": "Darkness", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


def _smoke_factor(pm25: float) -> dict:
    max_pts = WEIGHTS["Smoke / AQI"]
    # PM2.5 μg/m³: < 12 good; < 35.4 moderate; > 35.4 poor
    if pm25 < 12:
        pts = max_pts
        detail = f"Air quality good (PM2.5 {pm25:.1f} μg/m³)"
    elif pm25 < 35.4:
        frac = 1 - (pm25 - 12) / 47.4
        pts = max(1, round(frac * max_pts))
        detail = f"Moderate smoke/haze (PM2.5 {pm25:.1f} μg/m³)"
    else:
        pts = 0
        detail = f"High smoke/haze (PM2.5 {pm25:.1f} μg/m³)"
    return {"name": "Smoke / AQI", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


def _wind_factor(wind_10m_kmh: float) -> dict:
    max_pts = WEIGHTS["Wind"]
    # < 10 km/h = excellent; > 40 = poor
    if wind_10m_kmh < 10:
        pts = max_pts
        detail = f"Calm — {int(wind_10m_kmh)} km/h"
    elif wind_10m_kmh < 25:
        frac = 1 - (wind_10m_kmh - 10) / 40
        pts = max(1, round(frac * max_pts))
        detail = f"Light wind — {int(wind_10m_kmh)} km/h"
    else:
        pts = 0
        detail = f"Windy — {int(wind_10m_kmh)} km/h"
    return {"name": "Wind", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


def _humidity_factor(humidity_pct: float) -> dict:
    max_pts = WEIGHTS["Humidity"]
    # < 50% = good; > 85% = poor
    if humidity_pct < 50:
        pts = max_pts
        detail = f"Low humidity — {int(humidity_pct)}%"
    elif humidity_pct < 75:
        pts = 2
        detail = f"Moderate humidity — {int(humidity_pct)}%"
    else:
        pts = 0 if humidity_pct >= 90 else 1
        detail = f"High humidity — {int(humidity_pct)}%"
    return {"name": "Humidity", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


def _temp_factor(temp_c: float) -> dict:
    max_pts = WEIGHTS["Temperature"]
    # Comfort range 5–25°C = max; outside this it's suboptimal
    if 5 <= temp_c <= 25:
        pts = max_pts
        detail = f"Comfortable — {temp_c:.0f}°C"
    elif -5 <= temp_c < 5 or 25 < temp_c <= 35:
        pts = 2
        detail = f"Cool/warm — {temp_c:.0f}°C (dress accordingly)"
    else:
        pts = 0
        detail = f"Extreme temperature — {temp_c:.0f}°C"
    return {"name": "Temperature", "score": pts, "max_score": max_pts,
            "status": _status(pts / max_pts), "detail": detail}


# ---------------------------------------------------------------------------
# Moon calculations via astronomy-engine
# ---------------------------------------------------------------------------

def _moon_info(obs_date: date, timezone: str, lat: float = 0.0, lon: float = 0.0) -> dict:
    """Return phase name, illumination %, rise/set times, best viewing window.

    Searches a 36-hour window starting from local noon of obs_date so that
    moonsets which cross into the next calendar day are never missed.
    Times are shown in local timezone; set_time is suffixed ' +1' when the
    moon sets after local midnight (i.e. early morning of obs_date + 1 day).
    """
    try:
        import astronomy  # astronomy-engine
    except ImportError:
        return {
            "phase": "Unknown",
            "illumination": 50,
            "rise_time": "N/A",
            "set_time": "N/A",
            "best_viewing_window": "Conditions data unavailable",
        }

    try:
        tz = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, Exception):
        tz = ZoneInfo("UTC")

    # Phase / illumination calculated at local midnight of obs_date
    time_obj = astronomy.Time.Make(obs_date.year, obs_date.month, obs_date.day, 0, 0, 0.0)
    phase_angle = astronomy.MoonPhase(time_obj)
    illum = astronomy.Illumination(astronomy.Body.Moon, time_obj)
    illumination_pct = round(illum.phase_fraction * 100)

    # Phase name from angle
    if phase_angle < 22.5 or phase_angle >= 337.5:
        phase_name = "New Moon"
    elif phase_angle < 67.5:
        phase_name = "Waxing Crescent"
    elif phase_angle < 112.5:
        phase_name = "First Quarter"
    elif phase_angle < 157.5:
        phase_name = "Waxing Gibbous"
    elif phase_angle < 202.5:
        phase_name = "Full Moon"
    elif phase_angle < 247.5:
        phase_name = "Waning Gibbous"
    elif phase_angle < 292.5:
        phase_name = "Last Quarter"
    else:
        phase_name = "Waning Crescent"

    # Search start = local noon of obs_date, converted to UTC.
    # A 36-hour (1.5-day) window from noon covers the full observing night
    # plus early hours of the next morning, so no moonset is ever missed.
    try:
        local_noon = datetime(obs_date.year, obs_date.month, obs_date.day, 12, 0, 0, tzinfo=tz)
        noon_utc = local_noon.astimezone(ZoneInfo("UTC"))
        search_start = astronomy.Time.Make(
            noon_utc.year, noon_utc.month, noon_utc.day,
            noon_utc.hour, noon_utc.minute, float(noon_utc.second),
        )
    except Exception:
        search_start = time_obj  # fallback to midnight UTC

    obs = astronomy.Observer(lat, lon, 0.0)

    # Rise time
    try:
        rise_event = astronomy.SearchRiseSet(
            astronomy.Body.Moon, obs, astronomy.Direction.Rise, search_start, 1.5
        )
        if rise_event is not None:
            rise_dt = rise_event.Utc().replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
            rise_str = rise_dt.strftime("%H:%M")
        else:
            rise_str = "N/A"
    except Exception:
        rise_str = "N/A"

    # Set time — tag with ' +1' when moonset falls after local midnight
    set_str = "N/A"
    try:
        set_event = astronomy.SearchRiseSet(
            astronomy.Body.Moon, obs, astronomy.Direction.Set, search_start, 1.5
        )
        if set_event is not None:
            set_dt = set_event.Utc().replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
            set_str = set_dt.strftime("%H:%M")
            if set_dt.date() > obs_date:
                set_str += " +1"
    except Exception:
        set_str = "N/A"

    # Best viewing window
    if illumination_pct < 15:
        best_window = "All night — near new moon, ideal darkness"
    elif set_str != "N/A":
        if "+1" in set_str:
            time_only = set_str.replace(" +1", "")
            best_window = f"After {time_only} (next morning) when moon has set"
        else:
            best_window = f"After {set_str} when moon has set"
    else:
        best_window = "Avoid peak moonrise hours"

    return {
        "phase": phase_name,
        "illumination": illumination_pct,
        "rise_time": rise_str,
        "set_time": set_str,
        "best_viewing_window": best_window,
    }


# ---------------------------------------------------------------------------
# Open-Meteo data fetching
# ---------------------------------------------------------------------------

def _target_hour(obs_date: date, timezone: str) -> int:
    """Return the hour (0–23) of astronomical midnight in local time."""
    # Use 22:00 local as the representative "dark hour" for forecast lookup
    return 22


def _fetch_forecast(lat: float, lon: float, obs_date: date, timezone: str) -> dict:
    """Fetch hourly forecast from Open-Meteo for obs_date. Returns raw hourly values."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join([
            "cloudcover", "visibility", "windspeed_10m",
            "windspeed_850hPa", "temperature_2m", "relativehumidity_2m",
        ]),
        "forecast_days": 16,
        "timezone": timezone,
    }
    r = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=15)
    r.raise_for_status()
    data = r.json()
    times: list[str] = data["hourly"]["time"]
    target = f"{obs_date.isoformat()}T{_target_hour(obs_date, timezone):02d}:00"
    # Find closest hour
    idx = 0
    for i, t in enumerate(times):
        if t >= target:
            idx = i
            break
    h = data["hourly"]
    return {
        "cloudcover": h["cloudcover"][idx] or 0.0,
        "visibility": h["visibility"][idx] or 10_000.0,
        "windspeed_10m": h["windspeed_10m"][idx] or 0.0,
        "windspeed_850hPa": h["windspeed_850hPa"][idx] or 0.0,
        "temperature_2m": h["temperature_2m"][idx] or 15.0,
        "relativehumidity_2m": h["relativehumidity_2m"][idx] or 50.0,
    }


def _fetch_historical_avg(lat: float, lon: float, obs_date: date) -> dict:
    """
    Fetch historical averages for the same calendar date over the 5 most recent
    complete years. Returns averaged values.

    Data sources (both requested with timezone=UTC so indices are UTC hours):
    - years >= 2022: Historical Forecast API — supports windspeed_850hPa directly,
      identical variable names to the live forecast API.
    - years <  2022 (or on fetch failure): ERA5 archive API — uses windspeed_1000hPa
      as a surface-level proxy for 850hPa (less accurate but widely available).

    Night-time hour indices 20–23 always refer to 20:00–23:00 UTC because both
    APIs are explicitly requested with timezone=UTC.
    """
    today = date.today()
    year = obs_date.year
    # Collect up to 5 past complete years
    years_to_avg: list[int] = []
    for dy in range(1, 6):
        y = year - dy
        if y < 1940:
            break
        # Don't request future archive dates
        check_date = obs_date.replace(year=y)
        if check_date < today:
            years_to_avg.append(y)

    if not years_to_avg:
        # Fall back to reasonable defaults
        return {
            "cloudcover": 40.0, "visibility": 15_000.0, "windspeed_10m": 10.0,
            "windspeed_850hPa": 20.0, "temperature_2m": 15.0, "relativehumidity_2m": 55.0,
        }

    all_vals: list[dict] = []
    for y in years_to_avg:
        archive_date = obs_date.replace(year=y)
        fetched = False

        # Historical Forecast API: officially available from 2022 onwards.
        # Variable names are identical to the live forecast API (verified).
        # Request timezone=UTC so hour indices 20-23 = 20:00-23:00 UTC.
        if y >= 2022:
            try:
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": ",".join([
                        "cloudcover", "visibility", "windspeed_10m",
                        "windspeed_850hPa", "temperature_2m", "relativehumidity_2m",
                    ]),
                    "start_date": archive_date.isoformat(),
                    "end_date": archive_date.isoformat(),
                    "timezone": "UTC",
                }
                r = httpx.get(
                    "https://historical-forecast-api.open-meteo.com/v1/forecast",
                    params=params, timeout=15,
                )
                r.raise_for_status()
                d = r.json()["hourly"]
                night_idx = list(range(20, min(24, len(d["cloudcover"]))))
                if not night_idx:
                    night_idx = [0]

                def avg_hf(key: str, fallback: float = 0.0) -> float:
                    vals = [d[key][i] for i in night_idx if d[key][i] is not None]
                    return sum(vals) / len(vals) if vals else fallback

                all_vals.append({
                    "cloudcover": avg_hf("cloudcover", 40.0),
                    "visibility": avg_hf("visibility", 10_000.0),
                    "windspeed_10m": avg_hf("windspeed_10m", 10.0),
                    "windspeed_850hPa": avg_hf("windspeed_850hPa", 20.0),
                    "temperature_2m": avg_hf("temperature_2m", 15.0),
                    "relativehumidity_2m": avg_hf("relativehumidity_2m", 55.0),
                })
                fetched = True
            except Exception:
                pass  # fall through to ERA5 archive below

        # ERA5 archive API fallback: years before 2022, or if historical forecast failed.
        # Uses windspeed_1000hPa as a surface-level proxy for 850hPa (less accurate).
        # Request timezone=UTC so hour indices 20-23 = 20:00-23:00 UTC.
        if not fetched:
            try:
                params = {
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": ",".join([
                        "cloudcover", "visibility", "windspeed_10m",
                        "windspeed_1000hPa", "temperature_2m", "relativehumidity_2m",
                    ]),
                    "start_date": archive_date.isoformat(),
                    "end_date": archive_date.isoformat(),
                    "timezone": "UTC",
                }
                r = httpx.get("https://archive-api.open-meteo.com/v1/archive",
                              params=params, timeout=15)
                r.raise_for_status()
                d = r.json()["hourly"]
                night_idx = list(range(20, min(24, len(d["cloudcover"]))))
                if not night_idx:
                    night_idx = [0]

                def avg_era5(key: str, fallback: float = 0.0) -> float:
                    vals = [d[key][i] for i in night_idx if d[key][i] is not None]
                    return sum(vals) / len(vals) if vals else fallback

                all_vals.append({
                    "cloudcover": avg_era5("cloudcover", 40.0),
                    "visibility": avg_era5("visibility", 10_000.0),
                    "windspeed_10m": avg_era5("windspeed_10m", 10.0),
                    "windspeed_850hPa": avg_era5("windspeed_1000hPa", 20.0),
                    "temperature_2m": avg_era5("temperature_2m", 15.0),
                    "relativehumidity_2m": avg_era5("relativehumidity_2m", 55.0),
                })
            except Exception:
                continue  # skip bad years

    if not all_vals:
        return {
            "cloudcover": 40.0, "visibility": 15_000.0, "windspeed_10m": 10.0,
            "windspeed_850hPa": 20.0, "temperature_2m": 15.0, "relativehumidity_2m": 55.0,
        }

    keys = list(all_vals[0].keys())
    return {k: sum(v[k] for v in all_vals) / len(all_vals) for k in keys}


def _fetch_pm25(lat: float, lon: float, obs_date: date, timezone: str) -> float:
    """Fetch PM2.5 from Open-Meteo air quality API. Returns μg/m³."""
    try:
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "pm2_5",
            "forecast_days": 1,
            "timezone": timezone,
        }
        r = httpx.get("https://air-quality-api.open-meteo.com/v1/air-quality",
                      params=params, timeout=10)
        r.raise_for_status()
        vals = r.json()["hourly"]["pm2_5"]
        valid = [v for v in vals if v is not None]
        return sum(valid) / len(valid) if valid else 10.0
    except Exception:
        return 10.0  # assume good if unavailable


# ---------------------------------------------------------------------------
# Score label
# ---------------------------------------------------------------------------

def _score_label(score: int) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Fair"
    return "Poor"


# ---------------------------------------------------------------------------
# AI Take — rule-based plain English paragraph
# ---------------------------------------------------------------------------

def _ai_take(score: int, label: str, factors: list[dict], moon: dict,
             data_type: str, spot_name: str = "") -> str:
    cloud = next((f for f in factors if f["name"] == "Cloud Cover"), None)
    moon_illum = moon.get("illumination", 50)
    moon_phase = moon.get("phase", "")

    if score >= 85:
        opener = f"Conditions look excellent{' at ' + spot_name if spot_name else ''}."
    elif score >= 70:
        opener = f"Tonight looks good for stargazing{' at ' + spot_name if spot_name else ''}."
    elif score >= 50:
        opener = f"Conditions are fair{' at ' + spot_name if spot_name else ''}."
    else:
        opener = f"Conditions are challenging{' at ' + spot_name if spot_name else ''}."

    moon_comment = ""
    if moon_illum < 20:
        moon_comment = f"The {moon_phase.lower()} keeps skies very dark — perfect for faint objects."
    elif moon_illum < 50:
        moon_comment = f"The {moon_phase.lower()} ({moon_illum}% illuminated) sets {moon.get('set_time', 'early')}, leaving dark skies later in the night."
    else:
        moon_comment = f"The {moon_phase.lower()} ({moon_illum}% illuminated) will brighten skies — best for planets and brighter objects."

    if data_type == "historical_average":
        closing = "Note: this is based on historical averages — actual conditions will vary."
    elif cloud and cloud["status"] == "poor":
        closing = "Check the forecast closer to your visit date as clouds may clear."
    elif score >= 70:
        closing = f"Aim for after {moon.get('set_time', '22:00') if moon_illum >= 20 else '10 pm'} for the darkest skies."
    else:
        closing = "Consider an alternate date if conditions don't improve."

    return f"{opener} {moon_comment} {closing}"


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def weather_tool(lat: float, lon: float, obs_date_str: str, timezone: str,
                 spot_name: str = "") -> dict:
    """
    Compute full 8-factor visibility conditions for (lat, lon) on obs_date_str.

    Args:
        lat, lon:       Location of the dark sky spot
        obs_date_str:   ISO date "YYYY-MM-DD"
        timezone:       IANA timezone string, e.g. "America/Chicago"
        spot_name:      Optional spot name for ai_take text

    Returns:
        dict matching ConditionsResponse schema (without Pydantic wrapping).
    """
    obs_date = date.fromisoformat(obs_date_str)
    today = date.today()
    days_out = (obs_date - today).days

    is_forecast = days_out <= 16
    data_type = "forecast" if is_forecast else "historical_average"

    # --- Fetch weather data ---
    if is_forecast:
        wx = _fetch_forecast(lat, lon, obs_date, timezone)
    else:
        wx = _fetch_historical_avg(lat, lon, obs_date)

    pm25 = _fetch_pm25(lat, lon, obs_date, timezone) if is_forecast else 10.0

    # --- Moon info ---
    moon = _moon_info(obs_date, timezone, lat, lon)

    # --- Compute 8 factors ---
    factors = [
        _cloud_factor(wx["cloudcover"]),
        _transparency_factor(wx["visibility"], wx["relativehumidity_2m"]),
        _seeing_factor(wx["windspeed_850hPa"]),
        _darkness_factor(moon["illumination"], moon["rise_time"], moon["set_time"]),
        _smoke_factor(pm25),
        _wind_factor(wx["windspeed_10m"]),
        _humidity_factor(wx["relativehumidity_2m"]),
        _temp_factor(wx["temperature_2m"]),
    ]

    total_score = sum(f["score"] for f in factors)
    label = _score_label(total_score)
    ai_take = _ai_take(total_score, label, factors, moon, data_type, spot_name)

    return {
        "score": total_score,
        "label": label,
        "factors": factors,
        "moon": moon,
        "ai_take": ai_take,
        "data_type": data_type,
    }
