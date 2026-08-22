import { NextResponse } from "next/server";
import { PLUM_STAFF_EMAILS } from "@/lib/plum-staff-emails";

/**
 * Default recipient when a request doesn't specify one. This is the
 * fallback, not a hard lock — a caller can now name an explicit recipient
 * (a single test address, or "everyone at Plum") via `sendTo`. The
 * reasoning for keeping a safe default still applies: the CleverTap account
 * this project can reach is a shared, live engagement account, so a
 * malformed payload that omits `sendTo` entirely must still land somewhere
 * safe rather than erroring in a way that could get worked around toward a
 * real member. Explicit intent (typed by a human in Slack) now overrides
 * this; silence does not.
 */
const DEFAULT_RECIPIENT = "oshin.sharma@plumhq.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SendTo {
  mode?: "default" | "single" | "all_plum_staff";
  email?: string;
}

/** Resolve who a send actually goes to. Throws rather than guessing on anything malformed. */
function resolveRecipients(sendTo: SendTo | undefined): { recipients: string[]; label: string } {
  const mode = sendTo?.mode ?? "default";

  if (mode === "single") {
    const email = (sendTo?.email ?? "").trim();
    if (!EMAIL_RE.test(email)) throw new Error(`invalid_recipient_email: "${email}"`);
    return { recipients: [email], label: `test send to ${email}` };
  }

  if (mode === "all_plum_staff") {
    const recipients = PLUM_STAFF_EMAILS.filter((e) => EMAIL_RE.test(e));
    if (recipients.length === 0) throw new Error("plum_staff_list_empty");
    // Sanity valve: this is a static list, so it can't balloon on its own,
    // but a bad edit (e.g. pasting in a segment export by mistake) still
    // shouldn't be able to silently mail thousands of addresses.
    if (recipients.length > 2000) throw new Error(`plum_staff_list_too_large: ${recipients.length}`);
    return { recipients, label: `everyone at Plum (${recipients.length} address${recipients.length === 1 ? "" : "es"})` };
  }

  return { recipients: [DEFAULT_RECIPIENT], label: `default (${DEFAULT_RECIPIENT})` };
}

/**
 * Email images are hosted in a SEPARATE Vercel project, not in this app.
 *
 * They lived in frontend/public/email-assets and kept 404-ing: teammates
 * deploy this project from their own local trees, and any deploy from a tree
 * without those files silently replaces production and breaks every image in
 * every email already sent. Pushing to GitHub did not fix it, because a
 * teammate deploying from a stale local checkout still wins.
 *
 * The assets project is deployed independently and nothing in the app's deploy
 * cycle can touch it. Update it by redeploying that folder, not this one.
 */
const ASSETS = process.env.EMAIL_ASSETS_BASE ?? "https://iw-crew-m-email-assets.vercel.app";
const FOOTER_DESKTOP = `${ASSETS}/footer-desktop-v2.png`;
const FOOTER_MOBILE = `${ASSETS}/footer-mobile-v2.png`;
const BENEFITS_DEEPLINK = "https://deeplink.plumhq.com/benefits";

/**
 * Deeplink table from CLEVERTAP_CAMPAIGN_SETUP_SKILL.md §1, matched against
 * the campaign type so a Health Checkup / Telehealth nudge sends people to
 * the right in-app screen instead of the generic benefits page.
 */
const PRODUCT_DEEPLINKS: Array<{ match: RegExp; url: string }> = [
  { match: /\bhra\b|health\s*risk\s*assessment/i, url: "https://deeplink.plumhq.com/home?screen=hra" },
  { match: /health\s*-?\s*check\s*-?up|\bhc\b/i, url: "https://deeplink.plumhq.com/home?screen=hc" },
  { match: /tele\s*-?\s*health|\bth\b|doctor\s*consult|teleconsult/i, url: "https://deeplink.plumhq.com/care" },
];

function deeplinkFor(campaignType: string) {
  return PRODUCT_DEEPLINKS.find((p) => p.match.test(campaignType))?.url ?? BENEFITS_DEEPLINK;
}

/**
 * Generic single-brand headers, one pair per campaign type. Used when an
 * account has no bespoke creative built yet, so the email still ships a real
 * branded banner instead of no header at all. The bespoke (co-branded,
 * per-account) creative replaces these once the Figma agent builds it.
 * Copy baked into these matches the queue prompt's generic wording.
 */
/**
 * Per-account co-branded creatives, keyed `account|campaignType`. These carry
 * the client logo in the co-branding slot, so they beat the generic headers.
 * Built through the Figma pipeline and composited locally (Figma image fills
 * never reach a server-side export), then pixel-verified before shipping.
 */
const ACCOUNT_CREATIVES: Record<string, { desktop: string; mobile: string }> = {
  "prochant|renewal": {
    desktop: `${ASSETS}/prochant-header-desktop-family.png`,
    mobile: `${ASSETS}/prochant-header-mobile-family.png`,
  },
  "groww|welcome": {
    desktop: `${ASSETS}/groww-welcome-desktop.png`,
    mobile: `${ASSETS}/groww-welcome-mobile.png`,
  },
  "open financial|welcome": {
    desktop: `${ASSETS}/openfinancial-welcome-desktop.png`,
    mobile: `${ASSETS}/openfinancial-welcome-mobile.png`,
  },
  "open financial|renewal": {
    desktop: `${ASSETS}/openfinancial-renewal-desktop.png`,
    mobile: `${ASSETS}/openfinancial-renewal-mobile.png`,
  },
  "groww|renewal": {
    desktop: `${ASSETS}/groww-renewal-desktop.png`,
    mobile: `${ASSETS}/groww-renewal-mobile.png`,
  },
};

const GENERIC_HEADERS: Record<string, { desktop: string; mobile: string }> = {
  // HRA is a Plum product campaign, not client co-branded - these templates
  // (Figma 160:620 / 160:638) have no partner logo slot by design.
  hra: {
    desktop: `${ASSETS}/hra-desktop.png`,
    mobile: `${ASSETS}/hra-mobile.png`,
  },
  welcome: {
    desktop: `${ASSETS}/generic-welcome-desktop.png`,
    mobile: `${ASSETS}/generic-welcome-mobile.png`,
  },
  renewal: {
    desktop: `${ASSETS}/generic-renewal-desktop.png`,
    mobile: `${ASSETS}/generic-renewal-mobile.png`,
  },
};
// plumhq.app.link and deeplink.plumhq.com are JS interstitials that render
// blank in several mail clients (confirmed 2026-08-22). Welcome/renewal link
// the store directly, exactly as the production Open Financial email does.
// HRA is the one deliberate exception - the AM gave plumhq.app.link by name
// for that footer, so it keeps the Branch link instead.
const APP_DOWNLOAD_DEFAULT = "https://play.google.com/store/apps/details?id=com.plumhq.employee.production";
const APP_DOWNLOAD_HRA = "https://plumhq.app.link";

interface SendRequest {
  requestId?: string;
  amName?: string;
  accountName?: string;
  campaignType?: string;
  copy?: { subject?: string; body?: string };
  creative?: { creativeUrl?: string; mobileCreativeUrl?: string; stub?: boolean };
  /** Return the assembled HTML without sending. Never sends. */
  preview?: boolean;
  /** Who this actually goes to. Omit for the safe default. */
  sendTo?: SendTo;
  /**
   * Send `copy` as a plain message with no banner, CTA or app footer.
   *
   * For deliverability/reach tests. The branded assembly below is built to
   * look like a real Plum benefits campaign, which is exactly wrong for a
   * test blast — recipients would read a test as a genuine health comms.
   * Plain mode also skips the failed-generation word floor, since a test
   * body is legitimately short.
   */
  plain?: boolean;
}

function buildPlainHtml(subject: string, body: string) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0; padding:24px; background-color:#FFFFFF; font-family:Inter, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#1A1A1A;">
<div style="max-width:600px; margin:0 auto;">
${paragraphs}
</div>
</body>
</html>`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Turn the model's plain-text body into email-safe HTML. */
function bodyToHtml(body: string) {
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        `<ul style="margin:0 0 24px 0; padding-left:22px;">${list
          .map((li) => `<li style="margin-bottom:8px;">${esc(li)}</li>`)
          .join("")}</ul>`
      );
      list = [];
    }
  };
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("- ")) { list.push(line.slice(2)); continue; }
    flush();
    const bold = line.endsWith(":") && line.length < 60;
    out.push(
      `<p style="margin:0 0 ${bold ? 8 : 16}px 0;${bold ? "font-weight:600;" : ""}">${esc(line)}</p>`
    );
  }
  flush();
  return out.join("\n");
}


/**
 * The CTA should not be the last thing before the footer. Split the body so a
 * closing section (in practice "Reaching out to Plum") renders BELOW the
 * button. Falls back to putting everything above if no such heading exists.
 */
function splitAtClosingSection(body: string): { above: string; below: string } {
  const lines = body.split("\n");
  const idx = lines.findIndex((l) =>
    /^\s*(reaching out to plum|reaching us)\s*:?\s*$/i.test(l)
  );
  if (idx === -1) return { above: body, below: "" };
  return {
    above: lines.slice(0, idx).join("\n").trimEnd(),
    below: lines.slice(idx).join("\n").trim(),
  };
}

function buildHtml(opts: {
  subject: string; body: string;
  desktopHeader?: string; mobileHeader?: string;
  deeplink: string;
  headerAlt?: string;
  ctaLabel: string;
  appDownload: string;
}) {
  const { body, desktopHeader, mobileHeader, deeplink, headerAlt, ctaLabel, appDownload } = opts;
  const { above, below } = splitAtClosingSection(body);
  // Headline, subtext and the co-branding lockup are all baked into this PNG
  // (deliberate - GT Alpina cannot load as a webfont in email). So when a
  // client blocks remote images the entire top of the email is empty unless
  // the alt text carries the message. Styling the img makes that alt render
  // as intentional type, and the background stops it being a white void.
  const header = (src: string, cls: string, extra: string) => `
  <div class="${cls}"${extra}>
    <a href="${deeplink}" style="display:block;">
      <img src="${src}" alt="${esc(headerAlt ?? "")}"
           style="display:block; width:100%; height:auto; border:0; background-color:#F7F1EC;
                  font-family:Georgia, 'Times New Roman', serif; font-size:20px; line-height:1.5;
                  color:#3A0E2B; text-align:center;">
    </a>
  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(opts.subject)}</title>
<style>
  @media only screen and (max-width:600px) {
    .desktop-only { display:none !important; max-height:0 !important; overflow:hidden !important; mso-hide:all !important; }
    .mobile-only  { display:block !important; max-height:none !important; overflow:visible !important; }
    .body-pad     { padding-left:22px !important; padding-right:22px !important; }
    .cta a        { font-size:14px !important; padding:10px 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5F5F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#FFFFFF; border-radius:12px; overflow:hidden;">

<tr><td style="padding:0; font-size:0; line-height:0;">
${desktopHeader ? header(desktopHeader, "desktop-only", "") : ""}
${mobileHeader ? header(mobileHeader, "mobile-only", ` style="display:none; max-height:0; overflow:hidden;"`) : ""}
</td></tr>

<tr><td class="body-pad" style="padding:32px 40px 8px 40px; font-family:Inter, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#3A0E2B;">
${bodyToHtml(above)}
</td></tr>

<tr><td class="cta" align="center" style="padding:8px 40px 28px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="#571541" style="border-radius:8px;">
<a href="${deeplink}" style="display:inline-block; padding:11px 22px; font-family:Inter, Helvetica, Arial, sans-serif; font-size:15px; font-weight:600; line-height:1.4; color:#FFFFFF; text-decoration:none; border-radius:8px;">${ctaLabel}</a>
</td></tr></table>
</td></tr>

${below ? `<tr><td class="body-pad" style="padding:4px 40px 30px 40px; font-family:Inter, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#3A0E2B;">
${bodyToHtml(below)}
</td></tr>` : ""}

<tr><td style="padding:0; font-size:0; line-height:0;">
  <div class="desktop-only">
    <a href="${appDownload}" style="display:block;">
      <img src="${FOOTER_DESKTOP}" alt="Download the Plum app" style="display:block; width:100%; height:auto; border:0; background-color:#F7EEF3; font-family:Inter, Helvetica, Arial, sans-serif; font-size:14px; color:#3A0E2B; text-align:center;">
    </a>
  </div>
  <div class="mobile-only" style="display:none; max-height:0; overflow:hidden;">
    <a href="${appDownload}" style="display:block;">
      <img src="${FOOTER_MOBILE}" alt="Download the Plum app" style="display:block; width:100%; height:auto; border:0; background-color:#F7EEF3; font-family:Inter, Helvetica, Arial, sans-serif; font-size:14px; color:#3A0E2B; text-align:center;">
    </a>
  </div>
</td></tr>



</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;">
<tr><td align="center" style="padding:20px 40px; font-family:Inter, Helvetica, Arial, sans-serif; font-size:12px; line-height:1.5; color:#6B5A64;">
If you would like to stop receiving these emails, unsubscribe here.
</td></tr></table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * One Resend call per recipient rather than a shared `to` array — a
 * company-wide send must not expose everyone's address to everyone else.
 */
async function sendAll(
  recipients: string[],
  opts: { apiKey: string; from: string; subject: string; html: string }
): Promise<{ to: string; ok: boolean; messageId?: string; error?: string }[]> {
  const { apiKey, from, subject, html } = opts;
  return Promise.all(
    recipients.map(async (to) => {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            // Resend sits behind Cloudflare, which blocks some default UAs outright.
            "User-Agent": "crew-m/1.0 (+https://iw-crew-m-c4b9.insurwreck.com)",
          },
          body: JSON.stringify({ from, to: [to], subject, html }),
        });
        const text = await res.text();
        if (!res.ok) {
          console.error("Resend send failed for", to, res.status, text);
          return { to, ok: false, error: `send_failed_${res.status}` };
        }
        let id: string | undefined;
        try { id = JSON.parse(text).id; } catch { /* non-JSON success body */ }
        return { to, ok: true, messageId: id };
      } catch (err) {
        console.error("Resend request threw for", to, err);
        return { to, ok: false, error: "request_threw" };
      }
    })
  );
}

export async function POST(request: Request) {
  const { requestId, accountName, campaignType, copy, creative, preview, sendTo, plain } =
    (await request.json()) as SendRequest;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.error("RESEND_API_KEY / RESEND_FROM not set — cannot send");
    return NextResponse.json({ ok: false, error: "resend_not_configured" }, { status: 500 });
  }

  const typeKey = (campaignType ?? "").trim().toLowerCase();
  const subject = copy?.subject?.trim();
  const body = copy?.body?.trim();
  if (!subject || !body) {
    return NextResponse.json({ ok: false, error: "missing_copy" }, { status: 400 });
  }

  let recipients: string[];
  let recipientLabel: string;
  try {
    ({ recipients, label: recipientLabel } = resolveRecipients(sendTo));
  } catch (err) {
    console.error("recipient resolution failed", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }

  // Second gate, in case a caller assembles copy without going through
  // /api/copy: never send a body that is obviously a failed generation.
  // Plain sends opt out — a test body is legitimately short.
  const words = body.split(/\s+/).length;
  if (plain) {
    const plainHtml = buildPlainHtml(subject, body);
    if (preview) {
      return NextResponse.json({
        ok: true, preview: true, plain: true,
        wouldSendTo: recipientLabel, recipientCount: recipients.length,
        html: plainHtml,
      });
    }
    const plainResults = await sendAll(recipients, { apiKey, from, subject, html: plainHtml });
    const plainSent = plainResults.filter((r) => r.ok);
    const plainFailed = plainResults.filter((r) => !r.ok);
    if (plainSent.length === 0) {
      return NextResponse.json(
        { ok: false, error: "send_failed", recipientLabel, failed: plainFailed },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true, plain: true,
      messageId: plainSent[0].messageId,
      sentTo: recipientLabel,
      sentCount: plainSent.length,
      failedCount: plainFailed.length,
      failed: plainFailed.length ? plainFailed : undefined,
      requestId,
    });
  }
  // HRA narratives are deliberately short - the minimalist one is 24 words -
  // so the failed-generation floor only really applies to model-written copy.
  // Keep a low floor here purely to catch an empty body.
  const minWords = /^hra$/i.test(typeKey) ? 12 : 150;
  if (words < minWords) {
    console.error(`refusing to send ${accountName}: body is only ${words} words (min ${minWords})`);
    return NextResponse.json(
      { ok: false, error: "body_too_short", words, minimum: minWords },
      { status: 400 }
    );
  }

  // A bespoke creative wins; otherwise fall back to the generic header for
  // this campaign type so the email is never sent without a banner.
  // Header precedence: a creative passed in by the pipeline, then this
  // account's own co-branded creative, then the generic one for this campaign
  // type.
  const acctKey = `${(accountName ?? "").trim().toLowerCase()}|${typeKey}`;
  const account = ACCOUNT_CREATIVES[acctKey];
  // No bespoke or generic header exists yet for anything beyond welcome/
  // renewal (e.g. a Health Checkup nudge) — no Figma build has been run for
  // it. Per an explicit call to use only existing collateral rather than
  // ship no banner: borrow the "renewal" generic header, since its framing
  // (an existing, active member being re-engaged) fits an engagement nudge
  // far better than "welcome" (new-employee onboarding). This is a stand-in,
  // not a real fix — a bespoke banner should replace it via the Figma
  // pipeline in EMAIL-DESIGN-PLAYBOOK.md once one exists.
  const generic = GENERIC_HEADERS[typeKey] ?? GENERIC_HEADERS["renewal"];

  const passedIn = !creative?.stub && creative?.creativeUrl ? creative : null;
  const chosen = passedIn
    ? { desktop: passedIn.creativeUrl!, mobile: passedIn.mobileCreativeUrl ?? passedIn.creativeUrl! }
    : (account ?? generic);

  const headerUsed = passedIn
    ? "pipeline"
    : account
    ? `account:${acctKey}`
    : GENERIC_HEADERS[typeKey]
    ? `generic:${typeKey}`
    : `generic:renewal (borrowed, no header built for "${typeKey}")`;

  const deeplink = deeplinkFor(typeKey);

  // Carries the baked-in header message for clients that block images.
  const headerAlt = /^hra$/i.test(typeKey)
    ? "Meet your Health Risk Assessment. Answer a few questions and personalise your health journey."
    : `${typeKey === "renewal" ? "Welcome back!" : "Welcome to Plum!"} ${accountName ?? ""} and Plum. `
        .replace(/\s+/g, " ") + "Your health and wellness benefits are on their way.";

  const isHra = /^hra$/i.test(typeKey);
  const ctaLabel = isHra ? "Take your health assessment" : "See what your plan covers";

  const html = buildHtml({
    subject, body,
    desktopHeader: chosen?.desktop,
    mobileHeader: chosen?.mobile,
    deeplink,
    headerAlt,
    ctaLabel,
    appDownload: isHra ? APP_DOWNLOAD_HRA : APP_DOWNLOAD_DEFAULT,
  });

  if (preview) {
    return NextResponse.json({
      ok: true, preview: true, wouldSendTo: recipientLabel, recipientCount: recipients.length,
      imageCount: (html.match(/<img /g) ?? []).length,
      headerUsed,
      html,
    });
  }

  const results = await sendAll(recipients, { apiKey, from, subject, html });

  const sent = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  if (sent.length === 0) {
    return NextResponse.json(
      { ok: false, error: "send_failed", recipientLabel, failed },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: sent[0].messageId,
    sentTo: recipientLabel,
    sentCount: sent.length,
    failedCount: failed.length,
    failed: failed.length ? failed : undefined,
    requestId, accountName, campaignType,
    creativeWasStub: Boolean(creative?.stub),
    headerUsed,
  });
}
