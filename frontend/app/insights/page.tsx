"use client";

import { useEffect, useState } from "react";
import { getDashboard, getPersonas, type DashboardResponse, type Persona } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Lightbulb, TrendingDown, TrendingUp, Users, Zap } from "lucide-react";

interface Insight {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  label: "OBSERVED" | "RECOMMENDED";
  icon: React.ComponentType<{ className?: string }>;
}

export default function Insights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDashboard(), getPersonas()])
      .then(([dash, personaRes]) => {
        setInsights(deriveInsights(dash, personaRes.personas));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
                <p className="text-sm text-muted-foreground mt-1">Start the API server to generate insights.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-6 space-y-6">
        <div className="h-7 w-24 bg-muted rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Key findings and recommendations from behavioral analysis
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
          {insights.length} insights
        </Badge>
      </div>

      <div className="space-y-3">
        {insights.map((ins, idx) => {
          const Icon = ins.icon;
          return (
            <Card key={idx}>
              <CardContent className="py-4 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  ins.impact === "high" ? "bg-destructive/10" : ins.impact === "medium" ? "bg-warning/10" : "bg-muted"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    ins.impact === "high" ? "text-destructive" : ins.impact === "medium" ? "text-warning" : "text-muted-foreground"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{ins.title}</p>
                    <Badge
                      variant={ins.impact === "high" ? "destructive" : ins.impact === "medium" ? "secondary" : "outline"}
                      className="text-[10px] font-normal"
                    >
                      {ins.impact} impact
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                      {ins.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ins.detail}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function deriveInsights(dash: DashboardResponse, personas: Persona[]): Insight[] {
  const insights: Insight[] = [];
  const km = dash.key_metrics;

  if (km.no_app_share > 0.5) {
    insights.push({
      title: `${(km.no_app_share * 100).toFixed(0)}% of users have no app installed`,
      detail: `Push notifications cannot reach this cohort. SMS and WhatsApp are the only viable channels for ${Math.round(km.total_eligible_users * km.no_app_share).toLocaleString()} users. Prioritize app install campaigns or channel-shift to SMS/WhatsApp.`,
      impact: "high",
      label: "OBSERVED",
      icon: TrendingDown,
    });
  }

  const gap = km.org_activation_rate - km.employee_activation_rate;
  if (gap > 0.1) {
    insights.push({
      title: "Structural activation gap between orgs and employees",
      detail: `Org activation (${(km.org_activation_rate * 100).toFixed(0)}%) outpaces employee activation (${(km.employee_activation_rate * 100).toFixed(0)}%) by ${(gap * 100).toFixed(0)} points. ${km.structural_gap}`,
      impact: "high",
      label: "OBSERVED",
      icon: Users,
    });
  }

  const dormant = personas.filter((p) => p.avg_days_since_active > 60);
  if (dormant.length > 0) {
    const totalDormant = dormant.reduce((sum, p) => sum + p.size, 0);
    insights.push({
      title: `${dormant.length} persona(s) are dormant (60+ days inactive)`,
      detail: `${totalDormant.toLocaleString()} users across ${dormant.map((p) => p.name).join(", ")} have been inactive for over 60 days. Re-engagement campaigns should use non-push channels and benefit-led messaging.`,
      impact: "high",
      label: "RECOMMENDED",
      icon: Zap,
    });
  }

  const highFatigue = personas.filter((p) => p.avg_campaign_fatigue > 0.5);
  if (highFatigue.length > 0) {
    insights.push({
      title: `${highFatigue.length} persona(s) show high campaign fatigue`,
      detail: `${highFatigue.map((p) => p.name).join(", ")} have fatigue scores above 50%. Reduce send frequency and focus on high-value, well-timed messages rather than broadcast campaigns.`,
      impact: "medium",
      label: "RECOMMENDED",
      icon: TrendingDown,
    });
  }

  if (dash.campaign_summary.avg_click_rate < 0.02) {
    insights.push({
      title: "Overall click rate is below 2%",
      detail: `Average click rate across ${dash.campaign_summary.total_campaigns} campaigns is ${(dash.campaign_summary.avg_click_rate * 100).toFixed(1)}%. Consider improving CTAs, personalizing copy, and testing send times per persona.`,
      impact: "medium",
      label: "OBSERVED",
      icon: TrendingUp,
    });
  }

  const lowTH = personas.filter((p) => p.th_adoption_rate < 0.1 && p.app_installed_share > 0.5);
  if (lowTH.length > 0) {
    insights.push({
      title: "App-active personas with untapped TH potential",
      detail: `${lowTH.map((p) => p.name).join(", ")} have the app installed but <10% TH adoption. These are the lowest-friction TH activation targets since push is already reachable.`,
      impact: "medium",
      label: "RECOMMENDED",
      icon: Lightbulb,
    });
  }

  return insights;
}
