"""
Crew M API server.

Serves persona data, audience recommendations, and campaign simulation
results to the frontend. All data access is logged for audit compliance.
"""

import time
import logging
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from synthetic import generate_users, generate_campaigns
from pipeline import cluster_users, assign_persona_names, score_audience_fit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crewm")

app = FastAPI(title="Crew M API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup: generate data and run pipeline ---

_state = {}


def _compute_key_metrics(users) -> dict:
    """Derive key metrics from actual data, not hardcoded numbers."""
    n = len(users)
    no_app = (~users["has_app"]).mean()
    has_any_booking = (users["has_th_booking"] | users["has_hc_booking"])
    employee_activation = has_any_booking.mean()

    # Org-level: what share of unique segments have at least one active user
    org_groups = users.groupby("partner_segment")["has_th_booking"].apply(lambda x: x.any())
    org_activation = org_groups.mean()

    gap = round((org_activation - employee_activation) * 100)

    return {
        "total_eligible_users": n,
        "no_app_share": round(no_app, 3),
        "org_activation_rate": round(org_activation, 3),
        "employee_activation_rate": round(employee_activation, 3),
        "structural_gap": f"{gap} points between org and employee activation",
    }


def get_state():
    if not _state:
        logger.info("Generating synthetic data...")
        t0 = time.time()
        users = generate_users(10_000)
        campaigns = generate_campaigns(50)

        logger.info("Running clustering pipeline...")
        result = cluster_users(users)
        personas = assign_persona_names(result["personas"])

        _state["users"] = users
        _state["campaigns"] = campaigns
        _state["cluster_result"] = result
        _state["personas"] = personas

        logger.info(f"Pipeline complete in {time.time() - t0:.1f}s — {len(personas)} personas discovered")
    return _state


# --- Models ---

class SimulationRequest(BaseModel):
    objective: str
    channel: Optional[str] = None
    persona_ids: Optional[list[int]] = None
    copy_text: Optional[str] = None
    send_hour: Optional[int] = None


# --- Endpoints ---

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/dashboard")
def dashboard():
    """Dashboard summary: model confidence, top personas, key metrics."""
    state = get_state()
    personas = state["personas"]
    result = state["cluster_result"]
    campaigns = state["campaigns"]

    # Audit log: data access
    logger.info("DATA_ACCESS: dashboard summary requested")

    top_personas = sorted(personas, key=lambda p: p["size"], reverse=True)[:5]

    return {
        "label": "OBSERVED",
        "model_confidence": {
            "silhouette_score": result["silhouette_score"],
            "n_users_analyzed": result["n_users"],
            "n_personas": result["n_clusters"],
            "data_source": "synthetic_calibrated",
        },
        "top_personas": [
            {
                "id": p["id"],
                "name": p["name"],
                "size": p["size"],
                "share": p["share"],
                "th_adoption": p["th_adoption_rate"],
                "hc_adoption": p["hc_adoption_rate"],
                "app_installed": p["app_installed_share"],
            }
            for p in top_personas
        ],
        "campaign_summary": {
            "total_campaigns": len(campaigns),
            "avg_delivery_rate": round(campaigns["delivery_rate"].mean(), 3),
            "avg_open_rate": round(campaigns["open_rate"].mean(), 3),
            "avg_click_rate": round(campaigns["click_rate"].mean(), 3),
            "channels_used": campaigns["channel"].value_counts().to_dict(),
        },
        "key_metrics": _compute_key_metrics(state["users"]),
    }


@app.get("/api/personas")
def list_personas():
    """All discovered personas with full behavioral detail."""
    state = get_state()
    logger.info("DATA_ACCESS: full persona list requested")
    return {
        "label": "OBSERVED",
        "personas": state["personas"],
        "silhouette_score": state["cluster_result"]["silhouette_score"],
        "features_used": state["cluster_result"]["features_used"],
    }


@app.get("/api/personas/{persona_id}")
def get_persona(persona_id: int):
    """Single persona with all detail."""
    state = get_state()
    for p in state["personas"]:
        if p["id"] == persona_id:
            logger.info(f"DATA_ACCESS: persona {persona_id} detail requested")
            return {"label": "OBSERVED", "persona": p}
    return {"error": "Persona not found"}


@app.get("/api/audience/recommend")
def recommend_audience(
    objective: str = Query(..., description="Campaign objective: th_activation, hc_activation, app_install, reengagement, hc_crosssell"),
):
    """Rank personas by fit for a campaign objective."""
    state = get_state()
    logger.info(f"DATA_ACCESS: audience recommendation for objective={objective}")

    scores = []
    for p in state["personas"]:
        fit = score_audience_fit(p, objective)
        scores.append(fit)

    scores.sort(key=lambda s: s["score"], reverse=True)

    return {
        "label": "RECOMMENDED",
        "objective": objective,
        "rankings": scores,
    }


@app.post("/api/simulate")
def simulate_campaign(req: SimulationRequest):
    """
    Simulate campaign performance for given parameters.
    Returns PREDICTED funnel metrics with confidence.
    """
    state = get_state()
    campaigns = state["campaigns"]
    personas = state["personas"]

    logger.info(f"DATA_ACCESS: simulation requested — objective={req.objective}, channel={req.channel}")

    # Filter historical campaigns — cascade: objective+channel → objective → all
    relevant = campaigns[campaigns["objective"] == req.objective]
    evidence_note = f"objective '{req.objective}'"

    if req.channel:
        channel_relevant = relevant[relevant["channel"] == req.channel]
        if len(channel_relevant) >= 3:
            relevant = channel_relevant
            evidence_note = f"objective '{req.objective}' + channel '{req.channel}'"

    if len(relevant) < 3:
        relevant = campaigns[campaigns["objective"] == req.objective]
        evidence_note = f"objective '{req.objective}' (all channels)"

    if len(relevant) < 3:
        relevant = campaigns
        evidence_note = "all campaigns (limited objective-specific data)"

    # Get target personas
    target_personas = personas
    if req.persona_ids:
        target_personas = [p for p in personas if p["id"] in req.persona_ids]

    total_audience = sum(p["size"] for p in target_personas)

    # Predict funnel using historical averages (OBSERVED basis for PREDICTED output)
    avg_delivery = relevant["delivery_rate"].mean()
    avg_open = relevant["open_rate"].mean()
    avg_click = relevant["click_rate"].mean()
    avg_conv = relevant["conversion_rate"].mean()

    # Adjust for audience characteristics
    avg_response = sum(p["avg_notif_response_rate"] * p["size"] for p in target_personas) / max(total_audience, 1)
    response_modifier = avg_response / 0.25  # normalize against baseline

    predicted_delivery = min(avg_delivery * 1.0, 1.0)
    predicted_open = min(avg_open * response_modifier, 1.0)
    predicted_click = min(avg_click * response_modifier, 1.0)
    predicted_conv = min(avg_conv * response_modifier, 1.0)

    # Confidence based on sample size
    n_historical = len(relevant)
    confidence = "high" if n_historical >= 10 else "medium" if n_historical >= 5 else "low"

    delivered = int(total_audience * predicted_delivery)
    opened = int(delivered * predicted_open)
    clicked = int(opened * predicted_click)
    converted = int(clicked * predicted_conv)

    # Send time recommendation
    if req.send_hour is not None:
        send_time_note = f"Scheduled for {req.send_hour}:00"
    else:
        peak_hours = [p["peak_hour_mode"] for p in target_personas]
        recommended_hour = max(set(peak_hours), key=peak_hours.count)
        send_time_note = f"Recommended: {recommended_hour}:00 (peak activity for target audience)"

    # Best channel recommendation
    if not req.channel:
        channel_scores = {}
        for ch in ["whatsapp", "sms", "email", "push"]:
            reach = sum(p["channel_reach"][ch] * p["size"] for p in target_personas) / max(total_audience, 1)
            channel_scores[ch] = reach
        recommended_channel = max(channel_scores, key=channel_scores.get)
    else:
        recommended_channel = req.channel

    return {
        "label": "PREDICTED",
        "confidence": confidence,
        "evidence_basis": f"Based on {n_historical} historical campaigns ({evidence_note})",
        "audience_size": total_audience,
        "funnel": {
            "sent": total_audience,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "converted": converted,
            "delivery_rate": round(predicted_delivery, 4),
            "open_rate": round(predicted_open, 4),
            "click_rate": round(predicted_click, 4),
            "conversion_rate": round(predicted_conv, 4),
        },
        "channel": {
            "selected": recommended_channel,
            "label": "RECOMMENDED" if not req.channel else "OBSERVED",
        },
        "timing": {
            "note": send_time_note,
            "label": "RECOMMENDED",
        },
    }


@app.get("/api/campaigns")
def list_campaigns():
    """Historical campaign performance data."""
    state = get_state()
    campaigns = state["campaigns"]
    logger.info("DATA_ACCESS: campaign history requested")
    return {
        "label": "OBSERVED",
        "campaigns": campaigns.to_dict(orient="records"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
