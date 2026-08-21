import { NextResponse } from "next/server";

interface OpenModalRequest {
  requestId: string;
  triggerId: string;
  slackUser: string;
  slackChannel: string;
}

export async function POST(request: Request) {
  const { requestId, triggerId, slackChannel } = (await request.json()) as OpenModalRequest;

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error("SLACK_BOT_TOKEN is not set — cannot open the campaign modal");
    return NextResponse.json({ ok: false, error: "slack_not_configured" }, { status: 500 });
  }

  const view = {
    type: "modal",
    callback_id: "am_campaign_request",
    private_metadata: JSON.stringify({ channelId: slackChannel, requestId }),
    title: { type: "plain_text", text: "New campaign" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "am_name_block",
        label: { type: "plain_text", text: "Your name" },
        element: { type: "plain_text_input", action_id: "am_name_input" },
      },
      {
        type: "input",
        block_id: "account_block",
        label: { type: "plain_text", text: "Account name" },
        element: { type: "plain_text_input", action_id: "account_input" },
      },
      {
        type: "input",
        block_id: "campaign_type_block",
        label: { type: "plain_text", text: "Campaign type" },
        element: {
          type: "static_select",
          action_id: "campaign_type_select",
          placeholder: { type: "plain_text", text: "Choose one" },
          options: [
            { text: { type: "plain_text", text: "Welcome" }, value: "welcome" },
            { text: { type: "plain_text", text: "Renewal" }, value: "renewal" },
          ],
        },
      },
      {
        type: "input",
        block_id: "logo_block",
        optional: true,
        label: { type: "plain_text", text: "Client logo (optional)" },
        element: {
          type: "file_input",
          action_id: "logo_upload",
          filetypes: ["png", "jpg", "jpeg", "svg"],
          max_files: 1,
        },
      },
    ],
  };

  const res = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ trigger_id: triggerId, view }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("views.open failed", data.error);
    return NextResponse.json({ ok: false, error: data.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
