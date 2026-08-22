import { NextResponse } from "next/server";

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

  const decisionText = approved
    ? `<@${approverUserId}> approved *${row?.campaign_name ?? campaignId}*. Paste this into CleverTap to build the real draft:\n\n*Subject:* ${row?.subject ?? ""}\n*Body:*\n${row?.body ?? ""}\n\n*Suggested audience:* ${row?.segment_suggestion ?? ""}`
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
        ? `Your ${row.campaign_type} campaign for ${row.account_name} was approved — PMM is building the real draft in CleverTap now.`
        : `Your ${row.campaign_type} campaign for ${row.account_name} was not approved this time. Ping the PMM channel if you want details.`,
    });
  }

  return NextResponse.json({ ok: true, status });
}
