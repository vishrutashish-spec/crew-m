/**
 * Crew M API client.
 *
 * Types mirror the cohort model exactly. Counts are always integers and rates
 * are always derived from those counts server-side, so a percentage shown in
 * the UI can never disagree with the number beside it.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Provenance = "OBSERVED" | "DERIVED" | "PREDICTED" | "RECOMMENDED" | "MODELED";

export interface ChannelReach {
  count: number;
  of_total: number;
  campaign_ready: number;
  app_portion?: number;
  no_app_portion?: number;
  with_app?: number;
  stale_tokens?: number;
  basis?: string;
}

export interface FunnelStage {
  stage: string;
  event: string;
  count: number;
  from_prev: number;
  cumulative: number;
  of_app: number;
}

export interface OrgBreakdown {
  label: string;
  total: number;
  share_of_cohort: number;
  app: number;
  app_share: number;
  mau: number;
  th_booked: number;
  hc_booked: number;
  dnd: number;
  dnd_share: number;
  reach: Record<string, number>;
  ready: Record<string, number>;
  ios: number;
  android: number;
  note?: string | null;
}

export interface Cohort {
  key: string;
  label: string;
  age_range: { lo: number; hi: number };
  org_filter: string | null;

  total: number;
  share_of_base: number;

  app: number;
  app_share: number;
  no_app: number;
  no_app_share: number;
  mau: number;
  mau_share_of_app: number;
  app_dormant: number;

  ios: number;
  android: number;
  ios_share_of_app: number;
  android_share_of_app: number;

  male: number;
  female: number;
  female_share: number;

  reach: Record<string, ChannelReach>;
  dnd: number;
  dnd_share: number;

  th_funnel: FunnelStage[];
  hc_funnel: FunnelStage[];
  th_booked: number;
  hc_booked: number;
  th_booked_of_base: number;
  hc_booked_of_base: number;
  th_booked_of_app: number;
  hc_booked_of_app: number;

  org_breakdown: Record<string, OrgBreakdown>;
  peak_hour: number;
}

export interface Totals {
  eligible: number;
  app: number;
  app_share: number;
  no_app: number;
  no_app_share: number;
  mau: number;
  mau_share_of_app: number;
  app_dormant: number;
  ios: number;
  android: number;
  ios_share_of_app: number;
  android_share_of_app: number;
  male: number;
  female: number;
  female_share: number;
  dnd: number;
  dnd_share: number;
  reach: Record<string, ChannelReach>;
  th_funnel: FunnelStage[];
  hc_funnel: FunnelStage[];
  th_booked: number;
  hc_booked: number;
}

export interface Insight {
  id: string;
  kind: Provenance;
  severity: "high" | "medium" | "low";
  title: string;
  body: string;
  arithmetic: string;
  action: string;
  modeled?: boolean;
}

export interface Leader {
  cohort: string;
  value: number;
  key: string;
}

export interface Overview {
  label: string;
  org_filter: string | null;
  totals: Totals;
  cohorts: Cohort[];
  comparison: Record<string, Leader>;
  insights: Insight[];
  activation: {
    employee_rate: number;
    org_rate: number;
    gap_points: number;
    targets: Record<string, number>;
    label: string;
  };
  ct_live: {
    metrics: Record<string, number>;
    scope: string;
    pulled_at: string;
    window_days: number;
    dau_method: string;
    label: string;
  };
  built_at: string;
}

export interface CohortDetail {
  label: string;
  cohort: Cohort;
  insights: Insight[];
  base_totals: Totals;
}

export interface OrgType {
  key: string;
  label: string;
  share?: number;
  note?: string | null;
}

export interface CohortsResponse {
  label: string;
  org_filter: string | null;
  cohorts: Cohort[];
  org_types: OrgType[];
  org_share_is_modeled: boolean;
}

export interface SimOptions {
  objectives: { key: string; label: string; desc: string }[];
  cohorts: { key: string; label: string }[];
  org_types: { key: string; label: string }[];
  channels: { key: string; label: string }[];
  control_group_share: number;
}

export interface SimRequest {
  objective: string;
  cohort_keys: string[];
  org?: string | null;
  channel?: string | null;
  send_hour?: number | null;
  exclude_dnd?: boolean;
  exclude_no_app_for_push?: boolean;
}

export interface SimResult {
  label: string;
  confidence: string;
  confidence_reason: string;
  selection: {
    cohorts: string[];
    org: string;
    cohort_total: number;
    app_in_selection: number;
    dnd_in_selection: number;
    label: string;
  };
  audience: {
    objective_pool: number;
    pool_description: string;
    addressable: number;
    control_group: number;
    sent: number;
    label: string;
  };
  channel: {
    selected: string;
    selected_label: string;
    label: string;
    options: Record<string, { label: string; addressable: number; share_of_pool: number }>;
  };
  funnel: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    delivery_rate: number;
    open_rate: number;
    click_rate: number;
    conversion_rate: number;
    click_to_convert: number;
    label: string;
  };
  timing: { send_hour: number; note: string; label: string };
  warnings: string[];
}

export interface Methodology {
  provenance: {
    observed: { source: string; pulled_at: string; window_days: number; fields: string[] };
    derived: { fields: string[]; how: string };
    modeled: Record<string, unknown>;
    ct_live_scope: string;
    dau_method: string;
    notes: { title: string; body: string }[];
  };
  checks: string[];
  mau_scoped: { value: number; provenance: string };
  reach_decomposed: Record<string, Record<string, number>>;
  segment_reachability: Record<string, Record<string, number>>;
  funnels: {
    th: { stage: string; event: string; count: number }[];
    hc: { stage: string; event: string; count: number }[];
    window: string;
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.json();
}

const orgQuery = (org?: string | null) =>
  org && org !== "all" ? `?org=${encodeURIComponent(org)}` : "";

export const getOverview = (org?: string | null) =>
  get<Overview>(`/api/overview${orgQuery(org)}`);

export const getCohorts = (org?: string | null) =>
  get<CohortsResponse>(`/api/cohorts${orgQuery(org)}`);

export const getCohort = (key: string, org?: string | null) =>
  get<CohortDetail>(`/api/cohorts/${key}${orgQuery(org)}`);

export const getMethodology = () => get<Methodology>("/api/methodology");

export const getSimOptions = () => get<SimOptions>("/api/simulate/options");

export const getVerification = () =>
  get<{ label: string; checks: string[] }>("/api/verification");

export async function simulate(req: SimRequest): Promise<SimResult> {
  const res = await fetch(`${BASE}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return res.json();
}

/* ---------------------------------------------------------------------------
   Formatting: one place, so 216,924 never renders three different ways.
   --------------------------------------------------------------------------- */

export const n = (v: number) => v.toLocaleString("en-US");

export const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
  : v >= 1_000 ? `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}K`
  : String(v);

export const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;

// Theme-aware series tokens. CSS variables are valid SVG paint values, and
// the PNG exporter inlines computed styles, so exports pick up the active
// theme automatically. Light: ink/red/sand. Dark: cream leads, red lifts.
export const CHART = {
  ink: "var(--series-1)",
  red: "var(--series-2)",
  sand: "var(--series-3)",
  inkSoft: "var(--series-4)",
  sandDeep: "var(--series-5)",
} as const;

/** Chart series colours, in the order they should be assigned. */
export const SERIES = [CHART.ink, CHART.red, CHART.sand, CHART.inkSoft, CHART.sandDeep];

export const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: CHART.ink,
  email: CHART.red,
  push: CHART.sand,
};

/* ---------------------------------------------------------------------------
   Copy studio
   --------------------------------------------------------------------------- */

export interface CopyCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface CopyAnalysis {
  category: "utility" | "marketing";
  category_basis: string;
  chars: number;
  title_chars: number | null;
  emoji_count: number;
  emoji_range_for_band: [number, number];
  personalized: boolean;
  checks: CopyCheck[];
  style_score: number;
  label: string;
}

export interface CopyPrediction {
  label: string;
  confidence: string;
  confidence_reason: string;
  baseline: { open: number; click: number; convert: number };
  predicted: { open: number; click: number; convert: number };
  delta: { open: number; click: number; convert: number };
  factors: string[];
  funnel?: { sent: number; delivered: number; opened: number; clicked: number; converted: number };
}

export interface CopyVariant {
  id: string;
  band: string;
  band_label: string;
  channel: string;
  title: string | null;
  preheader: string | null;
  body: string;
  source: string;
  analysis: CopyAnalysis;
  prediction: CopyPrediction;
  label: string;
}

export interface CopyGenResponse {
  label: string;
  objective: string;
  channel: string;
  angle: string | null;
  groups: { band: string; band_label: string; variants: CopyVariant[] }[];
  discipline: Record<string, string>;
}

export interface CopyOptions {
  angles: Record<string, { key: string; label: string }[]>;
  bands: { key: string; label: string; emoji_range: [number, number] }[];
  limits: Record<string, Record<string, number | number[]>>;
  source: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const b = await res.json();
      detail = b.detail ?? detail;
    } catch { /* non-JSON error body */ }
    throw new Error(detail);
  }
  return res.json();
}

export const getCopyOptions = () => get<CopyOptions>("/api/copy/options");

export const generateCopy = (req: {
  objective: string; cohort_keys: string[]; channel: string;
  angle?: string | null; audience_sent?: number | null;
}) => post<CopyGenResponse>("/api/copy/generate", req);

export const analyzeCopy = (req: {
  text: string; title?: string | null; channel: string; objective: string;
  cohort_key: string; audience_sent?: number | null;
}) => post<{ label: string; analysis: CopyAnalysis; prediction: CopyPrediction }>(
  "/api/copy/analyze", req);
