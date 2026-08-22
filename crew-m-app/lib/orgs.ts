import "server-only";
import { supabase } from "./supabase";

export type Org = {
  orgId: string;
  org: string;
  segment: string | null;
  serviceTier: string | null;
  location: string | null;
  activeEmployees: number;
  healthScore: number | null;
  healthStatus: string | null;
  nextRenewalMonth: string | null;
};

type OrgRow = {
  org_id: string;
  org: string;
  segment: string | null;
  service_tier: string | null;
  location: string | null;
  active_employees: number;
  health_score: number | null;
  health_status: string | null;
  next_renewal_month: string | null;
};

function mapRow(row: OrgRow): Org {
  return {
    orgId: row.org_id,
    org: row.org,
    segment: row.segment,
    serviceTier: row.service_tier,
    location: row.location,
    activeEmployees: row.active_employees,
    healthScore: row.health_score,
    healthStatus: row.health_status,
    nextRenewalMonth: row.next_renewal_month,
  };
}

export async function searchOrgs(query: string, limit = 8): Promise<Org[]> {
  if (!supabase) return [];
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("orgs")
    .select("*")
    .ilike("org", `%${q}%`)
    .order("active_employees", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getOrg(orgId: string): Promise<Org | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.from("orgs").select("*").eq("org_id", orgId).maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as OrgRow) : null;
}

// The plain-language read of an org's real numbers — this is the "get the
// segment right" problem solved with data instead of guesswork.
export function summarizeSegment(org: Org): string {
  const parts = [`${org.activeEmployees.toLocaleString()} active employees`];
  if (org.segment) parts.push(org.segment.replace(/-/g, " "));
  if (org.serviceTier) parts.push(`${org.serviceTier} tier`);
  if (org.healthStatus) parts.push(`account health: ${org.healthStatus.toLowerCase()}`);
  if (org.nextRenewalMonth) {
    const d = new Date(org.nextRenewalMonth);
    if (!Number.isNaN(d.getTime())) {
      parts.push(`renews ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`);
    }
  }
  return parts.join(" · ");
}
