"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Megaphone, Loader2, ExternalLink } from "lucide-react";

type CampaignType = "welcome" | "renewal";

interface DraftResult {
  campaignName: string;
  reviewUrl: string;
  summary: string;
}

export default function NewCampaignPage() {
  const [amName, setAmName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("welcome");
  const [logoUrl, setLogoUrl] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<DraftResult | null>(null);

  const canSubmit = amName.trim().length > 0 && accountName.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "loading") return;

    setStatus("loading");
    setErrorMessage("");
    setResult(null);

    const requestId = `web-${Date.now()}`;

    try {
      const copyRes = await fetch("/api/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, amName, accountName, campaignType, logoUrl }),
      });
      if (!copyRes.ok) throw new Error("Couldn't generate copy. Try again.");
      const copy = await copyRes.json();

      const creativeRes = await fetch("/api/creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, copy }),
      });
      if (!creativeRes.ok) throw new Error("Couldn't render the creative. Try again.");
      const creative = await creativeRes.json();

      const draftRes = await fetch("/api/campaign/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, amName, accountName, campaignType, copy, creative }),
      });
      if (!draftRes.ok) throw new Error("Couldn't assemble the campaign brief. Try again.");
      const draft: DraftResult = await draftRes.json();

      setResult(draft);
      setStatus("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStatus("error");
    }
  }

  function handleReset() {
    setStatus("idle");
    setResult(null);
    setErrorMessage("");
  }

  return (
    <div className="py-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fill in the account and campaign type — copy and a creative brief get drafted for you.
        </p>
      </div>

      {status !== "done" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Campaign request</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="am-name" className="text-sm font-medium">
                  Your name
                </label>
                <input
                  id="am-name"
                  type="text"
                  value={amName}
                  onChange={(e) => setAmName(e.target.value)}
                  placeholder="Jordan Lee"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="account-name" className="text-sm font-medium">
                  Account name
                </label>
                <input
                  id="account-name"
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Campaign type</span>
                <div className="flex gap-2" role="radiogroup" aria-label="Campaign type">
                  {(["welcome", "renewal"] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={campaignType === type}
                      variant={campaignType === type ? "default" : "outline"}
                      size="lg"
                      className="capitalize flex-1"
                      onClick={() => setCampaignType(type)}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="logo-url" className="text-sm font-medium">
                  Client logo URL <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="logo-url"
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring"
                />
              </div>

              {status === "error" && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || status === "loading"}>
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Drafting…
                  </>
                ) : (
                  "Draft campaign"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {status === "done" && result && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{result.campaignName}</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                New request
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="text-sm whitespace-pre-wrap font-sans bg-muted rounded-lg p-4">
              {result.summary}
            </pre>
            <Separator />
            <a
              href={result.reviewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open CleverTap to build the real draft
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
