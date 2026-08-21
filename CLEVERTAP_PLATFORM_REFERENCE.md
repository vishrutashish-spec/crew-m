# CleverTap Platform Reference — Crew M Build Guide

> **Purpose**: Complete CleverTap platform knowledge for building Crew M. Covers API
> endpoints, data model, segmentation engine, campaign analytics, intelligent features,
> and operational constraints. Cross-referenced with Plum's actual CT setup from the
> Master Bible.
>
> **Not a replacement for the Bible** — the Bible (CREW_M_MASTER_CT_BIBLE.md) has
> Plum-specific segment definitions, event names, funnel numbers, and domain rules.
> This document covers the platform itself.

---

## 1. Authentication & Infrastructure

### Credentials

Every API request requires two headers:

```
X-CleverTap-Account-Id: <Project ID>
X-CleverTap-Passcode: <Account Passcode or User-Passcode>
Content-Type: application/json   (POST only)
```

Get from: CleverTap Dashboard → Settings → Project.

- **Account Passcode**: org-level, up to 100 per account, shareable across integrations
- **User Passcode**: per-dashboard-user, finite (1–365 days) or infinite (10-year) validity — recommended for API integrations (smaller blast radius if leaked)

**For Crew M**: Store in `.env.local` as `CT_ACCOUNT_ID` and `CT_PASSCODE`. Never hardcode.

### Regional Base URLs

Account is pinned to one region; must use the matching endpoint for all calls:

| Region | Code | Base URL |
|--------|------|----------|
| India | in1 | `https://in1.api.clevertap.com/1/` |
| US | us1 | `https://us1.api.clevertap.com/1/` |
| Singapore | sg1 | `https://sg1.api.clevertap.com/1/` |
| Europe | eu1 | `https://eu1.api.clevertap.com/1/` |
| Indonesia | aps3 | `https://aps3.api.clevertap.com/1/` |
| Middle East | mec1 | `https://mec1.api.clevertap.com/1/` |

**For Plum**: Almost certainly `in1` (India region). Confirm with Vishrut.

### Rate Limits

CleverTap uses **concurrency limits, not time-window rate limits**:

| API Type | Concurrent Limit |
|----------|-----------------|
| Data upload (events, profiles, device tokens) | 15 concurrent requests |
| Everything else (campaigns, segments, reports, counts, trends) | 3 concurrent requests |
| Campaign create/stop | 3 req/sec |
| Campaign report | 60 req/min per campaign |

Exceeding → HTTP 429 "Too many concurrent requests".

**Design implication for Crew M**: Backend needs a semaphore/queue limiting CT API calls to 3 concurrent. Use exponential backoff on 429/500/503. Set 60s timeout per request.

### Async Polling Pattern

Many CT endpoints are async — they return `{"status":"partial","req_id":"..."}` on first call. Poll with `GET ...?req_id=` every 30 seconds until `status: "success"`.

Affected endpoints: Event Count, Profile Count, Trends, Top Property Counts.

---

## 2. CleverTap Data Model

### Events

- A timestamped action a user took (e.g. "Consultation Booked")
- Each event has a **name** + up to **256 properties** (key-value pairs)
- **System events**: auto-captured by SDK, properties prefixed `CT` (e.g. App Launched, App Installed, Notification Viewed)
- **Custom events**: developer-defined (e.g. `healthCheckupbooking_confirmed`, `Telehealth_DoctorList_Viewed`)
- Property types: String, Boolean, Integer, Float, Double, Date, nested objects
- Scalar values capped at 512 chars, keys at 120 chars

**Plum's CT**: 993 events (628 active, 39 system, 954 custom). Top by volume: pathViewed (5.2M), nativeDisplay_home_card (1.5M), App Launched (570K). See Bible Section 3 for confirmed event names.

### User Profiles

Three pillars: **Identifiers**, **Properties**, **Events**.

- Every user gets a unique **CleverTap ID**
- Optional external identifiers: email, phone, Facebook ID, custom user ID
- **System properties**: Name, Email, Identity, Phone, Gender, DOB, Age, Timezone, channel opt-in flags (MSG-email, MSG-push, MSG-sms, MSG-whatsapp)
- Up to **256 custom property keys** per account
- Multi-value arrays: max 100 entries × 512 chars each

**Plum's CT**: 249 active user properties. Key ones: `is_in_DND_CT` (373 campaigns), `warehouse_production_inviteCreatedAt` (339), `warehouse_production_organisationId` (267). See Bible Section 4.

### Identity Resolution

- Anonymous profiles carry only CleverTap ID (no addressable identity)
- **Addressable/identified profiles** have email or phone → reachable directly
- When anonymous device logs in with known identity → event history merges into existing profile
- Same login across multiple devices → unified cross-device profile
- "Customer" sub-classification applies once a purchase event is recorded

### Campaigns vs Journeys

| | Campaign | Journey |
|--|----------|---------|
| **Structure** | One message, one moment | Multi-step, branching flow |
| **Channels** | Single channel per send | Combines channels in sequence |
| **Targeting** | Static segment at send time | Entry criteria + reactive branching |
| **Use case** | Broadcast, one-off moments | Nurture, habit building, lifecycle |
| **API access** | Full CRUD + reporting | Limited (no "list journeys" endpoint) |

**Plum context**: Adoption growth (12% → 35%) is Journey territory. Campaigns support one-off moments (open enrolment, seasonal weeks).

### Segments

Four types:

1. **Past Behavior** — historical criteria combining actions, inactions, property filters
2. **Live User** — real-time qualification on behavior match
3. **Custom List** — uploaded user lists (CSV)
4. **Partner Segments** — synced from ad partners

**System segments** (pre-built): All Users, First-time Users, Engaged Users (4+ weekly sessions), Test Users.

**Segment Builder** has three rule families:
- **USER PROPERTY**: static facts (partner_type, org ID, DND flag, plan status)
- **USER BEHAVIOR**: actions taken/not taken (`Event Did` / `Event Have Not Done` / `Event Combination Did Any Of`) with count operators and time windows
- **USER INTERESTS**: event property values, time of day, day of week

---

## 3. API Endpoints Reference

### 3.1 Events API

**Get Events** — two-step cursor flow:

```
POST /1/events.json
{
  "event_name": "Telehealth_DoctorList_Viewed",
  "from": 20260101,
  "to": 20260801,
  "batch_size": 5000    // default 500, max 5000
}
→ {"status":"success", "cursor":"..."}

GET /1/events.json?cursor=<cursor>
→ {records: [{profile, events, ts, event_props, session_props}], next_cursor}
```

- Cursor expires: **4 hours after creation** or **1 hour of inactivity**
- Repeat GET with `next_cursor` until exhausted

**Get Event Count** — async:

```
POST /1/counts/events.json
{
  "event_name": "healthCheckupbooking_confirmed",
  "from": 20260101,
  "to": 20260801,
  "event_properties": [
    {"name": "package", "operator": "equals", "value": "CORPORATE"}
  ]
}
```

Operators: `equals`, `contains`, `not_contains`, `in`, `not_in`, `gt/gte/lt/lte`, `exists/not_exists`. Properties are AND-combined.

Returns `{"status":"partial","req_id":"..."}` → poll every 30s.

### 3.2 User Profiles API

**Get Profiles by event** — same cursor pattern:

```
POST /1/profiles.json
{
  "event_name": "App Launched",
  "from": 20260101,
  "to": 20260801
}
→ {"cursor":"..."}

GET /1/profiles.json?cursor=<cursor>
→ {records: [{identity, email, name, profileData, events, platformInfo}]}
```

Cursor valid **4 days** (longer than Events cursor).

**Get Profile by ID**:

```
GET /1/profile.json?identity=<user_id>
→ {record: {identity, email, profileData, events}}
```

Exactly one identifier param: `email`, `identity`, or `objectId`.

**Get Profile Count** — async, same polling pattern as Event Count.

### 3.3 Campaigns API

**List Campaigns**:

```
POST /1/targets/list.json
{"from": 20260101, "to": 20260801}
→ [{id, name, scheduled_on, status}]
```

Status values: `scheduled`, `pending`, `running`, `paused`, `stopped`, `completed`.

**Get Campaign Report** (single campaign):

```
POST /1/targets/result.json
{"id": 1234567890}
→ {"result": {"sent": N, "clicked": N}}
```

Only `sent` + `clicked`. No delivered/opened/converted. 409s until campaign fully completed. Rate limit: 60 req/min per campaign.

### 3.4 Message Reports API (THE KEY ENDPOINT)

This is the richest analytics endpoint for Crew M:

```
POST /1/message/report.json
{
  "from": 20260101,
  "to": 20260801,
  "channel": ["push", "email", "sms", "whatsapp"],
  "delivery": ["one_time", "inaction", "action", "recurring"],
  "status": ["completed"],
  "daily": true    // day-wise split
}
```

**Filter params**:
- `channel[]`: push, email, sms, browser, inapp, webhooks, web_pop_up, exit_intent, native_display, inbox, tiktok, nativedisplay
- `delivery[]`: one_time, inaction, action, recurring, property_time, api, multiple_dates
- `status[]`: campaign status filter
- `message_type[]`: single, ab, message_on_user_property
- `label[]`: campaign label filter
- `daily`: boolean — if true, returns day-wise breakdown

**Response** per message:
- `message_name`, `channel`, `delivery`, `start_date`, `status`
- `sent`, `viewed`, `clicked`
- `conversion_event`, `labels`, `device`

**Crew M usage**: This is the primary endpoint for building the campaign performance dataset. Pull all campaigns with `daily: true` to get temporal patterns. Filter by channel to build channel-preference models.

**Gaps**: No explicit "delivered" count or numeric conversion count field in the documented response. Viewed ≈ delivered for push; for email, viewed = opened.

### 3.5 Trends API

```
POST /1/counts/trends.json
{
  "event_name": "healthCheckupbooking_confirmed",
  "from": 20260101,
  "to": 20260801,    // max 1 year span
  "unique": true,
  "groups": {
    "by_channel": {
      "property_type": "event_properties",
      "name": "channel",
      "top_n": 5,
      "order": "desc"
    }
  },
  "trend_type": "weekly"    // daily|weekly|monthly
}
```

- Max **1 year span** (aligns with Plum's data governance guardrail)
- Up to **5 group-by dimensions**
- Async polling pattern
- Returns time-bucketed counts (daily=YYYYMMDD, weekly=YYYYWW, monthly=YYYYMM keys)

### 3.6 Top Property Counts API

```
POST /1/counts/top.json
{
  "event_name": "Telehealth_DoctorList_Viewed",
  "from": 20260101,
  "to": 20260801,
  "groups": {
    "specialty": {
      "property_type": "event_properties",
      "name": "specialist_specialty",
      "top_n": 20,
      "order": "desc"
    }
  }
}
```

`property_type` options: `event_properties`, `profile_fields`, `session_properties`, `app_fields`, `demographics`, `technographics`, `reachability`, `geo_fields`.

### 3.7 Real-Time Counts

```
POST /1/now.json
{
  "user_type": true,
  "session_source": true,
  "browser": true,
  "os": true,
  "device": true
}
→ active users in last 5 minutes, with optional breakdowns
```

### 3.8 Segments (Limited API Access)

**API Segments** — Private Beta only, requires CSM access. Not available for hackathon.

**Custom List API** — Generally available, 3-step CSV upload:
1. `POST /1/get_custom_list_segment_url` → pre-signed URL (24h validity)
2. `PUT` CSV to the URL
3. `POST /1/upload_custom_list_segment_completed` with `{name, email, filename, creator, url, replace}`

Max 5GB via API, 50MB via dashboard.

---

## 4. Campaign Analytics Deep Dive

### Conversion Pipeline (All Channels)

```
Sent → Delivered → Viewed → Clicked → Converted
```

Conversion event counted **once per user per campaign** even if repeated.

### Channel-Specific Tracking

| Channel | Sent | Delivered | Viewed/Opened | Clicked | Notes |
|---------|------|-----------|---------------|---------|-------|
| Push | Yes | Yes (SDK ≥3.5.1) | Impressions | Yes | CTR = clicked/sent. View-through + click-through conversion tracked separately |
| Email | Yes | Yes | Opens (pixel) | Yes | Requires email-provider integration |
| SMS | Yes | Yes | N/A | Link clicks | Via SMS provider integration |
| WhatsApp | Yes | Yes | Read receipts | Yes | Supports two-way messaging via Conversations inbox |
| In-App | N/A | N/A | Impressions | Yes | Shown while user is in-app |
| App Inbox | N/A | Fetched on app launch/session | Views | Yes | Persistent on-device message center |

### Report Types Available

| Report | What It Shows | Crew M Relevance |
|--------|--------------|------------------|
| **Campaign Reports** | Per-campaign sent/viewed/clicked/converted | Training data for prediction models |
| **Journey Reports** | Node-level funnel stats along journey paths | Understanding multi-step campaign sequences |
| **Funnels** | Step-by-step event drop-off with conversion window | Validating TH/HC funnel numbers |
| **Cohort Analysis** | Retention/behavior tracking over time by starting behavior | Adoption trajectory analysis |
| **Trends** | Event counts over time with property breakdowns | Temporal pattern discovery |
| **Flows** | Open-ended multi-path exploration | Discovery mode for user paths |
| **RFM** | Recency × Frequency grid with monetary overlay | User value segmentation |

### A/B Testing

- Control variant + up to **7 test variants** on templated keys
- Statistical significance via **Welch's t-test**
- Confidence threshold = `100 - (5 / (variants - 1))`
- Up to 5 conversion goals per test
- Partial rollout via "test group %"
- Winner declaration is **manual**, not auto-promoted

### Funnel Analysis Features

- Ordered sequence of events with configurable conversion window (default 5 days)
- **Actionable funnels**: can launch a campaign/journey targeting the drop-off cohort directly
- **Flows** tab: sibling feature for open-ended, multi-path exploration

---

## 5. Intelligent Features

### IntelliTime (Best Time to Send)

- Splits each day into **twelve 2-hour buckets** (absolute clock time)
- Assigns each user to their historically best-performing bucket using up to **180 days** of activity
- Falls back to admin-defined window for users lacking history
- Max **10 IntelliTime configs** per account; one must be marked Default for Journey use
- Supported on: Email, SMS, Push, WhatsApp, Web Push
- Automatically applies user timezone (cannot disable)
- If computed bucket collides with user's DND window → **message discarded, not rescheduled**
- Incompatible with global throttle limits

**Crew M implication**: We can pull user activity timestamps to build our own send-time model, validated against CT's IntelliTime buckets.

### IntelliNODE (Journey Path Testing)

- Journey controller node for live multivariate path testing
- Up to **7 parallel paths** varying timing/messaging/channel/creative
- **Automated Mode**: equal traffic split, re-evaluates every 5 minutes, shifts traffic toward better-converting path
- **Manual Mode**: fixed distribution percentages
- Uses one shared Goal event for optimization

### IntelliChannel (Preferred Channel)

- ML scoring of each user's most-responsive channel (Push/Email/SMS/WhatsApp)
- Rolling **90-day window** based on sent/viewed/clicked interactions
- Refreshed **daily**
- Requires: ≥2 active channels, multi-channel reach, ≥3 total engagements (else "Not Enough Data")
- Usable as: segment filter or Journey Conditional-Split branch

**Crew M implication**: We can build our own channel preference model from the same underlying data, but CT already has one running. Our model should add persona-level channel preferences that CT's per-user model doesn't surface.

### Frequency Capping (Two Tiers)

1. **Global Frequency Caps**: per-channel message ceilings (e.g. "3 pushes in 7 days"), dwell-time minimums between messages (15 min–7 days), Global/Ad-hoc Throttle limits
2. **Message-level caps**: per-campaign re-qualification limits (send-every-time vs enforce minimum gap of 5 min–30 days)

Stricter of the two always wins. Violations appear in campaign error reports.

### DND & Delivery Controls

- Configurable DND days/hours per campaign
- Choice: **discard** vs **defer** messages qualifying during DND
- Campaign cut-off times
- Per-user-timezone delivery scheduling (skip-or-reschedule-next-day)
- TTL for delivery retry duration

### CleverAI / Predictive Features

- **Predictions Agent**: predictive segmentation for conversion/churn/uninstall likelihood, continuously refreshed
- **Recommendations Agent**: in-journey product/content suggestions
- **Journey Builder Agent**: journey construction optimization
- **Path Optimizer Agent**: journey path optimization
- **Lifecycle Agent**: next-best-action across acquisition → activation → retention → cross-sell → win-back
- **Psychographic Segmentation**: ML-driven clustering by inferred likes/interests (beyond behavioral actions)
- **Intent-Based Segments**: ML-bucketed Most/Moderately/Least Likely to convert/churn, with built-in 5% control group

### RFM Analysis (Built-In)

- Recency and Frequency scored 1-5 via percentile ranking on a selected event
- Monetary reported as Average Monetary Value (total spend / users in segment)
- **10 named segments**: Champions, Loyal Users, Potential Loyalists, New Users, Promising, Needing Attention, About to Sleep, At Risk, Cannot Lose Them, Hibernating
- Analysis window configurable (recommended under 512 days)
- Segments are campaign-actionable directly
- Transitions between segments trackable over time

---

## 6. Data Export Options

| Method | Best For | Format | Notes |
|--------|----------|--------|-------|
| **Cursor APIs** (Events/Profiles) | Moderate, scriptable pulls | JSON | Not for full historical bulk export |
| **S3/GCS/Azure Partner Exports** | Large historical backfills | JSON, CSV, XML, Parquet | Scheduled or one-time bulk dumps |
| **Webhooks** | Real-time event streaming | JSON POST | Push campaign interaction events to a URL |
| **BI Connectors** | Warehouse sync | Various | Integration guides available |

**For Crew M hackathon**: Use cursor APIs for targeted pulls (specific events, date ranges). If we need full historical data, use S3 export if available on Plum's plan.

---

## 7. Crew M API Strategy

### What to Pull & How

| Data Need | Endpoint | Priority |
|-----------|----------|----------|
| Campaign performance history | `POST /1/message/report.json` with `daily:true` | 🔴 Critical — training data for prediction models |
| Event counts by time | `POST /1/counts/trends.json` | 🔴 Critical — temporal patterns |
| User profiles (sample) | `POST /1/profiles.json` + cursor | 🔴 Critical — feature engineering |
| Top event properties | `POST /1/counts/top.json` | 🟡 Important — property distribution |
| Campaign list | `POST /1/targets/list.json` | 🟡 Important — campaign metadata |
| Individual campaign stats | `POST /1/targets/result.json` | 🟡 Important — per-campaign detail |
| Real-time active users | `POST /1/now.json` | 🟢 Nice-to-have — live dashboard |

### Architecture Pattern

```
CT API → Backend Queue (3 concurrent max)
       → Async Polling Loop (for partial/req_id endpoints)
       → Response Cache (SQLite/Parquet)
       → ML Pipeline reads from cache
       → Frontend reads from backend API, never CT directly
```

### What the API Cannot Give Us (Dashboard-Only)

- IntelliTime bucket assignments per user
- A/B variant-level results breakdown
- DND suppression counts
- Journey canvas/node structure
- Segment definitions/rules
- IntelliChannel per-user scores
- Psychographic segment membership

These would need manual export (screenshots, CSV downloads from dashboard) per Bible Section 19.3.

---

## 8. Key Constraints for Crew M Build

### From CT Platform

1. **3 concurrent API requests max** for analytics endpoints — queue and throttle
2. **Async polling** on count/trend endpoints — build a polling loop, don't assume sync
3. **Cursor TTLs differ**: Events = 4 hours (1h idle), Profiles = 4 days
4. **1-year max on Trends API** — aligns with data governance guardrail
5. **No "list all segments" API** without beta access — use segment definitions from Bible
6. **No journey list API** — journey data must come from manual exports
7. **Message Reports only gives sent/viewed/clicked** — no explicit "delivered" or conversion count

### From Data Governance (CLAUDE.md)

1. **All queries must specify date range; max 1-year window**
2. **No raw data export buttons in the UI** — display only
3. **Audit logging** on all data access (who, when, what)
4. **Secrets in env vars** — CT credentials in `.env.local`
5. **Move data only through the kit** — CT API access through backend, never client-side

### Synthetic Fallback Trigger Conditions

Use synthetic data when:
- CT API credentials not yet configured
- API returns errors or is unreachable
- Data volume insufficient for reliable clustering (< 1000 users)
- Campaign history too sparse for prediction training (< 20 campaigns)

Architecture must abstract data source — real CT and synthetic are interchangeable at the pipeline level.

---

## 9. Quick Reference: CT Concepts → Crew M Features

| CT Concept | How Crew M Uses It |
|------------|-------------------|
| Events + Properties | Feature engineering for user clustering |
| User Profiles + Properties | Demographics and attribute features for personas |
| Segments (Past Behavior) | Audience targeting recommendations |
| Campaign Reports | Training data for conversion prediction models |
| Trends | Temporal pattern discovery, send-time optimization |
| RFM Scores | Input features for persona clustering |
| IntelliChannel | Validation for our channel preference model |
| Funnel Analysis | Validating our funnel-stage predictions |
| A/B Results | Highest-quality training signal for copy/channel models |
| DND/Frequency Caps | Hard constraints on campaign recommendations |

---

> **Sources**: developer.clevertap.com (API reference), docs.clevertap.com (product docs).
> Cross-referenced with CREW_M_MASTER_CT_BIBLE.md Sections 2-4, 13, 19.
> Last updated: 21 August 2026.
