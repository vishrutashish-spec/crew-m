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

export default function CampaignSimulator() {
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
        const top3 = res.rankings.slice(0, 3).map((r) => r.persona_id);
        setSelectedPersonas(top3);
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
      <div className="max-w-7xl mx-auto px-4 py-12">
        <p className="text-red-400">Failed to load data. Is the backend running?</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Campaign Simulator</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configure a campaign and predict performance
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Configuration panel */}
        <div className="col-span-5 space-y-5">
          {/* Objective */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Campaign Objective</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj.value}
                  onClick={() => setObjective(obj.value)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                    objective === obj.value
                      ? "bg-blue-900/40 border border-blue-700 text-blue-200"
                      : "bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <p className="font-medium">{obj.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{obj.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Channel */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Channel</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-600"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Send Hour */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Send Time</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={sendHour ?? ""}
                onChange={(e) => setSendHour(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-600"
              >
                <option value="">Auto (use persona peak hour)</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{`${i.toString().padStart(2, "0")}:00`}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Copy Text */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">Campaign Copy (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={copyText}
                onChange={(e) => setCopyText(e.target.value)}
                placeholder="Enter campaign message for copy analysis..."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600 resize-none"
              />
            </CardContent>
          </Card>

          {/* Run button */}
          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? "Simulating..." : "Run Simulation"}
          </button>
        </div>

        {/* Right side: Audience + Results */}
        <div className="col-span-7 space-y-5">
          {/* Audience Selection */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-zinc-400">Target Audience</CardTitle>
                <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">RECOMMENDED</Badge>
              </div>
              <p className="text-xs text-zinc-500">
                {audienceLoading ? "Scoring..." : "Personas ranked by objective fit. Top 3 auto-selected."}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {audienceScores.map((score) => {
                const persona = personas.find((p) => p.id === score.persona_id);
                const isSelected = selectedPersonas.includes(score.persona_id);
                return (
                  <button
                    key={score.persona_id}
                    onClick={() => togglePersona(score.persona_id)}
                    className={`w-full text-left px-3 py-3 rounded-md transition-colors flex items-center gap-3 ${
                      isSelected
                        ? "bg-blue-900/30 border border-blue-800"
                        : "bg-zinc-800/30 border border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      isSelected ? "bg-blue-600 border-blue-500" : "border-zinc-600"
                    }`}>
                      {isSelected && <span className="text-white text-xs">&#10003;</span>}
                    </div>
                    {persona && <PixelAvatar personaId={persona.id} size={28} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{score.persona_name}</span>
                        <span className="text-xs text-zinc-500">
                          {persona ? `${persona.size.toLocaleString()} users` : ""}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{score.reasons[0]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-sm font-medium ${
                        score.score >= 70 ? "text-green-400" : score.score >= 40 ? "text-amber-400" : "text-zinc-500"
                      }`}>
                        {score.score}
                      </span>
                      <p className="text-xs text-zinc-500">fit</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Results */}
          {result && <SimulationResult result={result} />}
        </div>
      </div>
    </div>
  );
}

function SimulationResult({ result }: { result: SimulationResponse }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Simulation Results</CardTitle>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
              {result.label}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${
                result.confidence === "high"
                  ? "border-green-800 text-green-400"
                  : result.confidence === "medium"
                  ? "border-amber-800 text-amber-400"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              {result.confidence} confidence
            </Badge>
          </div>
        </div>
        <p className="text-xs text-zinc-500">{result.evidence_basis}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {result.warning && (
          <div className="bg-amber-900/20 border border-amber-800/50 rounded-md px-3 py-2 text-sm text-amber-300">
            {result.warning}
          </div>
        )}

        {/* Audience size */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Target Audience</p>
          <p className="text-2xl font-semibold">{result.audience_size.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">users in selected personas</p>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Funnel */}
        {result.funnel && (
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Predicted Funnel</p>
            <div className="space-y-3">
              <FunnelStep label="Sent" count={result.funnel.sent} rate={1} total={result.funnel.sent} />
              <FunnelStep label="Delivered" count={result.funnel.delivered} rate={result.funnel.delivery_rate} total={result.funnel.sent} />
              <FunnelStep label="Opened" count={result.funnel.opened} rate={result.funnel.open_rate} total={result.funnel.sent} />
              <FunnelStep label="Clicked" count={result.funnel.clicked} rate={result.funnel.click_rate} total={result.funnel.sent} />
              <FunnelStep label="Converted" count={result.funnel.converted} rate={result.funnel.conversion_rate} total={result.funnel.sent} highlight />
            </div>
          </div>
        )}

        <Separator className="bg-zinc-800" />

        {/* Channel + Timing */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Channel</p>
            <p className="text-sm font-medium capitalize">{result.channel.selected}</p>
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400 mt-1">
              {result.channel.label}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Timing</p>
            <p className="text-sm">{result.timing.note}</p>
            <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400 mt-1">
              {result.timing.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  label,
  count,
  rate,
  total,
  highlight,
}: {
  label: string;
  count: number;
  rate: number;
  total: number;
  highlight?: boolean;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className={highlight ? "text-blue-300 font-medium" : "text-zinc-300"}>{label}</span>
        <span className="text-zinc-200">
          {count.toLocaleString()}
          <span className="text-zinc-500 ml-1.5">({(rate * 100).toFixed(1)}%)</span>
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
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
