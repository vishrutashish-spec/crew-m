import { NextResponse } from "next/server";

interface BuildDraftRequest {
  requestId: string;
  amName: string;
  accountName: string;
  campaignType: "welcome" | "renewal" | string;
  copy: { subject?: string; body?: string };
  creative: { creativeUrl?: string; stub?: boolean };
}

/**
 * CleverTap has no API to create a campaign — campaigns are built in its
 * dashboard editor only. This assembles everything a human with CleverTap
 * Creator access needs to paste in and finish the real draft there (and,
 * if Campaign Approval is enabled on the account, CleverTap's own
 * Creator -> Approver workflow takes it from there).
 */
export async function POST(request: Request) {
  const { requestId, amName, accountName, campaignType, copy, creative } =
    (await request.json()) as BuildDraftRequest;

  const channel = "Email";
  const date = new Date().toISOString().slice(0, 10);
  const campaignName = `[${channel}] [${campaignType}] [${accountName}] [${date}] [v1]`;

  const segmentSuggestion =
    campaignType === "welcome"
      ? `New employees at ${accountName} who haven't installed the app or completed an activation event yet`
      : `Active employees at ${accountName} whose plan is due for renewal`;

  const summary = [
    `*${campaignName}*`,
    `Requested by: ${amName}`,
    `Channel: ${channel} (default for now — no channel picker yet)`,
    "",
    `*Subject:* ${copy?.subject ?? "(none generated)"}`,
    "*Body:*",
    copy?.body ?? "(none generated)",
    "",
    `*Creative:* ${creative?.creativeUrl ?? "(none)"}${
      creative?.stub ? " — placeholder, Figma rendering isn't wired up yet" : ""
    }`,
    "",
    `*Suggested audience:* ${segmentSuggestion}`,
    "",
    "This is a brief, not a CleverTap draft — CleverTap doesn't expose an API to create campaigns. Paste this into the CleverTap dashboard to create the real draft.",
  ].join("\n");

  const region = process.env.CT_REGION ?? "in1";

  return NextResponse.json({
    requestId,
    campaignName,
    channel,
    amName,
    subject: copy?.subject ?? "",
    body: copy?.body ?? "",
    creativeUrl: creative?.creativeUrl ?? "",
    creativeIsStub: Boolean(creative?.stub),
    segmentSuggestion,
    reviewUrl: `https://${region}.clevertap.com/`,
    // Kept for the Slack-reply path, which still expects a flat string.
    summary,
  });
}
