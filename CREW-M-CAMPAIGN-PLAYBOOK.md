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
