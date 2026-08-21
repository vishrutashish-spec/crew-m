"use client";

import { useState } from "react";
import { getAudienceRecommendation, type AudienceScore } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Target, ArrowRight } from "lucide-react";
import Link from "next/link";

const OBJECTIVES = [
  { value: "th_activation", label: "Telehealth Activation", desc: "Drive first TH consultation", icon: "💊" },
  { value: "hc_activation", label: "Health Checkup Activation", desc: "Drive first HC booking", icon: "🩺" },
  { value: "app_install", label: "App Install", desc: "Move no-app users to install", icon: "📱" },
  { value: "reengagement", label: "Re-engagement", desc: "Bring dormant users back", icon: "🔄" },
  { value: "hc_crosssell", label: "HC Cross-sell", desc: "Sell HC to TH-only users", icon: "🎯" },
];

export default function BuildAudience() {
  const [objective, setObjective] = useState<string | null>(null);
  const [rankings, setRankings] = useState<AudienceScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectObjective(obj: string) {
    setObjective(obj);
    setLoading(true);
    setError(null);
    try {
      const res = await getAudienceRecommendation(obj);
      setRankings(res.rankings);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Build Audience</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define your objective and get targeting recommendations
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">RECOMMENDED</Badge>
      </div>

      {/* Objective Selection */}
      <div>
        <p className="text-sm font-medium mb-3">What's your campaign objective?</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {OBJECTIVES.map((obj) => (
            <button
              key={obj.value}
              onClick={() => selectObjective(obj.value)}
              className={`text-left p-4 rounded-lg border transition-all ${
                objective === obj.value
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-border hover:border-border hover:shadow-sm"
              }`}
            >
              <span className="text-xl">{obj.icon}</span>
              <p className={`text-sm mt-2 ${objective === obj.value ? "font-medium text-primary" : "font-medium"}`}>
                {obj.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{obj.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Backend not running</p>
                <p className="text-sm text-muted-foreground mt-1">Start the API server to get recommendations.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && rankings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Persona Rankings</h2>
            <p className="text-xs text-muted-foreground">
              Scored by objective fit, channel reachability, and engagement likelihood
            </p>
          </div>

          <div className="space-y-2">
            {rankings.map((score, idx) => (
              <Card key={score.persona_id} className={idx < 3 ? "border-primary/20" : ""}>
                <CardContent className="py-4 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                    idx < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <PixelAvatar personaId={score.persona_id} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{score.persona_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {score.reasons.slice(0, 2).map((r, i) => (
                        <span key={i} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <span className={`text-lg font-semibold ${
                        score.score >= 70 ? "text-success" : score.score >= 40 ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {score.score}
                      </span>
                      <p className="text-[10px] text-muted-foreground">fit score</p>
                    </div>
                    <div className="w-20">
                      <Progress value={score.score} className="h-1.5" />
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal capitalize">{score.best_channel}</Badge>
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">{score.label}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-muted/30">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Ready to simulate?</p>
                  <p className="text-xs text-muted-foreground">
                    Take the top personas to the Campaign Simulator for performance prediction
                  </p>
                </div>
              </div>
              <Link
                href="/simulate"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
              >
                Open Simulator <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && !objective && !error && (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <Target className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Select a campaign objective above</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              The system will rank all discovered personas by their fit for your chosen objective,
              considering engagement patterns, channel reachability, and product adoption.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PixelAvatar({ personaId, size = 36 }: { personaId: number; size?: number }) {
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
