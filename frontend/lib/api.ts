const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getDashboard() {
  return fetchAPI<DashboardResponse>("/api/dashboard");
}

export async function getPersonas() {
  return fetchAPI<PersonasResponse>("/api/personas");
}

export async function getPersona(id: number) {
  return fetchAPI<{ label: string; persona: Persona }>(`/api/personas/${id}`);
}

export async function getAudienceRecommendation(objective: string) {
  return fetchAPI<AudienceResponse>(`/api/audience/recommend?objective=${objective}`);
}

export async function simulateCampaign(params: SimulationParams) {
  return fetchAPI<SimulationResponse>("/api/simulate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Types

export interface Persona {
  id: number;
  rank: number;
  name: string;
  size: number;
  share: number;
  avg_age: number;
  female_share: number;
  segment_mix: Record<string, number>;
  app_installed_share: number;
  avg_app_launches_30d: number;
  avg_days_since_active: number;
  avg_notif_response_rate: number;
  avg_campaign_fatigue: number;
  peak_hour_mode: number;
  th_adoption_rate: number;
  avg_th_consults: number;
  avg_th_funnel_depth: number;
  hc_adoption_rate: number;
  avg_hc_bookings: number;
  avg_hc_funnel_depth: number;
  dnd_share: number;
  avg_tenure_months: number;
  avg_wallet_expiry_days: number;
  channel_reach: Record<string, number>;
  lifecycle_distribution: Record<string, number>;
  top_th_specialties: Record<string, number>;
  hra_distribution: Record<string, number>;
  age_distribution: Record<string, number>;
  male_count: number;
  female_count: number;
  app_installed_count: number;
  app_not_installed_count: number;
  org_type_counts: Record<string, number>;
}

export interface DashboardResponse {
  label: string;
  model_confidence: {
    silhouette_score: number;
    n_users_analyzed: number;
    n_personas: number;
    data_source: string;
  };
  top_personas: {
    id: number;
    name: string;
    size: number;
    share: number;
    th_adoption: number;
    hc_adoption: number;
    app_installed: number;
  }[];
  campaign_summary: {
    total_campaigns: number;
    avg_delivery_rate: number;
    avg_open_rate: number;
    avg_click_rate: number;
    channels_used: Record<string, number>;
  };
  key_metrics: {
    total_eligible_users: number;
    no_app_share: number;
    org_activation_rate: number;
    employee_activation_rate: number;
    structural_gap: string;
  };
  generated_at?: string;
}

export interface PersonasResponse {
  label: string;
  personas: Persona[];
  silhouette_score: number;
  features_used: string[];
}

export interface AudienceScore {
  persona_id: number;
  persona_name: string;
  score: number;
  reasons: string[];
  best_channel: string;
  label: string;
}

export interface AudienceResponse {
  label: string;
  objective: string;
  rankings: AudienceScore[];
}

export interface SimulationParams {
  objective: string;
  channel?: string;
  persona_ids?: number[];
  copy_text?: string;
  send_hour?: number;
}

export interface SimulationResponse {
  label: string;
  confidence: string;
  evidence_basis: string;
  audience_size: number;
  warning?: string;
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
  } | null;
  channel: { selected: string; label: string };
  timing: { note: string; label: string };
}
