"use client";

import { useEffect, useState } from "react";
import { getPersonas, type Persona } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PersonaAvatar } from "@/components/persona-avatar";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie,
} from "recharts";
import { AlertTriangle, Info } from "lucide-react";

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
      <div className="flex items-end justify-between animate-fade-in">
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
              className={`w-full text-left rounded-lg border transition-all duration-150 p-3 flex items-center gap-3 ${
                selected?.id === p.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-transparent hover:bg-muted"
              }`}
            >
              <PersonaAvatar personaId={p.id} personaName={p.name} size={36} />
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

const RADAR_EXPLANATIONS: Record<string, string> = {
  "App installed": "% of users in this persona with the Plum app installed",
  "TH adoption": "% who have completed at least one telehealth consultation",
  "HC adoption": "% who have completed at least one health checkup booking",
  "Notif response": "Average notification response rate across all channels",
  "Recency": "1 - (avg days since active / 180). Higher = more recently active",
  "Low fatigue": "1 - campaign fatigue score. Higher = less likely to opt out",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", push: "Push", email: "Email", sms: "SMS",
};

const CHANNEL_COLORS: Record<string, string> = {
  WhatsApp: "oklch(0.65 0.17 155)",
  SMS: "oklch(0.75 0.15 65)",
  Email: "oklch(0.35 0.12 320)",
  Push: "oklch(0.65 0.18 15)",
};

const ORG_COLORS: Record<string, string> = {
  ENT: "oklch(0.35 0.12 320)",
  SMB: "oklch(0.65 0.18 15)",
  MM: "oklch(0.65 0.17 155)",
  EOR: "oklch(0.75 0.15 65)",
};

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
    .map(([ch, val]) => ({ channel: CHANNEL_LABELS[ch] || ch, reach: val }));

  const totalReachable = Object.values(p.channel_reach).reduce((sum, v) => sum + v, 0) / Object.keys(p.channel_reach).length;
  const reachableCount = Math.round(p.size * totalReachable);
  const unreachableCount = p.size - reachableCount;

  const reachabilityData = [
    { name: "Reachable", value: reachableCount, fill: "oklch(0.65 0.17 155)" },
    { name: "Unreachable", value: unreachableCount, fill: "oklch(0.91 0.005 320)" },
  ];

  const ageDistData = p.age_distribution
    ? Object.entries(p.age_distribution).map(([label, count]) => ({ label, count }))
    : [];

  const genderData = [
    { name: "Male", value: p.male_count || Math.round(p.size * (1 - p.female_share)), fill: "oklch(0.55 0.12 240)" },
    { name: "Female", value: p.female_count || Math.round(p.size * p.female_share), fill: "oklch(0.65 0.18 340)" },
  ];

  const appData = [
    { name: "Installed", value: p.app_installed_count || Math.round(p.size * p.app_installed_share), fill: "oklch(0.65 0.17 155)" },
    { name: "Not installed", value: p.app_not_installed_count || Math.round(p.size * (1 - p.app_installed_share)), fill: "oklch(0.75 0.15 65)" },
  ];

  const orgData = p.org_type_counts
    ? Object.entries(p.org_type_counts).map(([type, count]) => ({ type, count }))
    : Object.entries(p.segment_mix).map(([type, pct]) => ({ type, count: Math.round(p.size * pct) }));

  return (
    <div key={p.id} className="space-y-4 animate-fade-in">
      {/* Header with reachability pie */}
      <Card className="hover-lift">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-5">
            <PersonaAvatar personaId={p.id} personaName={p.name} size={56} />
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
            {/* Reachability pie */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-20 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reachabilityData} dataKey="value" cx="50%" cy="50%" innerRadius={22} outerRadius={36} paddingAngle={2} strokeWidth={0}>
                      {reachabilityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs font-semibold tabular-nums mt-1">{reachableCount.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">reachable</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar + Channel */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Behavioral profile</p>
              <InfoIcon tooltip="Each axis normalized 0–1. Hover axes for calculation details." />
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="oklch(0.91 0.005 320)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={4} textAnchor="middle" fontSize={10} fill="oklch(0.5 0.02 320)">
                          {payload.value}
                        </text>
                      </g>
                    )}
                  />
                  <Radar
                    dataKey="v"
                    stroke="oklch(0.35 0.12 320)"
                    fill="oklch(0.35 0.12 320)"
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const axis = payload[0].payload.axis as string;
                      const val = payload[0].value as number;
                      return (
                        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md max-w-[220px]">
                          <p className="text-xs font-medium">{axis}: {(val * 100).toFixed(0)}%</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{RADAR_EXPLANATIONS[axis]}</p>
                        </div>
                      );
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 px-1">
              {radarData.map((d) => (
                <div key={d.axis} className="info-tooltip">
                  <span className="text-[10px] text-muted-foreground cursor-help">{d.axis}: <span className="font-medium tabular-nums">{(d.v * 100).toFixed(0)}%</span></span>
                  <span className="tooltip-content">{RADAR_EXPLANATIONS[d.axis]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Channel reachability</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="channel" tick={{ fontSize: 11, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip formatter={(v) => [`${((v as number) * 100).toFixed(0)}%`, "Reach"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
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

      {/* Telehealth + Health Checkup */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Telehealth adoption & interaction</p>
              <InfoIcon tooltip="TH adoption = completed at least 1 teleconsultation. Funnel depth 0–5 tracks journey from homepage to booking success." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Adoption" value={`${(p.th_adoption_rate * 100).toFixed(1)}%`} />
              <MiniStat label="Avg consults" value={p.avg_th_consults.toFixed(1)} />
              <MiniStat label="Funnel depth" value={`${p.avg_th_funnel_depth.toFixed(1)}/5`} />
            </div>
            {/* TH funnel visualization */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">Funnel progress</p>
              <div className="flex items-center gap-1">
                {["Home", "Doctors", "Slot", "Book", "Done"].map((step, i) => {
                  const depth = p.avg_th_funnel_depth;
                  const filled = depth >= i + 1;
                  const partial = depth > i && depth < i + 1;
                  return (
                    <div key={step} className="flex-1">
                      <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: filled ? "100%" : partial ? `${(depth - i) * 100}%` : "0%",
                            background: "oklch(0.35 0.12 320)",
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 text-center">{step}</p>
                    </div>
                  );
                })}
              </div>
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

        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Health checkup behavior</p>
              <InfoIcon tooltip="HC adoption = completed at least 1 health checkup booking. Wallet expiry = avg days until HC wallet credit expires." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Adoption" value={`${(p.hc_adoption_rate * 100).toFixed(1)}%`} />
              <MiniStat label="Avg bookings" value={p.avg_hc_bookings.toFixed(1)} />
              <MiniStat label="Funnel depth" value={`${p.avg_hc_funnel_depth.toFixed(1)}/5`} />
            </div>
            {/* HC funnel visualization */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground">Funnel progress</p>
              <div className="flex items-center gap-1">
                {["Home", "List", "Add", "Slot", "Done"].map((step, i) => {
                  const depth = p.avg_hc_funnel_depth;
                  const filled = depth >= i + 1;
                  const partial = depth > i && depth < i + 1;
                  return (
                    <div key={step} className="flex-1">
                      <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: filled ? "100%" : partial ? `${(depth - i) * 100}%` : "0%",
                            background: "oklch(0.65 0.18 15)",
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 text-center">{step}</p>
                    </div>
                  );
                })}
              </div>
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

      {/* App behavior + Demographics */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">App behavior</p>
              <InfoIcon tooltip="App install status, launch frequency, and recency. Push notifications only reach users with the app installed." />
            </div>
            {/* App install pie */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={appData} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={34} paddingAngle={3} strokeWidth={0}>
                      {appData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {appData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-muted-foreground flex-1">{d.name}</span>
                    <span className="font-medium tabular-nums">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Avg launches (30d)" value={p.avg_app_launches_30d.toFixed(1)} />
              <MiniStat label="Days since active" value={`${p.avg_days_since_active.toFixed(0)}d`} />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Demographics</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">{p.avg_age}</p>
                <p className="text-[10px] text-muted-foreground">Avg age</p>
              </div>
              {/* Gender split mini bars */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {genderData.map((g) => (
                    <div key={g.name} className="flex items-center gap-1 text-[10px]">
                      <span className="w-2 h-2 rounded-full" style={{ background: g.fill }} />
                      <span className="text-muted-foreground">{g.name} {g.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-muted">
                  <div className="h-full rounded-l-full" style={{ width: `${(1 - p.female_share) * 100}%`, background: genderData[0].fill }} />
                  <div className="h-full rounded-r-full" style={{ width: `${p.female_share * 100}%`, background: genderData[1].fill }} />
                </div>
              </div>
            </div>
            {/* Age distribution */}
            {ageDistData.length > 0 && (
              <>
                <Separator />
                <p className="text-[10px] text-muted-foreground">Age distribution</p>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageDistData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => [(v as number).toLocaleString(), "Users"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="count" fill="oklch(0.35 0.12 320)" radius={[3, 3, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* HRA Status + Org Type + Engagement */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">HRA status</p>
              <InfoIcon tooltip="Health Risk Assessment completion status. Completed with goal = user set a health goal after assessment." />
            </div>
            {Object.entries(p.hra_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([status, pct]) => (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{status.replace(/_/g, " ")}</span>
                    <span className="tabular-nums font-medium">{(pct * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={pct * 100} className="h-1" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Org type split</p>
              <InfoIcon tooltip="Organisation segment distribution. ENT = Enterprise, SMB = Small & Medium, MM = Mid-Market, EOR = Employer of Record." />
            </div>
            {/* Org type bar chart */}
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orgData} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [(v as number).toLocaleString(), "Users"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={24}>
                    {orgData.map((d) => <Cell key={d.type} fill={ORG_COLORS[d.type] || "oklch(0.5 0 0)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {orgData.map((d) => (
                <div key={d.type} className="flex items-center gap-1 text-[10px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: ORG_COLORS[d.type] || "oklch(0.5 0 0)" }} />
                  <span className="text-muted-foreground">{d.type} {d.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
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
      </div>

      {/* Engagement + Notification + Lifecycle */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Engagement</p>
              <InfoIcon tooltip="Key engagement metrics. Campaign fatigue = likelihood of user opting out or ignoring campaigns." />
            </div>
            <StatRow label="App installed" value={`${(p.app_installed_share * 100).toFixed(0)}%`} />
            <StatRow label="App launches (30d)" value={p.avg_app_launches_30d.toFixed(1)} />
            <StatRow label="Days since active" value={`${p.avg_days_since_active.toFixed(0)}d`} alert={p.avg_days_since_active > 60} />
            <StatRow label="Notif response" value={`${(p.avg_notif_response_rate * 100).toFixed(0)}%`} />
            <StatRow label="Campaign fatigue" value={`${(p.avg_campaign_fatigue * 100).toFixed(0)}%`} alert={p.avg_campaign_fatigue > 0.5} />
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Lifecycle distribution</p>
            {Object.entries(p.lifecycle_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([state, pct]) => (
                <div key={state}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{state.replace(/_/g, " ")}</span>
                    <span className="tabular-nums">{(pct * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={pct * 100} className="h-1" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="pt-4 pb-3 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Wallet & tenure</p>
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold tabular-nums tracking-tight">{p.avg_tenure_months.toFixed(0)} mo</p>
                <p className="text-[10px] text-muted-foreground">Avg tenure</p>
              </div>
              <Separator />
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Wallet expiry</span>
                  <span className="font-medium tabular-nums">{p.avg_wallet_expiry_days.toFixed(0)}d</span>
                </div>
                <Progress value={Math.min((p.avg_wallet_expiry_days / 365) * 100, 100)} className="h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">DND share</span>
                  <span className={`font-medium tabular-nums ${p.dnd_share > 0.05 ? "text-destructive" : ""}`}>{(p.dnd_share * 100).toFixed(1)}%</span>
                </div>
                <Progress value={p.dnd_share * 100} className="h-1.5" />
              </div>
            </div>
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

function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <span className="info-tooltip">
      <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
      <span className="tooltip-content" style={{ whiteSpace: "normal", maxWidth: 240 }}>{tooltip}</span>
    </span>
  );
}
