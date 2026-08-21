"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Database, Key, Server, Shield, RefreshCw } from "lucide-react";
import { getCtLive, getDashboard, refreshCtLive, type CtLiveResponse, type DashboardResponse } from "@/lib/api";

export default function Settings() {
  const [ctStatus, setCtStatus] = useState<CtLiveResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getCtLive().then(setCtStatus).catch(() => {});
    getDashboard().then(setDashboard).catch(() => {});
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await refreshCtLive();
      setCtStatus(r);
    } catch {}
    setRefreshing(false);
  };

  const isConnected = ctStatus?.status === "live";
  const dataSource = isConnected ? "Live CT + Synthetic" : "Synthetic (calibrated)";

  return (
    <div className="py-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          System configuration and data source status
        </p>
      </div>

      {/* Data Source */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Data Source</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnected
                  ? "Real CleverTap metrics + synthetic persona clustering"
                  : "Synthetic data calibrated from real Plum distributions"}
              </p>
            </div>
            <Badge variant="secondary" className={`text-xs font-normal ${isConnected ? "bg-green-50 text-green-700 border-green-200" : ""}`}>
              {dataSource}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Users Analyzed</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total users in the synthetic dataset</p>
            </div>
            <span className="text-sm font-medium">
              {dashboard?.model_confidence?.n_users_analyzed?.toLocaleString() ?? "10,000"}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Features Used</p>
              <p className="text-xs text-muted-foreground mt-0.5">Behavioral features for persona clustering</p>
            </div>
            <span className="text-sm font-medium">27</span>
          </div>
        </CardContent>
      </Card>

      {/* CleverTap Integration */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">CleverTap Integration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isConnected
                  ? "Connected to CleverTap (in1 region, read-only)"
                  : "Set CT_ACCOUNT_ID and CT_PASSCODE in .env.local to connect"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Refresh CT connection"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
              </button>
              {isConnected ? (
                <Badge variant="outline" className="text-xs font-normal text-green-700 border-green-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs font-normal text-warning">Not connected</Badge>
              )}
            </div>
          </div>

          {isConnected && ctStatus?.metrics && (
            <>
              <Separator />
              <div className="grid grid-cols-3 gap-3">
                {ctStatus.metrics.dau != null && (
                  <div className="bg-muted/50 rounded-md p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">DAU</p>
                    <p className="text-sm font-semibold tabular-nums">{ctStatus.metrics.dau.toLocaleString()}</p>
                  </div>
                )}
                {ctStatus.metrics.mau != null && (
                  <div className="bg-muted/50 rounded-md p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">MAU</p>
                    <p className="text-sm font-semibold tabular-nums">{ctStatus.metrics.mau.toLocaleString()}</p>
                  </div>
                )}
                {ctStatus.metrics.ytd_active_users != null && (
                  <div className="bg-muted/50 rounded-md p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">YTD Active</p>
                    <p className="text-sm font-semibold tabular-nums">{ctStatus.metrics.ytd_active_users.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {ctStatus.metrics.pulled_at && (
                <p className="text-[10px] text-muted-foreground">
                  Last pulled: {new Date(ctStatus.metrics.pulled_at).toLocaleString()}
                </p>
              )}
            </>
          )}

          {!isConnected && (
            <div className="bg-muted rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-2">Required environment variables:</p>
              <code className="text-xs block font-mono">CT_ACCOUNT_ID=your_account_id</code>
              <code className="text-xs block font-mono mt-1">CT_PASSCODE=your_passcode</code>
              <code className="text-xs block font-mono mt-1">CT_REGION=in1</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Server */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">API Server</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Backend URL</p>
              <p className="text-xs text-muted-foreground mt-0.5">FastAPI server running ML pipeline</p>
            </div>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">http://localhost:8000</code>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">ML Pipeline</p>
              <p className="text-xs text-muted-foreground mt-0.5">K-Means clustering + XGBoost prediction + SHAP explainability</p>
            </div>
            <Badge variant="secondary" className="text-xs font-normal">scikit-learn + XGBoost</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Governance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Data Governance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <GovernanceRow label="Export controls" status="Enforced" desc="No download/export buttons in UI" />
          <Separator />
          <GovernanceRow label="Date range enforcement" status="Enforced" desc="Max 1-year window per query" />
          <Separator />
          <GovernanceRow label="Audit logging" status="Active" desc="All data access is logged" />
          <Separator />
          <GovernanceRow label="PII masking" status="Active" desc="Names, phone, email masked at source" />
          <Separator />
          <GovernanceRow
            label="Output classification"
            status="Enforced"
            desc="OBSERVED / PREDICTED / RECOMMENDED / GENERATED labels on all outputs"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function GovernanceRow({ label, status, desc }: { label: string; status: string; desc: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Badge variant="default" className="text-xs font-normal">{status}</Badge>
    </div>
  );
}
