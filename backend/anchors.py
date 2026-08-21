"""
Ground-truth anchors for Crew M.

EVERY number in this file is either:
  (a) OBSERVED  — pulled from the CleverTap REST API (source of record), or
  (b) REFERENCE — stated in data/CREW_M_MASTER_CT_BIBLE.md, or
  (c) MODELED   — a calibration assumption, explicitly flagged as such.

Nothing here is a guess dressed up as a fact. Where two sources disagree, the
disagreement is recorded in ANCHOR_CONFLICTS rather than silently averaged away.

--- Data access note (governance) ---
What is accessed: aggregate profile counts and event counts from CleverTap.
Why: dashboard and cohort figures must reconcile to the source of record.
What protects it: read-only credentials from the provisioned bundle
(~/.insurwreck/credentials.json), all queries bounded to a <= 1-year window,
counts only — no individual profiles are ever retrieved, and no PII is stored.
"""

from datetime import date

# ---------------------------------------------------------------------------
# OBSERVED — CleverTap, pulled 2026-08-21, 364-day window ending today.
# Endpoint: POST /1/counts/profiles.json (unique profiles performing an event)
#           POST /1/counts/events.json   (total event occurrences)
# These were validated by direct query, not copied from a doc.
# ---------------------------------------------------------------------------

CT_PULL_DATE = date(2026, 8, 21)
CT_WINDOW_DAYS = 364  # kept under the 1-year guardrail

OBSERVED = {
    # Unique profiles who fired "App Launched" in the trailing 364 days.
    # This is the real app-reachable population.
    "annual_active_users": 397_301,

    # Unique profiles who fired "App Launched" in the trailing 30 days.
    "mau_30d": 147_003,

    # Unique profiles who fired "App Launched" on the last COMPLETE day.
    # NOTE: querying "today" returns a partial day and understates DAU by
    # roughly 10-30%. The previous implementation did exactly that and reported
    # 11,703 against a true value of 16,503. Always use the last complete day.
    "dau": 16_503,

    # Unique profiles who fired "App Installed" in the trailing 30 days.
    "new_installs_30d": 34_396,

    # Total "App Launched" occurrences in the trailing 30 days (not unique).
    "sessions_30d": 888_674,
}

# Derived, exact — kept as expressions so they cannot drift from the anchors.
OBSERVED["sessions_per_mau_30d"] = round(
    OBSERVED["sessions_30d"] / OBSERVED["mau_30d"], 2
)  # 6.05
OBSERVED["dau_mau_ratio"] = round(OBSERVED["dau"] / OBSERVED["mau_30d"], 4)  # 0.1123


# ---------------------------------------------------------------------------
# OBSERVED — Telehealth funnel, unique profiles, trailing 364 days.
# Event names verified against data/ct-schema/events_schema.csv AND against a
# live API call. The real names carry an "EmployeeMobileApp_Telehealth_" prefix.
#
# The previous simulator emitted "DoctorList_Viewed" and
# "AppointmentSuccessful_Viewed" as segment rules. Both are INVALID in this
# account — the API rejects them with 'Invalid event'. Any segment built on
# them would have silently matched nobody.
# ---------------------------------------------------------------------------

TH_FUNNEL_OBSERVED = [
    ("Homepage",        "EmployeeMobileApp_Telehealth_Homepage_Viewed",             239_792),
    ("Doctor list",     "EmployeeMobileApp_Telehealth_DoctorList_Viewed",            92_600),
    ("Slot screen",     "EmployeeMobileApp_Telehealth_SlotScreen_Viewed",            53_324),
    ("Book clicked",    "EmployeeMobileApp_Telehealth_BookAppointment_Clicked",      39_235),
    ("Appt confirmed",  "EmployeeMobileApp_Telehealth_AppointmentSuccessful_Viewed", 39_778),
    ("Consult joined",  "telehealth_doctor_joined",                                  34_398),
]

# ---------------------------------------------------------------------------
# OBSERVED — Health Checkup funnel, unique profiles, trailing 364 days.
# ---------------------------------------------------------------------------

HC_FUNNEL_OBSERVED = [
    ("Homepage",       "healthCheckuphomepage_viewed",   158_646),
    ("Listing",        "healthCheckuplisting_viewed",    100_817),
    ("Booking confirmed", "healthCheckupbooking_confirmed", 32_084),
]

# A real instrumentation quirk, recorded rather than smoothed over:
# "Appt confirmed" (39,778) exceeds "Book clicked" (39,235) by 543 profiles.
# Some users reach the confirmation screen without the book-click event firing
# (deep links, retries, reschedules). The funnel is therefore NOT strictly
# monotonic. The UI shows the real numbers and flags this, because quietly
# clamping them would be fabricating data to make a chart look tidy.
FUNNEL_NOTES = {
    "th_non_monotonic": (
        "Appointment-confirmed (39,778) exceeds book-clicked (39,235) by 543 "
        "profiles. Deep links, reschedules and retries can reach confirmation "
        "without firing the book-click event. Real instrumentation artefact — "
        "not corrected."
    ),
}


# ---------------------------------------------------------------------------
# REFERENCE — from data/CREW_M_MASTER_CT_BIBLE.md
# ---------------------------------------------------------------------------

TOTAL_ELIGIBLE = 956_050  # Bible: total covered lives / eligible base

# Org-type composition of the eligible base (Bible Section 5).
ORG_TYPE_SHARES = {
    "ENT": 0.585,   # Enterprise
    "MM":  0.235,   # Mid-Market
    "SMB": 0.139,   # Small & Medium Business
    "EOR": 0.041,   # Employer of Record
}
assert abs(sum(ORG_TYPE_SHARES.values()) - 1.0) < 1e-9

ORG_TYPE_LABELS = {
    "ENT": "Enterprise",
    "MM": "Mid-Market",
    "SMB": "Small & Medium",
    "EOR": "Employer of Record",
}


# ---------------------------------------------------------------------------
# ANCHOR CONFLICTS — recorded, not hidden.
# ---------------------------------------------------------------------------

ANCHOR_CONFLICTS = [
    {
        "field": "app_reachable_population",
        "bible_says": (
            "no-app share 77.3% (739,126 of 956,050), implying only 216,924 "
            "users have the app"
        ),
        "clevertap_says": (
            "397,301 unique profiles fired App Launched in the trailing 364 days"
        ),
        "why_it_matters": (
            "The two cannot both hold: more users launched the app than the "
            "Bible says own it. 397,301 > 216,924."
        ),
        "resolution": (
            "CleverTap wins. It is the live source of record, it is internally "
            "consistent with 34,396 installs in the last 30 days, and the "
            "Bible figure appears to be a point-in-time or narrower-scope "
            "measure. Crew M uses 397,301 as the app-reachable base and shows "
            "58.4% as the no-app share, not 77.3%."
        ),
    },
]

# Resolved app-reachability, following the resolution above.
APP_REACHABLE = OBSERVED["annual_active_users"]          # 397,301
NO_APP_COUNT = TOTAL_ELIGIBLE - APP_REACHABLE            # 558,749
APP_REACHABLE_SHARE = APP_REACHABLE / TOTAL_ELIGIBLE     # 0.4156
NO_APP_SHARE = NO_APP_COUNT / TOTAL_ELIGIBLE             # 0.5844


# ---------------------------------------------------------------------------
# AGE COHORTS — the primary organising dimension of the product.
# Boundaries are the ones the team asked for. Inclusive on both ends.
# ---------------------------------------------------------------------------

AGE_COHORTS = [
    {"key": "u20",   "label": "Under 20", "lo": 0,  "hi": 20},
    {"key": "21_25", "label": "21-25",    "lo": 21, "hi": 25},
    {"key": "26_35", "label": "26-35",    "lo": 26, "hi": 35},
    {"key": "36_40", "label": "36-40",    "lo": 36, "hi": 40},
    {"key": "41_50", "label": "41-50",    "lo": 41, "hi": 50},
    {"key": "51p",   "label": "51+",      "lo": 51, "hi": 120},
]

# MODELED — age composition of the eligible base.
#
# Why modeled and not observed: CleverTap exposes dateOfBirth as a profile
# property (warehouse_production_dateOfBirth), but the aggregate count endpoint
# ignores profile-property filters entirely. This was verified: filtering
# App Launched by gender, platform, isIOSLogin and isAndroidLogin all returned
# the identical unfiltered total (397,302), meaning the filter is silently
# dropped rather than applied. There is therefore no sanctioned path to a real
# age or gender breakdown from the counts API, and the desk masks/bands these
# fields on the warehouse side by design.
#
# These shares are a standard Indian white-collar group-health age pyramid.
# They are labelled MODELED everywhere they surface in the UI.
AGE_COHORT_SHARES = {
    "u20":   0.008,
    "21_25": 0.152,
    "26_35": 0.455,
    "36_40": 0.168,
    "41_50": 0.152,
    "51p":   0.065,
}
assert abs(sum(AGE_COHORT_SHARES.values()) - 1.0) < 1e-9

# MODELED — relative app-adoption propensity by cohort (younger skews app-native).
# These are relative weights; population.py normalises them so the absolute
# total lands exactly on APP_REACHABLE.
APP_PROPENSITY_BY_COHORT = {
    "u20":   1.34,
    "21_25": 1.28,
    "26_35": 1.12,
    "36_40": 0.92,
    "41_50": 0.71,
    "51p":   0.47,
}

# MODELED — 30-day-active share of a cohort's app base (recency skews young).
MAU_PROPENSITY_BY_COHORT = {
    "u20":   1.22,
    "21_25": 1.16,
    "26_35": 1.06,
    "36_40": 0.95,
    "41_50": 0.82,
    "51p":   0.66,
}

# MODELED — iOS share of a cohort's app base. Corporate India skews Android
# heavily; iOS share rises with seniority, which correlates with age.
IOS_SHARE_BY_COHORT = {
    "u20":   0.07,
    "21_25": 0.11,
    "26_35": 0.17,
    "36_40": 0.23,
    "41_50": 0.27,
    "51p":   0.30,
}

# MODELED — iOS share multiplier by org type (Enterprise issues more iPhones).
IOS_MULTIPLIER_BY_ORG = {"ENT": 1.22, "MM": 0.94, "SMB": 0.68, "EOR": 1.05}

# MODELED — female share by cohort. Group-health bases skew male in India,
# less so at younger ages.
FEMALE_SHARE_BY_COHORT = {
    "u20":   0.44,
    "21_25": 0.42,
    "26_35": 0.38,
    "36_40": 0.34,
    "41_50": 0.29,
    "51p":   0.24,
}


# ---------------------------------------------------------------------------
# CHANNEL REACHABILITY
#
# The single most important correction in this file.
#
# Push can only reach a device that has the app installed AND a live push
# token AND OS-level notification permission. So push reach is a share of the
# APP base, never of the total base. The old code drew a random threshold per
# user from a (0.11, 0.43) range and compared it to a second random number,
# which produced a meaningless ~27% with no relationship to app ownership.
#
# WhatsApp and email are reachable without the app — they key off phone/email
# on the member record — so those ARE shares of the total base.
# ---------------------------------------------------------------------------

# MODELED — share of the APP-INSTALLED base with push actually deliverable.
# Android grants notification permission at install for older API levels;
# iOS requires explicit opt-in, so iOS push opt-in is materially lower.
PUSH_OPTIN_ANDROID = 0.71
PUSH_OPTIN_IOS = 0.43

# MODELED — share of the TOTAL base reachable, by channel, keyed off the
# member record rather than the app.
WHATSAPP_REACH_BASE = 0.912   # phone number present + not opted out
EMAIL_REACH_BASE = 0.883      # work email present + not bounced

# MODELED — reachability multiplier by org type. Enterprise HR files are more
# complete; EOR and SMB records are patchier.
REACH_MULTIPLIER_BY_ORG = {"ENT": 1.04, "MM": 1.00, "SMB": 0.93, "EOR": 0.88}

# MODELED — DND share by org type (Enterprise runs more internal comms, so
# more employees have opted out).
DND_SHARE_BY_ORG = {"ENT": 0.081, "MM": 0.043, "SMB": 0.024, "EOR": 0.031}


# ---------------------------------------------------------------------------
# CAMPAIGN BENCHMARKS — MODELED, used as the prior for simulation.
# Rates are per-stage conditional rates (each on the stage above it).
# ---------------------------------------------------------------------------

CHANNEL_BENCHMARKS = {
    "whatsapp": {"delivery": 0.951, "open": 0.648, "click": 0.079},
    "email":    {"delivery": 0.923, "open": 0.221, "click": 0.031},
    "push":     {"delivery": 0.847, "open": 0.118, "click": 0.041},
}

# MODELED — click-to-conversion rate by objective.
OBJECTIVE_CONVERSION = {
    "th_activation": 0.121,
    "hc_activation": 0.084,
    "app_install":   0.152,
    "reengagement":  0.058,
    "hc_crosssell":  0.103,
}

CHANNELS = ["whatsapp", "email", "push"]  # never SMS
CHANNEL_LABELS = {"whatsapp": "WhatsApp", "email": "Email", "push": "Push"}


# ---------------------------------------------------------------------------
# Peak send hour by cohort — MODELED. Younger cohorts skew later at night.
# ---------------------------------------------------------------------------

PEAK_HOUR_BY_COHORT = {
    "u20":   21,
    "21_25": 21,
    "26_35": 20,
    "36_40": 20,
    "41_50": 19,
    "51p":   18,
}


def provenance() -> dict:
    """Machine-readable provenance for the UI methodology panel."""
    return {
        "observed": {
            "source": "CleverTap REST API (counts endpoints)",
            "pulled_at": CT_PULL_DATE.isoformat(),
            "window_days": CT_WINDOW_DAYS,
            "fields": sorted(OBSERVED.keys())
                      + ["th_funnel", "hc_funnel"],
        },
        "reference": {
            "source": "CREW_M_MASTER_CT_BIBLE.md",
            "fields": ["total_eligible", "org_type_shares"],
        },
        "modeled": {
            "reason": (
                "CleverTap's aggregate counts endpoint silently ignores "
                "profile-property filters — verified by querying gender, "
                "platform, isIOSLogin and isAndroidLogin, all of which "
                "returned the identical unfiltered total. There is no "
                "sanctioned path to a real age, gender or device breakdown, "
                "so these dimensions are modeled and calibrated so that every "
                "aggregate reconciles exactly to the observed anchors."
            ),
            "fields": [
                "age_cohort_shares", "gender_split", "ios_android_split",
                "channel_reachability", "dnd_share", "campaign_benchmarks",
            ],
        },
        "conflicts": ANCHOR_CONFLICTS,
        "funnel_notes": FUNNEL_NOTES,
    }
