"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSimOptions, getCohorts, simulate, n, compact, pct, CHART,
  type SimOptions, type SimResult, type Cohort,
} from "@/lib/api";
import {
  Panel, PanelHead, ChartFrame, Chip, Stat, ErrorState, ChartTip, AXIS,
} from "@/components/kit";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import {
  ArrowRight, TriangleAlert, RotateCw, Check, Clock, Users, Radio,
} from "lucide-react";

export default function SimulatePage() {
  const [opts, setOpts] = useState<SimOptions | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — cohorts. Step 2 — narrow. Step 3 — run.
  const [selected, setSelected] = useState<string[]>(["26_35"]);
  const [org, setOrg] = useState("all");
  const [objective, setObjective] = useState("th_activation");
  const [channel, setChannel] = useState("");
  const [sendHour, setSendHour] = useState<string>("");
  const [excludeDnd, setExcludeDnd] = useState(true);
  const [excludeStale, setExcludeStale] = useState(true);

  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    getSimOptions().then(setOpts).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    getCohorts(org).then((r) => setCohorts(r.cohorts)).catch(() => {});
  }, [org]);

  const run = useCallback(async () => {
    if (!selected.length) return;
    setRunning(true);
    setRunError(null);
    try {
      setResult(
        await simulate({
          objective,
          cohort_keys: selected,
          org: org === "all" ? null : org,
          channel: channel || null,
          send_hour: sendHour === "" ? null : Number(sendHour),
          exclude_dnd: excludeDnd,
          exclude_no_app_for_push: excludeStale,
        })
      );
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setRunning(false);
    }
  }, [objective, selected, org, channel, sendHour, excludeDnd, excludeStale]);

  if (error) return <ErrorState message={error} />;

  const selectedTotal = cohorts
    .filter((c) => selected.includes(c.key))
    .reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-6 flex-wrap rise">
        <div>
          <h1 className="text-[30px] leading-none">Simulator</h1>
          <p className="text-[13px] text-muted-foreground mt-2">
            Pick cohorts, narrow them, then size the campaign against real reachability
          </p>
        </div>
        <Chip kind="PREDICTED" title="Funnel projection uses modeled industry priors" />
      </div>

      {/* ---------- STEP 1 — cohorts ---------- */}
      <Panel className="p-5 rise d1" ground="dot">
        <PanelHead
          title="1 · Choose age cohorts"
          sub="Cohorts are the primary audience dimension. Select one or more."
          chip="MODELED"
          right={
            <div className="flex items-center gap-2">
              <button className="btn !px-2.5 !py-1.5 !text-[11px]"
                onClick={() => setSelected(cohorts.map((c) => c.key))}>
                All
              </button>
              <button className="btn !px-2.5 !py-1.5 !text-[11px]"
                onClick={() => setSelected([])}>
                None
              </button>
            </div>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative">
          {cohorts.map((c) => {
            const on = selected.includes(c.key);
            return (
              <button
                key={c.key}
                className="tile"
                data-selected={on}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(c.key) ? prev.filter((k) => k !== c.key) : [...prev, c.key]
                  )
                }
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-heading text-[13.5px] text-[color:var(--ink)]">{c.label}</span>
                  <span
                    className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 ${
                      on ? "metal-cyan border-transparent" : "border-[color:var(--input)]"
                    }`}
                  >
                    {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </span>
                </div>
                <p className="figure text-[18px]">{compact(c.total)}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {compact(c.app)} app · {pct(c.app_share, 0)}
                </p>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-2.5 relative">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">
              {selected.length} cohort{selected.length !== 1 ? "s" : ""} selected —{" "}
              <span className="font-semibold text-foreground tnum">{n(selectedTotal)}</span> people
              before any objective or channel filter
            </span>
          </div>
        )}
      </Panel>

      {/* ---------- STEP 2 — narrow ---------- */}
      <Panel className="p-5 rise d2">
        <PanelHead title="2 · Narrow the audience" sub="Everything here filters the cohorts you picked above" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <Field label="Objective" hint="Sets which people inside the cohorts are eligible">
            <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
              {opts?.objectives.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <p className="text-[10.5px] text-muted-foreground mt-1.5 leading-snug">
              {opts?.objectives.find((o) => o.key === objective)?.desc}
            </p>
          </Field>

          <Field label="Org type" hint="Modeled — not a CleverTap property">
            <select className="field" value={org} onChange={(e) => setOrg(e.target.value)}>
              <option value="all">All org types</option>
              {opts?.org_types.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Channel" hint="Leave on auto to pick the widest real reach">
            <select className="field" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="">Auto — best real reach</option>
              {opts?.channels.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Send hour" hint="Peak window is 20:00–23:00">
            <select className="field" value={sendHour} onChange={(e) => setSendHour(e.target.value)}>
              <option value="">Auto — cohort peak</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 pt-5 border-t border-border flex flex-wrap items-center gap-6">
          <Toggle checked={excludeDnd} onChange={setExcludeDnd}
            label="Exclude DND-suppressed"
            hint="is_in_DND_CT — must be checked by every campaign" />
          <Toggle checked={excludeStale} onChange={setExcludeStale}
            label="Exclude stale push tokens"
            hint="No-app users whose tokens were never invalidated" />
        </div>

        <div className="mt-5 pt-5 border-t border-border flex items-center gap-4 flex-wrap">
          <button
            onClick={run}
            disabled={running || selected.length === 0}
            className="btn btn-primary metal-ink !px-6 !py-3 !text-[13px]"
          >
            {running ? <RotateCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {running ? "Sizing…" : result ? "Re-run" : "Run simulation"}
          </button>
          {selected.length === 0 && (
            <span className="text-[12px] text-[color:var(--red)]">Select at least one cohort</span>
          )}
          {runError && (
            <span className="text-[12px] text-[color:var(--red)]">{runError}</span>
          )}
        </div>
      </Panel>

      {/* ---------- STEP 3 — result ---------- */}
      {result ? (
        <Result result={result} />
      ) : (
        <Panel className="p-14 text-center rise d3" ticked>
          <div className="w-14 h-14 rounded-xl metal-ink flex items-center justify-center mx-auto mb-4">
            <Radio className="w-6 h-6 text-white" strokeWidth={1.6} />
          </div>
          <h3 className="text-[17px] mb-2">Nothing simulated yet</h3>
          <p className="text-[12.5px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            Pick cohorts and an objective, then run it. Audience sizing comes straight out of the
            cohort model; the funnel projection is a modeled prior and is labelled as such.
          </p>
        </Panel>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Result({ result: r }: { result: SimResult }) {
  const funnel = [
    { stage: "Sent", count: r.funnel.sent, rate: 1 },
    { stage: "Delivered", count: r.funnel.delivered, rate: r.funnel.delivery_rate },
    { stage: "Opened", count: r.funnel.opened, rate: r.funnel.open_rate },
    { stage: "Clicked", count: r.funnel.clicked, rate: r.funnel.click_rate },
    { stage: "Converted", count: r.funnel.converted, rate: r.funnel.click_to_convert },
  ];

  const channelData = Object.entries(r.channel.options).map(([key, v]) => ({
    channel: v.label,
    addressable: v.addressable,
    isChosen: key === r.channel.selected,
  }));

  return (
    <div className="space-y-5 rise">
      {/* Headline */}
      <Panel ground="aurora" ticked className="p-6">
        <div className="relative grid grid-cols-12 gap-7 items-center">
          <div className="col-span-12 lg:col-span-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="label-mono">Addressable audience</span>
              <Chip kind="DERIVED" />
            </div>
            <p className="figure text-[46px]">{n(r.audience.addressable)}</p>
            <p className="text-[12px] text-muted-foreground mt-2.5 leading-relaxed">
              {r.selection.cohorts.join(", ")} · {r.selection.org} · via{" "}
              <strong className="text-foreground">{r.channel.selected_label}</strong>
            </p>
          </div>
          <div className="col-span-12 lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-5">
            <Stat label="Cohort size" value={compact(r.selection.cohort_total)} sub="Before filters" size="sm" />
            <Stat label="Objective pool" value={compact(r.audience.objective_pool)}
              sub={r.audience.pool_description} size="sm" />
            <Stat label="Control group" value={n(r.audience.control_group)} sub="5% held back, flat" size="sm" />
            <Stat label="Will send to" value={n(r.audience.sent)} sub="Audience minus control" size="sm" tone="cyan" />
          </div>
        </div>
      </Panel>

      {/* Warnings */}
      {r.warnings.length > 0 && (
        <div className="space-y-3">
          {r.warnings.map((w, i) => (
            <div key={i} className="panel-flush p-4 border-[color:var(--red)]/30 bg-[color:var(--red)]/[0.035]">
              <div className="flex items-start gap-2.5">
                <TriangleAlert className="w-4 h-4 text-[color:var(--red)] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] leading-relaxed">{w}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Channel comparison */}
        <ChartFrame
          title="Channel choice"
          sub="How many of the objective pool each channel can actually reach"
          chip="DERIVED"
          filename="channel-choice"
          caption="Addressable audience by channel — Crew M"
          className="col-span-12 lg:col-span-5"
        >
          <div className="h-[196px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical"
                margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={compact} {...AXIS} />
                <YAxis type="category" dataKey="channel" {...AXIS} width={72} />
                <Tooltip content={<ChartTip formatter={(v) => n(v)} />}
                  cursor={{ fill: "rgba(43,11,33,0.04)" }} />
                <Bar dataKey="addressable" name="Addressable" radius={[0, 5, 5, 0]} barSize={26}>
                  {channelData.map((d) => (
                    <Cell key={d.channel} fill={d.isChosen ? CHART.ink : CHART.sand} />
                  ))}
                  <LabelList dataKey="addressable" position="right"
                    formatter={(v: unknown) => (typeof v === "number" ? compact(v) : "")}
                    style={{ fontSize: 10.5, fill: "#565064", fontFamily: "Vollkorn, Georgia, serif" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm border border-black/10" style={{ background: CHART.ink }} />
              Selected ({r.channel.label.toLowerCase()})
            </span>
            <span className="text-[11px] text-muted-foreground">
              Push counts only devices that can actually receive it
            </span>
          </div>
        </ChartFrame>

        {/* Funnel */}
        <ChartFrame
          title="Projected funnel"
          sub="Modeled industry priors — no real campaign history exists for this account"
          chip="PREDICTED"
          filename="projected-funnel"
          caption="Projected campaign funnel — PREDICTED from modeled priors — Crew M"
          className="col-span-12 lg:col-span-7"
        >
          <div className="h-[196px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} margin={{ left: -6, right: 12, top: 20, bottom: 0 }}>
                <XAxis dataKey="stage" {...AXIS} />
                <YAxis tickFormatter={compact} {...AXIS} width={44} />
                <Tooltip content={<ChartTip formatter={(v, name) => (name === "Users" ? n(v) : pct(v))} />}
                  cursor={{ fill: "rgba(43,11,33,0.04)" }} />
                <Bar dataKey="count" name="Users" radius={[5, 5, 0, 0]} barSize={44}>
                  {funnel.map((d, i) => (
                    <Cell key={d.stage} fill={i === funnel.length - 1 ? CHART.red : CHART.ink} />
                  ))}
                  <LabelList dataKey="rate" position="top"
                    formatter={(v: unknown) => (typeof v === "number" && v < 1 ? pct(v, 1) : "")}
                    style={{ fontSize: 10, fill: "#565064", fontFamily: "Vollkorn, Georgia, serif" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
            <Stat label="Delivered" value={pct(r.funnel.delivery_rate)} size="sm" />
            <Stat label="Opened" value={pct(r.funnel.open_rate)} size="sm" />
            <Stat label="Clicked" value={pct(r.funnel.click_rate)} size="sm" />
            <Stat label="End to end" value={pct(r.funnel.conversion_rate, 2)} size="sm" tone="red" />
          </div>
        </ChartFrame>
      </div>

      {/* Confidence + timing */}
      <div className="grid grid-cols-12 gap-5">
        <Panel className="col-span-12 lg:col-span-8 p-5">
          <PanelHead title="How much to trust this" chip="PREDICTED" />
          <div className="flex items-start gap-4">
            <div className="px-3 py-1.5 rounded-md bg-[color:#fdf2e3] border border-[color:#f2d9b4] flex-shrink-0">
              <span className="label-mono !text-[color:#8a4a06] !text-[10px]">
                {r.confidence} confidence
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {r.confidence_reason}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-[color:var(--cyan-wash)] border border-[color:#b3e8ee] p-3.5">
              <p className="label-mono !text-[color:var(--cyan-deep)] mb-1.5">Solid</p>
              <p className="text-[11.5px] leading-relaxed">
                Audience sizing. {n(r.audience.addressable)} is an exact count out of the cohort
                model, reconciled to the documented reachability figures.
              </p>
            </div>
            <div className="rounded-lg bg-[color:#fdf2e3] border border-[color:#f2d9b4] p-3.5">
              <p className="label-mono !text-[color:#8a4a06] mb-1.5">Soft</p>
              <p className="text-[11.5px] leading-relaxed">
                Everything downstream of send. The rates are priors, not learned from Plum
                campaigns — treat the shape as directional, not the absolute numbers.
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="col-span-12 lg:col-span-4 p-5" ticked>
          <PanelHead title="Timing" chip={r.timing.label} />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl metal-cyan flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="figure text-[30px]">{String(r.timing.send_hour).padStart(2, "0")}:00</p>
              <p className="text-[10.5px] text-muted-foreground mt-1">Local time</p>
            </div>
          </div>
          <p className="text-[11.5px] text-muted-foreground mt-4 pt-4 border-t border-border leading-relaxed">
            {r.timing.note}
          </p>
          {r.selection.dnd_in_selection > 0 && (
            <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
              <span className="text-[color:var(--red)] font-semibold tnum">
                {n(r.selection.dnd_in_selection)}
              </span>{" "}
              DND-suppressed people sit inside this selection.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-mono block mb-2">{label}</label>
      {children}
      {hint && !Array.isArray(children) && (
        <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">{hint}</p>
      )}
    </div>
  );
}

function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-start gap-2.5 text-left group">
      <span
        className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
          checked ? "metal-cyan border-transparent" : "border-[color:var(--input)] group-hover:border-[color:var(--cyan)]"
        }`}
      >
        {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </span>
      <span>
        <span className="text-[12px] font-medium block">{label}</span>
        <span className="text-[10.5px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
