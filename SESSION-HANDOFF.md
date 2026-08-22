# Session Handoff — Crew M / Insurwreck

Written 2026-08-21 for resuming in a new chat window. Read this first, then the
referenced files as needed — this is a pointer document, not a replacement for
the detailed ones.

---

## 🚨 Open safety issue — read before touching CleverTap again

**CleverTap targeting silently ignores single-value `equals` filters, in both
the API and the dashboard UI.**

Evidence:
- API: `create_campaign` with `estimate_only:true` and `where:{}` (empty) →
  **680,445** reach.
- API: same call with `profile_fields: [{field_name:"Email", operator:"equals",
  value:"oshin.sharma@plumhq.com"}]` → **HTTP 400, "Invalid profile field: null"**
  — happens for *any* field_name tried (Email, identity), so it's a tool bug,
  not a wrong property name.
- **Dashboard UI**: built a 3-rule segment (`Email equals
  oshin.sharma@plumhq.com` AND `warehouse_production_removed not equals true`
  AND `is_in_DND_CT not equals true`), hit Calculate → **680,449** reach. Same
  order of magnitude as "everyone." This means the UI path has the same
  underlying problem, not just the raw API.

**Do not trust a single-recipient or narrow segment in this account until this
is resolved.** Do not save/send anything that depends on precise targeting
without independently confirming reach some other way first (e.g. ask a
CleverTap admin, or test via a channel/mechanism that shows exact recipient
lists, not just an estimate).

**Nothing has been sent.** The Prochant draft was left mid-edit in the CT
dashboard, unsaved, at this exact point — segment section open, reach showing
680,449.

---

## What this project is

Building "Crew M" — originally scoped as a Slack-bot-driven tool for Plum
Account Managers to generate client email campaigns (copy + design + CT
setup). A separate, much larger team vision exists in `BRIEF.md` (ML-driven
campaign simulator) — the small AM tool is a different, narrower thing that
was being built standalone. Three people, three domains:
- **Oshin (you)** — design (this session)
- **Vishrut** — CleverTap operational knowledge
- **Kritin** — copy/brand voice

All shared context now lives in git: `~/insurwreck`, remote
`https://github.com/vishrutashish-spec/crew-m.git`, branch `main`.

## Key reference files (read these, don't re-derive)

| File | What it is |
|---|---|
| `EMAIL-DESIGN-PLAYBOOK.md` | **The design pipeline, exhaustively documented.** Figma file keys, node IDs, font substitution procedure, colour rule (fixed `#FFBFC5`, not brand-matched), the co-branding logo slot mechanics, the "images never export via API — composite locally" gotcha, heading-length-is-geometry-constrained gotcha, export sizes. Read this before touching Figma again. |
| `DESIGN-GUIDE.md` | Earlier/rawer version of the same knowledge, superseded by the playbook but has some detail not yet folded in. |
| `Copy_SKILL.md` | Kritin's copywriting rules. Hard bans: em dashes, "not X" negation contrasts, ", so you know X" tails, invented stats, unexplained acronyms (HRA/GMC/GTL). Channel-specific limits for email/WhatsApp/push. Real production welcome-email reference text included. |
| `CLEVERTAP_CAMPAIGN_SETUP_SKILL.md` | Vishrut's doc. **Canonical deeplinks table** (`https://deeplink.plumhq.com/benefits` etc.), the 12-grid email structure, the "Hide on" desktop/mobile duplication pattern, exact button CSS spec. |
| `CLEVERTAP_PLATFORM_REFERENCE.md` + `CREW_M_MASTER_CT_BIBLE.md` | Segment/event names, guardrails (5% control group mandatory, DND check, "coordinate with Oshin before launching"), campaign-status vocabulary. No campaign-creation endpoint is documented in either — that gap turned out to be real (see below). |
| `BUILD-SHEET-prochant-welcome.md` | The fully-resolved transcription sheet for the Prochant test campaign — copy, live CloudFront asset URLs, segment rules, deeplink, data provenance. Everything except the actual CT draft save. |
| `crew-m-app/` | The small Next.js AM tool actually built this session (org search → real segment lookup → Claude-drafted copy → review → save to Supabase). Separate from the CT campaign work. |
| `figma-exports/` | All generated PNGs, organized by client (`groww/`, `prochant/`). |

## What's actually confirmed working

- **Figma pipeline**: clone template → substitute missing fonts (GT Alpina/
  Passenger Sans unavailable until a Figma restart picks up newly-installed
  fonts; Vollkorn is the interim serif substitute) → set copy → composite
  client logo locally onto the exported PNG (never via Figma's image API,
  which doesn't propagate to server-side export) → verify by pixel-counting
  the composite before sending. Full Prochant and Groww sets exist in
  `figma-exports/`.
- **Warehouse data lookup**: real org policy data via the `insurwreck-data`
  MCP server (`policy_schedule`, `iw_policy_si`, `account_health` datasets).
  Confirmed Prochant's real GMC policy (ICICI Lombard/`il`, in-house TPA, ESC
  coverage, graded 5/10/20L sum insured, ₹50k maternity, renewal 29 Sep 2026
  derived from the expiring policy). **Ambulance/LASIK/Ayush are not in any
  warehouse dataset** — checked `benefits_config` (97 rows) too, genuinely
  absent, not just unlisted. Only include those if the AM explicitly supplies
  them — never invent, never default to omitting-means-not-covered without
  saying it's an assumption.
- **CleverTap dashboard access**: confirmed connected (Account ID
  `R59-Z68-4W7Z`, region `in1`, matches the live dashboard exactly).
  Successfully browsed real saved templates (183 of them), found and opened
  the actual "Welcome Email template" last used for **Eternal** (Zomato's
  parent) — its real content independently confirmed `il` = ICICI Lombard.
- **CT Content Manager (CMS)**: file upload works via `file_upload` targeting
  the hidden `input[type=file].btn-file-input` directly — **never click the
  visible "Upload File" button**, it opens a native OS dialog invisible to
  automation. Uploaded Prochant's two header PNGs to `/Content Manager/AM
  Emails/`, pulled back their live CloudFront URLs by pairing filename labels
  to `img[src*=cloudfront]` in the DOM (CMS "Copy link" is clipboard-only,
  not readable programmatically).
- **Vercel env vars**: pushed `CT_ACCOUNT_ID` / `CT_PASSCODE` into the
  `insurwreck/iw-crew-m-c4b9` Vercel project (Production + Preview as
  Sensitive/write-only, Development as normal) via `vercel link` +
  `vercel env add`. This was explicitly authorized after I raised the risk
  (write-capable prod CT secrets in a deployed hackathon app) — flagged, not
  silently done.

## What's broken / blocked

1. **CleverTap has no draft-via-API.** `create_campaign` requires `when:
   "now"` or a datetime — both are live sends. "Save Draft" only exists in
   the dashboard UI, so any draft has to be built there by hand/browser
   automation.
2. **Single-recipient/precise targeting is unreliable — see the urgent issue
   above.** This blocks the original ask ("send only to
   oshin.sharma@plumhq.com") entirely until resolved.
3. Client logos should be **requested from the AM**, not scraped — tried
   scraping first (Groww, Prochant), works sometimes but is fragile (dead
   Clearbit API, 403s, wrong colour variants, icon-only marks). Documented
   as the standing rule in the playbook.
4. GT Alpina/Passenger Sans real fonts: installed on disk in the right
   licensed weights, but Figma hadn't been restarted to pick them up as of
   last check — confirm before trusting any "real font" claim in a fresh
   session.

## Immediate next steps (pick up here)

1. Decide how to resolve the targeting bug before any CT send/draft depending
   on precise segmentation. Possibly loop in whoever administers the
   CleverTap account.
2. The Prochant dashboard draft is sitting unsaved mid-edit — probably cleanest
   to abandon it and rebuild once targeting is trusted, rather than resume a
   half-finished state from a stale screenshot.
3. Confirm GT Alpina is now visible to Figma (`listAvailableFontsAsync`) and
   redo the Prochant/Groww headers in the real font if so.
4. The Slack-bot-to-CleverTap connection (mentioned as the eventual "proper"
   way to do scoped sends) is still just an idea, not built.
