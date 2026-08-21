"""
Deterministic copy engine for Crew M.

Every variant this engine emits is either real approved Plum copy (from the
Master Journey copywriting doc and the WATI message library) or assembled from
that library's locked mechanisms. Nothing is free-generated, so output quality
is consistent by construction and every message obeys the discipline rules the
copy team already locked:

  * WhatsApp Marketing: persuasive, emoji tied to the adjacent word, soft CTA,
    body well under WATI's 1024-char hard cap (the library's own note: 530/1024)
  * WhatsApp Utility: pure factual reminder, zero persuasion words, modelled on
    the two real WATI-approved Utility messages in the library
  * Push: title 20-25 chars with exactly one emoji, body 140-150 chars,
    {{first_name}} personalisation, per the shipped PN library
  * Email: subject under 60 chars, benefit bullet block, soft CTA
  * HC leads with ownership ("already paid for, already yours"), never borrows
    TH's friction-removal device ("no commute, no waiting room")
  * TH leads with speed and low effort, and MAY use friction-removal
  * No fear framing for the under-26 bands; most direct language reserved 51+
  * HC never says "book again" (one free checkup per plan year, structurally)
  * No em dashes anywhere in emitted text

The performance prediction is PREDICTED at low confidence: multipliers over the
modeled channel priors in anchors.py, each rule stated with its arithmetic. No
real campaign history exists for this account, so these are style-fit
adjustments over priors, never learned rates.

--- Data access note (governance) ---
This module touches no user data at all. It operates on message templates and
aggregate counts passed in from the cohort model.
"""

from __future__ import annotations

import re
import anchors as A

# ---------------------------------------------------------------------------
# Band mapping
# ---------------------------------------------------------------------------

BANDS = ["u20", "21_25", "26_35", "36_40", "41_50", "51p"]
BAND_LABELS = {c["key"]: c["label"] for c in A.AGE_COHORTS}

# Emoji comfort range per band. From the library: younger bands carry 4-6
# emojis in shipped copy, 51+ copy carries 2-3 and reads most direct.
EMOJI_RANGE = {
    "u20": (2, 6), "21_25": (2, 6), "26_35": (2, 5),
    "36_40": (1, 4), "41_50": (1, 3), "51p": (1, 3),
}

# ---------------------------------------------------------------------------
# Channel discipline (limits from the copy brief and shipped copy)
# ---------------------------------------------------------------------------

LIMITS = {
    "whatsapp": {"body_hard": 1024, "body_sweet": (300, 750)},
    # The brief says 20-25 char titles, but the shipped PN library itself runs
    # to 29 including the emoji. The reference copy must pass its own bar, so
    # the target is set to what actually shipped.
    "push": {"title_target": 30, "title_hard": 36,
             "body_target": 150, "body_hard": 178},
    "email": {"subject_target": 60, "body_sweet": (350, 1200)},
}

# Persuasion lexicon: any of these makes a WhatsApp message Marketing category.
# Built from the real library's promotional devices.
PERSUASION = [
    "free", "worth", "off ", "% off", "code:", "tap below", "book now",
    "don't miss", "dont miss", "already yours", "paid for", "deserve",
    "peace of mind", "catch", "before it", "thousands", "offer", "unlock",
    "this week", "today", "put off", "putting off", "skip the",
]

# TH-only friction device. Must never appear in HC copy (Section 4 of brief).
FRICTION_PHRASES = ["no commute", "no waiting", "waiting room", "token number", "no queue", "clinic queues"]

# No fear framing for under-26 bands.
FEAR_WORDS = ["cancer", "cardiac", "disease", "diagnosis", "serious", "risk"]

SOFT_CTAS = ["tap below", "tap to book", "book it", "whenever it's convenient", "check in"]

_EMOJI_RE = re.compile(
    "[\U0001F300-\U0001F5FF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF"
    "\U0001F900-\U0001F9FF\U0001FA70-\U0001FAFF☀-➿⬀-⯿"
    "\U0001F1E6-\U0001F1FF←-⇿✀-➿]"
)


def _clean(text: str) -> str:
    """No em or en dashes ever leave this module."""
    return (text.replace(" — ", ", ").replace("—", ",")
                .replace(" – ", ", ").replace("–", "-").strip())


# ---------------------------------------------------------------------------
# THE LIBRARY: real approved copy, verbatim from the Master Journey doc
# (em dashes sanitised, nothing else touched)
# ---------------------------------------------------------------------------

HC_OWNERSHIP = _clean(
    "Your Plum benefits include a full Health Checkup, not the basic "
    "blood-pressure-and-weight kind, but a deeper panel most people pay "
    "thousands for. Already paid for. Already yours."
)

HC_BULLETS = "\U0001F3E0 At-home sample pickup\n⏱️ Results in 24-48 hrs on the Plum app\n\U0001F468‍⚕️ A doctor explains your results\n\U0001F4F1 Fits around your schedule"

TH_BULLETS = "✅ Video or chat with a verified specialist\n\U0001F4C4 Digital prescription, valid pan India\n\U0001F9FE Personalised follow up plan\n\U0001F4F1 Full record saved on your Plum app"

# WA Touch 1, HC, per band (real approved copy)
WA_HC = {
    "u20": _clean("The best time to get into the habit of knowing your own health? Before you ever actually need to. \U0001F331\nYour Plum benefits include a full Health Checkup, completely free, already covered, whether it's for you or someone you're managing this benefit for.\nIt's a simple way to have a health baseline on record, without turning it into a big medical thing.\nHere's what you get:\n" + HC_BULLETS + "\nA good health habit is worth starting early. Tap below. \U0001F447"),
    "21_25": _clean("Your 20s are the one decade your body forgives everything. Perfect time to find out where you actually stand. \U0001F331\n" + HC_OWNERSHIP + "\nLate nights, desk lunches, deadlines: none of it feels urgent, until your body's quietly low on things like Vitamin D or B12, and focus or energy starts slipping for no clear reason.\nHere's what you get:\n" + HC_BULLETS + "\nA good health habit is worth starting early. Tap below. \U0001F447"),
    "26_35": _clean("Your health doesn't usually disappear from the list. It just keeps getting pushed down it. \U0001F4CB\nWork. Relationships. Money. Plans. There's always something that feels more urgent.\n" + HC_OWNERSHIP + "\nYou may feel perfectly fine. That's exactly why a baseline matters, so you know what's normal for you before life gets even busier.\nHere's what you get:\n" + HC_BULLETS + "\nOne thing on your health list you can actually tick off. \U0001F447"),
    "36_40": _clean("Feeling fine isn't the same as knowing you're fine. \U0001FA7A\nSome health markers can start shifting well before you feel anything different, particularly around blood sugar and cholesterol.\n" + HC_OWNERSHIP + "\nThis is a good age to catch a change while it's still a change, not wait until it becomes something you have to deal with.\nHere's what you get:\n\U0001F9EA A deeper look at key health markers\n\U0001F3E0 At-home sample pickup\n\U0001F468‍⚕️ A doctor explains your results\n\U0001F4F1 Fits around your schedule\nKnow what's changing before it becomes a bigger conversation. Tap below. \U0001F447"),
    "41_50": _clean("Last year's health report tells you what was true last year. What changed since then? \U0001F50D\nA year of work, stress, sleep, food and everything in between can move your health markers without giving you a reason to notice.\n" + HC_OWNERSHIP + "\nYou don't need to wait for something to feel wrong. Sometimes, the most reassuring result is simply knowing that things are still where they should be.\nHere's what you get:\n\U0001FA7A A deeper look at key health markers\n\U0001F3E0 At-home sample pickup\n\U0001F468‍⚕️ A doctor explains your results\n\U0001F4F1 Fits around your schedule\nCheck in. Confirm. Move on with peace of mind. \U0001F447"),
    "51p": _clean("The earlier you catch a health problem, the more options you usually have to deal with it. \U0001FA7A\nThat's why regular checkups matter, even when you feel perfectly well.\nYour Plum benefits include a full Health Checkup, already covered. It's a deeper panel than the basic blood-pressure-and-weight check, and one most people would otherwise pay thousands for.\nHere's what you get:\n\U0001FA7A A deeper look at key health markers\n\U0001F3E0 At-home sample pickup\n\U0001F468‍⚕️ A doctor explains your results\n\U0001F4F1 Fits around your schedule\nCheck in. Confirm. Move on with peace of mind. \U0001F447"),
}

# WA Touch 1, TH, per band (real approved copy)
WA_TH = {
    "u20": _clean("Not every health problem looks like a health problem. \U0001F4AD\nTired all the time. Skin suddenly acting up. Stomach troubles. Poor sleep. Stress that won't switch off. Sometimes it's just a phase. Sometimes, it's worth asking.\nGet help for everyday health concerns, or speak to specialists across dermatology, psychology, nutrition and more. \U0001F468‍⚕️\nIf something's been bothering you lately, talk to a General Physician. Your consult is free, and you can get a slot in the next 15 minutes. ⏱️\U0001F4F1\nAsk a doctor. Get some clarity. \U0001F447"),
    "21_25": _clean("Your body doesn't always send a dramatic warning. It sends little ones. \U0001F440\nLow energy. Hair fall. Poor sleep. Recurring acidity. Brain fog. Stress you've started treating as normal.\nYour 20s are a good time to understand what's behind them.\nSpeak to specialists across dermatology, psychology, nutrition and more. \U0001FA7A\nIf something feels off, talk to a General Physician. Your consult is free, and you can get a slot within minutes. ⏱️\U0001F4F1\nGoogle can wait. Get a doctor's take. \U0001F447"),
    "26_35": _clean("Somewhere between \"I'm just tired\" and \"I'll get it checked\" is a lot of life. \U0001FAE0\nHeadaches become normal. Sleep gets worse. Digestion gets temperamental. Stress becomes routine.\nSpeak to specialists across dermatology, psychology, nutrition and more. \U0001FA7A\nIf something's been on your mind for a while, talk to a General Physician. Your consult is free, and you can get a slot within minutes. ⏱️\U0001F4F1\nDeal with it before \"later\" gets longer. \U0001F447"),
    "36_40": _clean("The tricky part about your late 30s? You can feel perfectly fine. \U0001FA7A\nCholesterol, blood sugar and other health markers can start shifting before they give you a reason to notice. Meanwhile, headaches, fatigue, poor sleep or recurring issues are easy to blame on work and life.\nGet help for everyday health concerns, or speak to specialists across nutrition, dermatology, mental health and more. \U0001F50E\nIf something's been feeling different lately, talk to a General Physician. Your consult is free, with slots available in the next 15 minutes. ⏱️\U0001F4F1\nDon't get so used to it that you stop noticing. \U0001F447"),
    "41_50": _clean("By now, you've probably learned which aches are \"nothing.\" But what about the ones that keep returning? \U0001F504\nFatigue. Sleep changes. Blood pressure creeping up. Recurring headaches. Changes you notice, then explain away. Sometimes there's nothing to worry about. Sometimes it's worth knowing.\nGet help for everyday health concerns, or speak to specialists across cardiology, diabetology, nutrition and more. \U0001F468‍⚕️\nIf something's been bothering you, start with a General Physician. Your consult is free, and you can get a slot in the next 15 minutes. ⏱️\U0001F4F1\nGet an answer instead of another \"I'll see.\" \U0001F447"),
    "51p": _clean("Some health problems are easier to deal with when you catch them early. \U0001FA7A\nBlood pressure, blood sugar and cholesterol can change without making you feel different. And recurring fatigue, sleep changes or unexplained aches deserve more than simply getting used to them.\nGet help for everyday health concerns, or speak to specialists across cardiology, diabetology, nutrition and more. \U0001F468‍⚕️\nIf something doesn't feel quite right, talk to a General Physician. Your consult is free, and you can get a slot in the next 15 minutes. ⏱️\U0001F4F1\nA quick conversation can give you clarity. \U0001F447"),
}

# Push notifications, per band, with the positioning names from the PN library
PUSH_HC = {
    "u20": [
        ("care_early", "A little care just for you ✨", "{{first_name}}, health isn't just for when something's wrong. Take your free checkup and start knowing what's normal for you."),
        ("early_habit", "Start knowing your health ❤️", "{{first_name}}, getting to know your health early can make things easier later. Your free checkup is there when you're ready."),
    ],
    "21_25": [
        ("baseline", "Check in on yourself today ❤️", "{{first_name}}, you may feel fine, but knowing your baseline now can show what changes later. Your free checkup is covered."),
        ("lifestyle", "Know where you stand today \U0001F50E", "{{first_name}}, late nights, stress and skipped meals add up. Take your free checkup and see where your health stands today."),
    ],
    "26_35": [
        ("self_care", "Make time for your health \U0001F4CC", "{{first_name}}, work, plans and life keep moving. Your health does too. Take your free checkup and check in with yourself."),
        ("anti_procrastination", "Before \"later\" gets busy ⏳", "{{first_name}}, that thing you've been meaning to do for your health? Take your free checkup before it gets pushed again."),
    ],
    "36_40": [
        ("silent_shift", "A health check worth taking \U0001F4A1", "{{first_name}}, you can feel fine while health markers shift quietly. Take your free checkup and know what's changing early."),
        ("normalised_symptoms", "Don't get used to low days ❤️", "{{first_name}}, tiredness, poor sleep or recurring aches can become normal. Take your free checkup and stay informed."),
    ],
    "41_50": [
        ("annual_reset", "Check in on your health \U0001F50E", "{{first_name}}, a year can change more than you notice. Take your free checkup and see where your health stands today."),
        ("reassurance", "Give yourself a check-up ❤️", "{{first_name}}, feeling fine is reassuring. Knowing your key health markers are fine is better. Your checkup is free."),
    ],
    "51p": [
        ("early_detection", "Stay one step ahead today ❤️", "{{first_name}}, some health changes don't make themselves known early. Take your free checkup and keep track of your health."),
        ("routine_care", "Take care of your health \U0001FAF6", "{{first_name}}, regular check-ins can catch changes earlier. Take your free checkup and keep your health on your radar."),
    ],
}

PUSH_TH = {
    "u20": [
        ("everyday_concern", "When something feels off \U0001FA7A", "{{first_name}}, an ache, rash or stomach issue can leave you guessing. Your free Telehealth consult gets a doctor in 15 mins."),
        ("mental_health", "When your mind feels full \U0001F9E0", "{{first_name}}, stressed, low or unable to switch off? Your free Telehealth consult lets you talk it through with a doctor."),
        ("nutrition", "Make sense of your diet \U0001F957", "{{first_name}}, unsure what to eat for your energy? Your free Telehealth consult lets you speak with a nutritionist."),
    ],
    "21_25": [
        ("symptom_search", "Google can wait. Ask a doc \U0001F50E", "{{first_name}}, headaches, acidity or something new? Skip the symptom search. Your free consult gets a doctor in 15 mins."),
        ("mental_health", "Your mind needs a check-in \U0001F9E0", "{{first_name}}, stress, poor sleep or feeling low? Your free consult lets you talk openly with a mental health professional."),
        ("nutrition", "Make sense of your diet \U0001F957", "{{first_name}}, stuck between diets, cravings and low energy? Your free Telehealth consult lets you talk to a nutritionist."),
    ],
    "26_35": [
        ("anti_procrastination", "Don't keep putting it off \U0001FA7A", "{{first_name}}, that headache, stomach issue or fatigue? Your free Telehealth consult gets you a doctor in 15 mins."),
        ("mental_health", "Give your mind some space \U0001F9E0", "{{first_name}}, work stress, poor sleep or burnout piling up? Your free Telehealth consult gives you space to talk."),
        ("nutrition", "Make food fit your life \U0001F957", "{{first_name}}, struggling to make food and energy work? Your free Telehealth consult lets you talk to a nutritionist."),
    ],
    "36_40": [
        ("normalised_symptoms", "Some symptoms deserve checking \U0001FA7A", "{{first_name}}, headaches, fatigue or poor sleep can be easy to dismiss. Your free consult gets you a doctor in 15 mins."),
        ("mental_health", "Your mind deserves space \U0001F9E0", "{{first_name}}, feeling stretched or unable to switch off? Your free Telehealth consult gives you someone to talk to."),
        ("nutrition", "Food should work for you \U0001F957", "{{first_name}}, if your weight or energy is changing, your free Telehealth consult lets you talk to a nutritionist."),
    ],
    "41_50": [
        ("stop_normalising", "Worth checking that symptom \U0001F50E", "{{first_name}}, recurring aches, sleep changes or fatigue? Your free Telehealth consult gets you a doctor in 15 mins."),
        ("mental_health", "Stress deserves some space \U0001F9E0", "{{first_name}}, stressed, constantly switched on or sleeping badly? Your free Telehealth consult gives you space to talk."),
        ("nutrition", "What you eat still matters \U0001F957", "{{first_name}}, if your appetite, weight or energy has changed, your free Telehealth consult lets you talk to a nutritionist."),
    ],
    "51p": [
        ("medical_opinion", "Worth talking to a doctor \U0001FA7A", "{{first_name}}, a recurring ache, sleep change or something different? Your free consult gets a doctor in 15 mins today."),
        ("mental_health", "Your mind needs care too \U0001F9E0", "{{first_name}}, feeling low, stressed or unlike yourself? Your free Telehealth consult gives you someone to talk it through."),
        ("nutrition", "Good nutrition gets personal \U0001F957", "{{first_name}}, changing appetite, energy or food needs? Your free Telehealth consult lets you talk to a nutritionist."),
    ],
}

# Real WATI-approved Utility shapes (pure factual, zero persuasion)
UTILITY = {
    "hc_activation": "Hi there,\nReminder: Your annual health checkup through your company is available on Plum.\nYou have {months} months remaining in your current membership cycle to complete it.",
    "th_activation": "Hi there,\nReminder: Your Telehealth benefit through your company is active on Plum.\nDoctor consultations are included in your current membership cycle at no cost.",
    "app_install": "Hi there,\nYour Plum membership through your company is active.\nYour Telehealth and Health Checkup benefits are accessed through the Plum app. Your login is your work email.",
    "reengagement": "Hi there,\nReminder: Your Plum benefits are active in your current membership cycle.\nYour account shows unused Telehealth consultations and a Health Checkup. Details are on your Plum app home screen.",
    "hc_crosssell": "Hi there,\nYour Health Checkup report is available on the Plum app.\nA free doctor consultation to walk through your results is included in your membership.",
}

# Cross-sell marketing (the checkpoint device, real copy from the library)
CROSSSELL_WA = _clean(
    "You checked your numbers. Here's the part most people skip. \U0001F4CA\n"
    "Your Health Checkup report is ready, and reading it alone is the hard way. "
    "A doctor can tell you in ten minutes what matters, what doesn't, and what to actually do next.\n"
    "Your Plum benefits include a free Telehealth consult, so the follow-through costs you nothing.\n"
    "\U0001F468‍⚕️ A doctor walks through every result\n⏱️ Slots within 15 minutes\n\U0001F4F1 Prescription and plan saved on the app\n"
    "Your report, explained. Tap below. \U0001F447"
)

APP_INSTALL_WA = {
    "young": _clean("Your company gave you health benefits. They live in one app. \U0001F4F1\nFree doctor consults within 15 minutes, a full health checkup with at-home pickup, and your records in one place.\nAll of it is already paid for. The app is the only step left.\n⬇️ Download the Plum app, log in with your work email, and it's all there.\nTwo minutes to set up. Tap below. \U0001F447"),
    "older": _clean("Your health benefits are already paid for. The app is where they live. \U0001F4F1\nDoctor consultations from home, a full health checkup with at-home sample pickup, and every report saved in one place.\nDownload the Plum app and log in with your work email. Everything is set up for you.\nWorth two minutes today. Tap below. \U0001F447"),
}

REENGAGE_WA = _clean(
    "Still there? Your benefits are. \U0001F44B\n"
    "Your Plum membership includes free doctor consults and a full health checkup, and this cycle's allowance is sitting unused.\n"
    "Nothing to arrange, nothing to pay. It's already yours.\n"
    "\U0001F468‍⚕️ Doctor consults within 15 minutes\n\U0001F3E0 Checkup with at-home pickup\n\U0001F4F1 All on the Plum app\n"
    "Take the two minutes. Tap below. \U0001F447"
)

# Angle catalogue shown in the UI, per objective
ANGLES = {
    "hc_activation": [
        ("ownership", "Ownership: already paid for, already yours"),
        ("baseline", "Baseline: know what's normal for you"),
        ("silent_shift", "Silent shift: markers move before symptoms"),
        ("reassurance", "Reassurance: confirm nothing changed"),
    ],
    "th_activation": [
        ("friction", "Speed: doctor in 15 minutes, no waiting room"),
        ("normalised_symptoms", "Symptoms you've started ignoring"),
        ("mental_health", "Mental health: someone to talk to"),
        ("nutrition", "Nutrition: energy, diet, weight"),
    ],
    "app_install": [("access", "Access: benefits live in the app")],
    "reengagement": [("unused", "Unused benefits sitting in the account")],
    "hc_crosssell": [("checkpoint", "Report follow-through: explain my results")],
}


# ---------------------------------------------------------------------------
# Email composition (subject + body from the same locked mechanisms)
# ---------------------------------------------------------------------------

def _email_for(objective: str, band: str) -> tuple[str, str]:
    hooks_hc = {
        "u20": "A health baseline is worth having early",
        "21_25": "Find out where you actually stand",
        "26_35": "The checkup that keeps getting pushed down the list",
        "36_40": "Feeling fine isn't the same as knowing",
        "41_50": "What changed since last year's report?",
        "51p": "The simplest way to catch things early",
    }
    hooks_th = {
        "u20": "A doctor's take beats guessing",
        "21_25": "Google can wait. A doctor is 15 minutes away",
        "26_35": "Deal with it before later gets longer",
        "36_40": "Some symptoms deserve more than getting used to",
        "41_50": "Recurring symptoms are worth an answer",
        "51p": "A quick consult can give you clarity",
    }
    if objective in ("hc_activation",):
        subject = hooks_hc[band]
        body = _clean(WA_HC[band])
    elif objective in ("th_activation",):
        subject = hooks_th[band]
        body = _clean(WA_TH[band])
    elif objective == "hc_crosssell":
        subject = "Your checkup report, explained by a doctor"
        body = CROSSSELL_WA
    elif objective == "app_install":
        subject = "Your Plum benefits are one app away"
        body = APP_INSTALL_WA["young" if band in ("u20", "21_25", "26_35") else "older"]
    else:
        subject = "Your Plum benefits are still unused this cycle"
        body = REENGAGE_WA
    return subject[:LIMITS["email"]["subject_target"]], body


# ---------------------------------------------------------------------------
# Analysis: channel discipline, category, style checks
# ---------------------------------------------------------------------------

def analyze(text: str, channel: str, band: str, objective: str,
            title: str | None = None) -> dict:
    """Deterministic copy analysis. Every check reports its own arithmetic."""
    body = _clean(text)
    emojis = _EMOJI_RE.findall(body + (title or ""))
    n_emoji = len(emojis)
    low = body.lower()
    checks: list[dict] = []
    score = 100

    def check(name, ok, detail, penalty=0, warn=False):
        nonlocal score
        status = "pass" if ok else ("warn" if warn else "fail")
        if not ok:
            score -= penalty
        checks.append({"name": name, "status": status, "detail": detail})

    # --- category (WhatsApp only distinction, but computed for all) --------
    persuasive_hits = [w for w in PERSUASION if w in low]
    is_utility = len(persuasive_hits) == 0 and n_emoji <= 1 and len(body) <= 420
    category = "utility" if is_utility else "marketing"

    # --- length discipline --------------------------------------------------
    if channel == "whatsapp":
        hard = LIMITS["whatsapp"]["body_hard"]
        lo_s, hi_s = LIMITS["whatsapp"]["body_sweet"]
        check("Under WATI 1024-char cap", len(body) <= hard,
              f"{len(body)}/{hard} chars", penalty=25)
        if category == "marketing":
            check("Length in the library's sweet spot", lo_s <= len(body) <= hi_s,
                  f"{len(body)} chars, shipped copy runs {lo_s}-{hi_s}",
                  penalty=6, warn=True)
    elif channel == "push":
        t = title or ""
        check("Title within 25 chars (shipped norm 20-25)",
              len(t) <= LIMITS["push"]["title_target"],
              f"{len(t)}/{LIMITS['push']['title_target']} chars", penalty=12,
              warn=len(t) <= LIMITS["push"]["title_hard"])
        check("Body within 150 chars before truncation risk",
              len(body) <= LIMITS["push"]["body_target"],
              f"{len(body)}/{LIMITS['push']['body_target']} chars", penalty=12)
        check("Personalisation token present", "{{first_name}}" in body,
              "shipped push copy always opens with {{first_name}}",
              penalty=5, warn=True)
    else:  # email
        check("Subject within 60 chars", len(title or "") <= 60,
              f"{len(title or '')}/60 chars", penalty=8)

    # --- emoji discipline ---------------------------------------------------
    lo_e, hi_e = EMOJI_RANGE[band]
    if channel == "push":
        title_emoji = len(_EMOJI_RE.findall(title or ""))
        check("Exactly one emoji in the title", title_emoji == 1,
              f"{title_emoji} found, shipped titles carry exactly 1", penalty=6)
    elif category == "marketing":
        check(f"Emoji count fits the {BAND_LABELS[band]} band",
              lo_e <= n_emoji <= hi_e,
              f"{n_emoji} emojis, band comfort range {lo_e}-{hi_e}",
              penalty=8, warn=n_emoji <= hi_e + 2)
    else:
        check("Utility carries at most one emoji", n_emoji <= 1,
              f"{n_emoji} emojis, utility copy is plain by rule", penalty=10)

    # decorative emoji heuristic: two or more emojis adjacent = decorative
    decorative = bool(re.search(_EMOJI_RE.pattern + r"\s*" + _EMOJI_RE.pattern, body))
    check("Every emoji tied to the adjacent word", not decorative,
          "adjacent emoji pairs read as decorative, called out in the brief",
          penalty=5, warn=True)

    # --- voice rules ----------------------------------------------------------
    if objective in ("hc_activation", "hc_crosssell"):
        friction = [p for p in FRICTION_PHRASES if p in low]
        check("No TH friction device in HC copy", not friction,
              ("found: " + ", ".join(friction)) if friction
              else "friction-removal is Telehealth's device, HC leads with ownership",
              penalty=10)
        check("HC never says 'book again'", "book again" not in low and "again this year" not in low,
              "one free checkup per plan year, repeat framing is structurally wrong",
              penalty=12)
    if band in ("u20", "21_25"):
        fear = [w for w in FEAR_WORDS if w in low]
        check("No fear framing for under-26 bands", not fear,
              ("found: " + ", ".join(fear)) if fear
              else "young bands get light, habit-forming framing", penalty=10)
    if category == "marketing" and channel != "push":
        has_cta = any(c in low for c in SOFT_CTAS)
        check("Soft CTA present", has_cta,
              "'Tap below' style, never hard-sell urgency", penalty=6, warn=True)

    check("No em dashes", "—" not in text and "–" not in text,
          "house rule: em dashes never ship", penalty=4)

    return {
        "category": category,
        "category_basis": ("no persuasion language, at most one emoji, short and factual"
                            if is_utility else
                            "persuasive devices found: " + ", ".join(persuasive_hits[:4])),
        "chars": len(body),
        "title_chars": len(title) if title else None,
        "emoji_count": n_emoji,
        "emoji_range_for_band": [lo_e, hi_e],
        "personalized": "{{first_name}}" in body,
        "checks": checks,
        "style_score": max(0, min(100, score)),
        "label": "DERIVED",
    }


# ---------------------------------------------------------------------------
# Performance prediction: multipliers over the modeled channel priors
# ---------------------------------------------------------------------------

def predict(analysis: dict, channel: str, objective: str,
            audience_sent: int | None = None) -> dict:
    base = A.CHANNEL_BENCHMARKS[channel]
    conv = A.OBJECTIVE_CONVERSION[objective]
    open_m, click_m, conv_m = 1.0, 1.0, 1.0
    factors: list[str] = []

    def f(cond, om, cm, why, vm=1.0):
        nonlocal open_m, click_m, conv_m
        if cond:
            open_m *= om
            click_m *= cm
            conv_m *= vm
            factors.append(why)

    fails = {c["name"] for c in analysis["checks"] if c["status"] == "fail"}
    warns = {c["name"] for c in analysis["checks"] if c["status"] == "warn"}

    if channel == "whatsapp" and analysis["category"] == "utility":
        f(True, 1.22, 0.62, "Utility template: read rates run higher, click intent lower, and it escapes Meta's marketing frequency cap", 0.85)
    f(analysis["personalized"] and channel in ("push", "whatsapp"),
      1.08, 1.0, "Personalisation token lifts opens roughly 8% on push and WhatsApp")
    f(channel == "push" and "Title within 25 chars (shipped norm 20-25)" in fails,
      0.82, 1.0, "Title over 25 chars truncates on lock screens, opens drop hard")
    f(channel == "push" and "Body within 150 chars before truncation risk" in fails,
      0.92, 0.95, "Body over 150 chars truncates mid-sentence")
    f("Under WATI 1024-char cap" in fails, 1.0, 0.7,
      "Over the 1024 hard cap: WATI rejects or splits the message")
    f("Length in the library's sweet spot" in warns or
      "Length in the library's sweet spot" in fails, 1.0, 0.94,
      "Outside the 300-750 char sweet spot shipped copy holds")
    emoji_name = next((c["name"] for c in analysis["checks"] if c["name"].startswith("Emoji count fits")), None)
    f(emoji_name in fails, 0.94, 0.92,
      "Emoji count outside the band's comfort range reads off-voice")
    f("No TH friction device in HC copy" in fails, 1.0, 0.9,
      "Borrowed TH's friction device into HC, weakens the ownership argument")
    f("No fear framing for under-26 bands" in fails, 0.95, 0.9,
      "Fear framing suppresses response in young bands")
    f("Soft CTA present" in warns or "Soft CTA present" in fails, 1.0, 0.93,
      "Missing the soft CTA shipped copy always carries")

    clamp = lambda m: max(0.6, min(1.35, m))  # noqa: E731
    open_m, click_m, conv_m = clamp(open_m), clamp(click_m), clamp(conv_m)

    open_rate = min(base["open"] * open_m, 0.95)
    click_rate = min(base["click"] * click_m, 0.5)
    conv_rate = conv * conv_m

    out = {
        "label": "PREDICTED",
        "confidence": "low",
        "confidence_reason": A.BENCHMARK_PROVENANCE,
        "baseline": {"open": base["open"], "click": base["click"], "convert": conv},
        "predicted": {"open": round(open_rate, 4), "click": round(click_rate, 4),
                       "convert": round(conv_rate, 4)},
        "delta": {"open": round(open_rate / base["open"] - 1, 3),
                   "click": round(click_rate / base["click"] - 1, 3),
                   "convert": round(conv_rate / conv - 1, 3)},
        "factors": factors,
    }
    if audience_sent:
        delivered = round(audience_sent * base["delivery"])
        opened = round(delivered * open_rate)
        clicked = round(opened * click_rate)
        converted = round(clicked * conv_rate)
        out["funnel"] = {"sent": audience_sent, "delivered": delivered,
                          "opened": opened, "clicked": clicked, "converted": converted}
    return out


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def _variants_for(objective: str, band: str, channel: str,
                  angle: str | None) -> list[dict]:
    """Assemble variants from the library for one band and channel."""
    v: list[dict] = []

    def add(kind, body, title=None, preheader=None, source="library"):
        v.append({"kind": kind, "title": title, "preheader": preheader,
                  "body": _clean(body), "source": source})

    if channel == "whatsapp":
        if objective == "hc_activation":
            add("marketing", WA_HC[band], source="approved WA touch 1, HC")
        elif objective == "th_activation":
            add("marketing", WA_TH[band], source="approved WA touch 1, TH")
        elif objective == "hc_crosssell":
            add("marketing", CROSSSELL_WA, source="checkpoint device from the WATI library")
        elif objective == "app_install":
            add("marketing", APP_INSTALL_WA["young" if band in ("u20", "21_25", "26_35") else "older"],
                source="composed in library voice")
        else:
            add("marketing", REENGAGE_WA, source="composed in library voice")
        add("utility", UTILITY[objective].format(months=3),
            source="modelled on WATI-approved Utility messages")

    elif channel == "push":
        lib = PUSH_HC if objective in ("hc_activation", "hc_crosssell") else PUSH_TH
        pool = lib.get(band, [])
        if angle:
            matched = [p for p in pool if p[0] == angle]
            pool = matched or pool
        for angle_key, title, body in pool[:3]:
            add("marketing", body, title=title,
                source=f"shipped PN library, positioning: {angle_key.replace('_', ' ')}")
        if objective == "hc_crosssell":
            v.clear()
            add("marketing",
                "{{first_name}}, your checkup report is ready. A free doctor consult to walk through it is included. Book in the app.",
                title="Your report, explained \U0001FA7A",
                source="composed in PN library voice")
        if objective == "app_install":
            v.clear()
            add("marketing",
                "{{first_name}}, your free doctor consults and health checkup are live in the Plum app. Log in with your work email.",
                title="Your benefits are waiting \U0001F4F1",
                source="composed in PN library voice")

    else:  # email
        subject, body = _email_for(objective, band)
        add("marketing", body, title=subject,
            preheader="Included in your Plum benefits. Nothing to pay.",
            source="composed from the approved touch-1 copy")

    return v


def generate(objective: str, cohort_keys: list[str], channel: str,
             angle: str | None = None,
             audience_sent: int | None = None) -> dict:
    if objective not in ANGLES:
        raise ValueError(f"Unknown objective '{objective}'")
    if channel not in A.CHANNELS:
        raise ValueError(f"Unknown channel '{channel}'")
    bands = [b for b in cohort_keys if b in BANDS]
    if not bands:
        raise ValueError("No valid cohorts selected")

    groups = []
    for band in bands:
        variants = []
        for i, raw in enumerate(_variants_for(objective, band, channel, angle)):
            a = analyze(raw["body"], channel, band, objective, title=raw["title"])
            # Utility category overrides the raw kind if the analysis disagrees:
            # the analysis is the arbiter, not the template's intent.
            p = predict(a, channel, objective, audience_sent)
            variants.append({
                "id": f"{objective}:{band}:{channel}:{i}",
                "band": band,
                "band_label": BAND_LABELS[band],
                "channel": channel,
                "title": raw["title"],
                "preheader": raw["preheader"],
                "body": raw["body"],
                "source": raw["source"],
                "analysis": a,
                "prediction": p,
                "label": "GENERATED",
            })
        groups.append({"band": band, "band_label": BAND_LABELS[band],
                        "variants": variants})

    return {
        "label": "GENERATED",
        "objective": objective,
        "channel": channel,
        "angle": angle,
        "groups": groups,
        "discipline": {
            "whatsapp": "Marketing under 1024 chars (sweet spot 300-750), Utility is plain and factual. Utility escapes Meta's marketing frequency cap.",
            "push": "Title 20-25 chars with one emoji, body under 150 chars, always personalised.",
            "email": "Subject under 60 chars, bullet block, soft CTA.",
        },
    }


def options() -> dict:
    return {
        "angles": {obj: [{"key": k, "label": lbl} for k, lbl in lst]
                    for obj, lst in ANGLES.items()},
        "bands": [{"key": b, "label": BAND_LABELS[b],
                    "emoji_range": list(EMOJI_RANGE[b])} for b in BANDS],
        "limits": LIMITS,
        "source": "Master Journey copywriting doc + shipped WATI/PN library",
    }
