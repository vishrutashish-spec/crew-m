"use client";

import { useEffect, useState } from "react";
import {
  getPersonas,
  getAudienceRecommendation,
  simulateCampaign,
  type Persona,
  type AudienceScore,
  type SimulationResponse,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  FlaskConical,
  Check,
  ChevronDown,
  Clock,
  Hash,
  MessageSquare,
  Zap,
} from "lucide-react";

const OBJECTIVES = [
  { value: "th_activation", label: "Telehealth Activation", desc: "Drive first TH consultation" },
  { value: "hc_activation", label: "Health Checkup Activation", desc: "Drive first HC booking" },
  { value: "app_install", label: "App Install", desc: "Move no-app users to install" },
  { value: "reengagement", label: "Re-engagement", desc: "Bring dormant users back" },
  { value: "hc_crosssell", label: "HC Cross-sell", desc: "Sell HC to TH-only users" },
];

const CHANNELS = [
  { value: "", label: "Auto (recommended)" },
  { value: "push", label: "Push Notification" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "in_app", label: "In-App" },
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

  async function runSimulation() {
    setLoading(true);
    setResult(null);
    try {
      const res = await simulateCampaign({
        objective,
        channel: channel || undefined,
        persona_ids: selectedPersonas.length > 0 ? selectedPersonas : undefined,
        copy_text: copyText || undefined,
        send_hour: sendHour,
      });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  function togglePersona(id: number) {
    setSelectedPersonas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  if (error && personas.length === 0) {
    return (
      <div className="py-12">
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Backend not running</p>
                <p className="text-sm text-muted-foreground mt-1">Start the API server to use the simulator.</p>
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

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Simulate</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure a campaign and predict performance before sending
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">PREDICTED</Badge>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Configuration */}
        <div className="col-span-5 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Campaign Objective</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj.value}
                  onClick={() => setObjective(obj.value)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-all border ${
                    objective === obj.value
                      ? "bg-primary/5 border-primary/30 text-foreground"
                      : "bg-transparent border-transparent hover:bg-muted"
                  }`}
                >
                  <p className={objective === obj.value ? "font-medium" : ""}>{obj.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{obj.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Channel</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CHANNELS.map((ch) => (
                    <option key={ch.value} value={ch.value}>{ch.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Send Time</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <select
                  value={sendHour ?? ""}
                  onChange={(e) => setSendHour(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Auto (use persona peak hour)</option>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{`${i.toString().padStart(2, "0")}:00`}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <CardTitle className="text-sm font-medium text-muted-foreground">Campaign Copy (optional)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <textarea
                value={copyText}
                onChange={(e) => setCopyText(e.target.value)}
                placeholder="Enter campaign message for copy analysis..."
                rows={3}
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </CardContent>
          </Card>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FlaskConical className="w-4 h-4" />
            {loading ? "Simulating..." : "Run Simulation"}
          </button>
        </div>

        {/* Right side */}
        <div className="col-span-7 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Target Audience</CardTitle>
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">RECOMMENDED</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {audienceLoading ? "Scoring personas..." : "Ranked by objective fit. Top 3 auto-selected."}
              </p>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {audienceScores.map((score) => {
                const persona = personas.find((p) => p.id === score.persona_id);
                const isSelected = selectedPersonas.includes(score.persona_id);
                return (
                  <button
                    key={score.persona_id}
                    onClick={() => togglePersona(score.persona_id)}
                    className={`w-full text-left px-3 py-3 rounded-md transition-all flex items-center gap-3 border ${
                      isSelected
                        ? "bg-primary/5 border-primary/30"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    {persona && <PixelAvatar personaId={persona.id} size={28} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{score.persona_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {persona ? `${persona.size.toLocaleString()} users` : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{score.reasons[0]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-sm font-medium ${
                        score.score >= 70 ? "text-success" : score.score >= 40 ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {score.score}
                      </span>
                      <p className="text-[10px] text-muted-foreground">fit</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {result && <SimulationResult result={result} />}
        </div>
      </div>
    </div>
  );
}

function SimulationResult({ result }: { result: SimulationResponse }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">Simulation Results</CardTitle>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              {result.label}
            </Badge>
            <Badge
              variant={result.confidence === "high" ? "default" : "secondary"}
              className="text-xs font-normal"
            >
              {result.confidence} confidence
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{result.evidence_basis}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {result.warning && (
          <div className="bg-warning/10 border border-warning/30 rounded-md px-3 py-2 text-sm text-warning-foreground flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <span>{result.warning}</span>
          </div>
        )}

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Target Audience</p>
          <p className="text-2xl font-semibold tracking-tight">{result.audience_size.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">users in selected personas</p>
        </div>

        <Separator />

        {result.funnel && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-3">Predicted Funnel</p>
            <div className="space-y-3">
              <FunnelStep label="Sent" count={result.funnel.sent} rate={1} total={result.funnel.sent} />
              <FunnelStep label="Delivered" count={result.funnel.delivered} rate={result.funnel.delivery_rate} total={result.funnel.sent} />
              <FunnelStep label="Opened" count={result.funnel.opened} rate={result.funnel.open_rate} total={result.funnel.sent} />
              <FunnelStep label="Clicked" count={result.funnel.clicked} rate={result.funnel.click_rate} total={result.funnel.sent} />
              <FunnelStep label="Converted" count={result.funnel.converted} rate={result.funnel.conversion_rate} total={result.funnel.sent} highlight />
            </div>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Channel</p>
            <p className="text-sm font-medium capitalize">{result.channel.selected}</p>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground mt-1">
              {result.channel.label}
            </Badge>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Timing</p>
            <p className="text-sm">{result.timing.note}</p>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground mt-1">
              {result.timing.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStep({ label, count, rate, total, highlight }: {
  label: string; count: number; rate: number; total: number; highlight?: boolean;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className={highlight ? "text-primary font-medium" : ""}>{label}</span>
        <span className="font-medium">
          {count.toLocaleString()}
          <span className="text-muted-foreground ml-1.5 font-normal">({(rate * 100).toFixed(1)}%)</span>
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
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
