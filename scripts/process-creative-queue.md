# Process pending creative requests

You are running unattended (launchd, no human watching). Be conservative:
never touch the original Figma template frames, only ever clone them, and
never mark a row done unless you've actually verified the result.

## 1. Fetch the queue

```
POST https://workflow-stg.plumhq.com/webhook/iw-crew-m-c4b9-creative-queue-manage
{"action": "get_pending"}
```

Returns an array of rows: `requestId, accountName, campaignType, brandMode
("single"|"cobranded"), logoUrl, status`. If the array is empty, stop here —
nothing to do this run, that's a normal outcome, not an error.

## 2. Read the playbook fresh

Read `~/insurwreck/EMAIL-DESIGN-PLAYBOOK.md` in full before touching Figma —
node IDs and positions shift between sessions and the doc says to re-verify
every time. Follow it exactly: file key `3J4g2wdTGz5IGrb9tjECGt` (must stay
in the "Plum product" paid team), font substitution procedure (§1.2/1.3),
the four header variants (§3.1), the co-branding lockup mechanics (§6),
typography specs (§5), and the export + local logo composite steps (§8.3).

Scope for this job: **only the header** (desktop 944×422 + mobile 514×828).
Footers and the CTA button are not part of `/api/creative`'s output and are
handled elsewhere (footers are fixed, shared, already-hosted artwork per
BUILD-SHEET-prochant-welcome.md — do not regenerate them).

## 3. For each pending row

1. **Verify fonts**: `figma.listAvailableFontsAsync()`, filter for
   `alpina|passenger`. If empty, fall back to Vollkorn per §1.3 and note the
   substitution — never claim GT Alpina when it's Vollkorn.
2. **Pick the variant**: `brandMode: "single"` → single-brand header
   (`1:197` desktop, `23:678` mobile). `brandMode: "cobranded"` → co-branded
   header (`23:220` desktop, `1:896` mobile) — **requires `logoUrl`**. If
   `brandMode` is `"cobranded"` and `logoUrl` is empty, skip this row (leave
   it pending) and note it in your summary — don't guess a logo.
3. **Clone** desktop + mobile variants per §8.2: load fonts → `src.clone()`
   → swap fonts on the clone's TEXT nodes → `appendChild` → position at
   `x >= 19000` → rename `GEN — <campaignType> — <accountName> — <desktop|mobile>`
   (+ `[VOLLKORN sub for GT Alpina]` suffix if applicable). Never modify or
   rename the source templates.
4. **Set copy**: heading, one-line subtitle, AND the button label — the
   header template embeds its own CTA button as part of its layout (see
   §5.3's typography spec, which lists a "Button label" row for the header
   itself, and §4.3 "Changes per email" which lists it alongside heading and
   logo). **Find every text node in the cloned header whose content is
   still a template placeholder (e.g. "Button text", "Button CTA in 4-5
   words", "Heading that fits in 2 lines") and replace it — a shipped
   placeholder string is always a bug, never leave one.** Do not invent
   benefit specifics (no numbers, no coverage details) — this queue only
   carries account name and campaign type, nothing else. Use:
   - Welcome: heading `"Welcome!"`, subtitle `"Your health and wellness
     benefits are on their way"`, button `"Explore your benefits"`
   - Renewal: heading `"Welcome back!"`, subtitle `"Your health and wellness
     benefits for the year ahead"`, button `"Explore your benefits"`
   Before exporting, walk every TEXT node in the cloned header and assert
   none of its `characters` matches a known placeholder string — treat a
   match as a failed row, not a shippable one.
   Assert `heading.height <= 100` after setting text (§5.3 "heading length is
   geometry, not taste") — if it wraps past 2 lines, drop the size, don't
   change the copy.
5. **Fix desktop co-branded subheading to 18px** if that variant was used
   (template ships 30px, which the playbook says is always wrong).
6. **Apply the fixed accent** `#FFBFC5` to the gradient's last stop and the
   largest ellipse (select by size, not name — see §4.4).
7. **If co-branded**: download `logoUrl` locally, then **re-measure the logo
   slot's `absoluteBoundingBox` right now** (after the copy/layout changes
   above, never reuse an earlier measurement — §8.3 warns this exact mistake
   silently misplaces the logo). Composite locally with PIL after export
   (never via Figma's image API — it doesn't reach server-side exports),
   resize to the slot's measured size, then **assert the pixels** (brand +
   dark-wordmark pixel counts in the crop) before accepting the result.
8. **Export both variants at 1x** (944×422 / 514×828, no @2x) to
   `~/insurwreck/frontend/public/creatives/<requestId>-desktop.png` and
   `<requestId>-mobile.png`.

## 4. Ship the results

After processing every pending row this run:

1. `cd ~/insurwreck/frontend && npm run build` — confirm it still builds clean.
2. `cd ~/insurwreck && git add frontend/public/creatives && git commit -m
   "Add generated creatives for <list requestIds>"` (local commit only —
   this machine has no GitHub credentials, that's expected, don't try to
   push).
3. Deploy: from `~/insurwreck`, run
   `vercel --prod --token "$(python3 -c "import json;print(json.load(open('/Users/oshin/.insurwreck/credentials.json'))['services']['vercel']['token'])")" --yes`
4. For each row you actually finished (not skipped), call:
   ```
   POST https://workflow-stg.plumhq.com/webhook/iw-crew-m-c4b9-creative-queue-manage
   {"action": "mark_done", "requestId": "<id>",
    "desktopUrl": "https://iw-crew-m-c4b9.insurwreck.com/creatives/<id>-desktop.png",
    "mobileUrl": "https://iw-crew-m-c4b9.insurwreck.com/creatives/<id>-mobile.png"}
   ```
   Only call this after confirming the deploy succeeded and the URL is
   actually reachable (curl it, expect 200) — don't mark done on faith.

## 5. Report

End with a short plain-text summary: how many rows were in the queue, how
many you finished, how many you skipped and why (e.g. "cobranded but no
logo supplied"), and whether the deploy succeeded. This is read later from
a log file, not by a person watching live — be factual, not chatty.
