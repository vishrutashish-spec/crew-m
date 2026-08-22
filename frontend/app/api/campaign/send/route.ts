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

const ASSETS = "https://iw-crew-m-c4b9.insurwreck.com/email-assets";
const FOOTER_DESKTOP = `${ASSETS}/footer-desktop-v2.png`;
const FOOTER_MOBILE = `${ASSETS}/footer-mobile-v2.png`;
const BENEFITS_DEEPLINK = "https://deeplink.plumhq.com/benefits";
const APP_DOWNLOAD = "https://plumhq.app.link";

interface SendRequest {
  requestId?: string;
  amName?: string;
  accountName?: string;
  campaignType?: string;
  copy?: { subject?: string; body?: string };
  creative?: { creativeUrl?: string; mobileCreativeUrl?: string; stub?: boolean };
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

function buildHtml(opts: {
  subject: string; body: string;
  desktopHeader?: string; mobileHeader?: string;
}) {
  const { body, desktopHeader, mobileHeader } = opts;
  const header = (src: string, cls: string, extra: string) => `
  <div class="${cls}"${extra}>
    <a href="${BENEFITS_DEEPLINK}" style="display:block;">
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
${bodyToHtml(body)}
</td></tr>

<tr><td class="cta" align="center" style="padding:8px 40px 28px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="#571541" style="border-radius:8px;">
<a href="${BENEFITS_DEEPLINK}" style="display:inline-block; padding:11px 22px; font-family:Inter, Helvetica, Arial, sans-serif; font-size:15px; font-weight:600; line-height:1.4; color:#FFFFFF; text-decoration:none; border-radius:8px;">See what your plan covers</a>
</td></tr></table>
</td></tr>

<tr><td style="padding:0; font-size:0; line-height:0;">
  <div class="desktop-only">
    <a href="${APP_DOWNLOAD}" style="display:block;">
      <img src="${FOOTER_DESKTOP}" alt="Download the Plum app" style="display:block; width:100%; height:auto; border:0;">
    </a>
  </div>
  <div class="mobile-only" style="display:none; max-height:0; overflow:hidden;">
    <a href="${APP_DOWNLOAD}" style="display:block;">
      <img src="${FOOTER_MOBILE}" alt="Download the Plum app" style="display:block; width:100%; height:auto; border:0;">
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

export async function POST(request: Request) {
  const { requestId, accountName, campaignType, copy, creative } =
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

  const html = buildHtml({
    subject,
    body,
    desktopHeader: creative?.stub ? undefined : creative?.creativeUrl,
    mobileHeader: creative?.stub ? undefined : (creative?.mobileCreativeUrl ?? creative?.creativeUrl),
  });

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
  });
}
