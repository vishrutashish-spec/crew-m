import { NextResponse } from "next/server";

interface ReplyRequest {
  channel: string;
  amName: string;
  accountName: string;
  reviewUrl: string;
  summary: string;
}

export async function POST(request: Request) {
  const { channel, amName, accountName, reviewUrl, summary } =
    (await request.json()) as ReplyRequest;

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error("SLACK_BOT_TOKEN is not set — cannot reply in Slack");
    return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 500 });
  }

  if (!channel) {
    console.error("No Slack channel to reply to for", accountName, amName);
    return NextResponse.json({ ok: false, error: "missing_channel" }, { status: 400 });
  }

  const text = summary
    ? `${summary}\n\n<${reviewUrl}|Open CleverTap>`
    : `Campaign brief ready for ${accountName} (requested by ${amName}). <${reviewUrl}|Open CleverTap>`;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("chat.postMessage failed", data.error);
    return NextResponse.json({ ok: false, error: data.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
