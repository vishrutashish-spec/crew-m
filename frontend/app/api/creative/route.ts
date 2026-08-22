import { NextResponse } from "next/server";

interface RenderCreativeRequest {
  requestId: string;
  copy: { subject?: string; body?: string; campaignType?: string; accountName?: string };
  logoUrl?: string;
}

const CREATIVE_QUEUE_URL =
  process.env.CREATIVE_QUEUE_WEBHOOK_URL ??
  "https://workflow-stg.plumhq.com/webhook/iw-crew-m-c4b9-creative-queue";

async function queuePendingCreative(params: {
  requestId: string;
  accountName?: string;
  campaignType?: string;
  logoUrl?: string;
}) {
  try {
    await fetch(CREATIVE_QUEUE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: params.requestId,
        accountName: params.accountName ?? "",
        campaignType: params.campaignType ?? "",
        brandMode: params.logoUrl ? "cobranded" : "single",
        logoUrl: params.logoUrl ?? "",
      }),
    });
  } catch (err) {
    console.error("Failed to queue pending creative request (non-fatal)", err);
  }
}

/**
 * Real creative rendering (Figma template -> font substitution -> local logo
 * composite -> pixel-verified export) only runs through an interactive Figma
 * MCP session — a Vercel serverless function has no Figma access, so it can't
 * happen here. This map holds accounts that already had that pipeline run by
 * hand; anyone else gets an honest placeholder instead of a fake banner.
 * See EMAIL-DESIGN-PLAYBOOK.md and BUILD-SHEET-prochant-welcome.md.
 */
const REAL_CREATIVES: Record<string, Record<string, { desktop: string; mobile: string }>> = {
  prochant: {
    renewal: {
      desktop: "https://d250yozwgs1tp8.cloudfront.net/1704861952/assets/21c98d5b81da4887aeab19ef18893a10.png",
      mobile: "https://d250yozwgs1tp8.cloudfront.net/1704861952/assets/af754a113a3e4a4a94ff4452c1d803a1.png",
    },
  },
};

export async function POST(request: Request) {
  const { requestId, copy, logoUrl } = (await request.json()) as RenderCreativeRequest;

  const accountKey = copy?.accountName?.trim().toLowerCase();
  const typeKey = copy?.campaignType?.trim().toLowerCase();
  const real = accountKey && typeKey ? REAL_CREATIVES[accountKey]?.[typeKey] : undefined;

  if (real) {
    return NextResponse.json({
      requestId,
      creativeUrl: real.desktop,
      mobileCreativeUrl: real.mobile,
      stub: false,
    });
  }

  await queuePendingCreative({
    requestId,
    accountName: copy?.accountName,
    campaignType: copy?.campaignType,
    logoUrl,
  });

  const label = encodeURIComponent(copy?.campaignType ?? "campaign");
  return NextResponse.json({
    requestId,
    creativeUrl: `https://placehold.co/1200x630?text=${label}+creative`,
    stub: true,
    note: "No real creative exists yet — this request has been queued for the Figma-processing agent to build for real.",
  });
}
