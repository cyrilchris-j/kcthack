"""
routes/cities.py
Blueprint: /api/cities  — city-wise waste distribution & heatmap data.
           /api/top-cities — top-N ranked cities for a given year.
"""

from flask import Blueprint, request, jsonify
from utils.city_data import CITIES, enrich_city, avg_recycling_rate

cities_bp = Blueprint("cities", __name__)


@cities_bp.route("/cities", methods=["GET"])
def cities():
    year   = int(request.args.get("year", 2024))
    result = sorted(
        [enrich_city(c, year) for c in CITIES],
        key=lambda x: x["waste_kt"],
        reverse=True,
    )
    return jsonify({"year": year, "cities": result, "avg_recycling_rate": avg_recycling_rate()})


@cities_bp.route("/top-cities", methods=["GET"])
def top_cities():
    year  = int(request.args.get("year",  2024))
    limit = int(request.args.get("limit", 5))

    ranked = sorted(
        [
            {
                "name":        c["name"],
                "lat":         c["lat"],
                "lng":         c["lng"],
                "population":  c["population"],
                "device_rate": c["device_rate"],
                "waste_kt":    round(c["base_waste"] * (1 + 0.04 * (year - 2023)), 1),
            }
            for c in CITIES
        ],
        key=lambda x: x["waste_kt"],
        reverse=True,
    )
    return jsonify({"year": year, "top_cities": ranked[:limit]})
