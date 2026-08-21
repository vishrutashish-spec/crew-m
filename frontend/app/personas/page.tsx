"use client";

import { useEffect, useState } from "react";
import { getPersonas, type Persona } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { AlertTriangle } from "lucide-react";

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
      <div className="py-12 max-w-lg">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Backend not running</p>
                <p className="text-sm text-muted-foreground mt-1">Start the API server to load persona data.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!personas.length) {
    return (
      <div className="py-6 space-y-6">
        <div className="h-7 w-40 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
          </div>
          <div className="col-span-8 h-96 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Persona Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {personas.length} behavioral personas from K-Means clustering
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wide">OBSERVED</Badge>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Persona List */}
        <div className="col-span-4 space-y-1.5">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left rounded-lg border transition-all p-3 flex items-center gap-3 ${
                selected?.id === p.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              <PersonaAvatar personaId={p.id} size={36} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs truncate ${selected?.id === p.id ? "font-medium text-primary" : "font-medium"}`}>
                  {p.name}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {p.size.toLocaleString()} users · {(p.share * 100).toFixed(1)}%
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">#{p.rank}</span>
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="col-span-8">
          {selected && <PersonaDetail persona={selected} />}
        </div>
      </div>
    </div>
  );
}

function PersonaDetail({ persona: p }: { persona: Persona }) {
  const radarData = [
    { axis: "App installed", v: p.app_installed_share },
    { axis: "TH adoption", v: p.th_adoption_rate },
    { axis: "HC adoption", v: p.hc_adoption_rate },
    { axis: "Notif response", v: p.avg_notif_response_rate },
    { axis: "Recency", v: Math.max(0, 1 - p.avg_days_since_active / 180) },
    { axis: "Low fatigue", v: 1 - p.avg_campaign_fatigue },
  ];

  const channelData = Object.entries(p.channel_reach)
    .sort(([, a], [, b]) => b - a)
    .map(([ch, val]) => ({ channel: ch.charAt(0).toUpperCase() + ch.slice(1), reach: val }));

  const CHANNEL_COLORS: Record<string, string> = {
    Whatsapp: "oklch(0.65 0.17 155)",
    Sms: "oklch(0.75 0.15 65)",
    Email: "oklch(0.35 0.12 320)",
    Push: "oklch(0.65 0.18 15)",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-5">
            <PersonaAvatar personaId={p.id} size={56} />
            <div className="flex-1">
              <h2 className="text-lg font-semibold tracking-tight">{p.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {p.size.toLocaleString()} users · {(p.share * 100).toFixed(1)}% of base
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="text-[10px] font-normal">Age {p.avg_age}</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal">{(p.female_share * 100).toFixed(0)}% female</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal">Tenure {p.avg_tenure_months.toFixed(0)}mo</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal">Peak {p.peak_hour_mode}:00</Badge>
                {p.avg_campaign_fatigue > 0.5 && <Badge variant="destructive" className="text-[10px] font-normal">High fatigue</Badge>}
                {p.dnd_share > 0.05 && <Badge variant="destructive" className="text-[10px] font-normal">DND {(p.dnd_share * 100).toFixed(0)}%</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar + Channel */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Behavioral profile</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="oklch(0.91 0.005 320)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 10, fill: "oklch(0.5 0.02 320)" }}
                  />
                  <Radar
                    dataKey="v"
                    stroke="oklch(0.35 0.12 320)"
                    fill="oklch(0.35 0.12 320)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Channel reachability</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="channel" tick={{ fontSize: 11, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(0)}%`, "Reach"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="reach" radius={[0, 4, 4, 0]} barSize={22}>
                    {channelData.map((d) => (
                      <Cell key={d.channel} fill={CHANNEL_COLORS[d.channel] || "oklch(0.5 0 0)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Usage */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 space-y-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Telehealth</p>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Adoption" value={`${(p.th_adoption_rate * 100).toFixed(1)}%`} />
              <MiniStat label="Avg consults" value={p.avg_th_consults.toFixed(1)} />
              <MiniStat label="Funnel depth" value={`${p.avg_th_funnel_depth.toFixed(1)}/5`} />
            </div>
            {Object.keys(p.top_th_specialties).length > 0 && (
              <>
                <Separator />
                <p className="text-[10px] text-muted-foreground">Top specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(p.top_th_specialties).map(([spec, count]) => (
                    <Badge key={spec} variant="secondary" className="text-[10px] font-normal">
                      {spec} ({count})
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 space-y-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Health checkup</p>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Adoption" value={`${(p.hc_adoption_rate * 100).toFixed(1)}%`} />
              <MiniStat label="Avg bookings" value={p.avg_hc_bookings.toFixed(1)} />
              <MiniStat label="Funnel depth" value={`${p.avg_hc_funnel_depth.toFixed(1)}/5`} />
            </div>
            <Separator />
            <p className="text-[10px] text-muted-foreground">Wallet expiry</p>
            <div className="flex items-center gap-2">
              <Progress value={Math.min((p.avg_wallet_expiry_days / 365) * 100, 100)} className="h-1.5 flex-1" />
              <span className="text-xs tabular-nums font-medium">{p.avg_wallet_expiry_days.toFixed(0)}d</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement + Segments */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Engagement</p>
            <StatRow label="App installed" value={`${(p.app_installed_share * 100).toFixed(0)}%`} />
            <StatRow label="App launches (30d)" value={p.avg_app_launches_30d.toFixed(1)} />
            <StatRow label="Days since active" value={`${p.avg_days_since_active.toFixed(0)}d`} alert={p.avg_days_since_active > 60} />
            <StatRow label="Notif response" value={`${(p.avg_notif_response_rate * 100).toFixed(0)}%`} />
            <StatRow label="Campaign fatigue" value={`${(p.avg_campaign_fatigue * 100).toFixed(0)}%`} alert={p.avg_campaign_fatigue > 0.5} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Segment mix</p>
            {Object.entries(p.segment_mix)
              .sort(([, a], [, b]) => b - a)
              .map(([seg, val]) => (
                <div key={seg}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{seg}</span>
                    <span className="font-medium tabular-nums">{(val * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={val * 100} className="h-1" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">HRA status</p>
            {Object.entries(p.hra_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([status, pct]) => (
                <div key={status} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{status.replace(/_/g, " ")}</span>
                  <span className="tabular-nums">{(pct * 100).toFixed(0)}%</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${alert ? "text-warning font-medium" : ""}`}>{value}</span>
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
