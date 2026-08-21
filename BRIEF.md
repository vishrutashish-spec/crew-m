# Crew M — Project Brief

## What This Is

An AI-powered campaign intelligence platform for Plum's product marketing team.
It learns from real CleverTap user data — behavioral events, campaign history,
engagement patterns — and turns it into actionable campaign decisions backed by
evidence, not guesswork.

The system answers: **who** should receive a campaign, through **which channel**,
at **what time**, with **what message**, and **how well** it will perform — with
explainable reasoning behind every recommendation.

## Who It's For

Product marketing managers at Plum who plan and execute campaigns across
WhatsApp, email, push notifications, in-app, and SMS through CleverTap. They
have behavioral data, campaign history, and cohort information but no automated
way to turn that data into targeting decisions or performance predictions.

## The Problem

Campaigns are planned using intuition and tribal knowledge. There is no
systematic way to:

- Discover behavioral personas from actual usage data
- Predict how a campaign will perform before sending it
- Know which audience segment is the best fit for a given campaign
- Compare what-if scenarios (different channel, timing, copy) with evidence
- Score copy against what has historically worked

The data exists in CleverTap. The intelligence layer does not.

## The Demo Story (Full Loop)

This is the end-to-end flow that the product must demonstrate:

1. Marketer types: "I want more health checkup bookings"
2. System parses intent — HC activation, first-time booking
3. System surfaces data-driven personas discovered from real user clustering
4. System recommends the best-fit audience with scores and reasoning
5. System predicts conversion through the full funnel: delivery → open → click → convert
6. System recommends channel and timing based on real behavioral patterns
7. System explains every prediction with feature-level drivers (SHAP)
8. Marketer tweaks copy, channel, timing, or audience
9. System re-simulates live and shows the delta
10. Copy is scored against the baked-in style guide

Every number shown must trace back to data. Every recommendation must have a
reason. Every prediction must have a confidence level.

---

## Architecture Decisions (Locked)

### Screens

| Screen | Role |
|--------|------|
| **Overview** | Landing page. Eligible base, app/no-app split, the push-reachability gap, age cohort composition, both product funnels, and deterministic cross-metric insights. |
| **Age cohorts** | Six cohorts across the eligible base, selected from full-width tiles (no left rail). Per-cohort reachability, device and gender split, org-type drill-down table, both funnels, and cohort-specific insights. |
| **Simulator** | Cohort selection first, then filters narrow it: objective, org type, channel, send hour, DND and stale-token exclusions. Output is an exact audience size plus a clearly-labelled PREDICTED funnel. |
| **Methodology** | Field-level provenance, the reachability decomposition, literal CT event names, and the full list of invariants the model asserts at startup. |

### Naming

Plain naming throughout. No fantasy/game naming. Campaign Simulator, Persona
Explorer, Dashboard, Audience Recommender — not The Forge, Persona Guild, The
Watchtower, The Compass.

### Pixel Avatars

Each persona gets a unique pixel art character. Visual traits map to behavioral
characteristics: color palette reflects engagement level, accessories reflect
product affinity, expression reflects conversion tendency. Deterministic — the
same persona always renders the same character.

### Data Strategy

1. **Primary**: Real CleverTap data via API (user profiles, events, segments, campaigns)
2. **Fallback**: Synthetic data generator calibrated from Plum's real distributions
3. Architecture abstracts the data source — real and synthetic are interchangeable

### ML Pipeline (Real, Not Faked)

| Step | Method |
|------|--------|
| Feature engineering | Recency, frequency, intensity, engagement scores, channel preference, intent signals, communication fatigue, temporal behavior — all derived from CT events |
| Clustering | K-Means or HDBSCAN on user feature space → ~8-10 natural personas |
| Prediction | XGBoost/LightGBM for each funnel stage: P(open), P(click given open), P(convert given click) |
| Explainability | SHAP values for every prediction |
| Training data | CT campaign history + user-campaign interaction events |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js + React + TypeScript + Tailwind + shadcn/ui |
| Pixel avatars | Deterministic pixel avatar library |
| Charts | Recharts |
| Backend | Python + FastAPI |
| ML | scikit-learn + XGBoost + SHAP + pandas + NumPy |
| Data | CleverTap API → local feature tables (Parquet/SQLite cache) |
| LLM | Claude API — copy analysis, persona narration, campaign NLU, explanations |

---

## Baked-In Domain Intelligence

These are not reference documents. They are hardcoded system rules that Crew M
enforces automatically. They come from the Crew M operational playbooks.

### Segment Definitions (Exact CT Event Names)

**AARR funnel:**
- M0 NEW APP users — gmcMembershipCreatedAtTimestamp 30-60 days ago + inviteCreatedAt 30-60 days ago + App Launched in last 60 days
- Activations — any of: cultfitoffer_explored, healthCheckuplisting_viewed, Telehealth_DoctorList_Viewed, perks_offer_unlocked
- Revenue — any of: superTopUp_purchased, topUp_purchased, oPD_purchased, mAternity_purchased

**Lifecycle segments:**
- Unacquired: NOT done App Launched in last 180 days + membership exists in last 365 days
  - Fresh (30-60d), Lapsing (60-90d), Dormant (90-365d)
- Unactivated: downloaded app, NOT done any activation event, hard cutoff 90 days
  - Fresh (last 7d), Lapsing (7-14d), Dormant (14-90d)
- Retained: done at least 1 activation event
  - Fresh (last 30d), Lapsing (30-60d), Dormant (60-90d)

**HRA behavioral events:**
- hra_entry_viewed, hra_started, hra_question_answered, hra_completed, hra_score_viewed, hra_goals_saved, hra_recommendation_viewed, hra_recommendation_clicked
- Derived states: never started, started-dropped-off, completed-no-goal, completed+goal-no-action, high-risk-no-action-30d

### Narrative Playbook (Lifecycle → Messaging Angle)

| Segment State | Messaging Angle |
|---------------|----------------|
| Unacquired — Fresh | Urgency + first action ("get started in the next 30 days") |
| Unacquired — Lapsing/Dormant | Re-acquisition, remove friction, remind of what's theirs |
| Unactivated — Fresh | Remove-friction framing, one clear first step |
| Unactivated — Lapsing/Dormant | Re-surface single highest-converting hook |
| Retained — Fresh/Lapsing | Habit/streak framing, build on existing engagement |
| Retained — Dormant | Re-engagement without guilt-tripping |

**HRA-specific angles:**
- Never started → lead with speed + personalization
- Dropped off → low-friction reminder, emphasize how little is left
- Completed, no goal → nudge toward goal-selection screen
- Completed + goal, no action → recommendation-specific push matched to goal
- High-risk, no action 30d → care-forward urgency, never fear-based

### Copy Style Guide (Hard Rules)

These are enforced in copy scoring. Violations are flagged.

1. **No "not X" negation contrasts.** State the positive claim and stop.
   - Bad: "Recommendations built around your results — not generic advice."
   - Good: "Recommendations built specifically from your results."

2. **No ", so you know X" tails.** Land the benefit in the main clause.
   - Bad: "A score across 7 key health areas, so you know exactly what to focus on."
   - Good: "Your health, scored across 7 key areas — with a clear place to start."

3. **No em dashes.** Rewrite as two sentences or restructure.

4. **Colon definitions must define what the thing IS** — not where it lives or how long it takes.

5. **Never invent stats.** No fabricated percentages or outcome figures. If no real number exists, phrase qualitatively.

6. **Never surface scoring formulas, weights, or percentile math** to end users.

7. **Skip acronyms** (HRA, GMC, GTL) in first-touch consumer copy unless defined.

8. **Lead with reader benefit**, not mechanism ("Get your Health Score in 5 minutes" beats "Complete your Health Risk Assessment").

9. **AM emails are shorter and more direct** than consumer copy. Professional counterpart, not end consumer.

10. **When editing a human draft, edit minimally.** Fix factual/compliance issues, typos, banned constructions. Do not rewrite wholesale.

### Plum Domain Rules

**Telehealth:**
- Video and chat consultations, chat being pushed (faster, cheaper)
- 24x7, cashless, bookable via app or WhatsApp
- Repeat usage is real (~5 consults/year once started)
- Adoption metric is unique users, not total bookings
- Canonical event: EmployeeMobileApp_Telehealth_AppointmentSuccessful_Viewed
- Problem is early-funnel: 67% never open the doctor list

**Health Checkups:**
- At-home biomarker screening, one free per year
- Priority is first-time activation, NOT repeat usage
- Right angle: "you still haven't used the one in your plan"
- wallet_expiry_days_left powers urgency messaging
- Canonical event: healthCheckupbooking_confirmed
- Problem is late-funnel: friction through every stage after listing

**Four Adoption Gaps (diagnose before messaging):**
| Gap | Symptom | Fix |
|-----|---------|-----|
| Awareness | Doesn't know benefit exists | Information + visibility |
| Friction | Knows, but booking feels like effort | Reduce steps, deep links |
| Trust | Unfamiliar with virtual care | Testimonials, profiles, security |
| Trigger | Knows and trusts, nothing nudges action | Urgency, seasonal, wallet expiry |

**Confirmed funnel numbers:**
- TH: 126K Homepage → 41K DoctorList (33%) → 23K SlotScreen (18%) → 17K BookClick (13%) → 16K Success (12.8%)
- HC: 83K Homepage → 47K Listing (57%) → 12K ItemAdded (15%) → 7K SlotSelected (8%) → 5K Confirmed (6.1%)

**Partner segments:**
- ENT: 57% of employees, worst adoption (biggest lever)
- SMB: 65% of accounts, 14% of employees
- MM: consistent improver
- EOR: smallest, best per-employee performer (2x avg)

**Key correlations:**
- Adoption compounds with tenure (M3 < M6 < M9)
- 74% org-level activation vs ~10% employee-level (the gap)
- 8-11 PM peak activity for many segments
- WhatsApp/SMS highest reachability (97-98%)
- No-app segment is 77% of eligible users (739K of 956K)

### Adoption Targets

| Milestone | Target |
|-----------|--------|
| M3 | 15% unique users / eligible employees |
| M6 | 25% |
| M9 | 35% |

---

## The Four-Way Distinction (Non-Negotiable)

Every output the system produces must be clearly labeled as one of:

| Label | Meaning | Example |
|-------|---------|---------|
| **OBSERVED** | What actually happened historically | "Segment A had 8.2% conversion across 14 campaigns" |
| **PREDICTED** | What the model expects to happen | "Estimated 7.5% conversion for Segment A" |
| **RECOMMENDED** | What the system suggests doing | "Prioritize Segment A over Segment C" |
| **GENERATED** | What the LLM created | "Here are three copy variants for Segment A" |

Never blur these. Never present a prediction as an observation. Never present
generated copy as a data-backed recommendation.

---

## What's In Scope

- Real CleverTap data pipeline (synthetic fallback)
- Real clustering for persona discovery
- Real prediction models (XGBoost/LightGBM) for campaign simulation
- SHAP explainability for every prediction
- Audience recommendation with scoring and reasoning
- What-if simulation (change any variable, see the delta)
- Copy scoring against style guide rules
- Pixel avatar personas
- 3 polished screens (Dashboard, Persona Explorer, Campaign Simulator)
- Baked-in domain rules from Crew M playbooks
- Confidence levels and evidence volume on every prediction

## What's Out of Scope

For the Dashboard / Persona Explorer / Campaign Simulator platform described
above:

- Campaign drafting/activation in CleverTap
- Uplift modeling (needs control group data we don't have)
- Auto model retraining and drift detection
- Copy generation (analysis and scoring only, not generation)
- Figma template filling
- Backtesting dashboard (can show static validation results)
- Send-time optimization as a separate model (show timing data in persona cards)
- Real-time CT webhook integration

Campaign drafting, copy generation, and Figma creative rendering ARE in scope
for the separate AM Campaign Request Bot workstream below — that exclusion
list is specific to the analytics platform, not the whole project.

---

## Workstream: AM Campaign Request Bot (Krtin)

A second, separate slice of Crew M, running alongside the analytics platform
above. Origin problem: AMs hit the same friction every time they set up a
CleverTap campaign for a client — copy, creative, segment, and the fear of
getting it wrong. This workstream automates the mechanical setup so the AM
only supplies intent, and a human (PMM) still approves before anything goes
out.

**Flow**: AM runs `/new-campaign` in Slack → a modal collects AM name, account
name, campaign type (Welcome/Renewal), and an optional logo → n8n
(`iw-crew-m-c4b9 · AM campaign request → CleverTap draft`) parses the
submission, stores the raw input for audit, and calls this app's own API
routes in sequence: generate copy → render creative → build a CleverTap
campaign **draft only** → reply in Slack with a link to the draft. A PMM
reviews and publishes the draft directly in CleverTap — this tool never
publishes/sends anything itself.

**In scope for this workstream**: campaign drafting in CleverTap (draft
state only, never published by this tool), copy generation grounded in
account context, creative rendering, Slack modal intake.

**Out of scope for this workstream**: publishing/sending campaigns (PMM does
that manually in CleverTap), any UI beyond the Slack modal — this workstream
has no screens of its own in the three above.

**Reference docs**: `CLEVERTAP_CAMPAIGN_SETUP_SKILL.md`,
`CLEVERTAP_PLATFORM_REFERENCE.md`, `Copy_SKILL.md`.

**Where it lives**: API routes under `frontend/app/api/` (this is what's
actually deployed at the Vercel domain the n8n workflow calls) — separate
from `backend/server.py`, which is the Python/FastAPI service for the
analytics platform's ML pipeline and is not part of this workstream.

**Environment variables needed** (set in `frontend/.env.local` for dev, and
in the Vercel project settings for the deployed app — never commit values):
`SLACK_BOT_TOKEN` (requires creating a Slack app — not done yet),
`ANTHROPIC_API_KEY`, `CT_ACCOUNT_ID`, `CT_PASSCODE`, `CT_REGION`.

**Known gaps**: creative rendering is currently a stub (no real Figma call);
CleverTap has no API to create campaigns, so `/api/campaign/draft` produces
a structured brief for a human to paste into CleverTap's dashboard rather
than a real CT draft; there's no Slack app yet, so nothing in this workstream
runs end-to-end until one is created and `SLACK_BOT_TOKEN` is set.

---

## Build Principles

1. **Do not fake intelligence.** Every number must come from data or a trained
   model. Never hardcode outputs. Never use the LLM to invent conversion rates.
   If the model can't make a reliable prediction, say so with low confidence.

2. **Data-driven personas, not invented ones.** Personas emerge from clustering
   real behavioral data. The LLM writes the narrative description, but every
   claim in that narrative must trace to cluster statistics.

3. **The LLM is for language, not math.** Use it for: parsing natural language
   campaign briefs, writing persona narratives, explaining predictions in plain
   English, analyzing copy against the style guide. Do NOT use it for: predicting
   conversion rates, scoring audiences, ranking channels.

4. **Build incrementally.** Get data pipeline + models working (even ugly) before
   touching the frontend. Show working software early. React to what's real.

5. **Graceful degradation.** Insufficient data → say so. Unknown campaign type →
   say so. Weak confidence → show it. Missing channel history → exclude it.
   Never fabricate an answer because the UI expects one.

6. **Secrets in env vars, never in code.** CleverTap credentials, API keys, any
   credentials go in `.env` / `.env.local`, never committed to git.
