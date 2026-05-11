"""
routes/scenario.py
Blueprint: /api/scenario  — future scenario simulation
           (Optimistic / Baseline / Pessimistic trajectories).
"""

from flask import Blueprint, request, jsonify
from models.predictor import predict_waste

scenario_bp = Blueprint("scenario", __name__)


@scenario_bp.route("/scenario", methods=["POST"])
def scenario():
    data = request.get_json(force=True)

    base_population  = float(data.get("population",    1.4))
    base_device_rate = float(data.get("device_rate",   0.5))
    growth_rate      = float(data.get("growth_rate",   0.012))   # annual pop growth
    adoption_rate    = float(data.get("adoption_rate", 0.02))    # annual tech adoption
    recycling_rate   = float(data.get("recycling_rate",0.20))    # fraction recycled
    start_year       = int(data.get("start_year",      2024))
    end_year         = int(data.get("end_year",        2040))

    scenarios = {"optimistic": [], "baseline": [], "pessimistic": []}

    for year in range(start_year, end_year + 1):
        offset = year - start_year
        pop    = base_population  * ((1 + growth_rate)   ** offset)
        rate   = min(0.98, base_device_rate * ((1 + adoption_rate) ** offset))

        # ── Baseline ─────────────────────────────────────────────────────────
        base  = predict_waste(pop, rate, year) * (1 - recycling_rate)

        # ── Optimistic: slower adoption + better recycling ────────────────────
        opt_rate    = min(0.98, base_device_rate * ((1 + adoption_rate * 0.6) ** offset))
        opt_recycle = min(0.70, recycling_rate + 0.02 * offset)
        optimistic  = predict_waste(pop, opt_rate, year) * (1 - opt_recycle)

        # ── Pessimistic: faster adoption + weaker recycling ───────────────────
        pess_rate    = min(0.98, base_device_rate * ((1 + adoption_rate * 1.5) ** offset))
        pess_recycle = max(0.05, recycling_rate - 0.005 * offset)
        pessimistic  = predict_waste(pop, pess_rate, year) * (1 - pess_recycle)

        for label, value in [
            ("baseline",    base),
            ("optimistic",  optimistic),
            ("pessimistic", pessimistic),
        ]:
            scenarios[label].append({
                "year":  year,
                "waste": round(max(0, value), 2),
            })

    return jsonify({"scenarios": scenarios, "recycling_rate": recycling_rate})
