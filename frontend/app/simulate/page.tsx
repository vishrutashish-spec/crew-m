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
import { PersonaAvatar } from "@/components/persona-avatar";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AlertTriangle, Check, ChevronDown, ArrowRight, RotateCcw, MessageSquare, Sparkles, Users } from "lucide-react";

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

const SEGMENTS = [
  { value: "", label: "All segments" },
  { value: "ENT", label: "Enterprise" },
  { value: "SMB", label: "Small & Medium Business" },
  { value: "MM", label: "Mid-Market" },
  { value: "EOR", label: "Employer of Record" },
];

const ENGAGEMENT_LEVELS = [
  { value: "", label: "All engagement levels" },
  { value: "active", label: "Active (< 14 days)" },
  { value: "occasional", label: "Occasional (14-60 days)" },
  { value: "dormant", label: "Dormant (60+ days)" },
];

type AudienceBuilderStep = "idle" | "describing" | "questions" | "building" | "done";

interface SegmentRule {
  type: "event" | "property";
  name: string;
  operator: string;
  value: string;
}

const BASE_QUESTIONS = {
  thFunnel: "What telehealth funnel stage? (Never opened doctor list / Browsed but didn't book / Booked at least once / Completed consultation)",
  hcFunnel: "What health checkup status? (Never viewed / Browsed listings / Added to cart but didn't book / Completed booking)",
  product: "Which benefit product? (Telehealth / Health Checkup / Both / Neither used yet)",
  appStatus: "Do they have the Plum app? (Yes, must have app / No, targeting users without app / Doesn't matter)",
  orgSegment: "Which organisation segment? (Enterprise / SMB / Mid-Market / EOR / All)",
  lifecycle: "What lifecycle stage? (New users under 60 days / Active in last 30 days / Lapsing 30–90 days / Dormant 90+ days / All)",
  goal: "What is the campaign goal? (First-time activation / Repeat usage / Cross-sell HC→TH / Re-engagement)",
};

export default function Simulate() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<number[]>([]);
  const [objective, setObjective] = useState("th_activation");
  const [channel, setChannel] = useState("");
  const [segment, setSegment] = useState("");
  const [engagementLevel, setEngagementLevel] = useState("");
  const [copyText, setCopyText] = useState("");
  const [sendHour, setSendHour] = useState<number | undefined>(undefined);
  const [audienceScores, setAudienceScores] = useState<AudienceScore[]>([]);
  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [prevResult, setPrevResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audience description builder state
  const [builderStep, setBuilderStep] = useState<AudienceBuilderStep>("idle");
  const [audienceDescription, setAudienceDescription] = useState("");
  const [builderQuestions, setBuilderQuestions] = useState<string[]>([]);
  const [builderAnswers, setBuilderAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [builtSegment, setBuiltSegment] = useState<SegmentRule[]>([]);

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

  function startAudienceBuilder() {
    if (!audienceDescription.trim()) return;
    const description = audienceDescription.toLowerCase();

    // Generate contextual questions based on description
    const questions: string[] = [];
    if (description.includes("telehealth") || description.includes("th") || description.includes("doctor")) {
      questions.push("What stage of the telehealth funnel are they in? (Never visited / Browsed doctors / Selected a slot / Booked but didn't complete / Completed at least once)");
    } else if (description.includes("health check") || description.includes("hc")) {
      questions.push("What is their health checkup booking status? (Never booked / Browsed packages / Added to cart / Completed booking)");
    } else {
      questions.push(EXAMPLE_QUESTIONS[0]);
    }

    if (!description.includes("active") && !description.includes("dormant") && !description.includes("recent")) {
      questions.push(EXAMPLE_QUESTIONS[1]);
    }

    if (!description.includes("app")) {
      questions.push(EXAMPLE_QUESTIONS[2]);
    }

    if (!description.includes("enterprise") && !description.includes("smb") && !description.includes("mid-market")) {
      questions.push(EXAMPLE_QUESTIONS[3]);
    }

    questions.push(EXAMPLE_QUESTIONS[4]);

    setBuilderQuestions(questions.slice(0, 5));
    setBuilderAnswers([]);
    setCurrentQuestionIdx(0);
    setCurrentAnswer("");
    setBuilderStep("questions");
  }

  function submitAnswer() {
    if (!currentAnswer.trim()) return;
    const newAnswers = [...builderAnswers, currentAnswer];
    setBuilderAnswers(newAnswers);
    setCurrentAnswer("");

    if (currentQuestionIdx + 1 < builderQuestions.length) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      setBuilderStep("building");
      // Build segment rules from answers
      setTimeout(() => {
        const rules = buildSegmentRules(audienceDescription, newAnswers, builderQuestions);
        setBuiltSegment(rules);
        // Auto-select matching personas
        const matchingPersonas = findMatchingPersonas(personas, rules);
        if (matchingPersonas.length > 0) {
          setSelectedPersonas(matchingPersonas.map(p => p.id));
        }
        setBuilderStep("done");
      }, 800);
    }
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
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all duration-150 ${
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

          {/* Channel + Timing + Segment + Engagement */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Channel</p>
                <div className="relative">
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
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
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
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

          {/* Segment + Engagement filters */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Org segment</p>
                <div className="relative">
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
                  >
                    {SEGMENTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Engagement</p>
                <div className="relative">
                  <select
                    value={engagementLevel}
                    onChange={(e) => setEngagementLevel(e.target.value)}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
                  >
                    {ENGAGEMENT_LEVELS.map((e) => (
                      <option key={e.value} value={e.value}>{e.label}</option>
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
                className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-all duration-150"
              />
            </CardContent>
          </Card>

          {/* Run */}
          <button
            onClick={runSimulation}
            disabled={loading || selectedPersonas.length === 0}
            className="w-full bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 text-primary-foreground font-medium py-3 rounded-lg transition-all duration-150 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {loading ? "Simulating..." : result ? "Re-simulate" : "Run simulation"}
          </button>
        </div>

        {/* Right: Audience + Audience Builder + Results */}
        <div className="col-span-7 space-y-4">
          {/* Audience Description Builder */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Describe your audience</p>
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground tracking-wide ml-auto">RECOMMENDED</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Describe who you want to target in plain language, and we&apos;ll build the segment.
              </p>

              {builderStep === "idle" && (
                <div className="space-y-2">
                  <textarea
                    value={audienceDescription}
                    onChange={(e) => setAudienceDescription(e.target.value)}
                    placeholder="e.g., Enterprise employees who have the app but haven't tried telehealth yet, and were active in the last month..."
                    rows={2}
                    className="w-full bg-muted border border-border rounded-md px-3 py-2 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-all duration-150"
                  />
                  <button
                    onClick={startAudienceBuilder}
                    disabled={!audienceDescription.trim()}
                    className="bg-secondary hover:bg-secondary/80 active:scale-[0.98] disabled:opacity-40 text-secondary-foreground font-medium px-4 py-2 rounded-md transition-all duration-150 flex items-center gap-2 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Build segment
                  </button>
                </div>
              )}

              {builderStep === "questions" && (
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground">Question {currentQuestionIdx + 1} of {builderQuestions.length}</p>
                    <p className="text-sm font-medium">{builderQuestions[currentQuestionIdx]}</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                        placeholder="Type your answer..."
                        className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-150"
                        autoFocus
                      />
                      <button
                        onClick={submitAnswer}
                        disabled={!currentAnswer.trim()}
                        className="bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 text-primary-foreground px-3 py-2 rounded-md transition-all duration-150 text-xs"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  {builderAnswers.length > 0 && (
                    <div className="space-y-1">
                      {builderAnswers.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <Check className="w-3 h-3 text-success flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{builderQuestions[i]}</span>
                          <span className="font-medium ml-auto flex-shrink-0">{a}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => { setBuilderStep("idle"); setBuilderAnswers([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {builderStep === "building" && (
                <div className="flex items-center gap-3 py-4">
                  <RotateCcw className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Building segment from your answers...</span>
                </div>
              )}

              {builderStep === "done" && builtSegment.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <p className="text-xs font-medium">Built segment ({builtSegment.length} rules)</p>
                    </div>
                    <div className="space-y-1.5">
                      {builtSegment.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] bg-background rounded px-2.5 py-1.5 border border-border/50">
                          <Badge variant={rule.type === "event" ? "default" : "secondary"} className="text-[9px] font-normal px-1.5 py-0">
                            {rule.type === "event" ? "Event" : "Property"}
                          </Badge>
                          <span className="font-medium">{rule.name}</span>
                          <span className="text-muted-foreground">{rule.operator}</span>
                          <span className="text-primary font-medium">{rule.value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {selectedPersonas.length} matching persona{selectedPersonas.length !== 1 ? "s" : ""} auto-selected
                    </p>
                  </div>
                  <button
                    onClick={() => { setBuilderStep("idle"); setAudienceDescription(""); setBuiltSegment([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reset builder
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

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
                      className={`w-full text-left px-3 py-2.5 rounded-md transition-all duration-150 flex items-center gap-3 ${
                        isSelected ? "bg-primary/5 border border-primary/30" : "border border-transparent hover:bg-muted"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all duration-150 ${
                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      {persona && <PersonaAvatar personaId={persona.id} personaName={persona.name} size={24} />}
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
                      formatter={(v, name) => [(v as number).toLocaleString(), name === "current" ? "Current" : "Previous"]}
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

function buildSegmentRules(description: string, answers: string[], questions: string[]): SegmentRule[] {
  const rules: SegmentRule[] = [];
  const lower = description.toLowerCase();

  // Parse description for base rules
  if (lower.includes("enterprise") || lower.includes("ent")) {
    rules.push({ type: "property", name: "organisation_type", operator: "equals", value: "ENT" });
  }
  if (lower.includes("app installed") || lower.includes("have the app")) {
    rules.push({ type: "property", name: "has_app", operator: "equals", value: "true" });
  }
  if (lower.includes("no app") || lower.includes("without app")) {
    rules.push({ type: "property", name: "has_app", operator: "equals", value: "false" });
  }

  // Parse answers
  for (let i = 0; i < answers.length; i++) {
    const q = questions[i]?.toLowerCase() || "";
    const a = answers[i].toLowerCase();

    if (q.includes("telehealth") || q.includes("product")) {
      if (a.includes("never") || a.includes("neither")) {
        rules.push({ type: "event", name: "th_homepage_viewed", operator: "count equals", value: "0" });
      } else if (a.includes("browsed") || a.includes("telehealth")) {
        rules.push({ type: "event", name: "th_homepage_viewed", operator: "count >=", value: "1" });
        rules.push({ type: "event", name: "th_consultation_booked", operator: "count equals", value: "0" });
      } else if (a.includes("completed") || a.includes("both")) {
        rules.push({ type: "event", name: "th_consultation_booked", operator: "count >=", value: "1" });
      }
    }

    if (q.includes("health checkup")) {
      if (a.includes("never")) {
        rules.push({ type: "event", name: "hc_listing_viewed", operator: "count equals", value: "0" });
      } else if (a.includes("browsed") || a.includes("added")) {
        rules.push({ type: "event", name: "hc_listing_viewed", operator: "count >=", value: "1" });
      } else if (a.includes("completed")) {
        rules.push({ type: "event", name: "hc_booking_confirmed", operator: "count >=", value: "1" });
      }
    }

    if (q.includes("recently") || q.includes("active")) {
      if (a.includes("7")) {
        rules.push({ type: "property", name: "days_since_active", operator: "<=", value: "7" });
      } else if (a.includes("30")) {
        rules.push({ type: "property", name: "days_since_active", operator: "<=", value: "30" });
      } else if (a.includes("90")) {
        rules.push({ type: "property", name: "days_since_active", operator: "<=", value: "90" });
      }
    }

    if (q.includes("app installed")) {
      if (a.includes("yes")) {
        rules.push({ type: "property", name: "has_app", operator: "equals", value: "true" });
      } else if (a.includes("no") && !a.includes("doesn")) {
        rules.push({ type: "property", name: "has_app", operator: "equals", value: "false" });
      }
    }

    if (q.includes("organisation") || q.includes("organization")) {
      if (a.includes("enterprise")) {
        rules.push({ type: "property", name: "organisation_type", operator: "equals", value: "ENT" });
      } else if (a.includes("smb")) {
        rules.push({ type: "property", name: "organisation_type", operator: "equals", value: "SMB" });
      } else if (a.includes("mid")) {
        rules.push({ type: "property", name: "organisation_type", operator: "equals", value: "MM" });
      }
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return rules.filter((r) => {
    const key = `${r.type}:${r.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findMatchingPersonas(personas: Persona[], rules: SegmentRule[]): Persona[] {
  return personas.filter((p) => {
    for (const rule of rules) {
      if (rule.name === "organisation_type" && rule.value === "ENT" && p.segment_mix.ENT < 0.4) return false;
      if (rule.name === "organisation_type" && rule.value === "SMB" && p.segment_mix.SMB < 0.3) return false;
      if (rule.name === "has_app" && rule.value === "true" && p.app_installed_share < 0.3) return false;
      if (rule.name === "has_app" && rule.value === "false" && p.app_installed_share > 0.3) return false;
      if (rule.name === "days_since_active" && parseInt(rule.value) < 30 && p.avg_days_since_active > 30) return false;
      if (rule.name === "th_consultation_booked" && rule.operator.includes(">=") && p.th_adoption_rate < 0.05) return false;
      if (rule.name === "th_homepage_viewed" && rule.operator.includes("count equals") && rule.value === "0" && p.avg_th_funnel_depth > 0.5) return false;
    }
    return true;
  }).slice(0, 5);
}
