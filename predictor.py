"""
models/predictor.py
ML model: Polynomial Regression for e-waste prediction.
Trained once at import time; reused across all requests.
"""

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures

# ─── Training Data ────────────────────────────────────────────────────────────
# Features: [population_millions, device_usage_rate, year_offset_from_2010]
# Target  : e-waste in Million Metric Tons (MMT)
_X_TRAIN = np.array([
    [1.4,  0.30,  0],   # 2010
    [1.6,  0.35,  1],
    [1.8,  0.40,  2],
    [2.0,  0.45,  3],
    [2.3,  0.50,  4],
    [2.6,  0.55,  5],
    [2.9,  0.60,  6],
    [3.2,  0.65,  7],
    [3.6,  0.70,  8],
    [4.0,  0.75,  9],
    [4.5,  0.78, 10],   # 2020
    [5.0,  0.80, 11],
    [5.5,  0.83, 12],
    [6.2,  0.85, 13],   # 2023
])
_Y_TRAIN = np.array([
    33.8, 36.2, 38.5, 41.0, 43.8, 46.9,
    50.0, 53.6, 57.4, 61.3, 53.6, 57.4,
    59.4, 61.3
])

# ─── Build & Fit ──────────────────────────────────────────────────────────────
_poly  = PolynomialFeatures(degree=2, include_bias=False)
_X_poly = _poly.fit_transform(_X_TRAIN)
_model  = LinearRegression().fit(_X_poly, _Y_TRAIN)


# ─── Public API ───────────────────────────────────────────────────────────────
def predict_waste(population: float, device_rate: float, year: int) -> float:
    """Return predicted e-waste (MMT) for given inputs. Always ≥ 0."""
    year_offset = year - 2010
    features    = np.array([[population, device_rate, year_offset]])
    features_poly = _poly.transform(features)
    prediction    = _model.predict(features_poly)[0]
    return max(0.0, round(float(prediction), 2))
