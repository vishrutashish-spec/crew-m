import { NextResponse } from "next/server";
import { searchOrgs } from "@/lib/orgs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ orgs: [] });
  }

  const orgs = await searchOrgs(q);
  return NextResponse.json({ orgs });
}
