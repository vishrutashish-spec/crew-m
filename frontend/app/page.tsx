"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard, getPersonas, type DashboardResponse, type Persona } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { ArrowRight, AlertTriangle, TrendingUp, TrendingDown, Users, Smartphone, Activity, Target } from "lucide-react";
import { PersonaAvatar } from "@/components/persona-avatar";

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "#1baf7a",
  push: "#eb6834",
  email: "#2a78d6",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", push: "Push", email: "Email",
};

export default function Overview() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDashboard(), getPersonas()])
      .then(([d, p]) => { setData(d); setPersonas(p.personas); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="py-16 max-w-md mx-auto">
        <Card className="border-destructive/20">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm font-medium mb-1">Backend not running</p>
            <p className="text-xs text-muted-foreground mb-4">
              Start the API server to load campaign intelligence.
            </p>
            <code className="text-xs bg-muted px-4 py-2 rounded-lg font-mono inline-block">
              cd backend && python3 server.py
            </code>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-8 py-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 h-72 bg-muted rounded-2xl animate-pulse" />
          <div className="col-span-5 h-72 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  const { model_confidence, top_personas, campaign_summary, key_metrics } = data;
  const byChannel = campaign_summary.by_channel || {};
  const funnelChannels = ["whatsapp", "push", "email"].filter(ch => byChannel[ch]);
  const funnelData = funnelChannels.map(ch => ({
    channel: CHANNEL_LABELS[ch] || ch,
    key: ch,
    delivered: byChannel[ch].avg_delivery_rate,
    opened: byChannel[ch].avg_open_rate,
    clicked: byChannel[ch].avg_click_rate,
    conversion: byChannel[ch].avg_conversion_rate,
    count: byChannel[ch].count,
  }));

  const channelData = Object.entries(campaign_summary.channels_used).map(([ch, count]) => ({
    channel: CHANNEL_LABELS[ch] || ch,
    count,
    key: ch,
  }));

  const orgGap = key_metrics.org_activation_rate - key_metrics.employee_activation_rate;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between animate-fade-in">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Campaign intelligence across {model_confidence.n_users_analyzed.toLocaleString()} users
            <span className="mx-2 text-border">·</span>
            {model_confidence.n_personas} personas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.generated_at && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums">
              {new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Badge variant={data.ct_live ? "default" : "secondary"} className="text-[11px] font-normal rounded-full px-3">
            {data.ct_live ? "Live CT + Synthetic" : "Synthetic"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wider rounded-full px-3">
            OBSERVED
          </Badge>
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-4 gap-5 animate-fade-in stagger-1">
        <HeroMetric
          icon={<Users className="w-4 h-4" />}
          label="Eligible users"
          value={key_metrics.total_eligible_users.toLocaleString()}
          sub="Total addressable base"
        />
        <HeroMetric
          icon={<Smartphone className="w-4 h-4" />}
          label="No-app share"
          value={`${(key_metrics.no_app_share * 100).toFixed(0)}%`}
          sub={`${Math.round(key_metrics.total_eligible_users * key_metrics.no_app_share).toLocaleString()} unreachable via push`}
          alert
        />
        <HeroMetric
          icon={<Activity className="w-4 h-4" />}
          label="Employee activation"
          value={`${(key_metrics.employee_activation_rate * 100).toFixed(1)}%`}
          sub={`vs ${(key_metrics.org_activation_rate * 100).toFixed(0)}% org activation`}
          alert
        />
        <HeroMetric
          icon={<Target className="w-4 h-4" />}
          label="Activation gap"
          value={`${(orgGap * 100).toFixed(0)}pt`}
          sub={key_metrics.structural_gap}
          alert
        />
      </div>

      {/* Live CleverTap metrics */}
      {data.ct_live && (
        <div className="animate-fade-in stagger-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <p className="text-[13px] font-medium text-foreground/80">Live from CleverTap</p>
            <Badge variant="outline" className="text-[10px] font-normal text-success border-success/30 tracking-wider rounded-full px-3">
              OBSERVED
            </Badge>
            {data.ct_live.pulled_at && (
              <span className="text-[10px] text-muted-foreground/50 ml-auto tabular-nums">
                {new Date(data.ct_live.pulled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-4">
            {data.ct_live.dau != null && <LiveMetric label="DAU" value={data.ct_live.dau.toLocaleString()} sub="Active today" />}
            {data.ct_live.mau != null && <LiveMetric label="MAU" value={data.ct_live.mau.toLocaleString()} sub="30-day active" />}
            {data.ct_live.new_installs_30d != null && <LiveMetric label="New installs" value={data.ct_live.new_installs_30d.toLocaleString()} sub="Last 30 days" accent />}
            {data.ct_live.total_sessions_30d != null && <LiveMetric label="Sessions" value={data.ct_live.total_sessions_30d.toLocaleString()} sub="30-day total" />}
            {data.ct_live.ytd_active_users != null && <LiveMetric label="YTD active" value={data.ct_live.ytd_active_users.toLocaleString()} sub="Unique this year" />}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6 animate-fade-in stagger-3">
        {/* Campaign funnel */}
        <div className="col-span-7">
          <Card className="card-elevated border-border/40">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[13px] font-medium text-foreground/80">Campaign funnel by channel</p>
                <span className="text-[11px] text-muted-foreground/60 tabular-nums">{campaign_summary.total_campaigns} campaigns</span>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mb-5">
                Weighted avg rates across historical campaigns
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ left: -8, right: 12, top: 0, bottom: 0 }}>
                    <XAxis dataKey="channel" tick={{ fontSize: 11, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} width={42} />
                    <Tooltip
                      formatter={(v, name) => [`${((v as number) * 100).toFixed(1)}%`, name === "delivered" ? "Delivered" : name === "opened" ? "Opened" : "Clicked"]}
                      contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid oklch(0.93 0.005 250)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                    />
                    <Bar dataKey="delivered" name="delivered" fill="#2a78d6" radius={[6, 6, 0, 0]} barSize={18} />
                    <Bar dataKey="opened" name="opened" fill="#1baf7a" radius={[6, 6, 0, 0]} barSize={18} />
                    <Bar dataKey="clicked" name="clicked" fill="#eb6834" radius={[6, 6, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-5 mt-3 justify-center">
                <LegendDot color="#2a78d6" label="Delivered" />
                <LegendDot color="#1baf7a" label="Opened" />
                <LegendDot color="#eb6834" label="Clicked" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channel split */}
        <div className="col-span-5">
          <Card className="card-elevated border-border/40 h-full">
            <CardContent className="pt-6 pb-5 h-full flex flex-col">
              <p className="text-[13px] font-medium text-foreground/80 mb-1">Channel distribution</p>
              <p className="text-[11px] text-muted-foreground/60 mb-4">{campaign_summary.total_campaigns} campaigns by channel</p>
              <div className="flex items-center gap-8 flex-1">
                <div className="w-32 h-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={channelData} dataKey="count" nameKey="channel" cx="50%" cy="50%" innerRadius={34} outerRadius={56} paddingAngle={3} strokeWidth={0}>
                        {channelData.map((d) => (
                          <Cell key={d.key} fill={CHANNEL_COLORS[d.key] || "#888"} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 flex-1">
                  {channelData.map((d) => (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHANNEL_COLORS[d.key] }} />
                      <span className="text-[12px] text-muted-foreground flex-1">{d.channel}</span>
                      <span className="text-[13px] font-medium tabular-nums">
                        {d.count}
                        <span className="text-muted-foreground/50 ml-1 font-normal text-[11px]">
                          ({((d.count / campaign_summary.total_campaigns) * 100).toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conversion rates by channel */}
              <div className="mt-auto pt-5 border-t border-border/40">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-3">End-to-end conversion</p>
                <div className="flex gap-3">
                  {funnelChannels.map(ch => (
                    <div key={ch} className="flex-1 text-center">
                      <p className="text-[15px] font-semibold tabular-nums">{(byChannel[ch].avg_conversion_rate * 100).toFixed(2)}%</p>
                      <p className="text-[10px] text-muted-foreground/60">{CHANNEL_LABELS[ch]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Personas */}
      <div className="animate-fade-in stagger-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[13px] font-medium text-foreground/80">Discovered personas</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              K-Means clustering · silhouette {model_confidence.silhouette_score.toFixed(2)}
              {model_confidence.silhouette_score >= 0.25 ? " (good)" : model_confidence.silhouette_score >= 0.15 ? " (fair)" : " (weak)"}
            </p>
          </div>
          <Link href="/personas" className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1.5 font-medium transition-colors">
            Explore all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {top_personas.map((p) => {
            const persona = personas.find((fp) => fp.id === p.id);
            return (
              <Link key={p.id} href="/personas">
                <Card className="hover:border-primary/20 transition-all cursor-pointer group h-full card-elevated border-border/40">
                  <CardContent className="pt-5 pb-4 px-5">
                    <div className="flex items-start gap-3 mb-4">
                      <PersonaAvatar personaId={p.id} personaName={p.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium truncate group-hover:text-primary transition-colors leading-snug">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {p.size.toLocaleString()} · {(p.share * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <MetricBar label="TH" value={p.th_adoption} />
                      <MetricBar label="HC" value={p.hc_adoption} />
                      <MetricBar label="App" value={p.app_installed} />
                    </div>
                    {persona && (
                      <div className="mt-4 pt-3 border-t border-border/30">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground/60">Best channel</span>
                          <span className="font-medium text-foreground/70">
                            {persona.channel_reach ? CHANNEL_LABELS[Object.entries(persona.channel_reach).sort(([,a],[,b]) => b - a)[0]?.[0]] || "—" : "—"}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Opportunities + Quick Actions */}
      <div className="grid grid-cols-12 gap-6 animate-fade-in stagger-5">
        <div className="col-span-7">
          <Card className="card-elevated border-border/40">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-3 mb-5">
                <p className="text-[13px] font-medium text-foreground/80">Opportunities</p>
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground/60 tracking-wider rounded-full px-3">
                  RECOMMENDED
                </Badge>
              </div>
              <div className="space-y-3">
                {key_metrics.no_app_share > 0.5 && (
                  <OpportunityRow
                    title={`${(key_metrics.no_app_share * 100).toFixed(0)}% of users have no app`}
                    detail="Push notifications can't reach this group. Use WhatsApp and email for app-install campaigns."
                    impact="high"
                    action="/simulate"
                    actionLabel="Simulate app-install"
                  />
                )}
                {orgGap > 0.3 && (
                  <OpportunityRow
                    title="Structural activation gap"
                    detail={`Org activation (${(key_metrics.org_activation_rate * 100).toFixed(0)}%) far exceeds employee activation (${(key_metrics.employee_activation_rate * 100).toFixed(1)}%). The gap is awareness, not access.`}
                    impact="high"
                    action="/simulate"
                    actionLabel="Simulate awareness campaign"
                  />
                )}
                <OpportunityRow
                  title="Dormant segments dominate"
                  detail="The largest personas are dormant with no app. Re-engagement requires benefit-led messaging via non-push channels."
                  impact="medium"
                  action="/personas"
                  actionLabel="View personas"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-5 space-y-4">
          <Link href="/simulate">
            <Card className="hover:border-primary/20 transition-all cursor-pointer group card-elevated border-border/40">
              <CardContent className="py-6 flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-primary/8 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/12 transition-colors">
                  <Beaker className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium group-hover:text-primary transition-colors">Campaign Simulator</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Predict performance before sending</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/personas">
            <Card className="hover:border-primary/20 transition-all cursor-pointer group card-elevated border-border/40">
              <CardContent className="py-6 flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-success/8 flex items-center justify-center flex-shrink-0 group-hover:bg-success/12 transition-colors">
                  <Users className="w-5 h-5 text-success" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium group-hover:text-primary transition-colors">Persona Explorer</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">Behavioral segments with full detail</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Beaker({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" /><path d="M7 16h10" />
    </svg>
  );
}

function HeroMetric({ icon, label, value, sub, alert }: {
  icon: React.ReactNode; label: string; value: string; sub: string; alert?: boolean;
}) {
  return (
    <Card className="card-elevated border-border/40 transition-all hover:shadow-md">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${alert ? "bg-warning/10 text-warning" : "bg-primary/8 text-primary"}`}>
            {icon}
          </div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">{label}</p>
        </div>
        <p className={`text-[26px] font-semibold tracking-tight tabular-nums leading-none ${alert ? "text-foreground" : "text-foreground"}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground/50 mt-2 leading-snug">{sub}</p>
      </CardContent>
    </Card>
  );
}

function LiveMetric({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <div className="bg-muted/40 rounded-2xl px-4 py-3.5">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1.5">{label}</p>
      <p className={`text-xl font-semibold tracking-tight tabular-nums ${accent ? "text-primary" : ""}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] text-muted-foreground/60 w-6 flex-shrink-0 tabular-nums">{label}</span>
      <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(value * 100, 2)}%`,
            background: value > 0.1 ? "oklch(0.52 0.105 185)" : "oklch(0.52 0.105 185 / 0.25)",
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/50 w-8 text-right tabular-nums">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function OpportunityRow({ title, detail, impact, action, actionLabel }: {
  title: string; detail: string; impact: "high" | "medium"; action: string; actionLabel: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-muted/30 border border-border/30">
      <div className="flex items-start gap-2.5 mb-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${impact === "high" ? "bg-destructive" : "bg-warning"}`} />
        <p className="text-[13px] font-medium leading-snug">{title}</p>
      </div>
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed ml-4 mb-3">{detail}</p>
      <div className="flex items-center gap-3 ml-4">
        <Badge variant={impact === "high" ? "destructive" : "secondary"} className="text-[10px] font-normal rounded-full px-2.5">
          {impact}
        </Badge>
        <Link href={action} className="text-[11px] text-primary hover:text-primary/70 font-medium transition-colors">{actionLabel}</Link>
      </div>
    </div>
  );
}
