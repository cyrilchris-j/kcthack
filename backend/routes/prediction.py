"""
routes/prediction.py
Blueprint: /api/predict  — single-point waste prediction.
"""

from flask import Blueprint, request, jsonify
from models.predictor import predict_waste

prediction_bp = Blueprint("prediction", __name__)


@prediction_bp.route("/predict", methods=["POST"])
def predict():
    data        = request.get_json(force=True)
    population  = float(data.get("population",  1.4))   # millions
    device_rate = float(data.get("device_rate", 0.5))   # 0–1
    year        = int(data.get("year",          2024))

    predicted = predict_waste(population, device_rate, year)
    lower     = round(predicted * 0.95, 2)
    upper     = round(predicted * 1.05, 2)

    return jsonify({
        "year":                 year,
        "population":           population,
        "device_rate":          device_rate,
        "predicted_waste_mmt":  predicted,
        "confidence_lower":     lower,
        "confidence_upper":     upper,
        "unit":                 "Million Metric Tons",
    })
