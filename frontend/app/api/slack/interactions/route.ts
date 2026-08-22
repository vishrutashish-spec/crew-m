import { NextResponse } from "next/server";

// A company-wide approval triggers a real send inline (see below) that can
// now take well over a minute once rate-limited against Resend's cap — give
// this route the same headroom as /api/campaign/send rather than risking the
// platform aborting the function mid-send because the caller's own timeout
// (n8n's HTTP node) gave up waiting first.
export const maxDuration = 300;

const BASE_URL = "https://iw-crew-m-c4b9.insurwreck.com";

interface InteractionRequest {
  actionId: string;
  campaignId: string;
  approverUserId: string;
  channel: string;
  messageTs?: string;
}

async function slackApi(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function POST(request: Request) {
  const { actionId, campaignId, approverUserId, channel, messageTs } =
    (await request.json()) as InteractionRequest;

  const token = process.env.SLACK_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const approved = actionId === "approve_campaign";
  const status = approved ? "approved" : "rejected";

  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/campaign_requests?id=eq.${encodeURIComponent(campaignId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status, approved_by: approverUserId }),
    }
  );
  const [row] = patchRes.ok ? await patchRes.json() : [null];

  // Approval is the gate for the real send — this is the only code path that
  // triggers it, and only once, right after the PMM clicks Approve.
  let sendResult: {
    ok: boolean; error?: string; messageId?: string; sentTo?: string;
    sentCount?: number; failedCount?: number;
  } | null = null;
  if (approved && row) {
    try {
      const res = await fetch(`${BASE_URL}/api/campaign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: campaignId,
          amName: row.am_name,
          accountName: row.account_name,
          campaignType: row.campaign_type,
          copy: { subject: row.subject, body: row.body },
          creative: { creativeUrl: row.creative_url, stub: row.creative_is_stub },
          sendTo: row.send_to ?? undefined,
        }),
      });
      sendResult = await res.json();
    } catch (err) {
      console.error("campaign/send call failed", err);
      sendResult = { ok: false, error: "send_request_failed" };
    }
  }

  // A multi-recipient send can partially fail (e.g. hitting the provider's
  // rate limit) while still reporting ok:true, since success only requires
  // one recipient to land — never let that read as an unqualified "sent".
  const hasFailures = Boolean(sendResult?.failedCount);
  const countsNote =
    sendResult?.sentCount !== undefined
      ? ` (${sendResult.sentCount} sent${hasFailures ? `, :warning: ${sendResult.failedCount} FAILED` : ""})`
      : "";

  const decisionText = approved
    ? sendResult?.ok
      ? `<@${approverUserId}> approved *${row?.campaign_name ?? campaignId}* — email sent to ${sendResult.sentTo}${countsNote}.`
      : `<@${approverUserId}> approved *${row?.campaign_name ?? campaignId}*, but the send failed (${sendResult?.error ?? "unknown error"}). Subject: ${row?.subject ?? ""}`
    : `<@${approverUserId}> rejected *${row?.campaign_name ?? campaignId}*.`;

  await slackApi(token, "chat.postMessage", {
    channel,
    thread_ts: messageTs,
    text: decisionText,
  });

  // Let the requesting AM know too, if we know where they asked from.
  if (row?.slack_channel) {
    await slackApi(token, "chat.postMessage", {
      channel: row.slack_channel,
      thread_ts: row.slack_thread_ts || undefined,
      text: approved
        ? sendResult?.ok
          ? `Your ${row.campaign_type} campaign for ${row.account_name} was approved and the email has gone out${countsNote}.`
          : `Your ${row.campaign_type} campaign for ${row.account_name} was approved, but sending it failed — PMM has been notified.`
        : `Your ${row.campaign_type} campaign for ${row.account_name} was not approved this time. Ping the PMM channel if you want details.`,
    });
  }

  return NextResponse.json({ ok: true, status, sendResult });
}
