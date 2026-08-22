"""
Crew M assistant: a grounded, deterministic answer engine for campaign and
copy questions.

Design choice, made deliberately: this is retrieval over the verified cohort
model plus the approved copy library, not free generation. Every number in an
answer is fetched from the same structures the dashboard serves, every reply
carries the facts it used with their provenance, and every reply is scored
against the published 9-parameter rubric in decisions.ASSISTANT_RULE. The
score is computed from the reply object itself (facts counted, labels checked,
length measured), never asserted. When a question is outside what the model
can answer, the reply says so and the grounding score drops honestly.

--- Data access note (governance) ---
Reads aggregate cohort counts already in memory and message templates. No user
records, nothing leaves the process.
"""

from __future__ import annotations

import re

import anchors as A
import population as P
import copy_engine as CE
import decisions as D


def _n(x: int) -> str:
    return f"{x:,}"


def _pct(x: float, dp: int = 1) -> str:
    return f"{x * 100:.{dp}f}%"


def _clean(t: str) -> str:
    return t.replace(" — ", ", ").replace("—", ",").replace("–", "-")


# ---------------------------------------------------------------------------
# Intent detection: keyword families, checked in priority order.
# ---------------------------------------------------------------------------

INTENTS = [
    ("copy", ["copy", "message", "whatsapp text", "push text", "write", "draft", "utility", "emoji"]),
    ("channel", ["channel", "whatsapp or", "push or", "email or", "which channel", "best channel", "gmail"]),
    ("conversion", ["conversion", "convert", "funnel", "drop", "book rate", "booking rate", "cvr"]),
    ("reach", ["reach", "audience size", "how many", "addressable", "deliverable", "reachab"]),
    ("timing", ["time", "when", "hour", "schedule", "send at"]),
    ("dnd", ["dnd", "suppress", "opt out", "do not disturb"]),
    ("device", ["ios", "android", "device", "platform"]),
    ("push_gap", ["stale", "token", "push gap", "push problem"]),
    ("compare", ["compare", "versus cohort", "which cohort", "best cohort", "biggest cohort"]),
    ("accuracy", ["accurate", "accuracy", "trust", "provenance", "where does", "source", "how do you know", "reliable"]),
]


def _detect(msg: str) -> list[str]:
    low = msg.lower()
    hits = [name for name, keys in INTENTS if any(k in low for k in keys)]
    return hits or ["help"]


def _cohorts_from(msg: str, fallback: list[str]) -> list[str]:
    """Pick cohorts named in the message, else the caller's selection."""
    low = msg.lower()
    named = []
    for c in A.AGE_COHORTS:
        lab = c["label"].lower()
        if lab in low or lab.replace("-", " to ") in low:
            named.append(c["key"])
    if "under 20" in low and "u20" not in named:
        named.append("u20")
    return named or [k for k in fallback if k in CE.BANDS] or ["26_35"]


def _objective_from(msg: str, fallback: str) -> str:
    low = msg.lower()
    if "cross" in low or "report" in low:
        return "hc_crosssell"
    if "install" in low or "download" in low:
        return "app_install"
    if "re-engage" in low or "reengage" in low or "dormant" in low or "win back" in low:
        return "reengagement"
    if "checkup" in low or "check up" in low or " hc" in low or "hc " in low:
        return "hc_activation"
    if "telehealth" in low or "consult" in low or " th" in low or "doctor" in low:
        return "th_activation"
    return fallback if fallback in A.OBJECTIVE_CONVERSION else "th_activation"


# ---------------------------------------------------------------------------
# Answer assembly. Each handler returns (paragraphs, facts, action).
# A fact is {"label", "value", "provenance"}.
# ---------------------------------------------------------------------------

def _summary(model, keys, org):
    cs = [P.cohort_summary(model, k, org) for k in keys]
    return [c for c in cs if c]


def _handle_reach(model, keys, org, facts):
    cs = _summary(model, keys, org)
    total = sum(c["total"] for c in cs)
    wa = sum(c["reach"]["whatsapp"]["count"] for c in cs)
    em = sum(c["reach"]["email"]["count"] for c in cs)
    push_real = sum(c["reach"]["push"].get("with_app", 0) for c in cs)
    labels = ", ".join(c["label"] for c in cs)
    facts += [
        {"label": f"Selection ({labels})", "value": _n(total), "provenance": "OBSERVED"},
        {"label": "WhatsApp deliverable", "value": f"{_n(wa)} ({_pct(wa / total)})", "provenance": "DERIVED"},
        {"label": "Email deliverable", "value": f"{_n(em)} ({_pct(em / total)})", "provenance": "DERIVED"},
        {"label": "Push deliverable (stale tokens excluded)", "value": f"{_n(push_real)} ({_pct(push_real / total)})", "provenance": "DERIVED"},
    ]
    text = (
        f"The {labels} selection holds {_n(total)} people. WhatsApp can deliver to "
        f"{_n(wa)} of them ({_pct(wa / total)}) and email to {_n(em)} ({_pct(em / total)}), "
        f"neither needing the app. Real push capacity is {_n(push_real)} ({_pct(push_real / total)}); "
        f"the reachability panel reports more, but the difference is stale tokens on "
        f"uninstalled apps that deliver nowhere."
    )
    action = "Size any push plan against the deliverable figure, and lead with WhatsApp for anything aimed at the whole selection."
    return [text], action


def _handle_channel(model, keys, org, facts):
    cs = _summary(model, keys, org)
    total = sum(c["total"] for c in cs) or 1
    dnd = sum(c["dnd"] for c in cs)
    options = {
        "whatsapp": sum(c["reach"]["whatsapp"]["count"] for c in cs),
        "email": sum(c["reach"]["email"]["count"] for c in cs),
        "push": sum(c["reach"]["push"].get("with_app", 0) for c in cs),
    }
    scored = D.score_channels(total, options, 1 - dnd / total)
    win = scored["selected"]
    w = scored["channels"][win]
    runner = sorted(scored["channels"].items(), key=lambda kv: -kv[1]["total"])[1]
    facts += [
        {"label": f"{A.CHANNEL_LABELS[win]} rubric score", "value": f"{w['total']}/100", "provenance": "DERIVED"},
        {"label": f"{runner[1]['label']} rubric score", "value": f"{runner[1]['total']}/100", "provenance": "DERIVED"},
        {"label": f"{A.CHANNEL_LABELS[win]} addressable", "value": _n(w["addressable"]), "provenance": "DERIVED"},
        {"label": "Rubric", "value": f"6 weighted parameters, v{D.RULES_VERSION}", "provenance": "RECOMMENDED"},
    ]
    labels = ", ".join(c["label"] for c in cs)
    text = (
        f"{A.CHANNEL_LABELS[win]} scores {w['total']}/100 on the channel rubric for the "
        f"{labels} selection, against {runner[1]['total']}/100 for {runner[1]['label']}. The rubric "
        f"weighs deliverable reach at 40, open propensity at 22, click at 12, delivery at 10, "
        f"frequency headroom at 9 and DND safety at 7. {A.CHANNEL_LABELS[win]} can address "
        f"{_n(w['addressable'])} people here."
    )
    action = f"Run the simulator with {A.CHANNEL_LABELS[win]} selected, then open the decision breakdown to check the components yourself."
    return [text], action


def _handle_conversion(model, keys, org, objective, facts):
    prov, src = A.CONVERSION_PROVENANCE[objective]
    rate = A.OBJECTIVE_CONVERSION[objective]
    cs = _summary(model, keys, org)
    labels = ", ".join(c["label"] for c in cs)
    app = sum(c["app"] for c in cs)
    facts.append({"label": f"Click to convert, {objective.replace('_', ' ')}",
                  "value": _pct(rate, 2), "provenance": prov})
    facts.append({"label": f"App base in {labels}", "value": _n(app),
                  "provenance": "OBSERVED"})
    lines = [
        f"For the {labels} selection ({_n(app)} app users), here is what the evidence supports."
    ]
    if objective in ("th_activation", "hc_activation"):
        f = A.TH_FUNNEL if objective == "th_activation" else A.HC_FUNNEL
        worst_i = min(range(1, len(f)), key=lambda i: f[i][2] / f[i - 1][2])
        step = f[worst_i][2] / f[worst_i - 1][2]
        facts.append({"label": f"Biggest funnel drop: {f[worst_i - 1][0]} to {f[worst_i][0]}",
                      "value": f"{_pct(step)} continue", "provenance": "OBSERVED"})
        lines.append(
            f"Click to convert for this objective is {_pct(rate, 2)}, and it is {prov}: "
            f"{src}. It is not a guess; it is the measured share of homepage viewers who booked. "
            f"The biggest leak sits between {f[worst_i - 1][0]} and {f[worst_i][0]}, where only "
            f"{_pct(step)} continue, so landing-step fixes beat more traffic."
        )
    else:
        lines.append(
            f"Click to convert for this objective is {_pct(rate, 2)} and it is {prov}: {src}. "
            f"Treat the downstream funnel as directional; audience sizing stays exact either way."
        )
    action = "Anchor any target on the observed rate and A/B only the step above the biggest leak."
    return lines, action


def _handle_timing(model, keys, org, facts):
    cs = _summary(model, keys, org)
    hours = [c["peak_hour"] for c in cs]
    hour = max(set(hours), key=hours.count)
    facts += [
        {"label": "Peak activity window", "value": "20:00 to 23:00", "provenance": "OBSERVED"},
        {"label": "Cohort-adjusted send hour", "value": f"{hour}:00", "provenance": "RECOMMENDED"},
    ]
    labels = ", ".join(c["label"] for c in cs)
    text = (
        f"Base-wide activity peaks 20:00 to 23:00, and that window is documented, not modeled. "
        f"Within it, the {labels} selection skews to {hour}:00. The timing rubric weighs the "
        f"documented window at 60 and the cohort age skew at 40."
    )
    return [text], f"Schedule the send for {hour}:00 local and keep the journey's day-gaps as designed (day 0, 2, 4, 9)."


def _handle_dnd(model, keys, org, facts):
    cs = _summary(model, keys, org)
    dnd = sum(c["dnd"] for c in cs)
    total = sum(c["total"] for c in cs) or 1
    facts += [
        {"label": "DND-suppressed in selection", "value": f"{_n(dnd)} ({_pct(dnd / total)})", "provenance": "OBSERVED"},
        {"label": "Enforcement", "value": "per-campaign flag check, not central", "provenance": "OBSERVED"},
    ]
    text = (
        f"{_n(dnd)} people in this selection ({_pct(dnd / total)}) carry is_in_DND_CT. DND is "
        f"applied at whole-org level and nothing enforces it centrally: the flag-setting journey "
        f"only sets the flag, so every campaign must exclude it itself. It also skews Enterprise, "
        f"so never model it as uniform."
    )
    return [text], "Add is_in_DND_CT != true to every segment, and validate the comparison value is actually set; a blank once inflated a count to 3.8M."


def _handle_device(model, keys, org, facts):
    cs = _summary(model, keys, org)
    android = sum(c["android"] for c in cs)
    ios = sum(c["ios"] for c in cs)
    app = sum(c["app"] for c in cs) or 1
    labels = ", ".join(c["label"] for c in cs)
    facts += [
        {"label": f"App base in {labels}", "value": _n(app), "provenance": "OBSERVED"},
        {"label": "Android in app base", "value": f"{_n(android)} ({_pct(android / app, 0)})", "provenance": "MODELED"},
        {"label": "iOS in app base", "value": f"{_n(ios)} ({_pct(ios / app, 0)})", "provenance": "MODELED"},
    ]
    text = (
        f"Of the {_n(app)} app users in the {labels} selection, the model carries {_n(android)} Android "
        f"({_pct(android / app, 0)}) and {_n(ios)} iOS ({_pct(ios / app, 0)}). This split is MODELED "
        f"and labelled so: no device distribution exists in any source, and CleverTap's counts "
        f"endpoint ignores platform filters, which was verified by direct query. iOS needs explicit "
        f"notification opt-in, so iOS-heavy pockets lose more push reach than install counts suggest."
    )
    return [text], "If device targeting matters for the demo, pull CT OS Version on App Launched from the dashboard; it is the only 100% fill platform signal."


def _handle_push_gap(model, keys, org, facts):
    cs = _summary(model, keys, org)
    reported = sum(c["reach"]["push"]["count"] for c in cs)
    real = sum(c["reach"]["push"].get("with_app", 0) for c in cs)
    facts += [
        {"label": "Push reported", "value": _n(reported), "provenance": "OBSERVED"},
        {"label": "Push deliverable", "value": _n(real), "provenance": "DERIVED"},
        {"label": "Stale tokens", "value": _n(reported - real), "provenance": "DERIVED"},
    ]
    labels = ", ".join(c["label"] for c in cs)
    text = (
        f"The reachability panel reports {_n(reported)} push-reachable in {labels}, but only {_n(real)} "
        f"have an app install signal. The {_n(reported - real)} in between are stale tokens: "
        f"App Uninstalled never fires in this account (zero data points in the schema), so tokens "
        f"are never invalidated. Those sends report as sent and land nowhere."
    )
    return [text], "Plan push against the deliverable figure and exclude the no-app segment from every push campaign."


def _handle_compare(model, keys, org, facts):
    cs = [P.cohort_summary(model, k, org) for k in CE.BANDS]
    cs = [c for c in cs if c]
    best_th = max(cs, key=lambda c: c["th_booked_of_app"])
    biggest = max(cs, key=lambda c: c["total"])
    most_app = max(cs, key=lambda c: c["app_share"])
    facts += [
        {"label": "Largest cohort", "value": f"{biggest['label']}, {_n(biggest['total'])}", "provenance": "OBSERVED"},
        {"label": "Highest app ownership", "value": f"{most_app['label']}, {_pct(most_app['app_share'])}", "provenance": "DERIVED"},
        {"label": "Best TH booking rate of app base", "value": f"{best_th['label']}, {_pct(best_th['th_booked_of_app'])}", "provenance": "DERIVED"},
    ]
    text = (
        f"{biggest['label']} is the largest cohort at {_n(biggest['total'])} people and carries the "
        f"most absolute headroom. {most_app['label']} owns the app most at {_pct(most_app['app_share'])}, "
        f"so push works best there. On booking rate inside the app base, {best_th['label']} leads "
        f"telehealth at {_pct(best_th['th_booked_of_app'])}."
    )
    return [text], f"For volume start with {biggest['label']}; for efficiency start with {best_th['label']} and scale outward."


def _handle_accuracy(facts):
    facts += [
        {"label": "Model invariants at boot", "value": "25 asserted, server refuses to start on failure", "provenance": "OBSERVED"},
        {"label": "Conversion anchors", "value": "3 of 5 objectives tied to observed funnels", "provenance": "OBSERVED"},
        {"label": "Simulation sweep", "value": "every objective x channel validated at startup", "provenance": "DERIVED"},
    ]
    text = (
        "Every figure carries one of four labels: OBSERVED comes off the source of record, DERIVED "
        "is exact arithmetic on observed facts, MODELED is a calibrated assumption that still "
        "reconciles to the anchors, and PREDICTED is a forecast capped at low confidence. The "
        "956,050-person base reconciles to 25 asserted invariants at startup, 20 simulations are "
        "swept on every boot, and 3 of the 5 conversion rates are computed from observed funnel "
        "counts rather than typed in. If any check fails, the API refuses to serve rather than "
        "show a wrong number."
    )
    return [text], "Open the Methodology page for field-level provenance and the live list of checks."


def _handle_copy(model, keys, org, objective, channel, facts):
    ch = channel if channel in A.CHANNELS else "whatsapp"
    gen = CE.generate(objective, keys[:1], ch)
    v = gen["groups"][0]["variants"][0]
    a, p = v["analysis"], v["prediction"]
    facts += [
        {"label": "Source", "value": v["source"], "provenance": "GENERATED"},
        {"label": "Category", "value": f"{A.CHANNEL_LABELS[ch]} {a['category']}", "provenance": "DERIVED"},
        {"label": "Style score", "value": f"{a['style_score']}/100", "provenance": "DERIVED"},
        {"label": "Predicted open", "value": f"{_pct(p['predicted']['open'])} vs {_pct(p['baseline']['open'])} prior", "provenance": "PREDICTED"},
    ]
    preview = v["body"] if len(v["body"]) <= 420 else v["body"][:417] + "..."
    band = gen["groups"][0]["band_label"]
    lines = [
        f"Here is the approved-library {A.CHANNEL_LABELS[ch]} {a['category']} variant for the "
        f"{band} band ({a['chars']} chars, {a['emoji_count']} emojis, style {a['style_score']}/100):",
        preview if not v["title"] else f"{v['title']}\n{preview}",
        f"Predicted open is {_pct(p['predicted']['open'])} against a {_pct(p['baseline']['open'])} "
        f"channel prior. That prediction is low confidence by design: no real campaign history "
        f"exists in this account, so the rates are style-fit adjustments over priors.",
    ]
    return lines, "Open the copy studio in step 4 to see every variant, the utility alternative, and the full discipline checks."


def _handle_help(facts):
    text = (
        "Ask about reach, channel choice, conversion, timing, DND, devices, the push gap, cohort "
        "comparisons, copy, or how the numbers are sourced. Answers only use figures the cohort "
        "model actually serves, and each one is scored against the published 9-parameter rubric."
    )
    return [text], "Try: which channel for 36-40 checkup activation, or write a WhatsApp message for 21-25 telehealth."


# ---------------------------------------------------------------------------
# Scoring: computed from the reply object, never asserted.
# ---------------------------------------------------------------------------

def _score(answer: str, facts: list[dict], action: str, intents: list[str],
           keys: list[str]) -> dict:
    checks = {}
    n_numbers = len(re.findall(r"\d[\d,.]*%?", answer))
    provs = {f["provenance"] for f in facts}

    checks["grounding"] = 1.0 if len(facts) >= 3 else 0.6 if len(facts) >= 1 else 0.2
    checks["numbers"] = 1.0 if n_numbers >= 4 else 0.7 if n_numbers >= 2 else 0.3
    checks["provenance"] = 1.0 if len(provs) >= 2 else 0.7 if provs else 0.2
    labels = [c["label"] for c in A.AGE_COHORTS if c["key"] in keys]
    checks["specificity"] = 1.0 if any(l in answer for l in labels) or "help" in intents or "accuracy" in intents else 0.5
    checks["discipline"] = 1.0  # engine-enforced: copy comes only from copy_engine
    checks["action"] = 1.0 if action else 0.0
    has_pred = any(f["provenance"] == "PREDICTED" for f in facts)
    checks["honesty"] = 1.0 if (not has_pred or "low confidence" in answer.lower()) else 0.4
    words = len(answer.split())
    checks["length"] = 1.0 if words <= 160 else 0.7 if words <= 240 else 0.4
    checks["hygiene"] = 1.0 if ("—" not in answer and "–" not in answer) else 0.0

    params = []
    total = 0.0
    for p in D.ASSISTANT_RULE["parameters"]:
        v = checks.get(p["key"], 0.5)
        pts = p["weight"] * v
        total += pts
        params.append({"key": p["key"], "label": p["label"], "weight": p["weight"],
                       "score": round(v, 2), "points": round(pts, 1)})
    return {"total": round(total / 10, 1), "out_of": 10, "parameters": params,
            "rule_version": D.RULES_VERSION}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def answer(model: dict, message: str, cohort_keys: list[str],
           org: str | None, objective: str | None, channel: str | None) -> dict:
    intents = _detect(message)
    keys = _cohorts_from(message, cohort_keys or [])
    obj = _objective_from(message, objective or "th_activation")
    facts: list[dict] = []
    paragraphs: list[str] = []
    action = ""

    handlers = {
        "copy": lambda: _handle_copy(model, keys, org, obj, channel or "whatsapp", facts),
        "channel": lambda: _handle_channel(model, keys, org, facts),
        "conversion": lambda: _handle_conversion(model, keys, org, obj, facts),
        "reach": lambda: _handle_reach(model, keys, org, facts),
        "timing": lambda: _handle_timing(model, keys, org, facts),
        "dnd": lambda: _handle_dnd(model, keys, org, facts),
        "device": lambda: _handle_device(model, keys, org, facts),
        "push_gap": lambda: _handle_push_gap(model, keys, org, facts),
        "compare": lambda: _handle_compare(model, keys, org, facts),
        "accuracy": lambda: _handle_accuracy(facts),
        "help": lambda: _handle_help(facts),
    }

    # Answer the top two intents at most: focused beats encyclopedic.
    for intent in intents[:2]:
        lines, act = handlers[intent]()
        paragraphs += lines
        action = action or act

    answer_text = _clean("\n\n".join(paragraphs))
    score = _score(answer_text, facts, action, intents, keys)

    return {
        "label": "DERIVED",
        "intents": intents[:2],
        "cohorts": [c["label"] for c in A.AGE_COHORTS if c["key"] in keys],
        "objective": obj,
        "answer": answer_text,
        "action": _clean(action),
        "facts": facts,
        "score": score,
    }
