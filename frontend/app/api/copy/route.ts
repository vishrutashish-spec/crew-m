import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { lookupAccountFacts, factsForPrompt } from "@/lib/account-facts";

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

  const facts = lookupAccountFacts(accountName);

  const knownFacts = facts
    ? `Verified policy facts for this account, read from Plum's warehouse. Use these
verbatim where relevant. Do NOT alter, round or embellish any figure or date:

${factsForPrompt(facts)}`
    : `No verified policy data is on file for this account. Write the full structure
below, but DO NOT state an insurer, sum insured, renewal date, maternity limit,
copay or any other specific figure — you do not know them, and a wrong number in
a member email is far worse than an absent one. Where a specific belongs, write
a short line telling the member the detail is coming, e.g. "Your cover details
will follow shortly." Never invent a placeholder like "X" or "[insurer]".`;

  const userPrompt = `Write the body copy for a "${campaignType}" benefits email to employees of "${accountName}".
Requested by account manager ${amName}.
${logoUrl ? "A client logo was supplied and sits in the header creative — do not describe it." : ""}

${knownFacts}

This is a real member-facing benefits email, not a marketing blurb. Real Plum
welcome and renewal emails are long and specific: an employee should be able to
act on it without asking anyone a question. Aim for 250-400 words.

Follow this section order (it mirrors Plum's production emails). Use the exact
bold section headings shown, each on its own line ending in a colon:

1. A two or three sentence opening. Name the company. For a welcome, say Plum is
   now looking after their health benefits. For a renewal, say the cover carries
   on without a break.
2. One sentence naming the insurer and who handles claims (only if known).
3. "Here's when it starts:" — the coverage start date on its own line (only if known).
4. "Here's what you need to know:" — 4 to 6 bullets starting with "- ". Cover: who
   is included, health cards arriving in the Plum app, the 24x7 helpline
   1800 30 911 911 with missed calls returned within 15 minutes, using a network
   hospital for cashless treatment, and filing a reimbursement claim in the app
   otherwise.
5. "What you're covered for:" — bullets for sum insured, maternity and copay.
   Include ONLY the ones given in the verified facts above; omit the heading
   entirely if none are known.
6. "Reaching us:" — in-app support any time, care@plumhq.com 9am to 9pm daily,
   and the emergency helpline.
7. Close with "With care," then "Team Plum" on the next line.

Style rules that override anything else:
- No em dashes anywhere.
- No "not X, but Y" negation contrasts.
- No ", so you know X" tails.
- Never invent a statistic, limit, date or hospital count.
- Spell out any acronym on first use. Do not write GMC, GTL, GPA or HRA bare.
- No jokes, no personification, no wit. This is coverage information.

Respond with ONLY a raw JSON object (no markdown fences, no commentary) shaped exactly like:
{"subject": "...", "body": "..."}

The subject should be plain and specific, under 60 characters, and must not
contain any figure you were not given above.`;

  const apiBase =
    process.env.ANTHROPIC_BASE_URL ??
    process.env.ANTHROPIC_API_BASE ??
    "https://api.anthropic.com";

  const res = await fetch(`${apiBase}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      // This model thinks before answering — a low budget can burn the
      // whole response on the (discarded) thinking block and return no text.
      max_tokens: 4096,
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
  const blocks: Array<{ type: string; text?: string }> = data?.content ?? [];
  const text: string = blocks.find((b) => b.type === "text")?.text ?? "{}";

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
