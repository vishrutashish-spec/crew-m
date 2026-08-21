"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard, type DashboardResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Smartphone,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  FlaskConical,
  Target,
  Zap,
  Activity,
} from "lucide-react";

export default function Overview() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="py-12">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Backend not running</p>
                <p className="text-sm text-muted-foreground mt-1">Start the API server to load campaign intelligence data.</p>
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
        <div className="space-y-1">
          <div className="h-7 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-52 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { model_confidence, top_personas, campaign_summary, key_metrics } = data;

  return (
    <div className="py-6 space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Campaign intelligence across {model_confidence.n_users_analyzed.toLocaleString()} analyzed users
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs font-normal">
            {model_confidence.data_source === "synthetic_calibrated" ? "Synthetic (calibrated)" : "Live CT data"}
          </Badge>
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">OBSERVED</Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Users}
          label="Eligible Users"
          value={key_metrics.total_eligible_users.toLocaleString()}
          sublabel="Total addressable base"
        />
        <MetricCard
          icon={Smartphone}
          label="No-App Users"
          value={`${(key_metrics.no_app_share * 100).toFixed(0)}%`}
          sublabel={`${Math.round(key_metrics.total_eligible_users * key_metrics.no_app_share).toLocaleString()} unreachable via push`}
          variant="warning"
        />
        <MetricCard
          icon={TrendingUp}
          label="Org Activation"
          value={`${(key_metrics.org_activation_rate * 100).toFixed(0)}%`}
          sublabel="At least 1 booking"
        />
        <MetricCard
          icon={Activity}
          label="Employee Activation"
          value={`${(key_metrics.employee_activation_rate * 100).toFixed(0)}%`}
          sublabel={key_metrics.structural_gap}
          variant="warning"
        />
      </div>

      {/* Model + Campaign Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Model Confidence</CardTitle>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">OBSERVED</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Silhouette Score</span>
                <span className="font-medium">{model_confidence.silhouette_score.toFixed(3)}</span>
              </div>
              <Progress value={model_confidence.silhouette_score * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1.5">
                {model_confidence.silhouette_score > 0.25 ? "Good" : model_confidence.silhouette_score > 0.15 ? "Fair" : "Weak"} cluster separation across {model_confidence.n_personas} personas
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">Personas Discovered</span>
              <span className="text-lg font-semibold">{model_confidence.n_personas}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Campaign Performance (Avg)</CardTitle>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">OBSERVED</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <FunnelRow label="Delivery Rate" value={campaign_summary.avg_delivery_rate} color="bg-plum" />
            <FunnelRow label="Open Rate" value={campaign_summary.avg_open_rate} color="bg-chart-3" />
            <FunnelRow label="Click Rate" value={campaign_summary.avg_click_rate} color="bg-coral" />
            <div className="flex items-center justify-between text-sm pt-3 border-t">
              <span className="text-muted-foreground">Total Campaigns</span>
              <span className="font-medium">{campaign_summary.total_campaigns}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Personas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Top Personas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Discovered via K-Means clustering on behavioral features</p>
          </div>
          <Link href="/personas" className="text-sm text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {top_personas.map((p) => (
            <Link key={p.id} href="/personas">
              <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-3 mb-3">
                    <PersonaAvatar personaId={p.id} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.size.toLocaleString()} users</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <MiniBar label="TH" value={p.th_adoption} />
                    <MiniBar label="HC" value={p.hc_adoption} />
                    <MiniBar label="App" value={p.app_installed} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/simulate">
          <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
            <CardContent className="py-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">Campaign Simulator</p>
                <p className="text-xs text-muted-foreground mt-0.5">Evaluate campaign performance before sending</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/audience">
          <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
            <CardContent className="py-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-coral" />
              </div>
              <div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">Build Audience</p>
                <p className="text-xs text-muted-foreground mt-0.5">Define objectives and get targeting recommendations</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">RECOMMENDED</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <RecommendationRow
              text="77% of eligible users have no app installed. SMS and WhatsApp are the only reachable channels for this cohort."
              impact="High"
              action="Build an app-install campaign targeting no-app users via SMS"
            />
            <RecommendationRow
              text={`Employee activation (${(key_metrics.employee_activation_rate * 100).toFixed(0)}%) significantly lags org activation (${(key_metrics.org_activation_rate * 100).toFixed(0)}%). The structural gap suggests awareness, not access, is the bottleneck.`}
              impact="High"
              action="Create awareness campaigns for dormant employee segments"
            />
            <RecommendationRow
              text="Dormant No-App personas represent the largest cluster. Re-engagement requires non-push channels and benefit-led messaging."
              impact="Medium"
              action="Simulate a WhatsApp re-engagement campaign for this persona"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sublabel,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel: string;
  variant?: "warning";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${variant === "warning" ? "text-warning" : "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
        </div>
        <p className={`text-2xl font-semibold tracking-tight ${variant === "warning" ? "text-warning" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

function FunnelRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary/40 rounded-full" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-8 text-right">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

function RecommendationRow({ text, impact, action }: { text: string; impact: string; action: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-md bg-muted/50 border border-border/50">
      <Lightbulb className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">{text}</p>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant={impact === "High" ? "default" : "secondary"} className="text-xs">
            {impact} impact
          </Badge>
          <span className="text-xs text-primary">{action}</span>
        </div>
      </div>
    </div>
  );
}

function PersonaAvatar({ personaId, size = 36 }: { personaId: number; size?: number }) {
  const palettes = [
    ["#7c3aed", "#ede9fe"], ["#059669", "#d1fae5"], ["#d97706", "#fef3c7"],
    ["#dc2626", "#fee2e2"], ["#7c3aed", "#f3e8ff"], ["#db2777", "#fce7f3"],
    ["#0891b2", "#cffafe"], ["#65a30d", "#ecfccb"],
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
      <rect width={size} height={size} fill={bg} />
      {pixels.map((row, y) =>
        row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={fg} /> : null)
      )}
    </svg>
  );
}

function Lightbulb({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" /><path d="M10 22h4" />
    </svg>
  );
}
