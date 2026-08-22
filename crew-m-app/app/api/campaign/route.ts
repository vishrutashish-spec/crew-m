import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { getOrg, summarizeSegment } from "@/lib/orgs";

type ComposeInput = {
  orgId: string;
  request: string;
};

const DRAFT_TOOL: Anthropic.Tool = {
  name: "draft_campaign",
  description: "Return a subject line and body for the requested client campaign.",
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
    },
    required: ["subject", "body"],
  },
};

export async function POST(request: Request) {
  const { orgId, request: requestText } = (await request.json()) as ComposeInput;

  if (!orgId || !requestText) {
    return NextResponse.json({ error: "orgId and request are required" }, { status: 400 });
  }

  const org = await getOrg(orgId);
  if (!org) {
    return NextResponse.json({ error: "Org not found — try searching again." }, { status: 404 });
  }

  const segmentSummary = summarizeSegment(org);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [DRAFT_TOOL],
    tool_choice: { type: "tool", name: "draft_campaign" },
    system:
      "You draft short, warm client campaign copy for a health insurance broker's Account " +
      "Management team, sent to an org's employees. Plain language, no filler, no placeholder " +
      "brackets left unfilled. Reference the org by name naturally.",
    messages: [
      {
        role: "user",
        content:
          `Client organization: ${org.org}\n` +
          `Audience: ${segmentSummary}\n` +
          `What the AM asked for: ${requestText}`,
      },
    ],
  });

  const toolUse = message.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
  const result = toolUse?.input as { subject?: string; body?: string } | undefined;

  if (!result?.body) {
    return NextResponse.json({ error: "model returned no draft" }, { status: 502 });
  }

  return NextResponse.json({
    org: { orgId: org.orgId, org: org.org },
    segmentSummary,
    subject: result.subject ?? `Update for ${org.org}`,
    body: result.body,
  });
}
