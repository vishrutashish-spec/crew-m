import { NextResponse } from "next/server";

const BASE_URL = "https://iw-crew-m-c4b9.insurwreck.com";

interface ChatRequest {
  slackUser: string;
  slackChannel: string;
  threadTs?: string;
  text: string;
}

interface AgentReply {
  action: "reply" | "draft";
  text?: string;
  amName?: string;
  accountName?: string;
  campaignType?: string;
  logoUrl?: string;
}

const SYSTEM_PROMPT = `You are Crew M's campaign assistant, chatting with an Account Manager (AM) over Slack.

Your job: figure out (1) the AM's own name, (2) which client account they want a campaign for, and (3) whether it's a "welcome" or "renewal" campaign. A client logo URL is optional.

Ask short, direct questions — one at a time, not a list. Don't explain your reasoning. Don't use markdown headers.

Once you have the AM's name, the account name, and the campaign type, respond with ONLY this JSON (no other text):
{"action":"draft","amName":"...","accountName":"...","campaignType":"welcome|renewal","logoUrl":"..."}

Until then, respond with ONLY this JSON (no other text):
{"action":"reply","text":"your next message to the AM"}

Never output anything other than one of those two JSON shapes.`;

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

async function getRecentHistory(
  token: string,
  channel: string,
  threadTs: string | undefined
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const data = threadTs
    ? await slackApi(token, "conversations.replies", { channel, ts: threadTs, limit: 20 })
    : await slackApi(token, "conversations.history", { channel, limit: 20 });

  if (!data.ok) return [];

  const messages: Array<{ role: "user" | "assistant"; text: string; ts: string }> = (
    data.messages ?? []
  )
    .map((m: { bot_id?: string; text?: string; ts: string }) => ({
      role: m.bot_id ? ("assistant" as const) : ("user" as const),
      text: m.text ?? "",
      ts: m.ts,
    }))
    .filter((m: { text: string }) => m.text);

  // History comes back newest-last for threads, newest-first for channel history.
  const ordered = threadTs ? messages : [...messages].reverse();
  return ordered.map((m) => ({ role: m.role, content: m.text }));
}

async function callClaude(history: Array<{ role: string; content: string }>) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const apiBase = process.env.ANTHROPIC_API_BASE ?? "https://api.anthropic.com";
  if (!apiKey) throw new Error("anthropic_not_configured");

  const res = await fetch(`${apiBase}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) throw new Error(`anthropic_error_${res.status}`);
  const data = await res.json();
  const blocks: Array<{ type: string; text?: string }> = data?.content ?? [];
  const text = blocks.find((b) => b.type === "text")?.text ?? "{}";

  try {
    return JSON.parse(text) as AgentReply;
  } catch {
    return { action: "reply", text: "Sorry, I lost my train of thought — could you say that again?" } as AgentReply;
  }
}

export async function POST(request: Request) {
  const { slackUser, slackChannel, threadTs, text } = (await request.json()) as ChatRequest;

  const token = process.env.SLACK_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) {
    return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 500 });
  }

  const history = await getRecentHistory(token, slackChannel, threadTs);
  history.push({ role: "user", content: text });

  const reply = await callClaude(history);

  if (reply.action === "reply") {
    await slackApi(token, "chat.postMessage", {
      channel: slackChannel,
      thread_ts: threadTs,
      text: reply.text ?? "Sorry, could you rephrase that?",
    });
    return NextResponse.json({ ok: true, action: "reply" });
  }

  // action === "draft": run the existing pipeline against our own API.
  const requestId = `chat-${Date.now()}`;
  const { amName, accountName, campaignType, logoUrl } = reply;

  const copy = await fetch(`${BASE_URL}/api/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, amName, accountName, campaignType, logoUrl }),
  }).then((r) => r.json());

  const creative = await fetch(`${BASE_URL}/api/creative`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, copy }),
  }).then((r) => r.json());

  const draft = await fetch(`${BASE_URL}/api/campaign/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, amName, accountName, campaignType, copy, creative }),
  }).then((r) => r.json());

  // Tag the saved record with where it came from and where to post the approval.
  if (draft.id && supabaseUrl && supabaseKey) {
    await fetch(`${supabaseUrl}/rest/v1/campaign_requests?id=eq.${draft.id}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "pending_approval",
        slack_channel: slackChannel,
        slack_thread_ts: threadTs ?? null,
      }),
    }).catch(() => {});
  }

  await slackApi(token, "chat.postMessage", {
    channel: slackChannel,
    thread_ts: threadTs,
    text: `Got it — drafting the ${campaignType} campaign for ${accountName} now. I'll ping the PMM channel for approval and let you know what happens.`,
  });

  const pmmChannel = process.env.SLACK_PMM_CHANNEL_ID || slackChannel;
  await slackApi(token, "chat.postMessage", {
    channel: pmmChannel,
    text: `New campaign draft ready for review: *${draft.campaignName}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${draft.campaignName}*\nRequested by <@${slackUser}>\n\n*Subject:* ${draft.subject}\n\n*Suggested audience:* ${draft.segmentSuggestion}`,
        },
      },
      {
        type: "actions",
        block_id: "campaign_approval",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: "approve_campaign",
            value: draft.id ?? "",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            style: "danger",
            action_id: "reject_campaign",
            value: draft.id ?? "",
          },
        ],
      },
    ],
  });

  return NextResponse.json({ ok: true, action: "draft", id: draft.id });
}
