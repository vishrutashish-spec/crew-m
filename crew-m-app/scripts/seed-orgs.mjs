#!/usr/bin/env node
// Pulls the account_health dataset through the sanctioned export path (the
// desk masks and logs it) and loads it into your own Supabase `orgs` table.
// Run via `npm run seed`, after `npm run db:setup`. Safe to re-run — it
// upserts on org_id.

import { createClient } from "@supabase/supabase-js";

const DATASET_ID = 19244; // account_health

const token = process.env.INSURWRECK_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) {
  console.error("\nINSURWRECK_TOKEN isn't set. Ask Claude to add it to .env.local from your credentials.\n");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error("\nSUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't set. Run `npm run setup` first.\n");
  process.exit(1);
}

const res = await fetch(`https://insurwreck-desk.preview.plumhq.com/api/data/${DATASET_ID}.json`, {
  headers: { Authorization: `Bearer ${token}` },
});

if (!res.ok) {
  console.error(`\nDataset export failed: ${res.status} ${await res.text()}\n`);
  process.exit(1);
}

const rows = await res.json();

const orgs = rows
  .filter((row) => row.org_status === "ACTIVE")
  .map((row) => ({
    org_id: row.organisationId,
    org: (row.org ?? "").trim(),
    segment: row.segment,
    service_tier: row.service_tier,
    location: row.location,
    active_employees: row.active_employees,
    health_score: row.account_health_score,
    health_status: row.account_health_status,
    next_renewal_month: row.next_renewal_month,
  }))
  .filter((o) => o.org_id && o.org && o.active_employees != null);

// One row per org — keep the largest headcount reading if duplicated.
const byId = new Map();
for (const o of orgs) {
  const existing = byId.get(o.org_id);
  if (!existing || o.active_employees > existing.active_employees) byId.set(o.org_id, o);
}
const deduped = [...byId.values()];

const supabase = createClient(supabaseUrl, supabaseKey);
const { error } = await supabase.from("orgs").upsert(deduped, { onConflict: "org_id" });

if (error) {
  console.error("\nUpsert failed:", error.message, "\n");
  process.exit(1);
}

const rowCount = res.headers.get("x-insurwreck-row-count");
const truncated = res.headers.get("x-insurwreck-truncated");
console.log(`Seeded ${deduped.length} orgs from account_health (row_count=${rowCount}, truncated=${truncated ?? "false"}).`);
