"use client";

import { useEffect, useState } from "react";
import { getDashboard, type DashboardResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, BarChart3, ArrowRight, TrendingUp, Mail, Smartphone, MessageCircle } from "lucide-react";
import Link from "next/link";

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  push: Smartphone,
  sms: MessageCircle,
  whatsapp: MessageCircle,
};

export default function Campaigns() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard().then(setData).catch((e) => setError(e.message));
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
                <p className="text-sm text-muted-foreground mt-1">Start the API server to load campaign data.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-6 space-y-6">
        <div className="h-7 w-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { campaign_summary } = data;

  return (
    <div className="py-6 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Historical campaign performance across {campaign_summary.total_campaigns} campaigns
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">OBSERVED</Badge>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Avg Delivery Rate</p>
            <p className="text-2xl font-semibold tracking-tight">{(campaign_summary.avg_delivery_rate * 100).toFixed(1)}%</p>
            <Progress value={campaign_summary.avg_delivery_rate * 100} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Avg Open Rate</p>
            <p className="text-2xl font-semibold tracking-tight">{(campaign_summary.avg_open_rate * 100).toFixed(1)}%</p>
            <Progress value={campaign_summary.avg_open_rate * 100} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Avg Click Rate</p>
            <p className="text-2xl font-semibold tracking-tight">{(campaign_summary.avg_click_rate * 100).toFixed(1)}%</p>
            <Progress value={campaign_summary.avg_click_rate * 100} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Channel Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Channel Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(campaign_summary.channels_used)
              .sort(([, a], [, b]) => b - a)
              .map(([ch, count]) => {
                const Icon = CHANNEL_ICONS[ch] || BarChart3;
                const pct = (count / campaign_summary.total_campaigns) * 100;
                return (
                  <div key={ch} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium capitalize">{ch}</span>
                        <span className="text-muted-foreground">{count} campaigns ({pct.toFixed(0)}%)</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/simulate">
          <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
            <CardContent className="py-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">Simulate a New Campaign</p>
                <p className="text-xs text-muted-foreground mt-0.5">Predict performance before sending</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/audience">
          <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer group">
            <CardContent className="py-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-coral" />
              </div>
              <div>
                <p className="text-sm font-medium group-hover:text-primary transition-colors">Build Target Audience</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get persona-based targeting recommendations</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
