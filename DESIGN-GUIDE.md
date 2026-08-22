# Email Design Guide — Crew M

Owner: Oshin · Companions: CleverTap guide (Vishrut), Copy guide (Kritin)

This is the guide Claude follows when generating email collateral. Sections
marked **[FILL]** are the ones that need your input — everything else is
already confirmed from the Figma file.

---

## 1. Source files (confirmed)

| What | Figma file | Key |
|---|---|---|
| Email templates | Figma Training Doc | `3J4g2wdTGz5IGrb9tjECGt` |
| Colour system + illustrations | Daydream Illustrations | `bw1UDCiKdbwR7MLFqUPbdv` |

Both are in the **Plum product** team, which is what makes MCP access work.
Files in a Free-plan team are rate-limited and cannot be read.

---

## 2. Email structure (confirmed — do not change)

```
Header image  (desktop + mobile variants)
Text
Button
Footer
```

**Locked:** layout. Position of text, subtext, image, and the background
placeholder all stay exactly as the template has them.

**Changes per email:** the header title and subheading, so the header reads in
sync with the body copy. Never leave the template's placeholder copy in place.

---

## 3. Use cases → template

| Use case | Template frame | Notes |
|---|---|---|
| Welcome | Welcome Emails Headers | node `1:195` |
| Renewal | Welcome Emails Headers | same template as Welcome; only copy differs |
| Adoption | Adoption Emails Headers | mobile screen changes per use case |

For Adoption, the template uses **Health Checkup** as its worked example.
Other use cases will each need their own mobile screen. **Scope for now:
Health Checkup only.**

---

## 4. Colour

### Approved email palette (confirmed)

These are the six "(Recommended) Colours" swatches in the Training Doc, with
their real Daydream token names:

| Swatch | Token |
|---|---|
| Pink | `Rose/150` |
| Salmon | `Red/150` |
| Lavender | `Lavender/150` |
| Mint | `Teal/200` |
| Lime | `Guava/150` |
| Peach | `Orange/150` |

> Note: five sit at step **150**, but Mint is **Teal/200**. Intentional (150
> too pale?) or a slip? **[FILL]**

### The mapping — colour follows the CLIENT'S LOGO

**Decided (supersedes the earlier "email type drives colour" rule):** pick the
approved swatch that most resembles the client's own logo colour. Same client
gets a consistent colour across all their emails; variety comes from the
client mix, not the email type.

Implementation: extract the dominant colour from the client's logo, snap to the
nearest approved swatch.

### The real palette: 8 header modules (`02_doc`) — RESOLVED

The snap target is **not** the six-swatch row — it is the eight `02_doc`
header modules. Blue **is** available. Confirmed order as laid out in Figma:

| # | Colour |
|---|---|
| 1 | Blue / cyan |
| 2 | Mint / green |
| 3 | Lime |
| 4 | Pink / magenta |
| 5 | Coral / orange |
| 6 | Salmon / red |
| 7 | Yellow / amber |
| 8 | Lavender / purple |

Module spec (from the file): **217 × 192**, corner radius **17.55**, fill is a
**radial gradient** — not a flat colour. So matching a logo means matching to
a gradient, and the exact stops must be read per module at generation time.

Note: the "(Recommended) Colours" row shows only six swatches and omits blue
and yellow. Treat the eight modules as the source of truth; the six-swatch row
appears to be a subset or stale. **[CONFIRM]**

### Colour rules **[FILL]**

- Families that are **off-limits** for email:
  _(Daydream has 14 — Reds, Roses, Apples, Grapes, Vision, Lavender, Blues,
  Teals, Guavas, Lemons, Mangoes, Oranges, Beige, Greys. Assume Greys is out;
  confirm the rest.)_
- Default when an email doesn't fit the three types above:
- May the same colour repeat back-to-back for one client? yes / no:

---

## 5. Illustrations (confirmed)

Eight available, already named by topic — these map themselves:

Health Insurance · Personal Accident Insurance · Term Life Insurance ·
Plum Telehealth · Mental Health · Cultpass benefits · Health Checkup ·
In App Support

**[FILL]** What to do when an email's topic isn't one of these eight:

---

## 6. Button (confirmed)

- Pick from the **All Email Buttons** frame — do not draw a new one.
- Copy changes to match the email; **3–5 words**.
- **Do not change the button colour** unless explicitly asked. Other colour
  options exist in the frame if needed.
- Sits towards the **end of the body**.

---

## 7. Footer (confirmed)

From the **All Email Footers** frame. Desktop and mobile variants exist.
Contains: "Download the Plum app" block with QR code, Plum wordmark, social
icons (LinkedIn / X / Instagram), and an unsubscribe line.

**[FILL]** Is the unsubscribe line mandatory on every send, or does CleverTap
inject its own?

---

## 8. Typography

### What is baked into the PNG vs live text — CONFIRMED

Verified against a real production welcome email (Open Financial, 21 Aug 2026).
The PDF text layer contained the body copy but **not** the header headline,
which proves:

| Element | Rendering |
|---|---|
| Header headline + subheading | **Baked into the PNG** |
| Logo lockup | Baked into the PNG |
| Body copy, bullets | **Live HTML text** |
| Section headings (e.g. "Here's what you're covered for") | **Live HTML text** |
| Illustration cards | Images |
| Button | Image (from All Email Buttons) |
| Footer | Image + live unsubscribe link |

Consequences:
- Header type can use any font — it is pixels by the time it ships.
- Section headings and body **cannot**. They need a web-safe fallback stack.
- Body copy in production is **plum/purple, not black**.

### Fonts — RESOLVED

| Role | Face | Class |
|---|---|---|
| Headlines | **GT Alpina** | Serif |
| Body | **Inter** | Sans |
| Occasional | Times New Roman | Serif |

Fallbacks are split by role — one stack per class, never one stack for both:

```css
/* Headlines — GT Alpina is a serif, so Times New Roman is a correct fallback */
font-family: "GT Alpina", "Times New Roman", Georgia, serif;

/* Body — Inter is a sans; must NOT fall back to Times New Roman */
font-family: Inter, Helvetica, Arial, sans-serif;
```

This identifies the `Typography/Family/Serif` style found on the adoption
template headings: that is GT Alpina.

Supersedes: the Plum *web* design system's Bricolage Grotesque, and the
Passenger Sans seen in Daydream (that is the Daydream doc's own labelling, not
the email spec).

### ⚠️ GT Alpina will not load in email

GT Alpina is a licensed Grilli Type face and is not on Google Fonts. Email
clients effectively never load it — Gmail strips web fonts, Outlook desktop
never loads them. Practical consequence:

**Any GT Alpina heading left as live text renders as Times New Roman for
almost every recipient.**

So the rule is:

- A heading that **must** look like GT Alpina → **bake it into the PNG**.
- A heading left as live text → accept it will be Times New Roman in the wild.

Note: the live serif headings in the middle of the adoption email (e.g. "What
do you get on the other side?") are therefore very likely already rendering as
Times New Roman in production rather than GT Alpina. Worth checking whether
that is intended. **[CONFIRM]**

---

## 8b. Welcome emails — DECIDED

**Target design: Figma template layout + colour system, with a co-branded
client logo lockup added to the header.**

This is an explicit, sanctioned exception to the "do not change the layout"
rule in section 2 — the logo lockup is an addition Oshin approved. No other
layout change is permitted.

### Client logo — source and its risks

**Decision:** logo is sourced from the internet, based on the client name the
Account Manager provides.

Tested 2026-08-21, and this needs care:

| Route | Result |
|---|---|
| Clearbit logo API | **Dead** — retired post-HubSpot acquisition, HTTP 000 |
| Google favicon service | Partial — worked for atlassian.com, razorpay.com; 404 for two guessed domains |

Two known problems:

1. **Favicons are not wordmarks.** They return a ~1KB square icon mark. The
   production lockup uses the client's full wordmark. A favicon is not a
   substitute.
2. **Name → domain guessing is unreliable.** "Capillary Technologies India
   Limited" is not `capillarytech.com`. A wrong guess fetches *another
   company's logo* into a client-facing email.

**Decided: the AM supplies the client's website.** The Slack request must
capture the client's website URL alongside the name — the logo lookup is
driven off the domain, never off the name alone.

Not using the warehouse-email-domain route, so no PII is touched for this.

**Required regardless:** the review card must display the fetched logo so the
AM approves it before send. Never auto-send an externally fetched logo.

### Production reference vs the template

For reference, the current production welcome email differs from the template
as follows (we are moving to the template, per the decision above):

| | Production | Figma template |
|---|---|---|
| Header background | Dark plum / maroon | Light cream + pastel band |
| Header type | Bold sans, white | Serif, dark plum |
| Logo | Co-branded `plum │ Client` | Plum only |
| Illustration | Group cheering + yellow asterisk | Phone mock |
| CTA button | None | Required, near end of body |
| Footer | App Store + Play badges, colour social, © line | QR code, mono social |

**Which is the target?** These produce entirely different PNGs.

**Client logo source?** Every welcome email is co-branded, and the subject line
follows `<Client> <> Plum`. No client logos exist in the Training Doc or
Daydream.

### Content structure of a production welcome email (observed)

1. Header image (co-branded, "Welcome back!" + one-line subheading)
2. Intro — partnership renewed, named client in bold
3. Insurer paragraph
4. "Here's when it starts:" — coverage start date
5. "Here's what you need to know:" — bullets (health cards, helpline, cashless
   vs reimbursement)
6. "Note:" — claims incurred before the new policy date
7. "Next steps:" — enrollment invite
8. "Here's what you're covered for" — illustration card + policy summary
   (Sum Insured, Family definition, Insurer, TPA, Start Date)
9. "Health Insurance Benefits for <year>" — benefit limits as bullets
10. "Reaching out to Plum" — illustration card + support channels
11. Footer

### These fields are all live warehouse data

Nearly the whole email is per-org policy data already reachable through the
`insurwreck-data` MCP server:

| Email field | Source |
|---|---|
| Client / org name | `account_health.org`, `iw_policy_si.org_name` |
| Insurer | `iw_policy_si.insurer` |
| TPA | `policy_schedule.tpa` |
| Sum Insured | `policy_schedule.grade_sum_insured` |
| Coverage start date | `policy_schedule.inception_date` |
| Maternity limits | `policy_schedule.maternity_limit_normal` / `_caesarean` |
| Renewal date | `policy_schedule.expiration_date` |

So a welcome email can be generated per-org from real data rather than
hand-assembled. Fields with no warehouse equivalent (ambulance cap, LASIK,
Ayush, family definition wording) need a source. **[FILL]**

---

## 9. Output

Deliverable is **PNGs** exported from these templates, handed to CleverTap to
sync. Both desktop and mobile header variants per email.

**Export size: 1x** (native frame size, no @2x). Confirmed.

Reference sizes at 1x:

| Asset | Size |
|---|---|
| Header — desktop | 944 × 422 |
| Header — mobile | 514 × 828 |
| Footer — desktop | 600 × 325 |
| Footer — mobile | 376 × 214 |
| CTA button | hugs text (~223 × 34) |

### Gotcha: newly-created images lag the server-side renderer

Images added via the Figma API render correctly on the live canvas but come
back **blank** from server-side PNG export for a while. Always eyeball the
frame in Figma before trusting an exported PNG that contains a new image.
