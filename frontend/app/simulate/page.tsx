"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getPersonas,
  getAudienceRecommendation,
  simulateCampaign,
  type Persona,
  type AudienceScore,
  type SimulationResponse,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AlertTriangle, Check, ChevronDown, ArrowRight, RotateCcw } from "lucide-react";

const OBJECTIVES = [
  { value: "th_activation", label: "Telehealth activation", desc: "Drive first TH consultation" },
  { value: "hc_activation", label: "Health checkup activation", desc: "Drive first HC booking" },
  { value: "app_install", label: "App install", desc: "Move no-app users to install" },
  { value: "reengagement", label: "Re-engagement", desc: "Bring dormant users back" },
  { value: "hc_crosssell", label: "HC cross-sell", desc: "Sell HC to TH-only users" },
];

const CHANNELS = [
  { value: "", label: "Auto (best channel per audience)" },
  { value: "push", label: "Push notification" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
];

export default function Simulate() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<number[]>([]);
  const [objective, setObjective] = useState("th_activation");
  const [channel, setChannel] = useState("");
  const [copyText, setCopyText] = useState("");
  const [sendHour, setSendHour] = useState<number | undefined>(undefined);
  const [audienceScores, setAudienceScores] = useState<AudienceScore[]>([]);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [prevResult, setPrevResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPersonas()
      .then((res) => setPersonas(res.personas))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setAudienceLoading(true);
    getAudienceRecommendation(objective)
      .then((res) => {
        setAudienceScores(res.rankings);
        setSelectedPersonas(res.rankings.slice(0, 3).map((r) => r.persona_id));
      })
      .catch(() => {})
      .finally(() => setAudienceLoading(false));
  }, [objective]);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    try {
      const res = await simulateCampaign({
        objective,
        channel: channel || undefined,
        persona_ids: selectedPersonas.length > 0 ? selectedPersonas : undefined,
        copy_text: copyText || undefined,
        send_hour: sendHour,
      });
      if (result) setPrevResult(result);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }, [objective, channel, selectedPersonas, copyText, sendHour, result]);

  function togglePersona(id: number) {
    setSelectedPersonas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  if (error && personas.length === 0) {
    return (
      <div className="py-12 max-w-lg">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Backend not running</p>
                <p className="text-sm text-muted-foreground mt-1">Start the API server to use the simulator.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaign Simulator</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure, predict, and compare campaign scenarios
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wide">PREDICTED</Badge>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Configuration */}
        <div className="col-span-5 space-y-4">
          {/* Objective */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Campaign objective</p>
              <div className="space-y-1">
                {OBJECTIVES.map((obj) => (
                  <button
                    key={obj.value}
                    onClick={() => setObjective(obj.value)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                      objective === obj.value
                        ? "bg-primary/5 border border-primary/30"
                        : "border border-transparent hover:bg-muted"
                    }`}
                  >
                    <span className={objective === obj.value ? "font-medium" : ""}>{obj.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{obj.desc}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Channel + Timing */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Channel</p>
                <div className="relative">
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {CHANNELS.map((ch) => (
                      <option key={ch.value} value={ch.value}>{ch.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Send time</p>
                <div className="relative">
                  <select
                    value={sendHour ?? ""}
                    onChange={(e) => setSendHour(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Auto (peak hour)</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{`${i.toString().padStart(2, "0")}:00`}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Copy */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Campaign copy (optional)</p>
              <textarea
                value={copyText}
                onChange={(e) => setCopyText(e.target.value)}
                placeholder="Enter campaign message for copy analysis..."
                rows={2}
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </CardContent>
          </Card>

          {/* Run */}
          <button
            onClick={runSimulation}
            disabled={loading || selectedPersonas.length === 0}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {loading ? "Simulating..." : result ? "Re-simulate" : "Run simulation"}
          </button>
        </div>

        {/* Right: Audience + Results */}
        <div className="col-span-7 space-y-4">
          {/* Audience Selector */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Target audience</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {audienceLoading ? "Scoring..." : `${selectedPersonas.length} selected · ${audienceScores.reduce((s, a) => selectedPersonas.includes(a.persona_id) ? s + (personas.find(p => p.id === a.persona_id)?.size || 0) : s, 0).toLocaleString()} users`}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wide">RECOMMENDED</Badge>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {audienceScores.map((score) => {
                  const persona = personas.find((p) => p.id === score.persona_id);
                  const isSelected = selectedPersonas.includes(score.persona_id);
                  return (
                    <button
                      key={score.persona_id}
                      onClick={() => togglePersona(score.persona_id)}
                      className={`w-full text-left px-3 py-2.5 rounded-md transition-all flex items-center gap-3 ${
                        isSelected ? "bg-primary/5 border border-primary/30" : "border border-transparent hover:bg-muted"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      {persona && <PersonaAvatar personaId={persona.id} size={24} />}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate block">{score.persona_name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {persona ? `${persona.size.toLocaleString()} users` : ""}
                          {score.reasons[0] ? ` · ${score.reasons[0]}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-medium tabular-nums ${
                          score.score >= 70 ? "text-success" : score.score >= 40 ? "text-warning" : "text-muted-foreground"
                        }`}>
                          {score.score}
                        </span>
                        <div className="w-12">
                          <Progress value={score.score} className="h-1" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {result && <SimulationResult result={result} prevResult={prevResult} />}

          {!result && !loading && (
            <Card className="border-dashed">
              <CardContent className="py-10 flex flex-col items-center text-center">
                <svg className="w-8 h-8 text-muted-foreground mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                  <path d="M8.5 2h7" /><path d="M7 16h10" />
                </svg>
                <p className="text-sm font-medium">Configure and run a simulation</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Select an objective, choose your audience, and predict campaign performance before sending.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SimulationResult({ result, prevResult }: { result: SimulationResponse; prevResult: SimulationResponse | null }) {
  const hasFunnel = result.funnel !== null;
  const hasPrev = prevResult?.funnel !== null && prevResult !== null;

  const funnelStages = hasFunnel ? [
    { label: "Sent", count: result.funnel!.sent, rate: 1, prev: hasPrev ? prevResult!.funnel!.sent : null },
    { label: "Delivered", count: result.funnel!.delivered, rate: result.funnel!.delivery_rate, prev: hasPrev ? prevResult!.funnel!.delivery_rate : null },
    { label: "Opened", count: result.funnel!.opened, rate: result.funnel!.open_rate, prev: hasPrev ? prevResult!.funnel!.open_rate : null },
    { label: "Clicked", count: result.funnel!.clicked, rate: result.funnel!.click_rate, prev: hasPrev ? prevResult!.funnel!.click_rate : null },
    { label: "Converted", count: result.funnel!.converted, rate: result.funnel!.conversion_rate, prev: hasPrev ? prevResult!.funnel!.conversion_rate : null },
  ] : [];

  const chartData = funnelStages.map((s) => ({
    name: s.label,
    current: s.count,
    ...(hasPrev && s.prev !== null ? { previous: Math.round((s.prev as number) * (prevResult?.audience_size || 0)) } : {}),
  }));

  return (
    <Card className="animate-fade-in">
      <CardContent className="pt-5 pb-4 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium">Simulation results</p>
            <p className="text-xs text-muted-foreground mt-0.5">{result.evidence_basis}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wide">
              {result.label}
            </Badge>
            <Badge
              variant={result.confidence === "high" ? "default" : result.confidence === "medium" ? "secondary" : "outline"}
              className="text-[10px] font-normal"
            >
              {result.confidence} confidence
            </Badge>
          </div>
        </div>

        {result.warning && (
          <div className="bg-warning/10 border border-warning/20 rounded-md px-3 py-2 text-xs text-warning-foreground flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
            <span>{result.warning}</span>
          </div>
        )}

        {/* Hero number */}
        <div className="flex items-end gap-6">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Audience size</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{result.audience_size.toLocaleString()}</p>
          </div>
          {hasFunnel && (
            <>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Est. conversions</p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums text-primary">{result.funnel!.converted.toLocaleString()}</p>
              </div>
              <div className="pb-1">
                <p className="text-xs text-muted-foreground">
                  {(result.funnel!.conversion_rate * 100).toFixed(1)}% conv. rate
                  {hasPrev && prevResult?.funnel && (
                    <DeltaBadge current={result.funnel!.conversion_rate} prev={prevResult.funnel.conversion_rate} />
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Funnel chart */}
        {hasFunnel && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Predicted funnel</p>
                {hasPrev && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "oklch(0.35 0.12 320)" }} /> Current</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "oklch(0.35 0.12 320 / 0.25)" }} /> Previous</span>
                  </div>
                )}
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.5 0.02 320)" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid oklch(0.91 0.005 320)" }}
                      formatter={(v: number, name: string) => [v.toLocaleString(), name === "current" ? "Current" : "Previous"]}
                    />
                    {hasPrev && <Bar dataKey="previous" fill="oklch(0.35 0.12 320 / 0.2)" radius={[4, 4, 0, 0]} barSize={20} />}
                    <Bar dataKey="current" radius={[4, 4, 0, 0]} barSize={20}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i === chartData.length - 1 ? "oklch(0.65 0.18 15)" : "oklch(0.35 0.12 320)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Rate breakdown */}
              <div className="grid grid-cols-4 gap-3 mt-3">
                {funnelStages.slice(1).map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-lg font-semibold tabular-nums">{(s.rate * 100).toFixed(1)}%</p>
                    <p className="text-[10px] text-muted-foreground">{s.label} rate</p>
                    {s.prev !== null && <DeltaBadge current={s.rate} prev={s.prev as number} />}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Channel + Timing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Channel</p>
            <p className="text-sm font-medium">{({whatsapp:"WhatsApp",push:"Push",email:"Email",sms:"SMS"} as Record<string,string>)[result.channel.selected] || result.channel.selected}</p>
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground mt-1 tracking-wide">
              {result.channel.label}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Timing</p>
            <p className="text-sm">{result.timing.note}</p>
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground mt-1 tracking-wide">
              {result.timing.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  const delta = current - prev;
  if (Math.abs(delta) < 0.001) return null;
  const pct = ((delta / Math.max(prev, 0.001)) * 100).toFixed(0);
  const isPositive = delta > 0;
  return (
    <span className={`text-[10px] font-medium ml-1.5 ${isPositive ? "text-success" : "text-destructive"}`}>
      {isPositive ? "+" : ""}{pct}%
    </span>
  );
}

function PersonaAvatar({ personaId, size = 24 }: { personaId: number; size?: number }) {
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded flex-shrink-0">
      <rect width={size} height={size} fill={bg} rx={2} />
      {pixels.map((row, y) =>
        row.map((on, x) => on ? <rect key={`${x}-${y}`} x={x * px} y={y * px} width={px} height={px} fill={fg} /> : null)
      )}
    </svg>
  );
}
