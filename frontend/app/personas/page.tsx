"use client";

import { useEffect, useState } from "react";
import { getPersonas, type Persona } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Users } from "lucide-react";

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
      <div className="py-12">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Backend not running</p>
                <p className="text-sm text-muted-foreground mt-1">Start the API server to load persona data.</p>
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

  if (!personas.length) {
    return (
      <div className="py-6 space-y-6">
        <div className="space-y-1">
          <div className="h-7 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
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
          <h1 className="text-2xl font-semibold tracking-tight">Personas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {personas.length} behavioral personas discovered via K-Means clustering
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">OBSERVED</Badge>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-2">
          {personas.map((p) => (
            <Card
              key={p.id}
              className={`cursor-pointer transition-all ${
                selected?.id === p.id
                  ? "border-primary/50 shadow-sm bg-accent"
                  : "hover:border-border hover:shadow-sm"
              }`}
              onClick={() => setSelected(p)}
            >
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <PixelAvatar personaId={p.id} size={36} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${selected?.id === p.id ? "font-medium text-primary" : "font-medium"}`}>
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.size.toLocaleString()} users · {(p.share * 100).toFixed(1)}%
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">#{p.rank}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="col-span-8">
          {selected && <PersonaDetail persona={selected} />}
        </div>
      </div>
    </div>
  );
}

function PersonaDetail({ persona: p }: { persona: Persona }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-5">
            <PixelAvatar personaId={p.id} size={64} />
            <div className="flex-1">
              <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {p.size.toLocaleString()} users · {(p.share * 100).toFixed(1)}% of analyzed base
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="text-xs font-normal">Age {p.avg_age}</Badge>
                <Badge variant="secondary" className="text-xs font-normal">{(p.female_share * 100).toFixed(0)}% female</Badge>
                <Badge variant="secondary" className="text-xs font-normal">Tenure {p.avg_tenure_months.toFixed(0)}mo</Badge>
                <Badge variant="secondary" className="text-xs font-normal">Peak {p.peak_hour_mode}:00</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Engagement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <StatRow label="App Installed" value={`${(p.app_installed_share * 100).toFixed(0)}%`} />
            <StatRow label="App Launches (30d)" value={p.avg_app_launches_30d.toFixed(1)} />
            <StatRow label="Days Since Active" value={`${p.avg_days_since_active.toFixed(0)}d`} />
            <StatRow label="Notif Response" value={`${(p.avg_notif_response_rate * 100).toFixed(1)}%`} />
            <StatRow label="Campaign Fatigue" value={`${(p.avg_campaign_fatigue * 100).toFixed(0)}%`} alert={p.avg_campaign_fatigue > 0.5} />
            <StatRow label="DND Share" value={`${(p.dnd_share * 100).toFixed(1)}%`} alert={p.dnd_share > 0.05} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Product Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Telehealth</p>
            <StatRow label="Adoption" value={`${(p.th_adoption_rate * 100).toFixed(1)}%`} />
            <StatRow label="Avg Consults" value={p.avg_th_consults.toFixed(1)} />
            <StatRow label="Funnel Depth" value={`${p.avg_th_funnel_depth.toFixed(1)} / 5`} />
            <Separator />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Health Checkup</p>
            <StatRow label="Adoption" value={`${(p.hc_adoption_rate * 100).toFixed(1)}%`} />
            <StatRow label="Avg Bookings" value={p.avg_hc_bookings.toFixed(2)} />
            <StatRow label="Funnel Depth" value={`${p.avg_hc_funnel_depth.toFixed(1)} / 5`} />
            <Separator />
            <StatRow label="Wallet Expiry" value={`${p.avg_wallet_expiry_days.toFixed(0)} days`} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Channel Reachability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(p.channel_reach)
              .sort(([, a], [, b]) => b - a)
              .map(([ch, val]) => (
                <div key={ch}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground capitalize">{ch}</span>
                    <span className="font-medium">{(val * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={val * 100} className="h-1.5" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Segment Mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(p.segment_mix)
              .sort(([, a], [, b]) => b - a)
              .map(([seg, val]) => (
                <div key={seg}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">{seg}</span>
                    <span className="font-medium">{(val * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={val * 100} className="h-1.5" />
                </div>
              ))}
            <Separator />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-2">Top Lifecycle States</p>
            {Object.entries(p.lifecycle_distribution)
              .slice(0, 3)
              .map(([state, pct]) => (
                <div key={state} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{state.replace(/_/g, " ")}</span>
                  <span>{(pct * 100).toFixed(0)}%</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {(Object.keys(p.top_th_specialties).length > 0 || Object.keys(p.hra_distribution).length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(p.top_th_specialties).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top TH Specialties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(p.top_th_specialties).map(([spec, count]) => (
                  <div key={spec} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{spec}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">HRA Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(p.hra_distribution)
                .sort(([, a], [, b]) => b - a)
                .map(([status, pct]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{status.replace(/_/g, " ")}</span>
                    <span>{(pct * 100).toFixed(0)}%</span>
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
      <span className="text-muted-foreground">{label}</span>
      <span className={alert ? "text-warning font-medium" : ""}>{value}</span>
    </div>
  );
}

function PixelAvatar({ personaId, size = 48 }: { personaId: number; size?: number }) {
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
