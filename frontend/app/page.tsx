"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard, getPersonas, type DashboardResponse, type Persona } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { ArrowRight, AlertTriangle } from "lucide-react";

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: "oklch(0.65 0.17 155)",
  push: "oklch(0.65 0.18 15)",
  email: "oklch(0.35 0.12 320)",
  sms: "oklch(0.75 0.15 65)",
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
      <div className="py-12 max-w-lg">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Backend not running</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start the API server to load campaign intelligence data.
                </p>
                <code className="block mt-3 text-xs bg-muted px-3 py-2 rounded-md font-mono">
                  cd backend && python3 server.py
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-6 space-y-6">
        <div className="h-7 w-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-7 h-64 bg-muted rounded-lg animate-pulse" />
          <div className="col-span-5 h-64 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const { model_confidence, top_personas, campaign_summary, key_metrics } = data;

  const funnelData = [
    { stage: "Delivered", rate: campaign_summary.avg_delivery_rate, pct: `${(campaign_summary.avg_delivery_rate * 100).toFixed(1)}%` },
    { stage: "Opened", rate: campaign_summary.avg_open_rate, pct: `${(campaign_summary.avg_open_rate * 100).toFixed(1)}%` },
    { stage: "Clicked", rate: campaign_summary.avg_click_rate, pct: `${(campaign_summary.avg_click_rate * 100).toFixed(1)}%` },
  ];

  const channelData = Object.entries(campaign_summary.channels_used).map(([ch, count]) => ({
    channel: ch.charAt(0).toUpperCase() + ch.slice(1),
    count,
    key: ch,
  }));

  const orgGap = key_metrics.org_activation_rate - key_metrics.employee_activation_rate;

  return (
    <div className="py-6 space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Campaign intelligence across {model_confidence.n_users_analyzed.toLocaleString()} users
            <span className="mx-1.5 text-border">·</span>
            {model_confidence.n_personas} personas discovered
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs font-normal">
            {model_confidence.data_source === "synthetic_calibrated" ? "Synthetic" : "Live CT"}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wide">
            OBSERVED
          </Badge>
        </div>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <HeroMetric
          label="Eligible users"
          value={key_metrics.total_eligible_users.toLocaleString()}
          sub="Total addressable base"
        />
        <HeroMetric
          label="No-app share"
          value={`${(key_metrics.no_app_share * 100).toFixed(0)}%`}
          sub={`${Math.round(key_metrics.total_eligible_users * key_metrics.no_app_share).toLocaleString()} unreachable via push`}
          alert
        />
        <HeroMetric
          label="Employee activation"
          value={`${(key_metrics.employee_activation_rate * 100).toFixed(1)}%`}
          sub={`vs ${(key_metrics.org_activation_rate * 100).toFixed(0)}% org activation`}
          alert
        />
        <HeroMetric
          label="Activation gap"
          value={`${(orgGap * 100).toFixed(0)}pt`}
          sub={key_metrics.structural_gap}
          alert
        />
      </div>

      {/* Funnel + Channel split */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Campaign funnel averages</p>
                <span className="text-xs text-muted-foreground">{campaign_summary.total_campaigns} campaigns</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Average rates across all historical campaigns
              </p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 40, top: 0, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 12, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip
                      formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Rate"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid oklch(0.91 0.005 320)" }}
                    />
                    <Bar dataKey="rate" fill="oklch(0.35 0.12 320)" radius={[0, 4, 4, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-5">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-sm font-medium mb-1">Channel distribution</p>
              <p className="text-xs text-muted-foreground mb-3">{campaign_summary.total_campaigns} campaigns by channel</p>
              <div className="flex items-center gap-6">
                <div className="w-28 h-28 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={channelData} dataKey="count" nameKey="channel" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} strokeWidth={0}>
                        {channelData.map((d) => (
                          <Cell key={d.key} fill={CHANNEL_COLORS[d.key] || "oklch(0.7 0 0)"} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1">
                  {channelData.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHANNEL_COLORS[d.key] }} />
                      <span className="text-xs text-muted-foreground flex-1">{d.channel}</span>
                      <span className="text-xs font-medium tabular-nums">
                        {d.count}
                        <span className="text-muted-foreground ml-1 font-normal">
                          ({((d.count / campaign_summary.total_campaigns) * 100).toFixed(0)}%)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Personas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Discovered personas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              K-Means clustering · silhouette {model_confidence.silhouette_score.toFixed(2)}
              {model_confidence.silhouette_score >= 0.25 ? " (good)" : model_confidence.silhouette_score >= 0.15 ? " (fair)" : " (weak)"}
            </p>
          </div>
          <Link href="/personas" className="text-xs text-primary hover:underline flex items-center gap-1">
            Explore all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {top_personas.map((p, idx) => {
            const persona = personas.find((fp) => fp.id === p.id);
            return (
              <Link key={p.id} href="/personas">
                <Card className="hover:border-primary/30 transition-all cursor-pointer group h-full">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-start gap-3 mb-3">
                      <PersonaAvatar personaId={p.id} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors leading-tight">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {p.size.toLocaleString()} · {(p.share * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <MetricBar label="TH" value={p.th_adoption} />
                      <MetricBar label="HC" value={p.hc_adoption} />
                      <MetricBar label="App" value={p.app_installed} />
                    </div>
                    {persona && (
                      <div className="mt-3 pt-2 border-t border-border/50">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Best channel</span>
                          <span className="font-medium capitalize">
                            {persona.channel_reach ? Object.entries(persona.channel_reach).sort(([,a],[,b]) => b - a)[0]?.[0] : "—"}
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

      {/* Quick Actions + Opportunities */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-7">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-sm font-medium">Opportunities</p>
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wide">
                  RECOMMENDED
                </Badge>
              </div>
              <div className="space-y-3">
                {key_metrics.no_app_share > 0.5 && (
                  <OpportunityRow
                    title={`${(key_metrics.no_app_share * 100).toFixed(0)}% of users have no app`}
                    detail="Push notifications can't reach this group. Use SMS and WhatsApp for app-install campaigns."
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

        <div className="col-span-5 space-y-3">
          <Link href="/simulate">
            <Card className="hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                    <path d="M8.5 2h7" /><path d="M7 16h10" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">Campaign Simulator</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Predict performance before sending</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/personas">
            <Card className="hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="py-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">Persona Explorer</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Behavioral segments with full detail</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ label, value, sub, alert }: {
  label: string; value: string; sub: string; alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">{label}</p>
        <p className={`text-2xl font-semibold tracking-tight tabular-nums ${alert ? "text-warning" : ""}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 tabular-nums">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(value * 100, 1)}%`,
            background: value > 0.1 ? "oklch(0.35 0.12 320)" : "oklch(0.35 0.12 320 / 0.3)",
          }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function OpportunityRow({ title, detail, impact, action, actionLabel }: {
  title: string; detail: string; impact: "high" | "medium"; action: string; actionLabel: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
      <div className="flex items-start gap-2 mb-1.5">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${impact === "high" ? "bg-destructive" : "bg-warning"}`} />
        <p className="text-sm font-medium leading-tight">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed ml-3.5">{detail}</p>
      <div className="flex items-center gap-3 mt-2 ml-3.5">
        <Badge variant={impact === "high" ? "destructive" : "secondary"} className="text-[10px] font-normal">
          {impact}
        </Badge>
        <Link href={action} className="text-xs text-primary hover:underline">{actionLabel}</Link>
      </div>
    </div>
  );
}

function PersonaAvatar({ personaId, size = 36 }: { personaId: number; size?: number }) {
  const palettes = [
    ["oklch(0.45 0.12 320)", "oklch(0.95 0.02 320)"],
    ["oklch(0.45 0.15 155)", "oklch(0.95 0.02 155)"],
    ["oklch(0.55 0.15 65)", "oklch(0.96 0.02 65)"],
    ["oklch(0.55 0.18 15)", "oklch(0.96 0.02 15)"],
    ["oklch(0.45 0.12 280)", "oklch(0.95 0.02 280)"],
    ["oklch(0.45 0.15 200)", "oklch(0.95 0.02 200)"],
    ["oklch(0.55 0.12 100)", "oklch(0.96 0.02 100)"],
    ["oklch(0.45 0.18 340)", "oklch(0.95 0.02 340)"],
  ];
  const [fg, bg] = palettes[personaId % palettes.length];
  const seed = personaId * 7919 + 1;
  const pixels: boolean[][] = [];
  for (let y = 0; y < 8; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 4; x++) {
      const hash = ((seed + y * 31 + x * 17) * 2654435761) >>> 0;
      row.push(hash % 3 !== 0);
    }
    pixels.push([...row, ...[...row].reverse()]);
  }
  const px = size / 8;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md flex-shrink-0">
      <rect width={size} height={size} fill={bg} rx={3} />
      {pixels.map((row, y) =>
        row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={fg} /> : null)
      )}
    </svg>
  );
}
