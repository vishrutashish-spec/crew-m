"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Circle, LoaderCircle, ExternalLink } from "lucide-react";

type CampaignType = "welcome" | "renewal";

type StepKey = "copy" | "creative" | "draft";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "copy", label: "Generate copy" },
  { key: "creative", label: "Render creative" },
  { key: "draft", label: "Build draft" },
];

interface CopyResult {
  subject: string;
  body: string;
}

interface CreativeResult {
  creativeUrl: string;
  stub?: boolean;
}

interface DraftResult {
  campaignName: string;
  reviewUrl: string;
  summary: string;
}

export default function NewCampaignPage() {
  const [amName, setAmName] = useState("Oshin");
  const [accountName, setAccountName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("welcome");
  const [logoUrl, setLogoUrl] = useState("");

  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [activeStep, setActiveStep] = useState<StepKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<CopyResult | null>(null);
  const [creative, setCreative] = useState<CreativeResult | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);

  const canSubmit = amName.trim() !== "" && accountName.trim() !== "" && status !== "running";

  async function runPipeline() {
    setStatus("running");
    setError(null);
    setCopy(null);
    setCreative(null);
    setDraft(null);

    const requestId = `web-${crypto.randomUUID()}`;

    try {
      setActiveStep("copy");
      const copyRes = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          amName,
          accountName,
          campaignType,
          logoUrl: logoUrl.trim() || undefined,
        }),
      });
      if (!copyRes.ok) throw new Error(`Copy generation failed (HTTP ${copyRes.status}). Check ANTHROPIC_API_KEY is set.`);
      const copyData: CopyResult = await copyRes.json();
      setCopy(copyData);

      setActiveStep("creative");
      const creativeRes = await fetch("/api/creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, copy: { ...copyData, campaignType } }),
      });
      if (!creativeRes.ok) throw new Error(`Creative rendering failed (HTTP ${creativeRes.status}).`);
      const creativeData: CreativeResult = await creativeRes.json();
      setCreative(creativeData);

      setActiveStep("draft");
      const draftRes = await fetch("/api/campaign/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          amName,
          accountName,
          campaignType,
          copy: copyData,
          creative: creativeData,
        }),
      });
      if (!draftRes.ok) throw new Error(`Draft assembly failed (HTTP ${draftRes.status}).`);
      const draftData: DraftResult = await draftRes.json();
      setDraft(draftData);

      setActiveStep(null);
      setStatus("done");
    } catch (err) {
      setActiveStep(null);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="py-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Generate copy, creative, and a CleverTap brief directly — no Slack needed
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Request details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Your name">
              <input
                value={amName}
                onChange={(e) => setAmName(e.target.value)}
                disabled={status === "running"}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </Field>
            <Field label="Account name">
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Prochant"
                disabled={status === "running"}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 placeholder:text-muted-foreground"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Campaign type">
              <select
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                disabled={status === "running"}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="welcome">Welcome</option>
                <option value="renewal">Renewal</option>
              </select>
            </Field>
            <Field label="Client logo URL (optional)">
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                disabled={status === "running"}
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 placeholder:text-muted-foreground"
              />
            </Field>
          </div>

          <Button
            onClick={runPipeline}
            disabled={!canSubmit}
            className="mt-1"
          >
            {status === "running" ? "Generating…" : "Generate campaign"}
          </Button>
        </CardContent>
      </Card>

      {status !== "idle" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkflowRail activeStep={activeStep} status={status} />
          </CardContent>
        </Card>
      )}

      {status === "error" && error && (
        <Card className="ring-destructive/30">
          <CardContent className="pt-4">
            <p className="text-sm font-medium text-destructive">Couldn&apos;t finish the request</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </CardContent>
        </Card>
      )}

      {copy && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Generated copy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Subject</p>
              <p className="text-sm font-medium mt-1">{copy.subject}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Body</p>
              <div className="text-sm mt-1 whitespace-pre-wrap bg-muted/40 rounded-md p-3 border border-border">
                {copy.body}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {creative && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Creative</CardTitle>
              {creative.stub && (
                <Badge variant="secondary" className="text-xs font-normal">Placeholder — Figma rendering not wired up</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={creative.creativeUrl}
              alt="Generated campaign creative"
              className="w-full max-w-md rounded-md border border-border"
            />
          </CardContent>
        </Card>
      )}

      {draft && (
        <Card className="ring-plum/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{draft.campaignName}</CardTitle>
              <Badge className="bg-plum text-plum-foreground text-xs font-normal">Draft — needs your review</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm whitespace-pre-wrap bg-plum-wash/40 rounded-md p-3 border border-border">
              {draft.summary}
            </div>
            <p className="text-xs text-muted-foreground">
              This is a brief, not a live CleverTap draft — CleverTap has no API to create campaigns.
              Paste it into the CleverTap dashboard yourself and review before sending anything.
            </p>
            <a
              href={draft.reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-plum hover:underline"
            >
              Open CleverTap <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function WorkflowRail({
  activeStep,
  status,
}: {
  activeStep: StepKey | null;
  status: "idle" | "running" | "done" | "error";
}) {
  const activeIndex = activeStep ? STEPS.findIndex((s) => s.key === activeStep) : -1;

  return (
    <div className="flex items-center" role="list" aria-label="Campaign generation progress">
      {STEPS.map((step, i) => {
        const isDone = status === "done" || (status === "error" && i < activeIndex) || (activeIndex >= 0 && i < activeIndex);
        const isActive = i === activeIndex && status === "running";
        const isFailed = status === "error" && i === activeIndex;

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none" role="listitem">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full border flex items-center justify-center ${
                  isFailed
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : isDone
                    ? "border-plum bg-plum text-plum-foreground"
                    : isActive
                    ? "border-plum text-plum"
                    : "border-border text-muted-foreground"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isActive ? (
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              <span className={`text-xs font-mono ${isActive ? "text-plum" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${isDone ? "bg-plum" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
