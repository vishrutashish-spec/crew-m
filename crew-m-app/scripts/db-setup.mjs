#!/usr/bin/env node
// Applies supabase/schema.sql to your own Supabase project, using the DB
// password from ~/.insurwreck/credentials.json (never typed by hand). Run
// once via `npm run db:setup`, before `npm run seed`. Safe to re-run —
// everything in schema.sql is `create table if not exists`.

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";

const credsPath = join(homedir(), ".insurwreck", "credentials.json");

if (!existsSync(credsPath)) {
  console.error(`\nCouldn't find credentials at ${credsPath}. Run /insurwreck:start first.\n`);
  process.exit(1);
}

const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const supabase = creds.services?.supabase;

if (!supabase?.project_ref || !supabase?.db_password) {
  console.error("\nCredentials file is missing the Supabase project ref or DB password. Run /insurwreck:status.\n");
  process.exit(1);
}

// New Supabase projects don't expose the direct db.<ref>.supabase.co host
// over IPv4 — use the regional pooler instead (session mode, port 5432).
const region = supabase.region || "us-east-1";
const connectionString = `postgresql://postgres.${supabase.project_ref}:${encodeURIComponent(supabase.db_password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
const schema = readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf8");

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
try {
  await client.query(schema);
  console.log("Applied supabase/schema.sql — orgs and campaigns tables are ready.");
} finally {
  await client.end();
}
