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
  /** Free-text policy limits pasted by the AM in the /crew-m modal. */
  benefitsSupplied?: string;
}

const COPY_SKILL_PATH = path.join(process.cwd(), "lib", "prompts", "copy-skill.md");

export async function POST(request: Request) {
  const { requestId, amName, accountName, campaignType, logoUrl, benefitsSupplied } =
    (await request.json()) as GenerateCopyRequest;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set — cannot generate copy");
    return NextResponse.json({ error: "anthropic_not_configured" }, { status: 500 });
  }

  const copySkill = fs.readFileSync(COPY_SKILL_PATH, "utf-8");

  const facts = lookupAccountFacts(accountName);
  const isRenewal = String(campaignType).toLowerCase() === "renewal";

  // Policy year label for the subject, e.g. "2026-27", derived from the
  // cover start rather than today, so a future-dated policy reads correctly.
  const startYear = facts?.coverStart
    ? Number((facts.coverStart.match(/\b(20\d{2})\b/) ?? [])[1])
    : new Date().getFullYear();
  const yearLabel = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

  // AM-supplied limits are treated as verified: they come off the policy
  // schedule and are the only source for maternity, ambulance, LASIK and Ayush,
  // which are in no warehouse dataset.
  const supplied = benefitsSupplied?.trim();
  const suppliedBlock = supplied
    ? `\n\nAdditional policy benefits supplied by the account manager. Treat these
as verified and quote them exactly as written:\n\n${supplied}`
    : "";

  const knownFacts = facts
    ? `Verified policy facts, read from Plum's warehouse. Quote these exactly.
Do not alter, round, reformat or embellish any figure or date:

${factsForPrompt(facts)}${suppliedBlock}`
    : `No verified policy data is on file for this account. Write every section
below, but state NO insurer name, date, sum insured, maternity limit, copay or
any other specific. Where a specific belongs, write that the detail will follow
shortly. Never invent a figure and never write a placeholder like "[insurer]".${suppliedBlock}`;

  const userPrompt = `Write the body copy for a ${isRenewal ? "RENEWAL" : "WELCOME"} benefits email to employees of "${accountName}".
Requested by account manager ${amName}.

${knownFacts}

This is a real member-facing benefits email and must match Plum's production
format. Those emails are long and specific: an employee should be able to act
on it without asking anyone a question. Aim for 400-550 words. A short email is
a failure.

Use EXACTLY these sections, in this order, each heading on its own line:

1. Opening, two sentences. ${isRenewal
    ? `Say ${accountName} has RENEWED its partnership with Plum to continue bringing a best-in-class healthcare experience.`
    : `Say ${accountName} has partnered with Plum to bring a best-in-class healthcare experience.`}
   Describe it as comprehensive, simple, inclusive and easy to access for them
   and their loved ones.
2. One or two sentences naming the insurer as the trusted insurance partner and
   what that means for service and support. Only if the insurer is known.
3. "Here's when it starts:" then the ${isRenewal ? "renewed " : ""}coverage start date on the next line.
4. "Here's what you need to know:" with bullets starting "- ":
   - Coverage for the employee and their family begins on the start date, and
     health cards will be available in the Plum app shortly
   - Emergency assistance or a cashless claim without a health ID yet: call
     Plum's 24/7 helpline at 1800 30 911 911. Missed calls returned within 15 minutes
   - For cashless treatments, visit a network hospital. The network hospital
     list is in the Plum app
   - For non-network treatments, file a reimbursement claim in the Plum app once
     health IDs arrive
5. "Note:" then a line about reimbursement claims incurred BEFORE the coverage
   start date: submit documents through the Plum app under the previous policy,
   and the Claims Support team will review and guide them. ${isRenewal ? "" : "Include this only if a start date is known."}
6. "Next steps:" a Plum enrollment invite is coming, to sign up, review details
   and dependents, and enroll in the group insurance program.
7. "More updates to follow, stay tuned!" on its own line.
8. "Here's what you're covered for:" then these as separate lines, only the ones
   known: plan name, "Sum Insured: Graded", "Family definition: ...",
   "Insurer: ... | TPA: ...", "Start Date of Coverage: ...".
9. "Health Insurance Benefits for ${yearLabel}:" with bullets for maternity limit,
   pre and post natal expenses, baby day-one coverage, ambulance charges, LASIK
   and Ayush. Include ONLY limits given in the verified facts. If none are
   given, omit this whole section rather than inventing any.
10. A line saying complete coverage details are on the Plum app, where they can
    view detailed benefits, coverage limits and applicable policy terms.
11. "Reaching out to Plum:" with bullets for in-app support (Plum app or web
    dashboard, 24x7), email support (care@plumhq.com, 9am to 9pm, seven days a
    week), and emergencies without health cards (1800 30 911 911, 24x7, cashless
    only at network hospitals).

Hard rules:
- SUM INSURED IS WRITTEN AS "Graded" AND NOTHING ELSE. Never list the per-grade
  amounts. A whole organisation reads this email and the grades differ per person.
- No em dashes anywhere.
- No "not X, but Y" negation contrasts.
- No ", so you know X" tails.
- Never invent a statistic, limit, date or hospital count.
- Spell out acronyms on first use. Never write GMC, GTL, GPA or HRA bare.
- No jokes, no personification, no wit.

Respond with ONLY a raw JSON object (no markdown fences, no commentary):
{"subject": "...", "body": "..."}

The subject must be EXACTLY this, with nothing added or removed:
Welcome to Your ${yearLabel} Health Benefits 🎉${accountName}<> Plum`;

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
