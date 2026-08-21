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
      <div className="py-16 max-w-md mx-auto">
        <Card className="border-destructive/20">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-sm font-medium mb-1">Backend not running</p>
            <p className="text-xs text-muted-foreground mb-4">Start the API server to load persona data.</p>
            <code className="text-xs bg-muted px-4 py-2 rounded-lg font-mono inline-block">cd backend && python3 server.py</code>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!personas.length) {
    return (
      <div className="space-y-8 py-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />)}
          </div>
          <div className="col-span-8 h-96 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between animate-fade-in">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Personas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {personas.length} behavioral personas from K-Means clustering
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wider rounded-full px-3">OBSERVED</Badge>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 space-y-1.5">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left rounded-2xl border transition-all duration-200 p-3.5 flex items-center gap-3.5 ${
                selected?.id === p.id
                  ? "border-primary/30 bg-primary/5 shadow-sm"
                  : "border-transparent hover:bg-muted/60"
              }`}
            >
              <PersonaAvatar personaId={p.id} personaName={p.name} size={36} />
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] truncate leading-snug ${selected?.id === p.id ? "font-medium text-primary" : "font-medium"}`}>
                  {p.name}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {p.size.toLocaleString()} users · {(p.share * 100).toFixed(1)}%
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground/40 tabular-nums">#{p.rank}</span>
            </button>
          ))}
        </div>

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
  whatsapp: "WhatsApp", push: "Push", email: "Email",
};

const CHANNEL_COLORS: Record<string, string> = {
  WhatsApp: "#1baf7a",
  Email: "#2a78d6",
  Push: "#eb6834",
};

const ORG_COLORS: Record<string, string> = {
  ENT: "oklch(0.52 0.105 185)",
  SMB: "#eb6834",
  MM: "#1baf7a",
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
    { name: "Reachable", value: reachableCount, fill: "#1baf7a" },
    { name: "Unreachable", value: unreachableCount, fill: "oklch(0.93 0.005 250)" },
  ];

  const ageDistData = p.age_distribution
    ? Object.entries(p.age_distribution).map(([label, count]) => ({ label, count }))
    : [];

  const genderData = [
    { name: "Male", value: p.male_count || Math.round(p.size * (1 - p.female_share)), fill: "#2a78d6" },
    { name: "Female", value: p.female_count || Math.round(p.size * p.female_share), fill: "#e87da0" },
  ];

  const appData = [
    { name: "Installed", value: p.app_installed_count || Math.round(p.size * p.app_installed_share), fill: "#1baf7a" },
    { name: "Not installed", value: p.app_not_installed_count || Math.round(p.size * (1 - p.app_installed_share)), fill: "oklch(0.75 0.15 65)" },
  ];

  const orgData = p.org_type_counts
    ? Object.entries(p.org_type_counts).map(([type, count]) => ({ type, count }))
    : Object.entries(p.segment_mix).map(([type, pct]) => ({ type, count: Math.round(p.size * pct) }));

  return (
    <div key={p.id} className="space-y-5 animate-fade-in">
      {/* Header */}
      <Card className="card-elevated border-border/40">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start gap-5">
            <PersonaAvatar personaId={p.id} personaName={p.name} size={56} />
            <div className="flex-1">
              <h2 className="text-xl font-semibold tracking-tight">{p.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {p.size.toLocaleString()} users · {(p.share * 100).toFixed(1)}% of base
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="text-[10px] font-normal rounded-full px-2.5">Age {p.avg_age}</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal rounded-full px-2.5">{(p.female_share * 100).toFixed(0)}% female</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal rounded-full px-2.5">Tenure {p.avg_tenure_months.toFixed(0)}mo</Badge>
                <Badge variant="secondary" className="text-[10px] font-normal rounded-full px-2.5">Peak {p.peak_hour_mode}:00</Badge>
                {p.avg_campaign_fatigue > 0.5 && <Badge variant="destructive" className="text-[10px] font-normal rounded-full px-2.5">High fatigue</Badge>}
                {p.dnd_share > 0.05 && <Badge variant="destructive" className="text-[10px] font-normal rounded-full px-2.5">DND {(p.dnd_share * 100).toFixed(0)}%</Badge>}
              </div>
            </div>
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
              <p className="text-[10px] text-muted-foreground/60">reachable</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar + Channel */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Behavioral profile</p>
              <InfoIcon tooltip="Each axis normalized 0–1. Hover axes for calculation details." />
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="oklch(0.93 0.005 250)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }} />
                  <Radar dataKey="v" stroke="oklch(0.52 0.105 185)" fill="oklch(0.52 0.105 185)" fillOpacity={0.12} strokeWidth={1.5} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const axis = payload[0].payload.axis as string;
                      const val = payload[0].value as number;
                      return (
                        <div className="bg-card border border-border/40 rounded-xl px-3 py-2 shadow-lg max-w-[220px]">
                          <p className="text-xs font-medium">{axis}: {(val * 100).toFixed(0)}%</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{RADAR_EXPLANATIONS[axis]}</p>
                        </div>
                      );
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 px-1">
              {radarData.map((d) => (
                <div key={d.axis} className="info-tooltip">
                  <span className="text-[10px] text-muted-foreground/60 cursor-help">{d.axis}: <span className="font-medium tabular-nums text-foreground/70">{(d.v * 100).toFixed(0)}%</span></span>
                  <span className="tooltip-content">{RADAR_EXPLANATIONS[d.axis]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-3">Channel reachability</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="channel" tick={{ fontSize: 11, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} width={65} />
                  <Tooltip formatter={(v) => [`${((v as number) * 100).toFixed(0)}%`, "Reach"]} contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid oklch(0.93 0.005 250)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }} />
                  <Bar dataKey="reach" radius={[0, 6, 6, 0]} barSize={22}>
                    {channelData.map((d) => (
                      <Cell key={d.channel} fill={CHANNEL_COLORS[d.channel] || "#888"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TH + HC */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Telehealth adoption</p>
              <InfoIcon tooltip="TH adoption = completed at least 1 teleconsultation. Funnel depth 0–5 tracks journey from homepage to booking success." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Adoption" value={`${(p.th_adoption_rate * 100).toFixed(1)}%`} />
              <MiniStat label="Avg consults" value={p.avg_th_consults.toFixed(1)} />
              <MiniStat label="Funnel depth" value={`${p.avg_th_funnel_depth.toFixed(1)}/5`} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground/60">Funnel progress</p>
              <div className="flex items-center gap-1">
                {["Home", "Doctors", "Slot", "Book", "Done"].map((step, i) => {
                  const depth = p.avg_th_funnel_depth;
                  const filled = depth >= i + 1;
                  const partial = depth > i && depth < i + 1;
                  return (
                    <div key={step} className="flex-1">
                      <div className="h-1.5 rounded-full overflow-hidden bg-muted/60">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: filled ? "100%" : partial ? `${(depth - i) * 100}%` : "0%",
                            background: "oklch(0.52 0.105 185)",
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5 text-center">{step}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            {Object.keys(p.top_th_specialties).length > 0 && (
              <>
                <Separator className="opacity-40" />
                <p className="text-[10px] text-muted-foreground/60">Top specialties</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(p.top_th_specialties).map(([spec, count]) => (
                    <Badge key={spec} variant="secondary" className="text-[10px] font-normal rounded-full px-2.5">
                      {spec} ({count})
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Health checkup behavior</p>
              <InfoIcon tooltip="HC adoption = completed at least 1 health checkup booking. Wallet expiry = avg days until HC wallet credit expires." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Adoption" value={`${(p.hc_adoption_rate * 100).toFixed(1)}%`} />
              <MiniStat label="Avg bookings" value={p.avg_hc_bookings.toFixed(1)} />
              <MiniStat label="Funnel depth" value={`${p.avg_hc_funnel_depth.toFixed(1)}/5`} />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground/60">Funnel progress</p>
              <div className="flex items-center gap-1">
                {["Home", "List", "Add", "Slot", "Done"].map((step, i) => {
                  const depth = p.avg_hc_funnel_depth;
                  const filled = depth >= i + 1;
                  const partial = depth > i && depth < i + 1;
                  return (
                    <div key={step} className="flex-1">
                      <div className="h-1.5 rounded-full overflow-hidden bg-muted/60">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: filled ? "100%" : partial ? `${(depth - i) * 100}%` : "0%",
                            background: "#eb6834",
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5 text-center">{step}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <Separator className="opacity-40" />
            <p className="text-[10px] text-muted-foreground/60">Wallet expiry</p>
            <div className="flex items-center gap-2">
              <Progress value={Math.min((p.avg_wallet_expiry_days / 365) * 100, 100)} className="h-1.5 flex-1" />
              <span className="text-xs tabular-nums font-medium">{p.avg_wallet_expiry_days.toFixed(0)}d</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* App + Demographics */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">App behavior</p>
              <InfoIcon tooltip="App install status, launch frequency, and recency. Push notifications only reach users with the app installed." />
            </div>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={appData} dataKey="value" cx="50%" cy="50%" innerRadius={20} outerRadius={34} paddingAngle={3} strokeWidth={0}>
                      {appData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {appData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2.5 text-[12px]">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-muted-foreground/60 flex-1">{d.name}</span>
                    <span className="font-medium tabular-nums">{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator className="opacity-40" />
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Avg launches (30d)" value={p.avg_app_launches_30d.toFixed(1)} />
              <MiniStat label="Days since active" value={`${p.avg_days_since_active.toFixed(0)}d`} />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-3.5">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Demographics</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[26px] font-semibold tabular-nums tracking-tight leading-none">{p.avg_age}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Avg age</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  {genderData.map((g) => (
                    <div key={g.name} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-2 h-2 rounded-full" style={{ background: g.fill }} />
                      <span className="text-muted-foreground/60">{g.name} {g.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-muted/60">
                  <div className="h-full rounded-l-full" style={{ width: `${(1 - p.female_share) * 100}%`, background: genderData[0].fill }} />
                  <div className="h-full rounded-r-full" style={{ width: `${p.female_share * 100}%`, background: genderData[1].fill }} />
                </div>
              </div>
            </div>
            {ageDistData.length > 0 && (
              <>
                <Separator className="opacity-40" />
                <p className="text-[10px] text-muted-foreground/60">Age distribution</p>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageDistData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => [(v as number).toLocaleString(), "Users"]} contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid oklch(0.93 0.005 250)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }} />
                      <Bar dataKey="count" fill="oklch(0.52 0.105 185)" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* HRA + Org + Segment */}
      <div className="grid grid-cols-3 gap-5">
        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">HRA status</p>
              <InfoIcon tooltip="Health Risk Assessment completion status. Completed with goal = user set a health goal after assessment." />
            </div>
            {Object.entries(p.hra_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([status, pct]) => (
                <div key={status}>
                  <div className="flex justify-between text-[12px] mb-0.5">
                    <span className="text-muted-foreground/60">{status.replace(/_/g, " ")}</span>
                    <span className="tabular-nums font-medium">{(pct * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={pct * 100} className="h-1" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">Org type split</p>
              <InfoIcon tooltip="Organisation segment distribution. ENT = Enterprise, SMB = Small & Medium, MM = Mid-Market, EOR = Employer of Record." />
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orgData} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
                  <XAxis dataKey="type" tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [(v as number).toLocaleString(), "Users"]} contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid oklch(0.93 0.005 250)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={24}>
                    {orgData.map((d) => <Cell key={d.type} fill={ORG_COLORS[d.type] || "#888"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {orgData.map((d) => (
                <div key={d.type} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: ORG_COLORS[d.type] || "#888" }} />
                  <span className="text-muted-foreground/60">{d.type} {d.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-2.5">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">Segment mix</p>
            {Object.entries(p.segment_mix)
              .sort(([, a], [, b]) => b - a)
              .map(([seg, val]) => (
                <div key={seg}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-muted-foreground/60">{seg}</span>
                    <span className="font-medium tabular-nums">{(val * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={val * 100} className="h-1" />
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Engagement + Lifecycle + Wallet */}
      <div className="grid grid-cols-3 gap-5">
        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">Engagement</p>
              <InfoIcon tooltip="Key engagement metrics. Campaign fatigue = likelihood of user opting out or ignoring campaigns." />
            </div>
            <StatRow label="App installed" value={`${(p.app_installed_share * 100).toFixed(0)}%`} />
            <StatRow label="App launches (30d)" value={p.avg_app_launches_30d.toFixed(1)} />
            <StatRow label="Days since active" value={`${p.avg_days_since_active.toFixed(0)}d`} alert={p.avg_days_since_active > 60} />
            <StatRow label="Notif response" value={`${(p.avg_notif_response_rate * 100).toFixed(0)}%`} />
            <StatRow label="Campaign fatigue" value={`${(p.avg_campaign_fatigue * 100).toFixed(0)}%`} alert={p.avg_campaign_fatigue > 0.5} />
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-2.5">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">Lifecycle distribution</p>
            {Object.entries(p.lifecycle_distribution)
              .sort(([, a], [, b]) => b - a)
              .map(([state, pct]) => (
                <div key={state}>
                  <div className="flex justify-between text-[12px] mb-0.5">
                    <span className="text-muted-foreground/60">{state.replace(/_/g, " ")}</span>
                    <span className="tabular-nums font-medium">{(pct * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={pct * 100} className="h-1" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="card-elevated border-border/40">
          <CardContent className="pt-5 pb-4 space-y-2.5">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-1">Wallet & tenure</p>
            <div className="space-y-3.5">
              <div>
                <p className="text-xl font-semibold tabular-nums tracking-tight leading-none">{p.avg_tenure_months.toFixed(0)} mo</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Avg tenure</p>
              </div>
              <Separator className="opacity-40" />
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-muted-foreground/60">Wallet expiry</span>
                  <span className="font-medium tabular-nums">{p.avg_wallet_expiry_days.toFixed(0)}d</span>
                </div>
                <Progress value={Math.min((p.avg_wallet_expiry_days / 365) * 100, 100)} className="h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-muted-foreground/60">DND share</span>
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
      <p className="text-lg font-semibold tabular-nums tracking-tight leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-1">{label}</p>
    </div>
  );
}

function StatRow({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-muted-foreground/60">{label}</span>
      <span className={`tabular-nums ${alert ? "text-warning font-medium" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <span className="info-tooltip">
      <Info className="w-3 h-3 text-muted-foreground/40 cursor-help" />
      <span className="tooltip-content" style={{ whiteSpace: "normal", maxWidth: 240 }}>{tooltip}</span>
    </span>
  );
}
