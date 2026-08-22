import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type SendInput = {
  orgId: string;
  orgName: string;
  requestText: string;
  segmentSummary: string;
  subject: string;
  body: string;
};

// The CleverTap connection provisioned for this hackathon is read-only — a
// live send would reach real Plum customers. This logs the reviewed
// campaign as ready to launch instead of dispatching it.
export async function POST(request: Request) {
  const { orgId, orgName, requestText, segmentSummary, subject, body } = (await request.json()) as SendInput;

  if (!orgId || !subject || !body) {
    return NextResponse.json({ error: "orgId, subject, and body are required" }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured — run npm run setup." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      org_name: orgName,
      request_text: requestText,
      segment_summary: segmentSummary,
      subject,
      body,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  return NextResponse.json({ id: data.id, status: "ready_to_launch" });
}
