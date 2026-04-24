"""
app.py  —  E-Waste Intelligence System
Entry point: creates the Flask app, registers blueprints,
and serves the frontend from ../frontend/.

Run:
    cd backend
    python3 app.py
"""

import os
from flask import Flask, send_from_directory
from flask_cors import CORS

from routes.prediction import prediction_bp
from routes.forecast   import forecast_bp
from routes.cities     import cities_bp
from routes.scenario   import scenario_bp

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

# ─── App Factory ──────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app, origins="*")

# ─── Register Blueprints ──────────────────────────────────────────────────────
app.register_blueprint(prediction_bp, url_prefix="/api")
app.register_blueprint(forecast_bp,   url_prefix="/api")
app.register_blueprint(cities_bp,     url_prefix="/api")
app.register_blueprint(scenario_bp,   url_prefix="/api")

# ─── Health Check ─────────────────────────────────────────────────────────────
from flask import jsonify

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "message": "E-Waste Intelligence System API"})

# ─── Frontend Serving ─────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)

# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5001)
