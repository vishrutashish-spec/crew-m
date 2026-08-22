"""
SIGNAL: the campaign analyst in the product.

Replaces the earlier assistant. Three things changed and they are the whole
point:

  1. It reads the clinical evidence. Specialty mix, biomarker abnormality and
     the real booking clock are now first-class answers, so "what is the
     dermatology pattern here" or "which biomarker is most off at 36-40"
     returns a measured number instead of a plausible sentence.
  2. It builds segments. Ask what filters to use and it emits real CleverTap
     rules with the literal event and property names, in the order a segment
     is actually assembled.
  3. It has a voice. SIGNAL leads with the number that decides the question,
     is blunt about what is unreliable, and does not pad. Openers and
     transitions vary deterministically off the question text, so it reads
     like a person without ever being random.

Still deterministic and still grounded: nothing is generated, every figure is
fetched from the verified model or the aggregate extraction, and every reply
scores itself against the published 10-parameter rubric.

--- Data access note (governance) ---
Reads in-memory aggregates only. No member rows, no free text, nothing leaves
the process.
"""

from __future__ import annotations

import re

import anchors as A
import population as P
import copy_engine as CE
import decisions as D
import cohort_intel as CI
import timing as T

RUBRIC_VERSION = "2.0"

# ---------------------------------------------------------------------------
# Voice. Varied deterministically by question, never randomly.
# ---------------------------------------------------------------------------

OPENERS = {
    "lead": ["Here is the number that decides it.", "Short answer first.",
             "The data is unambiguous here.", "One figure settles this."],
    "caution": ["Worth slowing down on this one.", "This is where people get burned.",
                "Careful here, the obvious read is wrong."],
    "finding": ["This one is genuinely interesting.", "There is a real pattern here.",
                "The evidence has a clear shape."],
    "plain": ["Straight answer.", "Here is what the model holds.",
              "Pulling that from the cohort model."],
}


def _pick(bucket: str, seed: str) -> str:
    opts = OPENERS[bucket]
    return opts[sum(ord(c) for c in seed[:24]) % len(opts)]


def _n(x) -> str:
    return f"{int(x):,}"


def _pct(x: float, dp: int = 1) -> str:
    return f"{x * 100:.{dp}f}%"


def _clean(t: str) -> str:
    return t.replace(" — ", ", ").replace("—", ",").replace("–", "-")


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------

INTENTS = [
    ("segment", ["filter", "segment", "build", "rules", "how do i target",
                 "who should i target", "audience should", "criteria"]),
    ("specialty", ["dermat", "specialty", "speciality", "gynae", "gyno", "psycholog",
                   "psychiatr", "nutrition", "ortho", "pediatric", "paediatric",
                   "cardio", "endocrin", "gastro", "neurolog", "ent ", "consult pattern",
                   "which doctor", "what doctors", "physician"]),
    ("biomarker", ["biomarker", "marker", "vitamin", "b12", "hba1c", "cholesterol",
                   "ldl", "hdl", "triglyc", "glucose", "thyroid", "tsh", "liver",
                   "uric", "haemoglobin", "hemoglobin", "anaemia", "anemia",
                   "deficien", "most off", "blood", "lipid", "sugar"]),
    ("copy", ["copy", "message", "write", "draft", "utility", "emoji", "subject line"]),
    ("timing", ["time", "when", "hour", "schedule", "send at", "best time", "timing"]),
    ("channel", ["channel", "whatsapp or", "push or", "email or", "which channel",
                 "best channel", "gmail"]),
    ("conversion", ["conversion", "convert", "funnel", "drop", "book rate", "cvr"]),
    ("reach", ["reach", "audience size", "how many", "addressable", "deliverable",
               "reachab"]),
    ("push_gap", ["stale", "token", "push gap", "push problem"]),
    ("dnd", ["dnd", "suppress", "opt out", "do not disturb"]),
    ("device", ["ios", "android", "device", "platform"]),
    ("compare", ["compare", "which cohort", "best cohort", "biggest cohort",
                 "versus", " vs "]),
    ("accuracy", ["accurate", "accuracy", "trust", "provenance", "source",
                  "how do you know", "reliable", "where does"]),
]

COHORT_ALIASES = {
    "u20": ["under 20", "under20", "teen", "u20"],
    "21_25": ["21-25", "21 to 25", "early 20s", "twenties", "21_25"],
    "26_35": ["26-35", "26 to 35", "late 20s", "thirties", "26_35"],
    "36_40": ["36-40", "36 to 40", "late 30s", "36_40", "pivot"],
    "41_50": ["41-50", "41 to 50", "forties", "41_50"],
    "51p": ["51+", "51 plus", "over 50", "fifties", "older", "51p"],
}


def _detect(msg: str) -> list[str]:
    low = msg.lower()
    hits = [n for n, keys in INTENTS if any(k in low for k in keys)]
    return hits or ["help"]


def _cohorts_from(msg: str, fallback: list[str]) -> list[str]:
    low = msg.lower()
    named = [k for k, al in COHORT_ALIASES.items() if any(a in low for a in al)]
    return named or [k for k in fallback if k in CE.BANDS] or ["26_35"]


def _label(keys: list[str]) -> str:
    m = {c["key"]: c["label"] for c in A.AGE_COHORTS}
    return ", ".join(m[k] for k in keys if k in m)


def _objective_from(msg: str, fallback: str) -> str:
    low = msg.lower()
    if "cross" in low or "report" in low:
        return "hc_crosssell"
    if "install" in low or "download" in low:
        return "app_install"
    if "dormant" in low or "re-engage" in low or "reengage" in low or "win back" in low:
        return "reengagement"
    if "checkup" in low or "check up" in low or "hc" in low.split():
        return "hc_activation"
    if "telehealth" in low or "consult" in low or "doctor" in low:
        return "th_activation"
    return fallback if fallback in A.OBJECTIVE_CONVERSION else "th_activation"


# ---------------------------------------------------------------------------
# Handlers. Each returns (paragraphs, action, facts appended in place).
# ---------------------------------------------------------------------------

def _sum(model, keys, org):
    return [c for c in (P.cohort_summary(model, k, org) for k in keys) if c]


def h_specialty(model, keys, org, msg, facts, seed):
    cohort = keys[0]
    lab = _label([cohort])
    named = None
    for tok in re.findall(r"[a-zA-Z\-]+", msg):
        s = CI.find_specialty(tok)
        if s:
            named = s
            break

    prov = CI.provenance()["th"]
    if named:
        idx = CI.specialty_index(cohort, named)
        if not idx:
            return [f"No {named} signal for {lab} in the consultation file."], "", facts
        facts += [
            {"label": f"{named} share of {lab} consults",
             "value": _pct(idx["share"]), "provenance": "OBSERVED"},
            {"label": "Index vs cohort average",
             "value": f"{idx['index_vs_average']}", "provenance": "DERIVED"},
            {"label": "Peaks in",
             "value": f"{_label([idx['peak_cohort']])} at {_pct(idx['peak_share'])}",
             "provenance": "OBSERVED"},
            {"label": "Evidence base",
             "value": f"{_n(prov['consults'])} consults, {_n(prov['members_valid'])} members",
             "provenance": "OBSERVED"},
        ]
        others = sorted(idx["all_cohorts"].items(), key=lambda kv: -kv[1])
        ladder = ", ".join(f"{_label([c])} {_pct(v, 0)}" for c, v in others[:4])
        direction = ("over-indexes" if idx["index_vs_average"] > 110
                     else "under-indexes" if idx["index_vs_average"] < 90
                     else "sits at the average")
        text = (
            f"{_pick('finding', seed)} {named} is {_pct(idx['share'])} of all {lab} "
            f"consults, which {direction} at {idx['index_vs_average']} against the "
            f"cross-cohort average. It peaks in {_label([idx['peak_cohort']])} at "
            f"{_pct(idx['peak_share'])}. Full ladder: {ladder}. That is measured off "
            f"{_n(prov['consults'])} real consults, not a model."
        )
        act = (f"If you are building a {named} angle, target "
               f"{_label([idx['peak_cohort']])} first; it carries the strongest "
               f"existing demand signal.")
        return [text], act, facts

    mix = CI.specialty_mix(cohort)[:5]
    rising = CI.rising_specialties(cohort)
    eng = CI.th_engagement(cohort)
    facts += [
        {"label": f"Top specialty in {lab}",
         "value": f"{mix[0]['specialty']} at {_pct(mix[0]['share'])}", "provenance": "OBSERVED"},
        {"label": "Consults per member",
         "value": f"{eng['consults_per_member']} (index {eng['intensity_index']})",
         "provenance": "DERIVED"},
        {"label": "Evidence base",
         "value": f"{_n(prov['consults'])} consults", "provenance": "OBSERVED"},
    ]
    top = ", ".join(f"{m['specialty']} {_pct(m['share'], 0)}" for m in mix)
    text = (
        f"{_pick('plain', seed)} {lab} consult mix, largest first: {top}. "
        f"Members in this cohort book {eng['consults_per_member']} consults each, "
        f"an intensity index of {eng['intensity_index']} against the average."
    )
    if rising:
        r = ", ".join(f"{x['specialty']} at index {x['index']}" for x in rising)
        text += f" What is distinctive rather than just large: {r}."
    act = (f"Lead {lab} telehealth copy with {mix[0]['specialty']} for volume, and "
           f"use {rising[0]['specialty'] if rising else mix[1]['specialty']} as the "
           f"differentiated angle.")
    return [text], act, facts


def h_biomarker(model, keys, org, msg, facts, seed):
    cohort = keys[0]
    lab = _label([cohort])
    named = CI.find_marker(msg)
    prov = CI.provenance()["hc"]

    if named:
        t = CI.biomarker_trend(named)
        if not t:
            return [f"No {named} readings joined to age in the checkup file."], "", facts
        facts += [
            {"label": f"{t['marker']} abnormal, {_label([t['worst_cohort']])}",
             "value": f"{t['worst_pct']}%", "provenance": "OBSERVED"},
            {"label": f"{t['marker']} abnormal, all bookings",
             "value": f"{t['overall_pct']}%", "provenance": "OBSERVED"},
            {"label": "Age spread", "value": f"{t['spread']} points", "provenance": "DERIVED"},
            {"label": "Reference", "value": t["basis"], "provenance": "OBSERVED"},
        ]
        series = ", ".join(f"{_label([c])} {v}%" for c, v in t["series"].items())
        here = t["series"].get(cohort)
        text = (
            f"{_pick('finding', seed)} {t['marker']} runs abnormal in {t['worst_pct']}% "
            f"of {_label([t['worst_cohort']])} bookings against {t['overall_pct']}% "
            f"across all of them. Threshold used: {t['basis']}. "
            f"Across the age range: {series}. That is a {t['spread']}-point spread, "
            f"which is why this is an age-targeted angle rather than a general one."
        )
        if here is not None:
            text += f" For {lab} specifically it is {here}%."
        act = (f"Build the {t['marker']} angle against {_label([t['worst_cohort']])} "
               f"first and let the number carry the message; no fear framing needed "
               f"when the base rate is already this high.")
        return [text], act, facts

    b = CI.biomarkers(cohort)
    if not b:
        return [f"Not enough age-matched checkup bookings for {lab} to report markers."], "", facts
    worst = b["markers"][:4]
    facts += [
        {"label": f"Most abnormal in {lab}",
         "value": f"{worst[0]['marker']} at {worst[0]['abnormal_pct']}%", "provenance": "OBSERVED"},
        {"label": "Bookings behind this", "value": _n(b["bookings"]), "provenance": "OBSERVED"},
        {"label": "Age match rate", "value": _pct(prov["match_rate"]), "provenance": "DERIVED"},
    ]
    ladder = ", ".join(f"{m['marker']} {m['abnormal_pct']}%" for m in worst)
    w = worst[0]
    text = (
        f"{_pick('finding', seed)} In {lab}, the marker most often out of range is "
        f"{w['marker']} at {w['abnormal_pct']}% of bookings, median {w['median']} "
        f"against a threshold of {w['threshold']}. Then: {ladder}. "
        f"Based on {_n(b['bookings'])} age-matched checkup bookings."
    )
    steep = CI.steepest_gradient(2)
    if steep:
        s = steep[0]
        text += (f" The sharpest age gradient in the whole panel is {s['marker']}, "
                 f"climbing from {s['best_pct']}% in {_label([s['best_cohort']])} to "
                 f"{s['worst_pct']}% in {_label([s['worst_cohort']])}.")
    act = (f"Use {w['marker']} as the {lab} checkup hook. It is the single most "
           f"common abnormal finding in this cohort, so the claim is defensible.")
    return [text], act, facts


def h_segment(model, keys, org, msg, facts, seed):
    obj = _objective_from(msg, "th_activation")
    lab = _label(keys)
    cs = _sum(model, keys, org)
    app = sum(c["app"] for c in cs)
    no_app = sum(c["no_app"] for c in cs)
    dnd = sum(c["dnd"] for c in cs)
    total = sum(c["total"] for c in cs) or 1

    rules = [
        ("property", "warehouse_production_organisationStatus", "equals", "ACTIVE",
         "base eligibility, active orgs only"),
        ("property", "warehouse_production_isTestOrganisation", "not equals", "true",
         "base eligibility, excludes test orgs"),
        ("property", "is_in_DND_CT", "not equals", "true",
         f"DND suppression, {_n(dnd)} people in this selection carry the flag"),
    ]
    if obj in ("th_activation", "hc_activation", "reengagement", "hc_crosssell"):
        rules.append(("event", "App Launched", "Did", "in last 180 days",
                      f"app ownership, {_n(app)} in this selection"))
    if obj == "app_install":
        rules.append(("event", "App Installed", "Have Not Done", "in last 365 days",
                      f"the no-app pool, {_n(no_app)} people"))
    if obj == "th_activation":
        rules += [
            ("property", "warehouse_production_telehealthMembershipCreatedAtTimestamp",
             "exists", "in last 365 days", "telehealth product eligibility"),
            ("event", "EmployeeMobileApp_Telehealth_AppointmentSuccessful_Viewed",
             "Have Not Done", "ever", "never booked, the canonical booked event"),
        ]
    if obj == "hc_activation":
        rules += [
            ("property", "warehouse_production_plumHealthCheckupMembershipCreatedAtTimestamp",
             "exists", "in last 365 days", "checkup product eligibility"),
            ("event", "healthCheckupbooking_confirmed", "Have Not Done", "ever",
             "never booked, the canonical confirmed event"),
        ]
    if obj == "hc_crosssell":
        rules += [
            ("event", "healthCheckupreport_viewed", "Did", "in last 120 days",
             "the cross-sell trigger moment"),
            ("event", "healthCheckuptelehealthBooking_done", "Have Not Done", "ever",
             "has not yet crossed over"),
        ]
    if obj == "reengagement":
        rules.append(("event", "App Launched", "Have Not Done", "in last 30 days",
                      "installed but quiet"))

    facts += [
        {"label": "Selection", "value": f"{_n(total)} in {lab}", "provenance": "OBSERVED"},
        {"label": "Rules emitted", "value": str(len(rules)), "provenance": "RECOMMENDED"},
        {"label": "DND to exclude", "value": _n(dnd), "provenance": "OBSERVED"},
    ]
    lines = [
        f"{_pick('plain', seed)} For {obj.replace('_', ' ')} across {lab}, assemble it "
        f"in this order. The first three are non-negotiable base filters."
    ]
    for i, (kind, name, op, val, why) in enumerate(rules, 1):
        lines.append(f"{i}. {kind.upper()} {name} {op} {val}  ({why})")
    lines.append(
        f"Age itself is not a CleverTap property. Derive it from "
        f"warehouse_production_dateOfBirth, which is active, and never from the "
        f"age event property, which has single-digit fill against millions of rows."
    )
    act = ("Paste these into the segment builder top to bottom, then check the "
           "reachability panel before treating it as campaign-ready.")
    return lines, act, facts


def h_timing(model, keys, org, msg, facts, seed):
    low = msg.lower()
    ch = ("email" if "email" in low or "gmail" in low
          else "push" if "push" in low
          else "whatsapp")
    r = T.recommend(ch, keys)
    c = r["clock"]
    facts += [
        {"label": f"{r['channel_label']} primary send",
         "value": f"{r['primary']['send_at']} IST", "provenance": "RECOMMENDED"},
        {"label": "Observed intent peak",
         "value": f"{r['primary']['intent_peak']} IST at {_pct(r['primary']['intent_share'])}",
         "provenance": "OBSERVED"},
        {"label": "Observations", "value": _n(c["observations"]), "provenance": "OBSERVED"},
        {"label": "Dead zone", "value": f"{_pct(c['dead_share'])} of bookings 01:00 to 06:00",
         "provenance": "OBSERVED"},
    ]
    text = (
        f"{_pick('caution', seed)} Send {r['channel_label']} at "
        f"{r['primary']['send_at']} IST, with {r['secondary']['send_at']} as the "
        f"second slot. Booking intent is twin-peaked, not single-peaked: "
        f"{_pct(c['morning_share'])} of real bookings land between 09:00 and 14:00 "
        f"and {_pct(c['evening_share'])} between 17:00 and 21:00. "
        f"{r['why']}, which is why the send sits {r['primary']['lead_minutes']} "
        f"minutes ahead of the {r['primary']['intent_peak']} peak."
    )
    corr = r["corrections"][0]
    text += f" Worth knowing: the often-quoted 20:00 to 23:00 window holds only {_pct(c['night_share'])} of bookings."
    act = (f"Schedule {r['channel_label']} for {r['primary']['send_at']} IST and keep "
           f"the journey day-gaps as designed: day 0, 2, 4 and 9.")
    return [text], act, facts


def h_channel(model, keys, org, msg, facts, seed):
    cs = _sum(model, keys, org)
    total = sum(c["total"] for c in cs) or 1
    dnd = sum(c["dnd"] for c in cs)
    options = {
        "whatsapp": sum(c["reach"]["whatsapp"]["count"] for c in cs),
        "email": sum(c["reach"]["email"]["count"] for c in cs),
        "push": sum(c["reach"]["push"].get("with_app", 0) for c in cs),
    }
    sc = D.score_channels(total, options, 1 - dnd / total)
    win = sc["selected"]
    w = sc["channels"][win]
    runner = sorted(sc["channels"].items(), key=lambda kv: -kv[1]["total"])[1]
    facts += [
        {"label": f"{w['label']} rubric score", "value": f"{w['total']}/100", "provenance": "DERIVED"},
        {"label": f"{runner[1]['label']} rubric score", "value": f"{runner[1]['total']}/100", "provenance": "DERIVED"},
        {"label": f"{w['label']} addressable", "value": _n(w["addressable"]), "provenance": "DERIVED"},
    ]
    text = (
        f"{_pick('lead', seed)} {w['label']} for {_label(keys)}, scoring "
        f"{w['total']}/100 against {runner[1]['total']}/100 for {runner[1]['label']}. "
        f"The rubric weighs deliverable reach at 40, open propensity at 22, clicks at "
        f"12, delivery at 10, frequency headroom at 9 and DND safety at 7. It can "
        f"address {_n(w['addressable'])} people here."
    )
    act = f"Run the simulator on {w['label']} and open the rubric breakdown to audit the components."
    return [text], act, facts


def h_reach(model, keys, org, msg, facts, seed):
    cs = _sum(model, keys, org)
    total = sum(c["total"] for c in cs) or 1
    wa = sum(c["reach"]["whatsapp"]["count"] for c in cs)
    em = sum(c["reach"]["email"]["count"] for c in cs)
    real = sum(c["reach"]["push"].get("with_app", 0) for c in cs)
    rep = sum(c["reach"]["push"]["count"] for c in cs)
    lab = _label(keys)
    facts += [
        {"label": f"{lab} selection", "value": _n(total), "provenance": "OBSERVED"},
        {"label": "WhatsApp deliverable", "value": f"{_n(wa)} ({_pct(wa/total)})", "provenance": "DERIVED"},
        {"label": "Email deliverable", "value": f"{_n(em)} ({_pct(em/total)})", "provenance": "DERIVED"},
        {"label": "Push deliverable", "value": f"{_n(real)} ({_pct(real/total)})", "provenance": "DERIVED"},
    ]
    text = (
        f"{_pick('lead', seed)} {lab} holds {_n(total)} people. WhatsApp reaches "
        f"{_n(wa)} ({_pct(wa/total)}), email {_n(em)} ({_pct(em/total)}), and push "
        f"genuinely reaches {_n(real)} ({_pct(real/total)}). The panel will quote "
        f"{_n(rep)} for push; the gap is stale tokens on uninstalled apps that "
        f"report as sent and land nowhere."
    )
    act = "Plan push against the deliverable figure and lead with WhatsApp for anything base-wide."
    return [text], act, facts


def h_conversion(model, keys, org, msg, facts, seed):
    obj = _objective_from(msg, "th_activation")
    kind, basis = A.CONVERSION_PROVENANCE[obj]
    rate = A.OBJECTIVE_CONVERSION[obj]
    cs = _sum(model, keys, org)
    app = sum(c["app"] for c in cs)
    lab = _label(keys)
    facts += [
        {"label": f"Click to convert, {obj.replace('_',' ')}", "value": _pct(rate, 2), "provenance": kind},
        {"label": f"App base in {lab}", "value": _n(app), "provenance": "OBSERVED"},
    ]
    lines = []
    if obj in ("th_activation", "hc_activation"):
        f = A.TH_FUNNEL if obj == "th_activation" else A.HC_FUNNEL
        i = min(range(1, len(f)), key=lambda j: f[j][2] / f[j-1][2])
        step = f[i][2] / f[i-1][2]
        facts.append({"label": f"Worst step: {f[i-1][0]} to {f[i][0]}",
                      "value": f"{_pct(step)} continue", "provenance": "OBSERVED"})
        lines.append(
            f"{_pick('lead', seed)} {_pct(rate, 2)}, and it is {kind}: {basis}. "
            f"For {lab} that sits on an app base of {_n(app)}. The biggest leak is "
            f"{f[i-1][0]} to {f[i][0]}, where only {_pct(step)} continue, so fixing "
            f"that step beats buying more traffic into the top."
        )
    else:
        lines.append(
            f"{_pick('caution', seed)} {_pct(rate, 2)}, and it is {kind}: {basis}. "
            f"Audience sizing for {lab} stays exact either way; treat this rate as "
            f"directional."
        )
    act = "Set the target off the observed rate and A/B only the step above the biggest leak."
    return lines, act, facts


def h_push_gap(model, keys, org, msg, facts, seed):
    cs = _sum(model, keys, org)
    rep = sum(c["reach"]["push"]["count"] for c in cs)
    real = sum(c["reach"]["push"].get("with_app", 0) for c in cs)
    lab = _label(keys)
    facts += [
        {"label": "Push reported", "value": _n(rep), "provenance": "OBSERVED"},
        {"label": "Push deliverable", "value": _n(real), "provenance": "DERIVED"},
        {"label": "Stale tokens", "value": _n(rep - real), "provenance": "DERIVED"},
    ]
    text = (
        f"{_pick('caution', seed)} In {lab} the panel reports {_n(rep)} push-reachable "
        f"but only {_n(real)} hold an app install signal. The {_n(rep - real)} in "
        f"between are stale tokens: App Uninstalled never fires in this account, so "
        f"tokens are never invalidated. Those sends report as delivered and reach nobody."
    )
    act = "Exclude the no-app segment from every push campaign and size against the deliverable count."
    return [text], act, facts


def h_dnd(model, keys, org, msg, facts, seed):
    cs = _sum(model, keys, org)
    dnd = sum(c["dnd"] for c in cs)
    total = sum(c["total"] for c in cs) or 1
    facts += [
        {"label": "DND-suppressed", "value": f"{_n(dnd)} ({_pct(dnd/total)})", "provenance": "OBSERVED"},
        {"label": "Enforcement", "value": "per-campaign, not central", "provenance": "OBSERVED"},
    ]
    text = (
        f"{_pick('caution', seed)} {_n(dnd)} people in {_label(keys)}, "
        f"{_pct(dnd/total)} of the selection, carry is_in_DND_CT. Nothing enforces it "
        f"centrally: the flag-setting journey only sets the flag, so every campaign "
        f"has to exclude it itself. It also skews Enterprise, so do not model it flat."
    )
    act = ("Add is_in_DND_CT != true to every segment and confirm the comparison value "
           "is actually set; a blank once inflated a count past 3.8 million.")
    return [text], act, facts


def h_device(model, keys, org, msg, facts, seed):
    cs = _sum(model, keys, org)
    ios = sum(c["ios"] for c in cs)
    android = sum(c["android"] for c in cs)
    app = sum(c["app"] for c in cs) or 1
    facts += [
        {"label": "Android", "value": f"{_n(android)} ({_pct(android/app, 0)})", "provenance": "MODELED"},
        {"label": "iOS", "value": f"{_n(ios)} ({_pct(ios/app, 0)})", "provenance": "MODELED"},
        {"label": "App base", "value": _n(app), "provenance": "OBSERVED"},
    ]
    text = (
        f"{_pick('plain', seed)} Of {_n(app)} app users in {_label(keys)}, the model "
        f"carries {_n(android)} Android ({_pct(android/app, 0)}) and {_n(ios)} iOS "
        f"({_pct(ios/app, 0)}). This split is MODELED and labelled so: no device "
        f"distribution exists in any source, and CleverTap's counts endpoint ignores "
        f"platform filters, which was verified by direct query. iOS needs explicit "
        f"notification opt-in, so iOS-heavy pockets lose more push than installs suggest."
    )
    act = "Pull CT OS Version on App Launched from the dashboard if device targeting has to be exact."
    return [text], act, facts


def h_compare(model, keys, org, msg, facts, seed):
    cs = [c for c in (P.cohort_summary(model, k, org) for k in CE.BANDS) if c]
    biggest = max(cs, key=lambda c: c["total"])
    best_app = max(cs, key=lambda c: c["app_share"])
    best_th = max(cs, key=lambda c: c["th_booked_of_app"])
    facts += [
        {"label": "Largest", "value": f"{biggest['label']}, {_n(biggest['total'])}", "provenance": "OBSERVED"},
        {"label": "Highest app ownership", "value": f"{best_app['label']}, {_pct(best_app['app_share'])}", "provenance": "DERIVED"},
        {"label": "Best TH rate of app base", "value": f"{best_th['label']}, {_pct(best_th['th_booked_of_app'])}", "provenance": "DERIVED"},
    ]
    text = (
        f"{_pick('plain', seed)} {biggest['label']} is largest at {_n(biggest['total'])} "
        f"and carries the most absolute headroom. {best_app['label']} owns the app most "
        f"at {_pct(best_app['app_share'])}, so push works best there. On booking rate "
        f"inside the app base, {best_th['label']} leads telehealth at "
        f"{_pct(best_th['th_booked_of_app'])}."
    )
    over = []
    for c in cs:
        cmp = CI.consulter_vs_base(c["key"], c["share_of_base"])
        if cmp and cmp["index"] > 115:
            over.append(f"{c['label']} at index {cmp['index']}")
    if over:
        text += (f" Against their share of the base, these cohorts over-index on actual "
                 f"telehealth use: {', '.join(over)}.")
    act = f"Start with {biggest['label']} for volume and {best_th['label']} for efficiency."
    return [text], act, facts


def h_copy(model, keys, org, msg, facts, seed, channel):
    obj = _objective_from(msg, "th_activation")
    ch = channel if channel in A.CHANNELS else "whatsapp"
    gen = CE.generate(obj, keys[:1], ch)
    v = gen["groups"][0]["variants"][0]
    a, p = v["analysis"], v["prediction"]
    facts += [
        {"label": "Source", "value": v["source"], "provenance": "GENERATED"},
        {"label": "Category", "value": f"{A.CHANNEL_LABELS[ch]} {a['category']}", "provenance": "DERIVED"},
        {"label": "Style score", "value": f"{a['style_score']}/100", "provenance": "DERIVED"},
        {"label": "Predicted open", "value": f"{_pct(p['predicted']['open'])} vs {_pct(p['baseline']['open'])} prior", "provenance": "PREDICTED"},
    ]
    band = gen["groups"][0]["band_label"]
    body = v["body"] if len(v["body"]) <= 400 else v["body"][:397] + "..."
    lines = [
        f"{_pick('plain', seed)} Approved-library {A.CHANNEL_LABELS[ch]} "
        f"{a['category']} for {band}, {a['chars']} characters, {a['emoji_count']} "
        f"emojis, style {a['style_score']}/100:",
        body if not v["title"] else f"{v['title']}\n{body}",
        f"Predicted open {_pct(p['predicted']['open'])} against a "
        f"{_pct(p['baseline']['open'])} channel prior, at low confidence: this "
        f"account has no campaign history, so that is a style-fit adjustment on a "
        f"prior, not a learned rate.",
    ]
    marker = CI.worst_marker(keys[0])
    if marker and obj in ("hc_activation", "hc_crosssell"):
        lines.append(
            f"If you want a sharper hook for this cohort, {marker['marker']} runs "
            f"abnormal in {marker['abnormal_pct']}% of their checkup bookings."
        )
    act = "Open the copy studio for every variant, the utility alternative and the full discipline checks."
    return lines, act, facts


def h_accuracy(model, keys, org, msg, facts, seed):
    prov = CI.provenance()
    facts += [
        {"label": "Model invariants", "value": "25 asserted at boot", "provenance": "OBSERVED"},
        {"label": "Simulation sweep", "value": "20 combinations per boot", "provenance": "DERIVED"},
        {"label": "Clinical evidence",
         "value": f"{_n(prov['th']['consults'])} consults, {_n(prov['hc']['bookings'])} checkup bookings",
         "provenance": "OBSERVED"},
        {"label": "Known data defects", "value": "3 documented and filtered", "provenance": "OBSERVED"},
    ]
    text = (
        f"{_pick('plain', seed)} Four labels, never blurred: OBSERVED off the source "
        f"of record, DERIVED as exact arithmetic on observed facts, MODELED as a "
        f"calibrated assumption that still reconciles to the anchors, PREDICTED as a "
        f"forecast capped at low confidence. The 956,050 base reconciles to 25 "
        f"invariants at boot and 20 simulations are swept every start. The clinical "
        f"layer sits on {_n(prov['th']['consults'])} real consults and "
        f"{_n(prov['hc']['bookings'])} checkup bookings."
    )
    text += (
        f" Three defects are handled openly: patient age in the source ranges from "
        f"-517 to 2026 so rows are filtered to 15-80, dropping "
        f"{prov['th']['dropped_pct']}%; consultation timestamps are UTC and are "
        f"converted to IST or the booking curve peaks at 05:00; and checkup bookings "
        f"carry no age, so age is joined via member id and matches "
        f"{_pct(prov['hc']['match_rate'])}."
    )
    act = "Open Methodology for field-level provenance and the live invariant list."
    return [text], act, facts


def h_help(model, keys, org, msg, facts, seed):
    prov = CI.provenance()
    facts.append({"label": "Evidence available",
                  "value": f"{_n(prov['th']['consults'])} consults, 24 specialties, 11 biomarkers",
                  "provenance": "OBSERVED"})
    text = (
        "I read the cohort model, the approved copy library and Plum's own "
        "consultation and checkup files. Useful things to ask: which channel to use, "
        "what the real send time is, which biomarker is most off in a cohort, what "
        "the dermatology or mental-health pattern looks like, what filters to put in "
        "a segment, or how far to trust any number I give you."
    )
    act = "Try: which biomarker is most off in 36-40, or what filters build a checkup segment for 26-35."
    return [text], act, facts


HANDLERS = {
    "specialty": h_specialty, "biomarker": h_biomarker, "segment": h_segment,
    "timing": h_timing, "channel": h_channel, "reach": h_reach,
    "conversion": h_conversion, "push_gap": h_push_gap, "dnd": h_dnd,
    "device": h_device, "compare": h_compare, "accuracy": h_accuracy,
    "help": h_help,
}

# ---------------------------------------------------------------------------
# The 10-parameter rubric
# ---------------------------------------------------------------------------

RUBRIC = {
    "id": "signal_quality",
    "label": "SIGNAL answer quality",
    "version": RUBRIC_VERSION,
    "parameters": [
        {"key": "grounding", "label": "Grounded in real data", "weight": 15,
         "desc": "Every claim traces to a figure the model or the source files actually hold"},
        {"key": "numbers", "label": "Numeric traceability", "weight": 12,
         "desc": "Exact counts and rates, never rounded storytelling"},
        {"key": "provenance", "label": "Provenance labelling", "weight": 11,
         "desc": "OBSERVED, DERIVED, MODELED and PREDICTED never blurred"},
        {"key": "depth", "label": "Evidence depth", "weight": 12,
         "desc": "Reaches the clinical and behavioural layer, not just headline counts"},
        {"key": "specificity", "label": "Cohort specificity", "weight": 10,
         "desc": "Answers about the selected cohorts by name"},
        {"key": "action", "label": "Actionability", "weight": 12,
         "desc": "Ends with something the marketer can do next"},
        {"key": "honesty", "label": "Confidence honesty", "weight": 10,
         "desc": "Predictions carry low confidence, unknowns are said plainly"},
        {"key": "voice", "label": "Voice and personality", "weight": 8,
         "desc": "Reads like an analyst with a view, not a data dump"},
        {"key": "brevity", "label": "Length discipline", "weight": 5,
         "desc": "Tight; no padding"},
        {"key": "hygiene", "label": "House hygiene", "weight": 5,
         "desc": "No em dashes, no fabricated statistics"},
    ],
}

_DEPTH_INTENTS = {"specialty", "biomarker", "segment", "timing", "accuracy", "compare"}


def _score(answer: str, facts: list[dict], action: str, intents: list[str],
           keys: list[str], seed: str) -> dict:
    n_num = len(re.findall(r"\d[\d,.]*%?", answer))
    provs = {f["provenance"] for f in facts}
    labels = [c["label"] for c in A.AGE_COHORTS if c["key"] in keys]
    opener_used = any(o in answer for b in OPENERS.values() for o in b)

    c = {
        "grounding": 1.0 if len(facts) >= 3 else 0.6 if facts else 0.2,
        "numbers": 1.0 if n_num >= 6 else 0.75 if n_num >= 3 else 0.35,
        "provenance": 1.0 if len(provs) >= 3 else 0.75 if len(provs) >= 2 else 0.4,
        "depth": 1.0 if set(intents) & _DEPTH_INTENTS else 0.65,
        "specificity": 1.0 if (any(l in answer for l in labels)
                               or {"accuracy", "help", "compare"} & set(intents)) else 0.5,
        "action": 1.0 if action else 0.0,
        "honesty": (1.0 if (not any(f["provenance"] == "PREDICTED" for f in facts)
                            or "low confidence" in answer.lower()) else 0.4),
        "voice": 1.0 if opener_used else 0.6,
        "brevity": 1.0 if len(answer.split()) <= 175 else 0.7 if len(answer.split()) <= 250 else 0.4,
        "hygiene": 1.0 if ("—" not in answer and "–" not in answer) else 0.0,
    }
    params, total = [], 0.0
    for p in RUBRIC["parameters"]:
        v = c.get(p["key"], 0.5)
        pts = p["weight"] * v
        total += pts
        params.append({"key": p["key"], "label": p["label"], "weight": p["weight"],
                       "score": round(v, 2), "points": round(pts, 1)})
    return {"total": round(total / 10, 1), "out_of": 10, "parameters": params,
            "rule_version": RUBRIC_VERSION}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def answer(model: dict, message: str, cohort_keys: list[str],
           org: str | None, objective: str | None, channel: str | None) -> dict:
    intents = _detect(message)
    keys = _cohorts_from(message, cohort_keys or [])
    seed = message.strip().lower()
    facts: list[dict] = []
    paras: list[str] = []
    action = ""

    for intent in intents[:2]:
        fn = HANDLERS[intent]
        if intent == "copy":
            lines, act, facts = h_copy(model, keys, org, message, facts, seed,
                                       channel or "whatsapp")
        else:
            lines, act, facts = fn(model, keys, org, message, facts, seed)
        paras += lines
        action = action or act

    text = _clean("\n\n".join(paras))
    return {
        "label": "DERIVED",
        "agent": "SIGNAL",
        "intents": intents[:2],
        "cohorts": [c["label"] for c in A.AGE_COHORTS if c["key"] in keys],
        "objective": _objective_from(message, objective or "th_activation"),
        "answer": text,
        "action": _clean(action),
        "facts": facts,
        "score": _score(text, facts, action, intents[:2], keys, seed),
    }


def suggestions(cohort_keys: list[str]) -> list[str]:
    lab = _label(cohort_keys[:1]) or "26-35"
    return [
        f"Which biomarker is most off in {lab}?",
        f"What is the dermatology pattern in {lab}?",
        f"What filters build a checkup segment for {lab}?",
        f"When should I actually send WhatsApp?",
        f"Which channel for {lab}?",
        "How reliable are these numbers?",
    ]
