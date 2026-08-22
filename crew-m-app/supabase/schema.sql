-- Run this against your own Supabase project (see credentials.json) before
-- `npm run seed`. Paste into the SQL editor at your project's dashboard_url,
-- or run via `npm run db:setup` which does it for you over the DB password.

create table if not exists orgs (
  org_id text primary key,
  org text not null,
  segment text,
  service_tier text,
  location text,
  active_employees integer,
  health_score numeric,
  health_status text,
  next_renewal_month date,
  updated_at timestamptz not null default now()
);

alter table orgs enable row level security;

-- Campaigns an AM has drafted and reviewed through the app. "ready_to_launch"
-- is as far as this build goes — the CleverTap connection provisioned for
-- the hackathon is read-only, so nothing here dispatches a live campaign.
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id text references orgs(org_id),
  org_name text not null,
  request_text text not null,
  segment_summary text not null,
  subject text not null,
  body text not null,
  status text not null default 'ready_to_launch' check (status in ('ready_to_launch', 'archived')),
  created_at timestamptz not null default now()
);

alter table campaigns enable row level security;
-- No policies added — the app talks to Supabase with the service_role key
-- (server-side only), which bypasses RLS by design.

-- `risks` is separate from the tables above: it already exists in your
-- project. The desk creates it automatically when your Supabase project is
-- provisioned, and Claude Code logs a row here whenever it builds an
-- export/download feature for Plum data, so don't be surprised to find it.
