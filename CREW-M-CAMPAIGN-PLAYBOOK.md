# Crew M — Campaign Email Playbook

What the AM campaign pipeline actually does, and the things that bit us
building it. Companion to `EMAIL-DESIGN-PLAYBOOK.md`, which covers the Figma
side. Written 2026-08-22.

---

## 1. The pipeline

```
/crew-m in Slack
  -> n8n  iw-crew-m-c4b9 · AM campaign request → CleverTap draft
  -> POST /api/copy            body copy
  -> POST /api/creative        header creative (or queues one)
  -> POST /api/campaign/draft  assembles a brief
  -> POST /api/campaign/send   assembles the HTML and SENDS
  -> POST /api/slack/reply     posts the result back
```

Modal block/action ids are a contract with the n8n **Extract Campaign Fields**
node. Renaming one silently breaks the submission handler:

| Modal | n8n reads |
|---|---|
| `am_name_block.am_name_input` | `amName` |
| `account_block.account_input` | `accountName` |
| `campaign_type_block.campaign_type_select` | `campaignType` |
| `logo_block.logo_upload.files[0]` | `logoFileId`, `logoUrl` |

`file_input` **is** supported in modals — it needs the `files:read` scope,
which the app has. An earlier note claiming it is Workflow Builder only was
wrong. To validate a view without a real trigger, POST it to `views.open`
with a dummy `trigger_id`: `invalid_trigger_id` means the view is fine,
`invalid_arguments` means it is not.

**Slack app scopes needed**: `commands` (the slash command itself),
`chat:write` (post replies), `chat:write.public` (post into public channels
the bot hasn't been invited to — this scope does **not** cover DMs), and
`files:read` (the logo upload). Missing `chat:write.public` is the usual
cause of `not_in_channel` on the reply step; see the DM fallback below.

---

## 2. Sending

**Sends go through Resend, not CleverTap.** The reachable CleverTap account is
shared, live, and organizer-marked read-only precisely because a campaign
there emails real members. Two further CleverTap facts, both verified:

- There is **no draft API**. `when` accepts only `"now"` or a send datetime;
  `estimate_only` returns a reach number and persists nothing.
- Exact profile-field targeting through the API fails with
  `Invalid profile field: null` for every field tried, including
  `warehouse_production_email`, which works correctly in the dashboard. The
  UI and API disagree.

**The recipient is pinned in code.** `ONLY_RECIPIENT` in
`app/api/campaign/send/route.ts` is a module constant, not a request field or
env var, so no payload, Slack submission or bad segment can redirect a send.
Verified by attempting overrides via `to`, `recipient` and `ONLY_RECIPIENT`
keys — all ignored.

---

## 3. Asset hosting — do not move this back

Email images live in a **separate Vercel project**
(`iw-crew-m-email-assets`), not in `frontend/public`.

They were in the app, and kept 404-ing. Teammates deploy this project from
their own local trees; any deploy from a tree without the asset files
replaces production and breaks every image in every email already sent.
Pushing to GitHub does not fix it — a teammate deploying from a stale local
checkout still wins. The separate project is outside the app's deploy cycle.

Update it by redeploying that folder, not this one.

---

## 3.1 Creative queue — the unattended path

`/api/creative` can't always produce a header inline: a co-branded request
that needs a fresh Figma clone gets written to a queue instead of blocking
the Slack response. That queue is drained by
`scripts/run-creative-queue.sh`, run on a short interval outside the app
(originally via launchd), which shells out to
`claude -p "$(cat scripts/process-creative-queue.md)" --permission-mode
bypassPermissions --max-budget-usd 1` and logs each run to
`logs/creative-queue-<timestamp>.log` (see `logs/run-history.log` for the
run index).

`scripts/process-creative-queue.md` is the actual job spec, written for an
unattended agent with no human watching, so it's deliberately conservative:
fetch pending rows from
`POST workflow-stg.plumhq.com/webhook/iw-crew-m-c4b9-creative-queue-manage`
(`{"action": "get_pending"}`), re-read `EMAIL-DESIGN-PLAYBOOK.md` in full
every run because node IDs shift between sessions, **only clone Figma
frames, never edit the originals**, and skip (don't fail) any co-branded row
that's missing a `logoUrl` rather than guessing a logo. Scope is the header
image only — footers are fixed shared artwork and are never touched by this
job.

## 3.2 Per-account creative precedence

`ACCOUNT_CREATIVES` in `send/route.ts` holds bespoke header pairs keyed
`"<account>|<welcome|renewal>"` (e.g. `"groww|renewal"`,
`"open financial|welcome"`). Resolution order when assembling a send:

1. A creative passed in on the request itself (from the pipeline / queue)
2. `ACCOUNT_CREATIVES[accountName|campaignType]`
3. `GENERIC_HEADERS[campaignType]` — the unbranded fallback, and the reason
   a missing bespoke creative never blocks a send, only degrades it.

---

## 4. Email structure

Source of truth: the Open Financial production email. Sections, in order:

1. Opening naming the company and the partnership
2. Insurer paragraph
3. `Here's when it starts:` + date
4. `Here's what you need to know:` bullets
5. `Note:` claiming for treatment before the start date
6. `Next steps:` enrollment invite
7. `More updates to follow, stay tuned!`
8. `Here's what you're covered for:` card block
9. `Health Insurance Benefits for <years>:` limits
10. Line pointing at the Plum app for full detail
11. `Reaching out to Plum:` support block
12. Short closing

**Subject template**, identical for welcome and renewal:
`Welcome to Your <YYYY-YY> Health Benefits 🎉<Company><> Plum`

**Sum insured is written as `Graded` and nothing else.** Never list per-grade
amounts — a whole organisation reads the email and grades differ per person.

**Layout:** the CTA must not be the last thing before the footer. The support
section and closing render *below* the button.

**Facts are a hardcoded snapshot, not a live query.** `frontend/lib/
account-facts.ts` covers exactly three accounts (Open Financial, Groww,
Prochant) read by hand from the warehouse, not fetched at request time. The
reason it isn't live: `policy_schedule` (dataset 19251) has the richer
fields — maternity, copay, TPA — but the data API exposes it with no org
filter, so a single account's row can't be pulled from it; `iw_policy_si`
(dataset 19648) is filterable but doesn't carry those fields. If an account
is missing from the file, `/api/copy` writes the correct structure but
omits the specifics rather than inventing them — a wrong sum insured is
worse than a vague one. Adding a fourth account means reading the warehouse
by hand again, the same way the first three were done.

---

## 5. HRA adoption campaign

Different from welcome/renewal — it does **not** use the section order above.

- Banners: Figma `160:620` desktop (1023x507), `160:638` mobile (514x721).
  Both single-brand with no partner logo slot, by design — this is the
  documented exception to the client-logo rule in
  `EMAIL-DESIGN-PLAYBOOK.md` §7, stated there too. The test is simply whether
  a template contains a `Logo Co branding Unit`: HRA's do not, so there is
  nothing to fill and no lockup should be grafted on.
- Body: nine hand-written narratives in `frontend/lib/hra-narratives.ts`,
  used **verbatim**. This path never calls the copy model — they are
  deliberate marketing copy and regenerating them flattens the voice.
- CTA `Take your health assessment` -> `deeplink.plumhq.com/home?screen=hra`
- Footer app link -> `plumhq.app.link`

---

## 6. Things that bit us

**Use the template's type scale.** Do not invent font sizes. Mobile heading
49.59 / subtext 20.55; desktop 40 / 18. When a headline looks oversized the
fix is usually that the subtext was never set, not that the heading is wrong.

**Extended thinking eats `max_tokens`.** A 1024 budget can be spent entirely
on the thinking block, returning no text at all and shipping an empty email.
Use 4096, and find the text block by `type === "text"` rather than taking
`content[0]`.

**Validate generated copy before sending.** A bad run shipped a 6-word email.
`/api/copy` and `/api/campaign/send` both enforce a word floor — 150 for
model-written copy, 12 for HRA, whose minimalist narrative is 24 words.

**These links render blank**, because both are JavaScript interstitials:
`plumhq.app.link` (Branch) and `deeplink.plumhq.com/*`. They resolve on
mobile. The App Store / Play Store URLs are
`apps.apple.com/app/id1616851078` and
`play.google.com/store/apps/details?id=com.plumhq.employee.production`.

HRA is a deliberate, narrow exception to that rule for its footer link only
(the AM specified `plumhq.app.link` by name for HRA) — welcome/renewal keeps
the store link. Adding the HRA case once silently overwrote the single
shared `APP_DOWNLOAD` constant for every campaign type, quietly reverting
the blank-link fix for welcome/renewal. Fixed by splitting it into
`APP_DOWNLOAD_HRA` and `APP_DOWNLOAD_DEFAULT` in `send/route.ts`, picked by
`isHra`. **Any future per-campaign-type override needs its own constant —
never repoint the shared one.**

**A Slack DM reply needs the fallback path, not just the scope.** Even with
`chat:write.public`, `chat.postMessage` to the original channel can come
back `channel_not_found` or `not_in_channel` (that scope covers public
channels the bot hasn't joined, not DMs). `/api/slack/reply` catches those
two errors plus `no_channel` and retries with the requester's own user id
as `channel` — Slack opens the IM automatically. Silently swallowing the
first failure would mean the AM never learns their campaign sent.

**Design for blocked images.** Every major client blocks remote images by
default and Gmail strips base64, so there is no way to force them. The
headline, subtext and co-branding lockup are all baked into the header PNG,
so that image needs real `alt` text or the top of the email is empty. Put
background colours behind image cells so a blocked image is a tinted band,
not a white void.

**Do not add a text footer alongside the artwork.** The footer image already
ends with a dark plum band and the Plum wordmark; duplicating either looks
broken.

**Delete before you clone in Figma.** Every retry otherwise leaves an
orphaned frame in a shared team file.

**Re-verify Figma node ids each session.** The footers moved from
`1:738`/`1:784` to `104:445`/`104:408` with different dimensions, and a
co-branded family desktop banner (`110:548`) existed while a name-based
search said it did not.
