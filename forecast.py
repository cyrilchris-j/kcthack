"""
routes/forecast.py
Blueprint: /api/forecast  — year-by-year time-series forecast (2010 → 2040).
"""

from flask import Blueprint, request, jsonify
from models.predictor import predict_waste

forecast_bp = Blueprint("forecast", __name__)


@forecast_bp.route("/forecast", methods=["GET"])
def forecast():
    population  = float(request.args.get("population",  1.4))
    device_rate = float(request.args.get("device_rate", 0.5))

    results = []
    for year in range(2010, 2041):
        # Future years: project demographic/adoption growth from 2024
        adj_pop  = population  * (1 + 0.012 * (year - 2024)) if year > 2024 else population
        adj_rate = min(0.95, device_rate * (1 + 0.01 * (year - 2024))) if year > 2024 else device_rate

        results.append({
            "year":        year,
            "waste":       predict_waste(adj_pop, adj_rate, year),
            "population":  round(adj_pop,  2),
            "device_rate": round(adj_rate, 3),
            "is_forecast": year > 2023,
        })

    return jsonify({"forecast": results})
