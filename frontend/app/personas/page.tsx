"use client";

import { useEffect, useState } from "react";
import { getPersonas, type Persona } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export default function PersonaExplorer() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selected, setSelected] = useState<Persona | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPersonas()
      .then((res) => {
        setPersonas(res.personas);
        if (res.personas.length > 0) setSelected(res.personas[0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <p className="text-red-400">Failed to load personas. Is the backend running?</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Persona Explorer</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {personas.length} personas discovered via K-Means clustering
          <Badge variant="outline" className="ml-2 text-xs border-zinc-700 text-zinc-400">OBSERVED</Badge>
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Persona grid */}
        <div className="col-span-4 space-y-3">
          {personas.map((p) => (
            <Card
              key={p.id}
              className={`cursor-pointer transition-colors ${
                selected?.id === p.id
                  ? "bg-zinc-800 border-blue-700"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
              }`}
              onClick={() => setSelected(p)}
            >
              <CardContent className="py-4 px-4 flex items-center gap-4">
                <PixelAvatar personaId={p.id} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-zinc-500">
                    {p.size.toLocaleString()} users ({(p.share * 100).toFixed(1)}%)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">#{p.rank}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail panel */}
        <div className="col-span-8">
          {selected ? (
            <PersonaDetail persona={selected} />
          ) : (
            <Card className="bg-zinc-900 border-zinc-800 h-full flex items-center justify-center">
              <CardContent className="text-zinc-500">Select a persona to view details</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonaDetail({ persona: p }: { persona: Persona }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start gap-5">
            <PixelAvatar personaId={p.id} size={72} />
            <div>
              <h2 className="text-xl font-semibold">{p.name}</h2>
              <p className="text-sm text-zinc-400 mt-1">
                {p.size.toLocaleString()} users ({(p.share * 100).toFixed(1)}% of analyzed base)
              </p>
              <div className="flex gap-2 mt-3">
                <Badge variant="outline" className="text-xs border-zinc-700">
                  Avg age: {p.avg_age}
                </Badge>
                <Badge variant="outline" className="text-xs border-zinc-700">
                  {(p.female_share * 100).toFixed(0)}% female
                </Badge>
                <Badge variant="outline" className="text-xs border-zinc-700">
                  Tenure: {p.avg_tenure_months.toFixed(1)}mo
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Engagement + Product Usage */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Engagement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatRow label="App Installed" value={`${(p.app_installed_share * 100).toFixed(0)}%`} />
            <StatRow label="App Launches (30d)" value={p.avg_app_launches_30d.toFixed(1)} />
            <StatRow label="Days Since Active" value={`${p.avg_days_since_active.toFixed(0)}d`} />
            <StatRow label="Notif Response" value={`${(p.avg_notif_response_rate * 100).toFixed(1)}%`} />
            <StatRow label="Campaign Fatigue" value={`${(p.avg_campaign_fatigue * 100).toFixed(0)}%`} />
            <StatRow label="Peak Hour" value={`${p.peak_hour_mode}:00`} />
            <StatRow label="DND Share" value={`${(p.dnd_share * 100).toFixed(1)}%`} alert={p.dnd_share > 0.05} />
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Product Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Telehealth</p>
              <StatRow label="Adoption" value={`${(p.th_adoption_rate * 100).toFixed(1)}%`} />
              <StatRow label="Avg Consults" value={p.avg_th_consults.toFixed(1)} />
              <StatRow label="Funnel Depth" value={`${p.avg_th_funnel_depth.toFixed(1)} / 5`} />
            </div>
            <Separator className="bg-zinc-800" />
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Health Checkup</p>
              <StatRow label="Adoption" value={`${(p.hc_adoption_rate * 100).toFixed(1)}%`} />
              <StatRow label="Avg Bookings" value={p.avg_hc_bookings.toFixed(2)} />
              <StatRow label="Funnel Depth" value={`${p.avg_hc_funnel_depth.toFixed(1)} / 5`} />
            </div>
            <Separator className="bg-zinc-800" />
            <StatRow label="Wallet Expiry" value={`${p.avg_wallet_expiry_days.toFixed(0)} days`} />
          </CardContent>
        </Card>
      </div>

      {/* Channel Reach + Segment Mix */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Channel Reachability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(p.channel_reach)
              .sort(([, a], [, b]) => b - a)
              .map(([ch, val]) => (
                <div key={ch}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300 capitalize">{ch}</span>
                    <span className="text-zinc-200">{(val * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={val * 100} className="h-1.5" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Segment Mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(p.segment_mix)
              .sort(([, a], [, b]) => b - a)
              .map(([seg, val]) => (
                <div key={seg}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300">{seg}</span>
                    <span className="text-zinc-200">{(val * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={val * 100} className="h-1.5" />
                </div>
              ))}
            <Separator className="bg-zinc-800" />
            <div className="space-y-1">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mt-2">Top Lifecycle States</p>
              {Object.entries(p.lifecycle_distribution)
                .slice(0, 3)
                .map(([state, pct]) => (
                  <div key={state} className="flex justify-between text-xs">
                    <span className="text-zinc-400">{state.replace(/_/g, " ")}</span>
                    <span className="text-zinc-300">{(pct * 100).toFixed(0)}%</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TH Specialties + HRA */}
      {(Object.keys(p.top_th_specialties).length > 0 || Object.keys(p.hra_distribution).length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(p.top_th_specialties).length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-zinc-400">Top TH Specialties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(p.top_th_specialties).map(([spec, count]) => (
                  <div key={spec} className="flex justify-between text-sm">
                    <span className="text-zinc-300">{spec}</span>
                    <span className="text-zinc-400">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">HRA Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(p.hra_distribution)
                .sort(([, a], [, b]) => b - a)
                .map(([status, pct]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-zinc-300">{status.replace(/_/g, " ")}</span>
                    <span className="text-zinc-400">{(pct * 100).toFixed(0)}%</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className={alert ? "text-amber-400" : "text-zinc-200"}>{value}</span>
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
