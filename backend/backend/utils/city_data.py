"""
utils/city_data.py
Static city dataset and helpers for waste-intensity calculations.
"""

# ─── Master City Dataset ──────────────────────────────────────────────────────
# base_waste: kilotons (2023 baseline)
CITIES = [
    {"name": "Mumbai",       "lat": 19.0760, "lng": 72.8777, "base_waste": 412, "population": 20.7, "device_rate": 0.72, "recycling_rate": 0.28},
    {"name": "Delhi",        "lat": 28.7041, "lng": 77.1025, "base_waste": 396, "population": 32.9, "device_rate": 0.68, "recycling_rate": 0.22},
    {"name": "Bangalore",    "lat": 12.9716, "lng": 77.5946, "base_waste": 378, "population": 12.3, "device_rate": 0.85, "recycling_rate": 0.35},
    {"name": "Chennai",      "lat": 13.0827, "lng": 80.2707, "base_waste": 290, "population": 10.9, "device_rate": 0.78, "recycling_rate": 0.30},
    {"name": "Hyderabad",    "lat": 17.3850, "lng": 78.4867, "base_waste": 275, "population": 10.0, "device_rate": 0.80, "recycling_rate": 0.32},
    {"name": "Kolkata",      "lat": 22.5726, "lng": 88.3639, "base_waste": 260, "population": 14.9, "device_rate": 0.65, "recycling_rate": 0.18},
    {"name": "Pune",         "lat": 18.5204, "lng": 73.8567, "base_waste": 230, "population":  7.4, "device_rate": 0.82, "recycling_rate": 0.30},
    {"name": "Ahmedabad",    "lat": 23.0225, "lng": 72.5714, "base_waste": 195, "population":  8.0, "device_rate": 0.70, "recycling_rate": 0.20},
    {"name": "Jaipur",       "lat": 26.9124, "lng": 75.7873, "base_waste": 145, "population":  4.0, "device_rate": 0.62, "recycling_rate": 0.15},
    {"name": "Lucknow",      "lat": 26.8467, "lng": 80.9462, "base_waste": 130, "population":  3.7, "device_rate": 0.58, "recycling_rate": 0.12},
    {"name": "Surat",        "lat": 21.1702, "lng": 72.8311, "base_waste": 180, "population":  7.5, "device_rate": 0.68, "recycling_rate": 0.18},
    {"name": "Nagpur",       "lat": 21.1458, "lng": 79.0882, "base_waste": 110, "population":  3.1, "device_rate": 0.55, "recycling_rate": 0.14},
    {"name": "Bhopal",       "lat": 23.2599, "lng": 77.4126, "base_waste":  95, "population":  2.4, "device_rate": 0.52, "recycling_rate": 0.10},
    {"name": "Visakhapatnam","lat": 17.6868, "lng": 83.2185, "base_waste": 105, "population":  2.1, "device_rate": 0.60, "recycling_rate": 0.16},
    {"name": "Kochi",        "lat":  9.9312, "lng": 76.2673, "base_waste": 120, "population":  2.8, "device_rate": 0.75, "recycling_rate": 0.25},
]

# Annual growth factor applied per year beyond 2023 baseline
_ANNUAL_GROWTH = 0.04
# Intensity normaliser (kt → 0-1 scale)
_INTENSITY_MAX = 450.0


def risk_level(intensity: float) -> str:
    if intensity > 0.7:  return "Critical"
    if intensity > 0.5:  return "High"
    if intensity > 0.3:  return "Medium"
    return "Low"


def enrich_city(city: dict, year: int) -> dict:
    """Add waste_kt, intensity, risk_level, and recycling_rate to a city dict for a given year."""
    year_factor    = 1 + _ANNUAL_GROWTH * (year - 2023)
    waste_kt       = round(city["base_waste"] * year_factor, 1)
    intensity      = round(min(1.0, waste_kt / _INTENSITY_MAX), 3)
    return {
        "name":           city["name"],
        "lat":            city["lat"],
        "lng":            city["lng"],
        "waste_kt":       waste_kt,
        "intensity":      intensity,
        "population":     city["population"],
        "device_rate":    city["device_rate"],
        "recycling_rate": city["recycling_rate"],
        "risk_level":     risk_level(intensity),
    }


def avg_recycling_rate() -> float:
    """Return the average formal recycling rate across all monitored cities."""
    return round(sum(c["recycling_rate"] for c in CITIES) / len(CITIES), 3)
