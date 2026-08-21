"""
Deterministic cohort population model for Crew M.

Design decision: this is NOT a random sample. It is an exact contingency table.

Why that matters. A sampled population drifts: run it twice and the numbers
move, cohort subtotals stop adding up to the headline figure, and nobody can
tell a real finding from sampling noise. Every count here is produced by
integer apportionment (largest-remainder / Hamilton), so:

  * every cohort subtotal sums EXACTLY to the eligible base
  * every org-type split within a cohort sums EXACTLY to that cohort
  * app users, MAU, and every funnel stage sum EXACTLY to the CleverTap anchors
  * the same inputs always produce byte-identical outputs

verify() asserts all of this at import time. If an anchor and the model ever
disagree, the server refuses to start rather than serving a wrong number.

--- Data access note (governance) ---
What: aggregate cohort counts derived from CleverTap aggregate anchors plus
modeled demographic composition. No user-level data is read, stored or moved.
Why: the product answers "who should receive this campaign" at cohort level.
Protection: no PII enters this module — it operates purely on integer totals.
"""

from __future__ import annotations

import anchors as A


# ---------------------------------------------------------------------------
# Exact integer apportionment
# ---------------------------------------------------------------------------

def allocate(total: int, weights: dict[str, float]) -> dict[str, int]:
    """
    Split `total` across `weights` so the parts sum to exactly `total`.

    Largest-remainder method: floor every share, then hand the leftover units
    to the keys with the biggest fractional remainders. Ties break on key name
    so the result is deterministic.
    """
    if total <= 0:
        return {k: 0 for k in weights}
    wsum = sum(weights.values())
    if wsum <= 0:
        return {k: 0 for k in weights}

    exact = {k: total * w / wsum for k, w in weights.items()}
    out = {k: int(v) for k, v in exact.items()}
    remainder = total - sum(out.values())
    if remainder:
        order = sorted(weights, key=lambda k: (-(exact[k] - out[k]), k))
        for k in order[:remainder]:
            out[k] += 1
    return out


def allocate_capped(total: int, weights: dict[str, float],
                    caps: dict[str, int]) -> dict[str, int]:
    """
    Like allocate(), but no key may exceed its cap.

    Water-filling: allocate proportionally, clamp anything over its cap, then
    redistribute the freed units among the keys that still have headroom.
    Repeats until nothing is over cap or all capacity is used.

    Used for nested constraints — MAU cannot exceed the app base of its own
    cell, and a funnel stage cannot exceed the app base it is drawn from.
    """
    total = min(total, sum(caps.values()))
    out = {k: 0 for k in weights}
    active = {k: w for k, w in weights.items() if w > 0 and caps.get(k, 0) > 0}

    while total > 0 and active:
        share = allocate(total, active)
        overflow = 0
        newly_capped = []
        for k, v in share.items():
            room = caps[k] - out[k]
            if v >= room:
                out[k] = caps[k]
                overflow += v - room
                newly_capped.append(k)
            else:
                out[k] += v
        total = overflow
        for k in newly_capped:
            active.pop(k, None)
        if not newly_capped:
            break  # allocation fit entirely within caps
    return out


# ---------------------------------------------------------------------------
# Cell model
#
# A cell is one (age cohort x org type) pair. 6 x 4 = 24 cells.
# Every quantity below is an exact integer count within its cell.
# ---------------------------------------------------------------------------

COHORT_KEYS = [c["key"] for c in A.AGE_COHORTS]
COHORT_BY_KEY = {c["key"]: c for c in A.AGE_COHORTS}
ORG_KEYS = list(A.ORG_TYPE_SHARES.keys())


def _cell_id(cohort: str, org: str) -> str:
    return f"{cohort}|{org}"


def build() -> dict:
    """Build the full population model. Pure function of anchors.py."""

    # -- 1. Eligible base -> cohorts (exact) --------------------------------
    cohort_total = allocate(A.TOTAL_ELIGIBLE, A.AGE_COHORT_SHARES)

    # -- 2. Each cohort -> org types (exact within cohort) ------------------
    cells: dict[str, dict] = {}
    for ck in COHORT_KEYS:
        org_split = allocate(cohort_total[ck], A.ORG_TYPE_SHARES)
        for org in ORG_KEYS:
            cells[_cell_id(ck, org)] = {
                "cohort": ck,
                "org": org,
                "total": org_split[org],
            }

    # -- 3. App base (exact to OBSERVED annual_active_users) ----------------
    # Weight = cell size x cohort app propensity. Capped at cell size.
    app_weights = {
        cid: c["total"] * A.APP_PROPENSITY_BY_COHORT[c["cohort"]]
        for cid, c in cells.items()
    }
    app_caps = {cid: c["total"] for cid, c in cells.items()}
    app_alloc = allocate_capped(A.APP_REACHABLE, app_weights, app_caps)
    for cid, c in cells.items():
        c["app"] = app_alloc[cid]
        c["no_app"] = c["total"] - c["app"]

    # -- 4. MAU (exact to OBSERVED mau_30d, capped by app base) ------------
    mau_weights = {
        cid: c["app"] * A.MAU_PROPENSITY_BY_COHORT[c["cohort"]]
        for cid, c in cells.items()
    }
    mau_caps = {cid: c["app"] for cid, c in cells.items()}
    mau_alloc = allocate_capped(A.OBSERVED["mau_30d"], mau_weights, mau_caps)
    for cid, c in cells.items():
        c["mau"] = mau_alloc[cid]
        # App-installed but not active in 30d — the re-engagement pool.
        c["app_dormant"] = c["app"] - c["mau"]

    # -- 5. Platform split within the app base (exact per cell) ------------
    for cid, c in cells.items():
        ios_share = min(
            0.95,
            A.IOS_SHARE_BY_COHORT[c["cohort"]] * A.IOS_MULTIPLIER_BY_ORG[c["org"]],
        )
        split = allocate(c["app"], {"ios": ios_share, "android": 1 - ios_share})
        c["ios"] = split["ios"]
        c["android"] = split["android"]

    # -- 6. Gender split across the whole cell (exact per cell) ------------
    for cid, c in cells.items():
        f = A.FEMALE_SHARE_BY_COHORT[c["cohort"]]
        split = allocate(c["total"], {"female": f, "male": 1 - f})
        c["female"] = split["female"]
        c["male"] = split["male"]

    # -- 7. DND (exact per cell) -------------------------------------------
    for cid, c in cells.items():
        dnd_rate = A.DND_SHARE_BY_ORG[c["org"]]
        split = allocate(c["total"], {"dnd": dnd_rate, "ok": 1 - dnd_rate})
        c["dnd"] = split["dnd"]
        c["contactable"] = split["ok"]

    # -- 8. Channel reachability (exact counts, not floating rates) --------
    # WhatsApp / email key off the member record -> share of the whole cell.
    # Push requires the app AND an OS opt-in -> share of the app base only,
    # weighted by the platform split because iOS opt-in is much lower.
    for cid, c in cells.items():
        m = A.REACH_MULTIPLIER_BY_ORG[c["org"]]
        wa_rate = min(0.995, A.WHATSAPP_REACH_BASE * m)
        em_rate = min(0.995, A.EMAIL_REACH_BASE * m)

        # Reachability applies to contactable users only (DND excluded).
        base = c["contactable"]
        c["reach_whatsapp"] = allocate(base, {"y": wa_rate, "n": 1 - wa_rate})["y"]
        c["reach_email"] = allocate(base, {"y": em_rate, "n": 1 - em_rate})["y"]

        # Push: opt-in applied per platform, then DND-excluded proportionally.
        push_android = allocate(
            c["android"], {"y": A.PUSH_OPTIN_ANDROID, "n": 1 - A.PUSH_OPTIN_ANDROID}
        )["y"]
        push_ios = allocate(
            c["ios"], {"y": A.PUSH_OPTIN_IOS, "n": 1 - A.PUSH_OPTIN_IOS}
        )["y"]
        push_raw = push_android + push_ios
        keep = (c["contactable"] / c["total"]) if c["total"] else 0
        c["reach_push"] = allocate(push_raw, {"y": keep, "n": 1 - keep})["y"]
        c["reach_push_android"] = push_android
        c["reach_push_ios"] = push_ios

    # -- 9. TH / HC funnels (exact to OBSERVED stage totals) ---------------
    # Every funnel stage is drawn from the app base, since all these events
    # are in-app. Weight by MAU-leaning engagement so active cohorts carry
    # more of the funnel, which is what actually happens.
    funnel_weights = {
        cid: c["mau"] * 2.0 + c["app_dormant"] * 0.35
        for cid, c in cells.items()
    }
    app_cap = {cid: c["app"] for cid, c in cells.items()}

    for label, event, observed_total in A.TH_FUNNEL_OBSERVED:
        alloc = allocate_capped(observed_total, funnel_weights, app_cap)
        for cid, c in cells.items():
            c.setdefault("th_funnel", {})[label] = alloc[cid]

    for label, event, observed_total in A.HC_FUNNEL_OBSERVED:
        alloc = allocate_capped(observed_total, funnel_weights, app_cap)
        for cid, c in cells.items():
            c.setdefault("hc_funnel", {})[label] = alloc[cid]

    # Adoption = reached the terminal stage of each funnel.
    th_terminal = A.TH_FUNNEL_OBSERVED[-1][0]   # "Consult joined"
    hc_terminal = A.HC_FUNNEL_OBSERVED[-1][0]   # "Booking confirmed"
    for cid, c in cells.items():
        c["th_adopted"] = c["th_funnel"][th_terminal]
        c["hc_adopted"] = c["hc_funnel"][hc_terminal]

    return {"cells": cells, "cohort_total": cohort_total}


# ---------------------------------------------------------------------------
# Verification — the server will not start if any of this fails.
# ---------------------------------------------------------------------------

def verify(model: dict) -> list[str]:
    """Assert every additivity and anchor invariant. Returns the checks run."""
    cells = model["cells"]
    checks = []

    def eq(label, got, want):
        if got != want:
            raise AssertionError(f"{label}: model={got:,} anchor={want:,}")
        checks.append(f"{label} = {want:,}")

    eq("eligible base", sum(c["total"] for c in cells.values()), A.TOTAL_ELIGIBLE)
    eq("app base", sum(c["app"] for c in cells.values()), A.APP_REACHABLE)
    eq("no-app", sum(c["no_app"] for c in cells.values()), A.NO_APP_COUNT)
    eq("MAU", sum(c["mau"] for c in cells.values()), A.OBSERVED["mau_30d"])
    eq("iOS + Android = app base",
       sum(c["ios"] + c["android"] for c in cells.values()), A.APP_REACHABLE)
    eq("male + female = base",
       sum(c["male"] + c["female"] for c in cells.values()), A.TOTAL_ELIGIBLE)
    eq("dnd + contactable = base",
       sum(c["dnd"] + c["contactable"] for c in cells.values()), A.TOTAL_ELIGIBLE)

    for label, _event, total in A.TH_FUNNEL_OBSERVED:
        eq(f"TH funnel '{label}'",
           sum(c["th_funnel"][label] for c in cells.values()), total)
    for label, _event, total in A.HC_FUNNEL_OBSERVED:
        eq(f"HC funnel '{label}'",
           sum(c["hc_funnel"][label] for c in cells.values()), total)

    # Cohort subtotals must sum to the eligible base.
    for ck in COHORT_KEYS:
        got = sum(c["total"] for c in cells.values() if c["cohort"] == ck)
        if got != model["cohort_total"][ck]:
            raise AssertionError(f"cohort {ck} subtotal mismatch")
    checks.append("all 6 cohort subtotals reconcile")

    # No cell may have more app users than people, or more MAU than app users.
    for cid, c in cells.items():
        assert c["app"] <= c["total"], f"{cid}: app > total"
        assert c["mau"] <= c["app"], f"{cid}: mau > app"
        assert c["reach_push"] <= c["app"], f"{cid}: push reach > app base"
        for label, _e, _t in A.TH_FUNNEL_OBSERVED:
            assert c["th_funnel"][label] <= c["app"], f"{cid}: TH {label} > app"
    checks.append("all 24 cells pass containment checks")

    return checks


# ---------------------------------------------------------------------------
# Cohort rollups — what the API actually serves
# ---------------------------------------------------------------------------

def _rate(num: int, den: int, nd: int = 4) -> float:
    return round(num / den, nd) if den else 0.0


def cohort_summary(model: dict, cohort_key: str,
                   org_filter: str | None = None) -> dict:
    """Aggregate one cohort (optionally narrowed to a single org type)."""
    cells = [
        c for c in model["cells"].values()
        if c["cohort"] == cohort_key and (org_filter is None or c["org"] == org_filter)
    ]
    if not cells:
        return {}

    meta = COHORT_BY_KEY[cohort_key]
    s = lambda k: sum(c[k] for c in cells)  # noqa: E731

    total = s("total")
    app = s("app")
    mau = s("mau")

    th_stages = [
        {
            "stage": label,
            "event": event,
            "count": sum(c["th_funnel"][label] for c in cells),
        }
        for label, event, _t in A.TH_FUNNEL_OBSERVED
    ]
    hc_stages = [
        {
            "stage": label,
            "event": event,
            "count": sum(c["hc_funnel"][label] for c in cells),
        }
        for label, event, _t in A.HC_FUNNEL_OBSERVED
    ]

    # Stage-to-stage conversion, computed from the counts above so the
    # percentages can never disagree with the bars they sit under.
    for i, st in enumerate(th_stages):
        prev = th_stages[i - 1]["count"] if i else st["count"]
        st["from_prev"] = _rate(st["count"], prev)
        st["of_app"] = _rate(st["count"], app)
    for i, st in enumerate(hc_stages):
        prev = hc_stages[i - 1]["count"] if i else st["count"]
        st["from_prev"] = _rate(st["count"], prev)
        st["of_app"] = _rate(st["count"], app)

    org_breakdown = {}
    for org in ORG_KEYS:
        ocells = [c for c in cells if c["org"] == org]
        if not ocells:
            continue
        o_total = sum(c["total"] for c in ocells)
        org_breakdown[org] = {
            "label": A.ORG_TYPE_LABELS[org],
            "total": o_total,
            "share_of_cohort": _rate(o_total, total),
            "app": sum(c["app"] for c in ocells),
            "mau": sum(c["mau"] for c in ocells),
            "th_adopted": sum(c["th_adopted"] for c in ocells),
            "hc_adopted": sum(c["hc_adopted"] for c in ocells),
            "reach_whatsapp": sum(c["reach_whatsapp"] for c in ocells),
            "reach_email": sum(c["reach_email"] for c in ocells),
            "reach_push": sum(c["reach_push"] for c in ocells),
            "dnd": sum(c["dnd"] for c in ocells),
        }

    return {
        "key": cohort_key,
        "label": meta["label"],
        "age_range": {"lo": meta["lo"], "hi": meta["hi"]},
        "org_filter": org_filter,

        # Size — OBSERVED base, MODELED cohort split
        "total": total,
        "share_of_base": _rate(total, A.TOTAL_ELIGIBLE),

        # App — anchored to CleverTap
        "app": app,
        "app_share": _rate(app, total),
        "no_app": s("no_app"),
        "no_app_share": _rate(s("no_app"), total),
        "mau": mau,
        "mau_share_of_app": _rate(mau, app),
        "app_dormant": s("app_dormant"),

        # Device
        "ios": s("ios"),
        "android": s("android"),
        "ios_share_of_app": _rate(s("ios"), app),
        "android_share_of_app": _rate(s("android"), app),

        # Demographics
        "male": s("male"),
        "female": s("female"),
        "female_share": _rate(s("female"), total),

        # Reachability — counts first, rates derived from them
        "reach": {
            "whatsapp": {
                "count": s("reach_whatsapp"),
                "of_total": _rate(s("reach_whatsapp"), total),
                "basis": "member record (phone) — app not required",
            },
            "email": {
                "count": s("reach_email"),
                "of_total": _rate(s("reach_email"), total),
                "basis": "member record (work email) — app not required",
            },
            "push": {
                "count": s("reach_push"),
                "of_total": _rate(s("reach_push"), total),
                "of_app": _rate(s("reach_push"), app),
                "android": s("reach_push_android"),
                "ios": s("reach_push_ios"),
                "basis": "requires app install + OS notification opt-in",
            },
        },
        "dnd": s("dnd"),
        "dnd_share": _rate(s("dnd"), total),

        # Product funnels — anchored to CleverTap
        "th_funnel": th_stages,
        "hc_funnel": hc_stages,
        "th_adopted": s("th_adopted"),
        "hc_adopted": s("hc_adopted"),
        "th_adoption_of_app": _rate(s("th_adopted"), app),
        "hc_adoption_of_app": _rate(s("hc_adopted"), app),
        "th_adoption_of_base": _rate(s("th_adopted"), total),
        "hc_adoption_of_base": _rate(s("hc_adopted"), total),

        "org_breakdown": org_breakdown,
        "peak_hour": A.PEAK_HOUR_BY_COHORT[cohort_key],
    }


def all_cohorts(model: dict, org_filter: str | None = None) -> list[dict]:
    return [cohort_summary(model, ck, org_filter) for ck in COHORT_KEYS]


def totals(model: dict) -> dict:
    """Base-wide totals. Every figure is a sum over the same cells."""
    cells = model["cells"].values()
    s = lambda k: sum(c[k] for c in cells)  # noqa: E731
    total, app = A.TOTAL_ELIGIBLE, s("app")
    return {
        "eligible": total,
        "app": app,
        "app_share": _rate(app, total),
        "no_app": s("no_app"),
        "no_app_share": _rate(s("no_app"), total),
        "mau": s("mau"),
        "mau_share_of_base": _rate(s("mau"), total),
        "mau_share_of_app": _rate(s("mau"), app),
        "dau": A.OBSERVED["dau"],
        "dau_mau_ratio": A.OBSERVED["dau_mau_ratio"],
        "new_installs_30d": A.OBSERVED["new_installs_30d"],
        "sessions_30d": A.OBSERVED["sessions_30d"],
        "sessions_per_mau": A.OBSERVED["sessions_per_mau_30d"],
        "ios": s("ios"),
        "android": s("android"),
        "ios_share_of_app": _rate(s("ios"), app),
        "android_share_of_app": _rate(s("android"), app),
        "male": s("male"),
        "female": s("female"),
        "female_share": _rate(s("female"), total),
        "dnd": s("dnd"),
        "dnd_share": _rate(s("dnd"), total),
        "reach_whatsapp": s("reach_whatsapp"),
        "reach_email": s("reach_email"),
        "reach_push": s("reach_push"),
        "reach_whatsapp_share": _rate(s("reach_whatsapp"), total),
        "reach_email_share": _rate(s("reach_email"), total),
        "reach_push_share_of_base": _rate(s("reach_push"), total),
        "reach_push_share_of_app": _rate(s("reach_push"), app),
        "th_adopted": s("th_adopted"),
        "hc_adopted": s("hc_adopted"),
    }


if __name__ == "__main__":
    m = build()
    print("=== VERIFICATION ===")
    for c in verify(m):
        print(f"  ok  {c}")

    t = totals(m)
    print("\n=== BASE TOTALS ===")
    print(f"  Eligible base        {t['eligible']:>10,}")
    print(f"  App-reachable        {t['app']:>10,}  ({t['app_share']:.1%})")
    print(f"  No app               {t['no_app']:>10,}  ({t['no_app_share']:.1%})")
    print(f"  MAU (30d)            {t['mau']:>10,}  ({t['mau_share_of_app']:.1%} of app)")
    print(f"  DAU                  {t['dau']:>10,}  (DAU/MAU {t['dau_mau_ratio']:.1%})")
    print(f"  Android / iOS        {t['android']:>10,} / {t['ios']:,}"
          f"  ({t['android_share_of_app']:.1%} / {t['ios_share_of_app']:.1%})")
    print("\n  Reachability")
    print(f"    WhatsApp           {t['reach_whatsapp']:>10,}  ({t['reach_whatsapp_share']:.1%} of base)")
    print(f"    Email              {t['reach_email']:>10,}  ({t['reach_email_share']:.1%} of base)")
    print(f"    Push               {t['reach_push']:>10,}  ({t['reach_push_share_of_base']:.1%} of base,"
          f" {t['reach_push_share_of_app']:.1%} of app)")

    print("\n=== AGE COHORTS ===")
    hdr = f"  {'Cohort':<10}{'Users':>10}{'Share':>8}{'App':>10}{'App%':>7}{'MAU':>9}{'Push':>9}{'TH':>8}{'HC':>8}"
    print(hdr)
    for c in all_cohorts(m):
        print(f"  {c['label']:<10}{c['total']:>10,}{c['share_of_base']:>7.1%}"
              f"{c['app']:>10,}{c['app_share']:>7.1%}{c['mau']:>9,}"
              f"{c['reach']['push']['count']:>9,}{c['th_adopted']:>8,}{c['hc_adopted']:>8,}")
    print(f"  {'TOTAL':<10}{t['eligible']:>10,}{1.0:>7.1%}{t['app']:>10,}"
          f"{t['app_share']:>7.1%}{t['mau']:>9,}{t['reach_push']:>9,}"
          f"{t['th_adopted']:>8,}{t['hc_adopted']:>8,}")
