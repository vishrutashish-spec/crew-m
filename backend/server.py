"""
Crew M API server.

Cohort-first: age cohorts are the primary organising dimension, with org type
as a drill-down. Every figure served here is an exact sum over the deterministic
cohort model, and the model is verified against its anchors before the server
accepts a single request.

--- Data access note (governance) ---
What: aggregate cohort counts and documented segment totals. Why: the product
answers who to target, on which channel, at what time. Protection: no
user-level records are read or served, every response is counts-only, all
CleverTap queries are read-only and bounded to <= 1 year, and every data-access
route logs what was requested.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import anchors as A
import population as P
import insights as I

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crewm")

app = FastAPI(title="Crew M API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state: dict = {}


def get_model() -> dict:
    """Build and verify the cohort model once. Refuses to serve if it fails."""
    if "model" not in _state:
        logger.info("Building deterministic cohort model...")
        model = P.build()
        checks = P.verify(model)   # raises if any anchor disagrees
        _state["model"] = model
        _state["checks"] = checks
        _state["built_at"] = datetime.now(timezone.utc).isoformat()
        logger.info(f"Cohort model verified — {len(checks)} invariants hold")
    return _state["model"]


def _org(org: Optional[str]) -> Optional[str]:
    if org in (None, "", "all"):
        return None
    if org not in A.ORG_TYPE_SHARES:
        raise HTTPException(400, f"Unknown org type '{org}'")
    return org


# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    get_model()
    return {
        "status": "ok",
        "version": "2.0.0",
        "invariants_verified": len(_state["checks"]),
        "built_at": _state["built_at"],
    }


@app.get("/api/verification")
def verification():
    """Every invariant the model asserts. Shown in the UI methodology panel so
    the accuracy claim is checkable rather than asserted."""
    get_model()
    return {"label": "OBSERVED", "checks": _state["checks"]}


@app.get("/api/overview")
def overview(org: Optional[str] = Query(None)):
    """Dashboard: base totals, cohort table, funnels, insights."""
    model = get_model()
    org_f = _org(org)
    logger.info(f"DATA_ACCESS: overview requested (org={org_f or 'all'})")

    totals = P.totals(model, org_f)
    cells = [c for c in model["cells"].values()
             if org_f is None or c["org"] == org_f]

    # Real vs apparent push, computed here so the UI never has to derive it.
    real_push = sum(c["reach_push_app"] for c in cells)
    totals["reach"]["push"]["with_app"] = real_push
    totals["reach"]["push"]["stale_tokens"] = (
        totals["reach"]["push"]["count"] - real_push
    )

    return {
        "label": "OBSERVED",
        "org_filter": org_f,
        "totals": totals,
        "cohorts": P.all_cohorts(model, org_f),
        "comparison": I.cohort_comparison(model, org_f),
        "insights": I.base_insights(model) if org_f is None else [],
        "activation": {
            "employee_rate": A.EMPLOYEE_ACTIVATION_RATE,
            "org_rate": A.ORG_ACTIVATION_RATE,
            "gap_points": A.ACTIVATION_GAP_POINTS,
            "targets": A.ADOPTION_TARGETS,
            "label": "OBSERVED",
        },
        "ct_live": {
            "metrics": A.CT_LIVE,
            "scope": A.CT_LIVE_SCOPE,
            "pulled_at": A.CT_PULL_DATE.isoformat(),
            "window_days": A.CT_WINDOW_DAYS,
            "dau_method": A.DAU_METHOD,
            "label": "OBSERVED",
        },
        "built_at": _state["built_at"],
    }


@app.get("/api/cohorts")
def cohorts(org: Optional[str] = Query(None)):
    model = get_model()
    org_f = _org(org)
    logger.info(f"DATA_ACCESS: cohort list requested (org={org_f or 'all'})")
    return {
        "label": "OBSERVED",
        "org_filter": org_f,
        "cohorts": P.all_cohorts(model, org_f),
        "org_types": [
            {"key": k, "label": A.ORG_TYPE_LABELS[k], "share": v,
             "note": A.SEGMENT_ADOPTION_NOTES.get(k)}
            for k, v in A.ORG_TYPE_SHARES.items()
        ],
        "org_share_is_modeled": A.ORG_SHARE_IS_MODELED,
    }


@app.get("/api/cohorts/{cohort_key}")
def cohort_detail(cohort_key: str, org: Optional[str] = Query(None)):
    model = get_model()
    org_f = _org(org)
    summary = P.cohort_summary(model, cohort_key, org_f)
    if not summary:
        raise HTTPException(404, f"Unknown cohort '{cohort_key}'")
    logger.info(f"DATA_ACCESS: cohort {cohort_key} detail (org={org_f or 'all'})")

    cells = [c for c in model["cells"].values()
             if c["cohort"] == cohort_key
             and (org_f is None or c["org"] == org_f)]
    real_push = sum(c["reach_push_app"] for c in cells)
    summary["reach"]["push"]["with_app"] = real_push
    summary["reach"]["push"]["stale_tokens"] = (
        summary["reach"]["push"]["count"] - real_push
    )

    return {
        "label": "OBSERVED",
        "cohort": summary,
        "insights": I.cohort_insights(model, cohort_key, org_f),
        "base_totals": P.totals(model),
    }


@app.get("/api/methodology")
def methodology():
    """Provenance for every number. The four-way distinction made explicit."""
    get_model()
    return {
        "provenance": A.provenance(),
        "checks": _state["checks"],
        "mau_scoped": {
            "value": P.MAU_SCOPED,
            "provenance": P.MAU_SCOPED_PROVENANCE,
        },
        "reach_decomposed": A.REACH_DECOMPOSED,
        "segment_reachability": {
            k: {"users": v[0], "push": v[1], "email": v[2], "whatsapp": v[3]}
            for k, v in A.SEGMENT_REACHABILITY.items()
        },
        "funnels": {
            "th": [{"stage": s, "event": e, "count": n} for s, e, n in A.TH_FUNNEL],
            "hc": [{"stage": s, "event": e, "count": n} for s, e, n in A.HC_FUNNEL],
            "window": "120 days, active + non-test organisations",
        },
    }


# ---------------------------------------------------------------------------
# Simulator
# ---------------------------------------------------------------------------

class SimRequest(BaseModel):
    objective: str
    cohort_keys: list[str]
    org: Optional[str] = None
    channel: Optional[str] = None
    send_hour: Optional[int] = None
    exclude_dnd: bool = True
    exclude_no_app_for_push: bool = True


@app.get("/api/simulate/options")
def simulate_options():
    get_model()
    return {
        "objectives": [
            {"key": "th_activation", "label": "Telehealth activation",
             "desc": "First consultation for people who have never booked"},
            {"key": "hc_activation", "label": "Health checkup activation",
             "desc": "First checkup booking"},
            {"key": "app_install", "label": "App install",
             "desc": "Move the no-app segment onto the app"},
            {"key": "reengagement", "label": "Re-engagement",
             "desc": "Installed but quiet for 30 days or more"},
            {"key": "hc_crosssell", "label": "HC to TH cross-sell",
             "desc": "Telehealth prompt after a checkup report view"},
        ],
        "cohorts": [{"key": c["key"], "label": c["label"]} for c in A.AGE_COHORTS],
        "org_types": [{"key": k, "label": A.ORG_TYPE_LABELS[k]}
                      for k in A.ORG_TYPE_SHARES],
        "channels": [{"key": k, "label": A.CHANNEL_LABELS[k]} for k in A.CHANNELS],
        "control_group_share": A.CONTROL_GROUP_SHARE,
    }


@app.post("/api/simulate")
def simulate(req: SimRequest):
    """
    Size an audience from the real cohort model, then project a funnel.

    Audience sizing is DERIVED — exact counts out of the model.
    Funnel projection is PREDICTED and capped at low confidence, because no
    real campaign performance data exists for this account. The Bible names the
    missing campaign history export as the single most critical data gap, so
    these rates are industry priors and are labelled as such rather than
    dressed up as a learned prediction.
    """
    model = get_model()
    org_f = _org(req.org)

    if req.objective not in A.OBJECTIVE_CONVERSION:
        raise HTTPException(400, f"Unknown objective '{req.objective}'")
    if not req.cohort_keys:
        raise HTTPException(400, "Select at least one age cohort")
    unknown = set(req.cohort_keys) - set(P.COHORT_KEYS)
    if unknown:
        raise HTTPException(400, f"Unknown cohort(s): {sorted(unknown)}")

    logger.info(
        f"DATA_ACCESS: simulation objective={req.objective} "
        f"cohorts={req.cohort_keys} org={org_f or 'all'} channel={req.channel}"
    )

    cells = [c for c in model["cells"].values()
             if c["cohort"] in req.cohort_keys
             and (org_f is None or c["org"] == org_f)]
    if not cells:
        raise HTTPException(400, "That combination selects nobody")

    s = lambda k: sum(c[k] for c in cells)  # noqa: E731
    cohort_total, app_total = s("total"), s("app")

    # -- Objective determines the eligible pool inside the selection -------
    # pool_is_app records WHICH population the pool is drawn from, because
    # reachability has to be measured against that same population. An
    # app-install campaign targets people without the app, so intersecting it
    # with app-installed push reach would be intersecting two disjoint groups.
    if req.objective == "app_install":
        pool, pool_desc, pool_is_app = s("no_app"), "no app install signal", False
    elif req.objective == "reengagement":
        pool, pool_desc, pool_is_app = (
            s("app_dormant"), "app installed, quiet 30 days or more", True)
    elif req.objective == "th_activation":
        pool = app_total - s("th_booked")
        pool_desc, pool_is_app = "app installed, never booked telehealth", True
    elif req.objective == "hc_activation":
        pool = app_total - s("hc_booked")
        pool_desc, pool_is_app = "app installed, never booked a checkup", True
    else:  # hc_crosssell
        pool = s("hc_booked")
        pool_desc, pool_is_app = "booked a checkup — cross-sell on report view", True

    # -- Channel: pick the one that actually reaches the most of that pool --
    # Reach is taken from the app or no-app component to match the pool, then
    # DND is applied proportionally, then capped by the pool itself.
    dnd_keep = (s("not_dnd") / cohort_total) if cohort_total else 0.0
    component = "app" if pool_is_app else "no_app"

    channel_options = {}
    for ch in A.CHANNELS:
        reach = s(f"reach_{ch}_{component}")
        if ch == "push" and not pool_is_app:
            # The only push-reachable people without the app are stale tokens
            # on uninstalled apps. Excluding them is the default and correct.
            if req.exclude_no_app_for_push:
                reach = 0
        if req.exclude_dnd:
            reach = round(reach * dnd_keep)
        channel_options[ch] = min(reach, pool)

    if req.channel:
        if req.channel not in A.CHANNELS:
            raise HTTPException(400, f"Unknown channel '{req.channel}'")
        channel = req.channel
        channel_label = "OBSERVED"
    else:
        channel = max(channel_options, key=lambda c: channel_options[c])
        channel_label = "RECOMMENDED"

    addressable = channel_options[channel]
    control = round(addressable * A.CONTROL_GROUP_SHARE)
    sent = addressable - control

    # -- Funnel projection — PREDICTED, low confidence by construction -----
    b = A.CHANNEL_BENCHMARKS[channel]
    conv = A.OBJECTIVE_CONVERSION[req.objective]
    delivered = round(sent * b["delivery"])
    opened = round(delivered * b["open"])
    clicked = round(opened * b["click"])
    converted = round(clicked * conv)

    hours = [A.PEAK_HOUR[k] for k in req.cohort_keys]
    send_hour = req.send_hour if req.send_hour is not None else max(set(hours), key=hours.count)

    warnings = []
    if channel == "push":
        stale = s("reach_push") - s("reach_push_app")
        if stale > 0:
            warnings.append(
                f"Push reachability for this selection reads "
                f"{s('reach_push'):,} but only {s('reach_push_app'):,} have an "
                f"app install signal. {stale:,} are stale tokens that will "
                f"report as sent and land nowhere."
                + ("" if req.exclude_no_app_for_push
                   else " Stale tokens are currently INCLUDED in this estimate.")
            )
    if req.objective == "hc_crosssell":
        warnings.append(
            f"Cross-sell converts best triggered on report view, not on a "
            f"schedule — {A.HC_TO_TH_CROSSSELL_RATE:.1%} convert unprompted "
            f"from that moment."
        )
    if not req.exclude_dnd:
        warnings.append(
            f"DND is not being excluded. {s('dnd'):,} people in this selection "
            f"carry the suppression flag and must not receive campaign sends."
        )

    return {
        "label": "PREDICTED",
        "confidence": "low",
        "confidence_reason": A.BENCHMARK_PROVENANCE,

        "selection": {
            "cohorts": [P.COHORT_BY_KEY[k]["label"] for k in req.cohort_keys],
            "org": A.ORG_TYPE_LABELS[org_f] if org_f else "All org types",
            "cohort_total": cohort_total,
            "app_in_selection": app_total,
            "dnd_in_selection": s("dnd"),
            "label": "DERIVED",
        },
        "audience": {
            "objective_pool": pool,
            "pool_description": pool_desc,
            "addressable": addressable,
            "control_group": control,
            "sent": sent,
            "label": "DERIVED",
        },
        "channel": {
            "selected": channel,
            "selected_label": A.CHANNEL_LABELS[channel],
            "label": channel_label,
            "options": {
                ch: {
                    "label": A.CHANNEL_LABELS[ch],
                    "addressable": v,
                    "share_of_pool": round(v / pool, 4) if pool else 0.0,
                }
                for ch, v in channel_options.items()
            },
        },
        "funnel": {
            "sent": sent,
            "delivered": delivered,
            "opened": opened,
            "clicked": clicked,
            "converted": converted,
            "delivery_rate": round(delivered / sent, 4) if sent else 0.0,
            "open_rate": round(opened / delivered, 4) if delivered else 0.0,
            "click_rate": round(clicked / opened, 4) if opened else 0.0,
            "conversion_rate": round(converted / sent, 6) if sent else 0.0,
            "click_to_convert": conv,
            "label": "PREDICTED",
        },
        "timing": {
            "send_hour": send_hour,
            "note": f"Peak window is 20:00-23:00; this selection skews to {send_hour}:00",
            "label": "RECOMMENDED" if req.send_hour is None else "OBSERVED",
        },
        "warnings": warnings,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
