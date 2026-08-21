import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

interface GenerateCopyRequest {
  requestId: string;
  amName: string;
  accountName: string;
  campaignType: "welcome" | "renewal" | string;
  logoFileId?: string;
  logoUrl?: string;
  slackUser?: string;
}

const COPY_SKILL_PATH = path.join(process.cwd(), "lib", "prompts", "copy-skill.md");

export async function POST(request: Request) {
  const { requestId, amName, accountName, campaignType, logoUrl } =
    (await request.json()) as GenerateCopyRequest;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set — cannot generate copy");
    return NextResponse.json({ error: "anthropic_not_configured" }, { status: 500 });
  }

  const copySkill = fs.readFileSync(COPY_SKILL_PATH, "utf-8");

  const userPrompt = `Write the copy for a "${campaignType}" campaign email to the client account "${accountName}".
Requested by account manager ${amName}.
${logoUrl ? `A client logo was provided and will be placed in the creative — you do not need to describe it.` : "No client logo was provided."}

Note: no account-specific behavioral or claims data is available to this request yet — write from the campaign type and account name alone, following the style guide above.

Respond with ONLY a raw JSON object (no markdown fences, no commentary) shaped exactly like:
{"subject": "...", "body": "..."}`;

  const apiBase = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

  const res = await fetch(`${apiBase}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: copySkill,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic request failed", res.status, errText);
    return NextResponse.json({ error: "copy_generation_failed" }, { status: 502 });
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "{}";

  let parsed: { subject?: string; body?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { subject: `${campaignType} — ${accountName}`, body: text };
  }

  return NextResponse.json({
    requestId,
    accountName,
    campaignType,
    subject: parsed.subject ?? `${campaignType} — ${accountName}`,
    body: parsed.body ?? "",
  });
}
