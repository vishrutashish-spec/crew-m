"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard, type DashboardResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Card className="bg-zinc-900 border-red-900/50">
          <CardContent className="pt-6">
            <p className="text-red-400">Backend not running. Start the API server:</p>
            <code className="block mt-2 text-sm text-zinc-400 bg-zinc-800 p-3 rounded">
              cd backend && python3 server.py
            </code>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-zinc-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const { model_confidence, top_personas, campaign_summary, key_metrics } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Model trained on {model_confidence.n_users_analyzed.toLocaleString()} users
          <Badge variant="outline" className="ml-2 text-xs border-zinc-700 text-zinc-400">
            {model_confidence.data_source === "synthetic_calibrated" ? "Synthetic (calibrated)" : "Live CT data"}
          </Badge>
          <Badge variant="outline" className="ml-1 text-xs border-zinc-700 text-zinc-400">
            OBSERVED
          </Badge>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Eligible Users" value={key_metrics.total_eligible_users.toLocaleString()} subtitle="Total addressable base" />
        <MetricCard title="No-App Users" value={`${(key_metrics.no_app_share * 100).toFixed(0)}%`} subtitle={`${Math.round(key_metrics.total_eligible_users * key_metrics.no_app_share).toLocaleString()} unreachable via push`} alert />
        <MetricCard title="Org Activation" value={`${(key_metrics.org_activation_rate * 100).toFixed(0)}%`} subtitle="At least 1 booking" />
        <MetricCard title="Employee Activation" value={`${(key_metrics.employee_activation_rate * 100).toFixed(0)}%`} subtitle={key_metrics.structural_gap} alert />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-400">Model Confidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">Silhouette Score</span>
                <span className="text-zinc-200">{model_confidence.silhouette_score.toFixed(3)}</span>
              </div>
              <Progress value={model_confidence.silhouette_score * 100} className="h-2" />
              <p className="text-xs text-zinc-500 mt-1">
                {model_confidence.silhouette_score > 0.25 ? "Good" : model_confidence.silhouette_score > 0.15 ? "Fair" : "Weak"} cluster separation
              </p>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Personas Discovered</span>
              <span className="text-zinc-200">{model_confidence.n_personas}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-400">Campaign Performance (Avg)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FunnelRow label="Delivery Rate" value={campaign_summary.avg_delivery_rate} />
            <FunnelRow label="Open Rate" value={campaign_summary.avg_open_rate} />
            <FunnelRow label="Click Rate" value={campaign_summary.avg_click_rate} />
            <div className="flex justify-between text-sm pt-2 border-t border-zinc-800">
              <span className="text-zinc-400">Total Campaigns</span>
              <span className="text-zinc-200">{campaign_summary.total_campaigns}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Top Personas</h2>
          <Link href="/personas" className="text-sm text-blue-400 hover:text-blue-300">View all →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {top_personas.map((p) => (
            <Link key={p.id} href={`/personas?id=${p.id}`}>
              <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer">
                <CardContent className="pt-5 pb-4 px-4">
                  <PixelAvatar personaId={p.id} size={48} />
                  <p className="font-medium text-sm mt-3 truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.size.toLocaleString()} users ({(p.share * 100).toFixed(1)}%)</p>
                  <div className="mt-3 space-y-1">
                    <MiniStat label="TH" value={`${(p.th_adoption * 100).toFixed(1)}%`} />
                    <MiniStat label="HC" value={`${(p.hc_adoption * 100).toFixed(1)}%`} />
                    <MiniStat label="App" value={`${(p.app_installed * 100).toFixed(0)}%`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <Link href="/simulator" className="flex-1">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-blue-800 transition-colors cursor-pointer">
            <CardContent className="py-6 text-center">
              <p className="font-medium">Campaign Simulator</p>
              <p className="text-sm text-zinc-500 mt-1">Simulate performance with what-if scenarios</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/personas" className="flex-1">
          <Card className="bg-zinc-900 border-zinc-800 hover:border-blue-800 transition-colors cursor-pointer">
            <CardContent className="py-6 text-center">
              <p className="font-medium">Persona Explorer</p>
              <p className="text-sm text-zinc-500 mt-1">Explore behavioral personas from user data</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, alert }: { title: string; value: string; subtitle: string; alert?: boolean }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{title}</p>
        <p className={`text-2xl font-semibold mt-1 ${alert ? "text-amber-400" : "text-zinc-100"}`}>{value}</p>
        <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function FunnelRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200">{(value * 100).toFixed(1)}%</span>
      </div>
      <Progress value={value * 100} className="h-1.5" />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

function PixelAvatar({ personaId, size = 48 }: { personaId: number; size?: number }) {
  const colors = [
    ["#3b82f6", "#1d4ed8"], ["#10b981", "#047857"], ["#f59e0b", "#b45309"],
    ["#ef4444", "#b91c1c"], ["#8b5cf6", "#6d28d9"], ["#ec4899", "#be185d"],
    ["#06b6d4", "#0e7490"], ["#84cc16", "#4d7c0f"],
  ];
  const [primary, secondary] = colors[personaId % colors.length];

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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill={secondary} rx={4} />
      {pixels.map((row, y) =>
        row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={primary} /> : null)
      )}
    </svg>
  );
}
