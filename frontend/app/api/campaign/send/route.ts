import { NextResponse } from "next/server";

/**
 * HARD SAFETY RAIL — do not make this configurable.
 *
 * Every campaign this tool sends goes to this one address and nowhere else.
 * It is deliberately a module constant rather than a request field or an env
 * var: if the recipient cannot be supplied by the caller, no malformed
 * payload, prompt, Slack submission or misconfigured segment can redirect a
 * send at a real member. The CleverTap account this project can reach is a
 * shared, live engagement account, so a mistake there would email real
 * people; this route sends through Resend instead, which is a scoped
 * sending-only key, and pins the recipient here.
 */
const ONLY_RECIPIENT = "oshin.sharma@plumhq.com";

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
// blank in several mail clients (confirmed 2026-08-22). Link the stores
// directly, exactly as the production Open Financial email does.
const APP_STORE = "https://apps.apple.com/app/id1616851078";
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.plumhq.employee.production";

interface SendRequest {
  requestId?: string;
  amName?: string;
  accountName?: string;
  campaignType?: string;
  copy?: { subject?: string; body?: string };
  creative?: { creativeUrl?: string; mobileCreativeUrl?: string; stub?: boolean };
  /** Return the assembled HTML without sending. Never sends. */
  preview?: boolean;
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
}) {
  const { body, desktopHeader, mobileHeader, deeplink } = opts;
  const { above, below } = splitAtClosingSection(body);
  const header = (src: string, cls: string, extra: string) => `
  <div class="${cls}"${extra}>
    <a href="${deeplink}" style="display:block;">
      <img src="${src}" alt="" style="display:block; width:100%; height:auto; border:0;">
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
<a href="${deeplink}" style="display:inline-block; padding:11px 22px; font-family:Inter, Helvetica, Arial, sans-serif; font-size:15px; font-weight:600; line-height:1.4; color:#FFFFFF; text-decoration:none; border-radius:8px;">See what your plan covers</a>
</td></tr></table>
</td></tr>

${below ? `<tr><td class="body-pad" style="padding:4px 40px 30px 40px; font-family:Inter, Helvetica, Arial, sans-serif; font-size:16px; line-height:1.6; color:#3A0E2B;">
${bodyToHtml(below)}
</td></tr>` : ""}

<tr><td style="padding:0; font-size:0; line-height:0;">
  <div class="desktop-only">
    <a href="${PLAY_STORE}" style="display:block;">
      <img src="${FOOTER_DESKTOP}" alt="Download the Plum app" style="display:block; width:100%; height:auto; border:0;">
    </a>
  </div>
  <div class="mobile-only" style="display:none; max-height:0; overflow:hidden;">
    <a href="${PLAY_STORE}" style="display:block;">
      <img src="${FOOTER_MOBILE}" alt="Download the Plum app" style="display:block; width:100%; height:auto; border:0;">
    </a>
  </div>
</td></tr>

<tr><td align="center" bgcolor="#3A0E2B" style="padding:22px 40px; background-color:#3A0E2B; font-family:Inter, Helvetica, Arial, sans-serif; font-size:13px; line-height:1.6; color:#FFFFFF;">
<div style="font-size:20px; font-weight:700; letter-spacing:-0.4px; color:#FF5A5F; padding-bottom:10px;">plum</div>
<div style="color:#F0E4EC;">Download the Plum app:
<a href="${APP_STORE}" style="color:#FFFFFF; font-weight:600;">App Store</a>
&nbsp;·&nbsp;
<a href="${PLAY_STORE}" style="color:#FFFFFF; font-weight:600;">Google Play</a>
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

export async function POST(request: Request) {
  const { requestId, accountName, campaignType, copy, creative, preview } =
    (await request.json()) as SendRequest;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    console.error("RESEND_API_KEY / RESEND_FROM not set — cannot send");
    return NextResponse.json({ ok: false, error: "resend_not_configured" }, { status: 500 });
  }

  const subject = copy?.subject?.trim();
  const body = copy?.body?.trim();
  if (!subject || !body) {
    return NextResponse.json({ ok: false, error: "missing_copy" }, { status: 400 });
  }

  // A bespoke creative wins; otherwise fall back to the generic header for
  // this campaign type so the email is never sent without a banner.
  // Header precedence: a creative passed in by the pipeline, then this
  // account's own co-branded creative, then the generic one for this campaign
  // type.
  const typeKey = (campaignType ?? "").trim().toLowerCase();
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

  const html = buildHtml({
    subject, body,
    desktopHeader: chosen?.desktop,
    mobileHeader: chosen?.mobile,
    deeplink,
  });

  if (preview) {
    return NextResponse.json({
      ok: true, preview: true, wouldSendTo: ONLY_RECIPIENT,
      imageCount: (html.match(/<img /g) ?? []).length,
      headerUsed,
      html,
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Resend sits behind Cloudflare, which blocks some default UAs outright.
      "User-Agent": "crew-m/1.0 (+https://iw-crew-m-c4b9.insurwreck.com)",
    },
    body: JSON.stringify({ from, to: [ONLY_RECIPIENT], subject, html }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Resend send failed", res.status, text);
    return NextResponse.json({ ok: false, error: "send_failed", status: res.status }, { status: 502 });
  }

  let id: string | undefined;
  try { id = JSON.parse(text).id; } catch { /* non-JSON success body */ }

  return NextResponse.json({
    ok: true,
    messageId: id,
    sentTo: ONLY_RECIPIENT,
    requestId, accountName, campaignType,
    creativeWasStub: Boolean(creative?.stub),
    headerUsed,
  });
}
