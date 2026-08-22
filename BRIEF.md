# Crew M: Project Brief

## What This Is

An AI-powered campaign intelligence platform for Plum's product marketing team.
It learns from real CleverTap user data: behavioral events, campaign history,
engagement patterns: and turns it into actionable campaign decisions backed by
evidence, not guesswork.

The system answers: **who** should receive a campaign, through **which channel**,
at **what time**, with **what message**, and **how well** it will perform: with
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
2. System parses intent: HC activation, first-time booking
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
| **Simulator** | Cohort selection first, then filters narrow it: objective, org type, channel (picked via real WhatsApp / Gmail / Plum logos), send hour, DND and stale-token exclusions. Output is an exact audience size plus a clearly-labelled PREDICTED funnel. Step 4 is the copy studio: variants assembled from Plum's approved copy library (Master Journey doc + shipped WATI/PN messages), disciplined per channel (WhatsApp Utility vs Marketing classification, per-band emoji ranges, push title/body limits, soft CTAs, no fear framing under 26, no TH friction device in HC copy), each variant carrying a GENERATED label, itemised discipline checks, and a PREDICTED performance versus the channel prior, sized against the simulated send. A paste-your-own analyzer scores custom copy against the same rules. |
| **Methodology** | Field-level provenance, the reachability decomposition, literal CT event names, and the full list of invariants the model asserts at startup. |

### Naming

Plain naming throughout. No fantasy/game naming. Campaign Simulator, Persona
Explorer, Dashboard, Audience Recommender: not The Forge, Persona Guild, The
Watchtower, The Compass.

### Design language

Three colours carry every chart and nothing else: `#2B0B21` plum violet,
`#FF3F52` plum red, `#F8DBC9` cream. Metallic cyan is reserved for interaction
only: focus, active, selection: so data and controls are never confused.
Backgrounds are pure white and every panel carries a visible outline.

Vollkorn (serif) sets all headings, large figures and chart labels in plum
violet; Inter sets body copy in near-black. Panels use layered grounds
(engineered grid, dot field, warm aurora) and blueprint corner ticks.

Every chart exports to PNG with the font embedded, so an exported image is
self-describing rather than a fallback-serif mess.

### Data Strategy

1. **Anchors** are real: documented CT segment exports plus live CleverTap
   aggregate counts, each tagged with its provenance and pull date.
2. **Composition** is modeled where no measurement exists: age, gender, device,
   org type: and calibrated so every aggregate reconciles exactly to the anchors.
3. **Conflicts are recorded, never averaged.** `backend/anchors.py` carries the
   scope warning that split the two populations apart: the eligible base is
   956,050 in active non-test orgs, while CleverTap's `/counts` endpoints accept
   no org filter and so report account-wide. Dividing one by the other is the
   single easiest way to produce a wrong number here.

### Cohort model (replaces K-Means clustering)

Age cohorts are the primary organising dimension. K-Means personas are gone ,
they produced unstable, unexplainable groups whose subtotals did not reconcile.

| Aspect | Approach |
|--------|----------|
| Cohorts | Under 20, 21-25, 26-35, 36-40, 41-50, 51+ |
| Structure | 6 cohorts × 4 org types = 24 cells, every quantity an exact integer |
| Method | Largest-remainder (Hamilton) apportionment: not sampling |
| Guarantee | Deterministic: identical inputs always give byte-identical output |
| Verification | 25 invariants asserted at startup; the API refuses to boot if any anchor disagrees |
| Rates | Always derived from the counts shown beside them, so a percentage cannot contradict its own bar |

### Corrections this rebuild landed

| Was wrong | Now |
|-----------|-----|
| DAU 11,703: queried today, a partial day | 16,503: last complete day |
| Org activation 100%, gap 92 points: computed as "does any user in this org type have a booking", always true | 74% org vs 10% employee, the documented 64-point gap |
| Push reach ~27% from two unrelated random draws | 23% of base observed, decomposed into 138,588 real and 81,304 stale tokens |
| Total base 10,000 synthetic users | 956,050 eligible base |
| Segment rules emitted `DoctorList_Viewed`, `AppointmentSuccessful_Viewed`: both rejected by the API as invalid events, so those segments matched nobody | Literal names with the `EmployeeMobileApp_Telehealth_` and `healthCheckup` prefixes |
| Simulator intersected an app-install audience with app-installed push reach: two disjoint groups | Reach is measured against the same population the objective's pool is drawn from |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js + React + TypeScript + Tailwind |
| Type | Vollkorn (local, `public/fonts/`) for headings and figures; Inter for body |
| Charts | Recharts, with PNG export via embedded-font SVG rasterisation |
| Backend | Python + FastAPI |
| Cohort model | Pure-Python integer apportionment: no sklearn, no sampling |
| Data | Documented CT segment exports + live CleverTap aggregate counts (read-only, ≤1yr windows, counts only) |
| Insights | Deterministic rule engine (`backend/insights.py`): no LLM in the number path |

### Backend layout

| File | Role |
|------|------|
| `anchors.py` | Every ground-truth number, each tagged OBSERVED / REFERENCE / DERIVED / MODELED, with the scope warning and recorded conflicts |
| `population.py` | Exact integer cohort model + `verify()`, which asserts all 25 invariants |
| `insights.py` | Deterministic cross-metric insight rules, each carrying its own arithmetic |
| `server.py` | Cohort-first API; will not serve a request unless `verify()` passes |

---

## Baked-In Domain Intelligence

These are not reference documents. They are hardcoded system rules that Crew M
enforces automatically. They come from the Crew M operational playbooks.

### Segment Definitions (Exact CT Event Names)

**AARR funnel:**
- M0 NEW APP users: gmcMembershipCreatedAtTimestamp 30-60 days ago + inviteCreatedAt 30-60 days ago + App Launched in last 60 days
- Activations: any of: cultfitoffer_explored, healthCheckuplisting_viewed, Telehealth_DoctorList_Viewed, perks_offer_unlocked
- Revenue: any of: superTopUp_purchased, topUp_purchased, oPD_purchased, mAternity_purchased

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
| Unacquired: Fresh | Urgency + first action ("get started in the next 30 days") |
| Unacquired: Lapsing/Dormant | Re-acquisition, remove friction, remind of what's theirs |
| Unactivated: Fresh | Remove-friction framing, one clear first step |
| Unactivated: Lapsing/Dormant | Re-surface single highest-converting hook |
| Retained: Fresh/Lapsing | Habit/streak framing, build on existing engagement |
| Retained: Dormant | Re-engagement without guilt-tripping |

**HRA-specific angles:**
- Never started → lead with speed + personalization
- Dropped off → low-friction reminder, emphasize how little is left
- Completed, no goal → nudge toward goal-selection screen
- Completed + goal, no action → recommendation-specific push matched to goal
- High-risk, no action 30d → care-forward urgency, never fear-based

### Copy Style Guide (Hard Rules)

These are enforced in copy scoring. Violations are flagged.

1. **No "not X" negation contrasts.** State the positive claim and stop.
   - Bad: "Recommendations built around your results: not generic advice."
   - Good: "Recommendations built specifically from your results."

2. **No ", so you know X" tails.** Land the benefit in the main clause.
   - Bad: "A score across 7 key health areas, so you know exactly what to focus on."
   - Good: "Your health, scored across 7 key areas: with a clear place to start."

3. **No em dashes.** Rewrite as two sentences or restructure.

4. **Colon definitions must define what the thing IS**: not where it lives or how long it takes.

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
for the separate AM Campaign Request Bot workstream below: that exclusion
list is specific to the analytics platform, not the whole project.

---

## Workstream: AM Campaign Request Bot (Krtin)

A second, separate slice of Crew M, running alongside the analytics platform
above. Origin problem: AMs hit the same friction every time they set up a
CleverTap campaign for a client: copy, creative, segment, and the fear of
getting it wrong. This workstream automates the mechanical setup so the AM
only supplies intent, and a human (PMM) still approves before anything goes
out.

**Flow**: AM runs `/new-campaign` in Slack → a modal collects AM name, account
name, campaign type (Welcome/Renewal), and an optional logo → n8n
(`iw-crew-m-c4b9 · AM campaign request → CleverTap draft`) parses the
submission, stores the raw input for audit, and calls this app's own API
routes in sequence: generate copy → render creative → build a CleverTap
campaign **draft only** → reply in Slack with a link to the draft. A PMM
reviews and publishes the draft directly in CleverTap: this tool never
publishes/sends anything itself.

**In scope for this workstream**: campaign drafting in CleverTap (draft
state only, never published by this tool), copy generation grounded in
account context, creative rendering, Slack modal intake.

**Out of scope for this workstream**: publishing/sending campaigns (PMM does
that manually in CleverTap), any UI beyond the Slack modal: this workstream
has no screens of its own in the three above.

**Reference docs**: `CLEVERTAP_CAMPAIGN_SETUP_SKILL.md`,
`CLEVERTAP_PLATFORM_REFERENCE.md`, `Copy_SKILL.md`.

**Where it lives**: API routes under `frontend/app/api/` (this is what's
actually deployed at the Vercel domain the n8n workflow calls): separate
from `backend/server.py`, which is the Python/FastAPI service for the
analytics platform's ML pipeline and is not part of this workstream.

**Environment variables needed** (set in `frontend/.env.local` for dev, and
in the Vercel project settings for the deployed app: never commit values):
`SLACK_BOT_TOKEN` (requires creating a Slack app: not done yet),
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

### Design addenda (locked this session)

- No em dashes anywhere: UI, copy output, captions.
- Channels carry their real brand logos (WhatsApp glyph, Gmail M, Plum p) on
  charts, legends, pickers and rows. Bar colours stay in the three-colour
  palette; logos carry identity.
- macOS chrome (traffic lights, curved tops, hairline bars) on the main page
  banners and message previews. White surfaces only.
- Crew M brand mark: geometric M in the plum gradient with a metallic cyan
  signal node, in components/logos.tsx.
- backend/copy_engine.py is the deterministic copy engine; /api/copy/options,
  /api/copy/generate, /api/copy/analyze serve it.
- Dark mode: token-driven (.dark on <html>), plum-black surfaces, cream-led
  chart series, cream metallic primary button, OS-preference default with
  localStorage persistence and a no-flash inline init script. Theme toggle
  pill lives in the sidebar. PNG exports follow the active theme.
- All headings carry the brand gradient (light: plum to red; dark: cream to
  red) via background-clip: text.
- Accuracy iterations (locked): click-to-convert is computed from observed
  funnel counts for th_activation (12.76%), hc_activation (6.14%) and
  hc_crosssell (14.32%); the old modeled priors ran +36.8% / -28.1% off.
  Channel recommendation is a published 6-parameter weighted rubric
  (decisions.py, v1.0), not argmax reach; a 20-simulation sweep runs at every
  boot and the server refuses to start if any check fails.
- Decision transparency: every simulation ships its rubric breakdown; the UI
  renders the weights as a spectrum pie (deliberately non-plum colours) in a
  collapsed "How this recommendation was calculated" panel.
- Ask Crew M (simulator step 5): deterministic grounded Q&A over the verified
  model + approved copy library. Every reply carries the facts it used with
  provenance and scores itself against a published 9-parameter rubric
  (mean 9.8/10 across ten question families in testing). No free generation.
- Brand v5 (locked): "Crew M" in Vollkorn Bold as SVG text with a static
  cyan-spectrum gradient. No animation, nothing pointy, never boxed. One
  static seafoam node after the M. Favicon: broad rounded wave with node,
  on transparency.
- Liquid glass: a restrained .glass utility (backdrop blur + saturate,
  hairline top light, diagonal specular) on surfaces that float over colour:
  banner stats strips, tooltips, popovers, the org control, the theme pill,
  mac title bars. Scarce by rule.
- Charts carry gradient series fills + soft dashed grids via shared SeriesDefs.
