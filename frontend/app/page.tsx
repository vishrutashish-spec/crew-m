"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getOverview, n, compact, pct, CHART,
  type Overview,
} from "@/lib/api";
import {
  Panel, PanelHead, ChartFrame, Chip, Stat, BarRow, SplitRibbon,
  InsightCard, ErrorState, Skeleton, ChartTip, AXIS,
} from "@/components/kit";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ComposedChart, Line, LabelList,
} from "recharts";
import { ArrowRight, TriangleAlert } from "lucide-react";

const ORGS = [
  { key: "all", label: "All orgs" },
  { key: "ENT", label: "Enterprise" },
  { key: "MM", label: "Mid-Market" },
  { key: "SMB", label: "SMB" },
  { key: "EOR", label: "EOR" },
];

export default function OverviewPage() {
  const [org, setOrg] = useState("all");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    getOverview(org).then(setData).catch((e) => setError(e.message));
  }, [org]);

  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-6 flex-wrap rise">
        <div>
          <h1 className="text-[30px] leading-none">Overview</h1>
          <p className="text-[13px] text-muted-foreground mt-2">
            Who to reach, on which channel, and what the numbers actually support
          </p>
        </div>
        <div className="seg" role="tablist" aria-label="Organisation type">
          {ORGS.map((o) => (
            <button
              key={o.key}
              data-active={org === o.key}
              onClick={() => setOrg(o.key)}
              role="tab"
              aria-selected={org === o.key}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? <Skeleton /> : <Body data={data} org={org} />}
    </div>
  );
}

function Body({ data, org }: { data: Overview; org: string }) {
  const t = data.totals;
  const push = t.reach.push;
  const realPush = push.with_app ?? 0;
  const stale = push.stale_tokens ?? 0;

  const cohortChart = data.cohorts.map((c) => ({
    label: c.label,
    app: c.app,
    noApp: c.no_app,
    appShare: c.app_share,
  }));

  const reachChart = [
    { channel: "WhatsApp", reported: t.reach.whatsapp.count, real: t.reach.whatsapp.count },
    { channel: "Email", reported: t.reach.email.count, real: t.reach.email.count },
    { channel: "Push", reported: push.count, real: realPush },
  ];

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <Panel ground="aurora" ticked className="p-7 rise d1">
        <div className="relative grid grid-cols-12 gap-8 items-center">
          <div className="col-span-12 lg:col-span-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="label-mono">Eligible base</span>
              <Chip kind="OBSERVED" title="Bible segment export: active, non-test orgs" />
            </div>
            <p className="figure text-[54px]">{n(t.eligible)}</p>
            <p className="text-[12px] text-muted-foreground mt-2.5 leading-relaxed">
              People in active, non-test organisations
              {org !== "all" && <> · {ORGS.find((o) => o.key === org)?.label} only</>}
            </p>
            <Link
              href="/cohorts"
              className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--cyan-deep)] hover:underline mt-4 font-medium"
            >
              Break down by age cohort <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="col-span-12 lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            <Stat label="App installed" value={pct(t.app_share)}
              sub={`${n(t.app)} with an install signal in 365 days`} chip="OBSERVED" />
            <Stat label="No app" value={pct(t.no_app_share)}
              sub={`${n(t.no_app)} invisible to every in-app funnel`} tone="red" chip="OBSERVED" />
            <Stat label="Active 30d" value={compact(t.mau)}
              sub={`${pct(t.mau_share_of_app)} of the app base`} chip="DERIVED" />
            <Stat label="Activation gap" value={`${data.activation.gap_points} pts`}
              sub={`${pct(data.activation.org_rate, 0)} of orgs vs ${pct(data.activation.employee_rate, 0)} of employees`}
              tone="red" chip="OBSERVED" />
          </div>
        </div>
      </Panel>

      {/* ---------------- PUSH GAP ---------------- */}
      <div className="grid grid-cols-12 gap-5 rise d2">
        <ChartFrame
          title="Channel reachability"
          sub="WhatsApp and email key off the member record. Push needs the app: and most of its reported reach is not real."
          chip="OBSERVED"
          filename="channel-reachability"
          caption={`Channel reachability across ${n(t.eligible)} eligible users: Crew M`}
          className="col-span-12 lg:col-span-7"
          ground="dot"
        >
          <div className="h-[224px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reachChart} margin={{ left: -6, right: 16, top: 6, bottom: 0 }} barGap={3}>
                <XAxis dataKey="channel" {...AXIS} />
                <YAxis tickFormatter={compact} {...AXIS} width={44} />
                <Tooltip content={<ChartTip formatter={(v) => n(v)} />}
                  cursor={{ fill: "rgba(43,11,33,0.04)" }} />
                <Bar dataKey="reported" name="Reported reachable" radius={[5, 5, 0, 0]} barSize={36}>
                  {reachChart.map((d) => (
                    <Cell key={d.channel} fill={d.channel === "Push" ? CHART.sand : CHART.ink} />
                  ))}
                </Bar>
                <Bar dataKey="real" name="Actually deliverable" radius={[5, 5, 0, 0]} barSize={36}>
                  {reachChart.map((d) => (
                    <Cell key={d.channel} fill={d.channel === "Push" ? CHART.red : CHART.ink} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border flex-wrap">
            <Legend color={CHART.ink} label="Reachable = deliverable" />
            <Legend color={CHART.sand} label="Push reported" />
            <Legend color={CHART.red} label="Push deliverable" />
          </div>
        </ChartFrame>

        <Panel className="col-span-12 lg:col-span-5 p-5" ticked>
          <PanelHead title="The push gap" sub="Why push reach cannot be taken at face value" chip="DERIVED" />
          <div className="rounded-lg border border-[color:var(--red)]/25 bg-[color:var(--red)]/[0.04] p-4 mb-4">
            <div className="flex items-start gap-2.5">
              <TriangleAlert className="w-4 h-4 text-[color:var(--red)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="figure text-[27px] text-[color:var(--red)]">{n(stale)}</p>
                <p className="text-[12px] text-foreground mt-1.5 leading-relaxed">
                  push-reachable users who <strong>cannot receive push</strong>. They sit in the
                  no-app segment on stale tokens: <code className="text-[11px]">App Uninstalled</code>{" "}
                  never fires in this account, so tokens are never invalidated.
                </p>
              </div>
            </div>
          </div>
          <SplitRibbon parts={[
            { label: "Real push audience", value: realPush, color: CHART.ink },
            { label: "Stale tokens", value: stale, color: CHART.red },
          ]} />
          <div className="mt-4 pt-4 border-t border-border space-y-3.5">
            <BarRow label="Push: reported" value={push.count} total={t.eligible} color={CHART.sand}
              note={`${pct(push.of_total)} of the base, per the reachability panel`} />
            <BarRow label="Push: deliverable" value={realPush} total={t.eligible} color={CHART.red}
              note={`${pct(realPush / t.eligible)} once stale tokens are removed`} />
          </div>
        </Panel>
      </div>

      {/* ---------------- COHORTS ---------------- */}
      <div className="grid grid-cols-12 gap-5 rise d3">
        <ChartFrame
          title="Age cohorts"
          sub="App ownership falls steadily with age: bars are people, the line is the share"
          chip="MODELED"
          filename="age-cohorts"
          caption="Age cohort size and app ownership: cohort split MODELED: Crew M"
          className="col-span-12 lg:col-span-8"
        >
          <div className="h-[262px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cohortChart} margin={{ left: -6, right: 8, top: 12, bottom: 0 }}>
                <XAxis dataKey="label" {...AXIS} />
                <YAxis tickFormatter={compact} {...AXIS} width={44} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 0.4]}
                  tickFormatter={(v: number) => pct(v, 0)} {...AXIS} width={44} />
                <Tooltip
                  content={<ChartTip formatter={(v, name) => (name === "App ownership" ? pct(v) : n(v))} />}
                  cursor={{ fill: "rgba(43,11,33,0.04)" }} />
                <Bar dataKey="app" name="Has app" stackId="a" fill={CHART.ink} barSize={44} />
                <Bar dataKey="noApp" name="No app" stackId="a" fill={CHART.sand}
                  radius={[5, 5, 0, 0]} barSize={44} />
                <Line yAxisId="r" type="monotone" dataKey="appShare" name="App ownership"
                  stroke={CHART.red} strokeWidth={2.5}
                  dot={{ r: 3.5, fill: CHART.red, strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border flex-wrap">
            <Legend color={CHART.ink} label="Has app" />
            <Legend color={CHART.sand} label="No app" />
            <Legend color={CHART.red} label="App ownership %" />
          </div>
        </ChartFrame>

        <Panel className="col-span-12 lg:col-span-4 p-5">
          <PanelHead title="Composition" sub="Device, gender and suppression" chip="MODELED" />
          <div className="space-y-5">
            <div>
              <p className="label-mono mb-2.5">Device: app base only</p>
              <SplitRibbon parts={[
                { label: "Android", value: t.android, color: CHART.ink },
                { label: "iOS", value: t.ios, color: CHART.red },
              ]} />
              <p className="text-[10.5px] text-muted-foreground mt-2.5 leading-snug">
                iOS needs explicit notification opt-in, so iOS-heavy cohorts lose more push reach
                than install numbers suggest.
              </p>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="label-mono mb-2.5">Gender: whole base</p>
              <SplitRibbon parts={[
                { label: "Male", value: t.male, color: CHART.ink },
                { label: "Female", value: t.female, color: CHART.sand },
              ]} />
            </div>
            <div className="pt-4 border-t border-border">
              <p className="label-mono mb-2">DND-suppressed</p>
              <p className="figure text-[23px]">{n(t.dnd)}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                {pct(t.dnd_share)} of the base. Applied at whole-org level: every campaign must
                check the flag itself.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* ---------------- FUNNELS ---------------- */}
      <div className="grid grid-cols-12 gap-5 rise d4">
        <FunnelPanel title="Telehealth funnel" stages={t.th_funnel} className="col-span-12 lg:col-span-6" />
        <FunnelPanel title="Health checkup funnel" stages={t.hc_funnel} className="col-span-12 lg:col-span-6" />
      </div>

      {/* ---------------- INSIGHTS ---------------- */}
      {data.insights.length > 0 && (
        <div className="rise d5">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-[19px]">What the numbers say</h2>
            <span className="text-[11.5px] text-muted-foreground">
              {data.insights.length} findings, each with its arithmetic
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.insights.map((ins) => <InsightCard key={ins.id} insight={ins} />)}
          </div>
        </div>
      )}

      {/* ---------------- CT TELEMETRY ---------------- */}
      <Panel className="p-5 rise d6" ground="grid">
        <PanelHead
          title="CleverTap app telemetry"
          sub={data.ct_live.scope}
          chip="OBSERVED"
          right={
            <span className="text-[10.5px] text-muted-foreground">
              pulled {data.ct_live.pulled_at} · {data.ct_live.window_days}d window
            </span>
          }
        />
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-5 relative">
          <Stat label="DAU" value={n(data.ct_live.metrics.dau)} sub={data.ct_live.dau_method} size="sm" />
          <Stat label="MAU 30d" value={compact(data.ct_live.metrics.mau_30d)} sub="Unique app launchers" size="sm" />
          <Stat label="Annual active" value={compact(data.ct_live.metrics.annual_active_users)} sub="Unique, 364 days" size="sm" />
          <Stat label="Installs 30d" value={compact(data.ct_live.metrics.new_installs_30d)} sub="New app installs" size="sm" />
          <Stat label="Sessions 30d" value={compact(data.ct_live.metrics.sessions_30d)} sub="Total launches" size="sm" />
          <Stat label="Sessions / MAU" value={String(data.ct_live.metrics.sessions_per_mau)} sub="Launches per active user" size="sm" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-5 pt-4 border-t border-border leading-relaxed relative">
          These counts are account-wide because CleverTap&apos;s{" "}
          <code className="text-[10.5px]">/counts</code> endpoints accept no organisation filter.
          Do not divide them by the {n(t.eligible)} eligible base ,{" "}
          <Link href="/methodology" className="text-[color:var(--cyan-deep)] hover:underline">
            see methodology
          </Link>.
        </p>
      </Panel>
    </>
  );
}

function FunnelPanel({
  title, stages, className,
}: {
  title: string;
  stages: Overview["totals"]["th_funnel"];
  className?: string;
}) {
  const worst = stages.slice(1).reduce((min, s) => (s.from_prev < min.from_prev ? s : min), stages[1]);
  const data = stages.map((s) => ({
    stage: s.stage,
    count: s.count,
    step: s.from_prev,
    isWorst: s.stage === worst?.stage,
  }));

  return (
    <ChartFrame
      title={title}
      sub={`120-day window, active and non-test orgs · ${pct(stages[stages.length - 1].cumulative, 2)} of homepage viewers book`}
      chip="OBSERVED"
      filename={title}
      caption={`${title}: 120-day window, active + non-test orgs: Crew M`}
      className={className}
    >
      <div className="h-[212px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -6, right: 12, top: 20, bottom: 0 }}>
            <XAxis dataKey="stage" {...AXIS} interval={0} tick={{ ...AXIS.tick, fontSize: 10 }} />
            <YAxis tickFormatter={compact} {...AXIS} width={44} />
            <Tooltip
              content={<ChartTip formatter={(v, name) => (name === "Users" ? n(v) : pct(v))} />}
              cursor={{ fill: "rgba(43,11,33,0.04)" }} />
            <Bar dataKey="count" name="Users" radius={[5, 5, 0, 0]} barSize={40}>
              {data.map((d) => (
                <Cell key={d.stage} fill={d.isWorst ? CHART.red : CHART.ink} />
              ))}
              <LabelList dataKey="step" position="top"
                formatter={(v: unknown) => (typeof v === "number" && v < 1 ? pct(v, 0) : "")}
                style={{ fontSize: 10, fill: "#565064", fontFamily: "Vollkorn, Georgia, serif" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 flex-wrap">
        <Legend color={CHART.red} label={`Biggest drop: ${worst?.stage}`} />
        <span className="text-[11px] text-muted-foreground">
          Labels show the share continuing from the previous stage
        </span>
      </div>
    </ChartFrame>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/10"
        style={{ background: color }} />
      {label}
    </span>
  );
}
