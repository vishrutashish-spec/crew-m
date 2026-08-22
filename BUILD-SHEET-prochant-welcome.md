# Build Sheet — `Welcome email x Prochant`

Transcription-ready. Every field below maps to a CleverTap dashboard input.
Create in the dashboard and **Save as draft** — the API cannot save drafts, so
this is the only route.

Prepared 2026-08-21 · Renewal welcome, co-branded · Awaiting Oshin's approval

---

## 0. Assets — UPLOADED, live URLs below

All in CleverTap Content Manager → `/Content Manager /AM Emails/`
Verified 2026-08-21: all four HTTP 200, `image/png`, publicly reachable
without auth.

| Purpose | Size | URL |
|---|---|---|
| Header banner, **desktop** | 944 × 422 | `https://d250yozwgs1tp8.cloudfront.net/1704861952/assets/21c98d5b81da4887aeab19ef18893a10.png` |
| Header banner, **mobile** | 514 × 828 | `https://d250yozwgs1tp8.cloudfront.net/1704861952/assets/af754a113a3e4a4a94ff4452c1d803a1.png` |
| Footer, **desktop** | 600 × 326 | `https://d250yozwgs1tp8.cloudfront.net/1704861952/assets/9b585d30513f4248b490d7fd12918b1e.png` |
| Footer, **mobile** | 376 × 214 | `https://d250yozwgs1tp8.cloudfront.net/1704861952/assets/0b759d9e857f4a4eae4ae3f92e0bb0f7.png` |

Footers are fixed artwork and shared across all emails — reuse those two URLs
every time, do not re-upload per campaign.

The CTA button is built **live in CleverTap**, not as an image (§5).

Local originals: `~/insurwreck/figma-exports/prochant/`

### Uploading more collateral later

CMS: `https://in1.dashboard.clevertap.com/R59-Z68-4W7Z/cms/files/`

Two mechanics that matter:
- **Do not click the "Upload File" button** — it fires a native OS file dialog
  that browser automation cannot see or dismiss. Target the hidden
  `input[type=file]` (class `btn-file-input`, accepts multiple) directly.
- **10 MB combined limit** per upload call.
- CMS "Copy link" writes to the clipboard, which isn't readable programmatically.
  Pull URLs from the DOM instead by pairing each filename label to the
  `cloudfront` image src inside its card.

---

## 1. Campaign settings

| Field | Value |
|---|---|
| Campaign name | `Welcome email x Prochant` |
| Channel | Email |
| Campaign type | One-time |
| Sender name | `Plum` |
| Subject | `Your Health Insurance and Wellness Benefits for 2026-27` |
| Control group | **5%** (mandatory, no exceptions) |
| Frequency caps | Respect (default ON) |
| Send | **Save as draft. Do not schedule.** |

> Subject is 54 chars, above the ~45 guidance for mobile truncation. Kept per
> instruction. "…Benefits for 2026-27" is the part most likely to clip.

---

## 2. Who — target segment

Type: **Past behavior → New Segment**

| # | Rule | Field | Operator | Value |
|---|---|---|---|---|
| 1 | User property | `warehouse_production_removed` | not equals | `true` |
| 2 | AND · User property | `email` | contains | `plumhq.com` |
| 3 | AND · User property | `is_in_DND_CT` | not equals | `true` |

Rows 1–2 are the standing internal-only safety rule: **every campaign I build
targets plumhq.com addresses only.** Row 3 is the DND check every campaign must
carry independently.

> Not yet validated: CleverTap's exact operator strings for "contains" and
> "not equals" are unconfirmed. `estimate_only: true` would confirm reach
> without creating anything — ask if wanted.

---

## 3. What — email body, block by block

12-column grid, stacked rows. Duplicate-and-hide pattern per the setup skill:
build the desktop block, duplicate, redesign for mobile, then set "Hide on".

| # | Block | Content | Hide on |
|---|---|---|---|
| 1 | Image | header desktop `…21c98d5b…png` (944 × 422), radius 0, padding 0, link = benefits deeplink | **mobile** |
| 2 | Image | header mobile `…af754a11…png` (514 × 828), link = benefits deeplink | **desktop** |
| 3 | Text | Body copy (§4) | — |
| 4 | Button | CTA (§5) — desktop sizing | **mobile** |
| 5 | Button | CTA (§5) — mobile sizing | **desktop** |
| 6 | Text | Sign-off: `With care, Team Plum` | — |
| 7 | Image | footer desktop `…9b585d30…png` (600 × 326) | **mobile** |
| 8 | Image | footer mobile `…0b759d9e…png` (376 × 214) | **desktop** |
| 9 | Text | App download — desktop, badges side by side | **mobile** |
| 10 | Text | App download — mobile, badges stacked | **desktop** |
| 11 | Text | Unsubscribe: "If you'd rather not receive this kind of email, unsubscribe here" — "here" = CleverTap unsubscribe link | — |

Default "Hide on" is OFF for all three devices, so each toggle must be set
explicitly.

---

## 4. Body copy

Banner carries the headline, so the body opens on substance.

> Welcome back. We're glad to keep looking after you.
>
> Prochant has renewed its partnership with Plum, so your health cover carries
> on without a break.
>
> ICICI Lombard remains your insurance partner, with claims handled in-house
> by Plum.
>
> **Here's when it starts:** your renewed cover begins on 29 September 2026.
>
> **Here's what you need to know:**
> - Cover for you, your spouse and your children continues from 29 September 2026
> - Your health cards will be available in the Plum app shortly
> - Need emergency help or a cashless claim before your health ID arrives? Call 1800 30 911 911, any time. We return missed calls within 15 minutes
> - For cashless treatment, visit a network hospital. The list is in the Plum app
> - For treatment outside the network, file a reimbursement claim in the app once your health IDs arrive
>
> **What you're covered for:**
> - Sum insured: graded, ₹5,00,000 / ₹10,00,000 / ₹20,00,000 depending on your grade
> - Maternity: ₹50,000 for normal and caesarean delivery
> - No copayment on your plan
>
> **Reaching us:** in-app support any time, or care@plumhq.com between 9am and
> 9pm, every day.
>
> With care,
> Team Plum

Checked against the copy pre-flight: no em dashes · no "not X" negation
contrasts · no ", so you know X" tails · no invented figures · no undefined
acronyms (GMC avoided) · no wit (coverage news).

---

## 5. CTA button

Built live in CleverTap, not an image.

| Property | Value |
|---|---|
| Label | `See what your plan covers` (5 words) |
| URL | `https://deeplink.plumhq.com/benefits` |
| Action | Open web page |
| Background | `#571541` |
| Text colour | `#ffffff` |
| Font size | 18px, Regular, global font |
| Border radius | 8px |
| Padding | 13px top/bottom, 16px left/right |
| Auto width | ON |
| Align | Center |
| Line height | 1.5 · Letter spacing 0 · No border |

Duplicated for desktop/mobile with "Hide on" toggles.

---

## 6. Deeplinks

Both the **button** and both **banner images** point to:

`https://deeplink.plumhq.com/benefits`

Never a raw web URL. The deeplink handles app-installed and no-app cases
itself.

---

## 7. Data provenance

Everything factual came from the warehouse. Nothing invented.

| Field | Value | Source |
|---|---|---|
| Org | Prochant, ENTERPRISE, 1,714 employees | `account_health` |
| Current policy | 29 Sep 2025 → 28 Sep 2026 | `policy_schedule` |
| Renewal date | **29 September 2026** | derived from the expiring policy |
| Insurer | `il` → ICICI Lombard | `iw_policy_si`, `policy_active: true` |
| TPA | in-house | `policy_schedule.tpa` |
| Coverage | `esc` = Employee + Spouse + Children | `policy_schedule.coverage_type` |
| Sum insured | ₹5L / ₹10L / ₹20L graded | `policy_schedule.grade_sum_insured` |
| Maternity | ₹50,000 normal and caesarean | `policy_schedule.maternity_limit_*` |
| Copay | none | `copay_active: false` |
| Policy no. | 4016/X/411900096/00/000 | `policy_schedule.policy_number` |

**Verify before sending:**
1. **"ICICI Lombard"** is my expansion of the code `il`.
2. **29 September 2026** is derived, not stated anywhere.
3. **Ambulance cap, LASIK, Ayush** are omitted, not forgotten — not in the
   warehouse. The production reference email includes them, so someone must
   supply the real figures.
4. **Prochant's logo** was derived by recolouring the white wordmark from their
   own CDN asset to black. Matches the version supplied, but swap in the
   official dark file if it differs.
5. **Headline type is Vollkorn, not GT Alpina** — pending the Figma restart.
   Do not send until the real font is in.

---

## 8. Pre-send QA

- [ ] Banners uploaded to CloudFront, URLs live
- [ ] Preview desktop and mobile — confirm each block appears on exactly one
- [ ] Click every button and banner link, confirm the benefits screen opens
- [ ] Preview & Test to a test profile
- [ ] Confirm 5% control group is set
- [ ] Confirm segment resolves to plumhq.com addresses only
- [ ] Verify the five facts in §7
- [ ] Oshin approves before publish
