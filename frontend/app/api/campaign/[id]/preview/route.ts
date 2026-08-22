import { NextResponse } from "next/server";

const BASE_URL = "https://iw-crew-m-c4b9.insurwreck.com";

/**
 * Renders the actual email HTML for a saved draft, so a PMM approver can
 * open a link and see exactly what will be sent instead of reading raw
 * subject/body text in Slack. Reuses /api/campaign/send's own `preview`
 * mode (which only assembles HTML, never sends) rather than duplicating the
 * header/deeplink/creative logic here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new NextResponse("Preview unavailable — Supabase is not configured.", { status: 500 });
  }

  const rowRes = await fetch(
    `${supabaseUrl}/rest/v1/campaign_requests?id=eq.${encodeURIComponent(id)}`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const [row] = rowRes.ok ? await rowRes.json() : [null];
  if (!row) {
    return new NextResponse("Campaign draft not found.", { status: 404 });
  }

  const previewRes = await fetch(`${BASE_URL}/api/campaign/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accountName: row.account_name,
      campaignType: row.campaign_type,
      copy: { subject: row.subject, body: row.body },
      creative: { creativeUrl: row.creative_url, stub: row.creative_is_stub },
      preview: true,
    }),
  });
  const data = await previewRes.json();

  if (!data.ok) {
    return new NextResponse(`Couldn't render a preview: ${data.error ?? "unknown error"}`, {
      status: 502,
    });
  }

  return new NextResponse(data.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
