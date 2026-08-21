import { NextResponse } from "next/server";

interface RenderCreativeRequest {
  requestId: string;
  copy: { subject?: string; body?: string; campaignType?: string };
}

/**
 * Stub: real Figma template filling is not wired up. Returns a placeholder
 * so the rest of the pipeline (draft assembly, Slack reply) has something to
 * reference. Swap this for a real Figma API call when that's scoped.
 */
export async function POST(request: Request) {
  const { requestId, copy } = (await request.json()) as RenderCreativeRequest;

  const label = encodeURIComponent(copy?.campaignType ?? "campaign");
  return NextResponse.json({
    requestId,
    creativeUrl: `https://placehold.co/1200x630?text=${label}+creative`,
    stub: true,
  });
}
