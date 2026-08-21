"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getSimOptions, getCohorts, simulate, getCopyOptions, generateCopy, analyzeCopy,
  n, compact, pct, CHART,
  type SimOptions, type SimResult, type Cohort,
  type CopyOptions, type CopyGenResponse, type CopyVariant,
  type CopyAnalysis, type CopyPrediction,
} from "@/lib/api";
import {
  Panel, PanelHead, ChartFrame, Chip, Stat, ErrorState, ChartTip, AXIS,
  PageBanner, MacBar,
} from "@/components/kit";
import { ChannelGlyph, ChannelTickY, PlumGlyph, WhatsAppGlyph, GmailGlyph } from "@/components/logos";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import {
  ArrowRight, TriangleAlert, RotateCw, Check, Clock, Users, Radio,
  Sparkles, PenLine, TrendingUp, TrendingDown,
} from "lucide-react";

export default function SimulatePage() {
  const [opts, setOpts] = useState<SimOptions | null>(null);
  const [copyOpts, setCopyOpts] = useState<CopyOptions | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>(["26_35"]);
  const [org, setOrg] = useState("all");
  const [objective, setObjective] = useState("th_activation");
  const [channel, setChannel] = useState("");           // "" = auto
  const [sendHour, setSendHour] = useState<string>("");
  const [excludeDnd, setExcludeDnd] = useState(true);
  const [excludeStale, setExcludeStale] = useState(true);

  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    getSimOptions().then(setOpts).catch((e) => setError(e.message));
    getCopyOptions().then(setCopyOpts).catch(() => {});
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

  // The channel the copy studio writes for: an explicit pick wins, otherwise
  // the channel the last simulation recommended, otherwise WhatsApp.
  const copyChannel = channel || result?.channel.selected || "whatsapp";

  return (
    <div className="space-y-7">
      <PageBanner
        kicker="Simulator"
        title="Plan a campaign"
        sub="Pick cohorts, narrow the audience, size it against real reachability, then write the message in Plum's own voice."
        window="crewm / simulator"
        right={<Chip kind="PREDICTED" title="Funnel projections use modeled priors at low confidence" />}
      />

      {/* ---------- STEP 1 ---------- */}
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
              {selected.length} cohort{selected.length !== 1 ? "s" : ""} selected:{" "}
              <span className="font-semibold text-foreground tnum">{n(selectedTotal)}</span> people
              before any objective or channel filter
            </span>
          </div>
        )}
      </Panel>

      {/* ---------- STEP 2 ---------- */}
      <Panel className="p-5 rise d2">
        <PanelHead title="2 · Narrow the audience" sub="Everything here filters the cohorts you picked above" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Objective" hint={opts?.objectives.find((o) => o.key === objective)?.desc}>
            <select className="field" value={objective} onChange={(e) => setObjective(e.target.value)}>
              {opts?.objectives.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Org type" hint="Modeled, not a CleverTap property">
            <select className="field" value={org} onChange={(e) => setOrg(e.target.value)}>
              <option value="all">All org types</option>
              {opts?.org_types.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Send hour" hint="Peak window is 20:00 to 23:00">
            <select className="field" value={sendHour} onChange={(e) => setSendHour(e.target.value)}>
              <option value="">Auto, cohort peak</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Channel picker with real logos */}
        <div className="mt-5">
          <label className="label-mono block mb-2.5">Channel</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button className="tile !py-3" data-selected={channel === ""} onClick={() => setChannel("")}>
              <span className="flex items-center gap-2.5">
                <span className="w-[22px] h-[22px] rounded-md metal-cyan flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3 h-3 text-white" />
                </span>
                <span>
                  <span className="text-[12.5px] font-medium block">Auto</span>
                  <span className="text-[10px] text-muted-foreground">Widest real reach</span>
                </span>
              </span>
            </button>
            <button className="tile !py-3" data-selected={channel === "whatsapp"} onClick={() => setChannel("whatsapp")}>
              <span className="flex items-center gap-2.5">
                <WhatsAppGlyph size={22} />
                <span>
                  <span className="text-[12.5px] font-medium block">WhatsApp</span>
                  <span className="text-[10px] text-muted-foreground">No app needed</span>
                </span>
              </span>
            </button>
            <button className="tile !py-3" data-selected={channel === "email"} onClick={() => setChannel("email")}>
              <span className="flex items-center gap-2.5">
                <GmailGlyph size={22} />
                <span>
                  <span className="text-[12.5px] font-medium block">Email</span>
                  <span className="text-[10px] text-muted-foreground">Work inbox</span>
                </span>
              </span>
            </button>
            <button className="tile !py-3" data-selected={channel === "push"} onClick={() => setChannel("push")}>
              <span className="flex items-center gap-2.5">
                <PlumGlyph size={22} />
                <span>
                  <span className="text-[12.5px] font-medium block">Push</span>
                  <span className="text-[10px] text-muted-foreground">App base only</span>
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-border flex flex-wrap items-center gap-6">
          <Toggle checked={excludeDnd} onChange={setExcludeDnd}
            label="Exclude DND-suppressed"
            hint="is_in_DND_CT, must be checked by every campaign" />
          <Toggle checked={excludeStale} onChange={setExcludeStale}
            label="Exclude stale push tokens"
            hint="No-app users whose tokens were never invalidated" />
        </div>

        <div className="mt-5 pt-5 border-t border-border flex items-center gap-4 flex-wrap">
          <button
            onClick={run}
            disabled={running || selected.length === 0}
            className="btn btn-primary !px-7 !py-3 !text-[13.5px]"
          >
            {running ? <RotateCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {running ? "Sizing the audience" : result ? "Re-run simulation" : "Run simulation"}
          </button>
          {selected.length === 0 && (
            <span className="text-[12px] text-[color:var(--red)]">Select at least one cohort</span>
          )}
          {runError && <span className="text-[12px] text-[color:var(--red)]">{runError}</span>}
        </div>
      </Panel>

      {/* ---------- STEP 3: result ---------- */}
      {result ? (
        <Result result={result} />
      ) : (
        <Panel className="p-12 text-center rise d3" ticked>
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

      {/* ---------- STEP 4: copy studio ---------- */}
      <CopyStudio
        objective={objective}
        cohortKeys={selected}
        channel={copyChannel}
        channelWasAuto={!channel}
        audienceSent={result?.audience.sent ?? null}
        copyOpts={copyOpts}
      />
    </div>
  );
}

/* ==========================================================================
   Copy studio
   ========================================================================== */

function CopyStudio({
  objective, cohortKeys, channel, channelWasAuto, audienceSent, copyOpts,
}: {
  objective: string;
  cohortKeys: string[];
  channel: string;
  channelWasAuto: boolean;
  audienceSent: number | null;
  copyOpts: CopyOptions | null;
}) {
  const [angle, setAngle] = useState<string | null>(null);
  const [gen, setGen] = useState<CopyGenResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [customText, setCustomText] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customResult, setCustomResult] = useState<{ analysis: CopyAnalysis; prediction: CopyPrediction } | null>(null);
  const [customBusy, setCustomBusy] = useState(false);

  const angles = copyOpts?.angles[objective] ?? [];

  // Selection changed: previous output no longer describes the current plan.
  useEffect(() => {
    setGen(null);
    setAngle(null);
  }, [objective, channel, cohortKeys.join(",")]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function doGenerate(nextAngle?: string | null) {
    if (!cohortKeys.length) return;
    setBusy(true);
    setErr(null);
    try {
      setGen(await generateCopy({
        objective,
        cohort_keys: cohortKeys,
        channel,
        angle: nextAngle === undefined ? angle : nextAngle,
        audience_sent: audienceSent,
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function doAnalyze() {
    if (!customText.trim() || !cohortKeys.length) return;
    setCustomBusy(true);
    try {
      const r = await analyzeCopy({
        text: customText,
        title: channel === "push" || channel === "email" ? customTitle || null : null,
        channel,
        objective,
        cohort_key: cohortKeys[0],
        audience_sent: audienceSent,
      });
      setCustomResult({ analysis: r.analysis, prediction: r.prediction });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setCustomBusy(false);
    }
  }

  return (
    <Panel className="p-5 rise d4" ground="grid">
      <PanelHead
        title="4 · Copy studio"
        sub="Variants assembled from Plum's approved copy library, disciplined per channel, with predicted performance for this exact audience"
        chip="GENERATED"
        right={
          <span className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            Writing for
            <ChannelGlyph channel={channel} size={16} />
            <span className="font-medium text-foreground">
              {channel === "whatsapp" ? "WhatsApp" : channel === "email" ? "Email" : "Push"}
            </span>
            {channelWasAuto && <span className="text-muted-foreground">(auto)</span>}
          </span>
        }
      />

      {/* Angle chips */}
      <div className="relative flex items-center gap-2 flex-wrap mb-4">
        <span className="label-mono mr-1">Angle</span>
        <button
          className="btn !px-3 !py-1.5 !text-[11px]"
          style={angle === null ? { borderColor: "var(--cyan)", color: "var(--cyan-deep)", background: "var(--cyan-wash)" } : undefined}
          onClick={() => { setAngle(null); if (gen) doGenerate(null); }}
        >
          Best fit per band
        </button>
        {angles.map((a) => (
          <button
            key={a.key}
            className="btn !px-3 !py-1.5 !text-[11px]"
            style={angle === a.key ? { borderColor: "var(--cyan)", color: "var(--cyan-deep)", background: "var(--cyan-wash)" } : undefined}
            onClick={() => { setAngle(a.key); if (gen) doGenerate(a.key); }}
            title={a.label}
          >
            {a.label.split(":")[0]}
          </button>
        ))}
      </div>

      <div className="relative flex items-center gap-4 flex-wrap">
        <button
          onClick={() => doGenerate()}
          disabled={busy || cohortKeys.length === 0}
          className="btn btn-primary !px-6 !py-2.5 !text-[13px]"
        >
          {busy ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Writing" : gen ? "Regenerate" : "Generate copy"}
        </button>
        {audienceSent ? (
          <span className="text-[11.5px] text-muted-foreground">
            Predictions sized against the simulated send of{" "}
            <span className="font-semibold text-foreground tnum">{n(audienceSent)}</span>
          </span>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">
            Run the simulation first and predictions gain absolute counts
          </span>
        )}
        {err && <span className="text-[12px] text-[color:var(--red)]">{err}</span>}
      </div>

      {/* Variants */}
      {gen && (
        <div className="relative mt-6 space-y-6">
          {gen.groups.map((g) => (
            <div key={g.band}>
              <div className="flex items-center gap-2.5 mb-3">
                <h4 className="text-[14px]">{g.band_label}</h4>
                <span className="text-[11px] text-muted-foreground">
                  {g.variants.length} variant{g.variants.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {g.variants.map((v) => <VariantCard key={v.id} v={v} />)}
              </div>
            </div>
          ))}
          <p className="text-[10.5px] text-muted-foreground pt-1">
            {gen.discipline[gen.channel]}
          </p>
        </div>
      )}

      {/* Custom copy analyzer */}
      <div className="relative mt-6 pt-5 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <PenLine className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[13px] font-medium">Or check your own copy</span>
          <span className="text-[11px] text-muted-foreground">
            scored against the same discipline rules, for the {cohortKeys.length ? "first selected cohort" : "selected cohort"}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2.5">
            {(channel === "push" || channel === "email") && (
              <input className="field" placeholder={channel === "push" ? "Push title" : "Email subject"}
                value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
            )}
            <textarea className="field min-h-[110px]" placeholder="Paste the message body"
              value={customText} onChange={(e) => setCustomText(e.target.value)} />
            <button onClick={doAnalyze} disabled={customBusy || !customText.trim()}
              className="btn !px-4 !py-2 !text-[12px]">
              {customBusy ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Analyze
            </button>
          </div>
          {customResult && (
            <AnalysisBlock analysis={customResult.analysis} prediction={customResult.prediction} channel={channel} />
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- variants */

function VariantCard({ v }: { v: CopyVariant }) {
  const [open, setOpen] = useState(false);
  const a = v.analysis;

  return (
    <div className="mac-panel">
      <MacBar title={
        v.channel === "whatsapp" ? `whatsapp / ${a.category}` :
        v.channel === "push" ? "plum app / push" : "email / marketing"
      } />
      <div className="p-4">
        {/* Message preview */}
        {v.channel === "whatsapp" && (
          <div className="flex items-start gap-2.5">
            <WhatsAppGlyph size={20} />
            <div className="flex-1 rounded-xl rounded-tl-sm border border-border bg-[#f7fef9] px-3.5 py-3">
              <p className="text-[12px] leading-relaxed whitespace-pre-line">{v.body}</p>
            </div>
          </div>
        )}
        {v.channel === "push" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-[color:var(--muted)] px-3.5 py-3">
            <PlumGlyph size={26} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold">{v.title}</p>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{v.body}</p>
            </div>
          </div>
        )}
        {v.channel === "email" && (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[color:var(--muted)] border-b border-border">
              <GmailGlyph size={16} />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold truncate">{v.title}</p>
                {v.preheader && <p className="text-[10.5px] text-muted-foreground truncate">{v.preheader}</p>}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed whitespace-pre-line px-3.5 py-3">{v.body}</p>
          </div>
        )}

        {/* Discipline strip */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <Chip kind={a.category === "utility" ? "OBSERVED" : "RECOMMENDED"}
            title={a.category_basis} />
          <span className={`chip ${a.category === "utility" ? "chip-derived" : "chip-predicted"}`}>
            {v.channel === "whatsapp" ? `WA ${a.category}` : a.category}
          </span>
          <MeterChip
            label={v.channel === "push" ? `title ${a.title_chars}` : `${a.chars} chars`}
            ok={!a.checks.some((c) => c.status === "fail" && c.name.toLowerCase().includes("char"))}
          />
          <MeterChip label={`${a.emoji_count} emoji (${a.emoji_range_for_band[0]}-${a.emoji_range_for_band[1]} fits)`}
            ok={a.emoji_count >= a.emoji_range_for_band[0] - 1 && a.emoji_count <= a.emoji_range_for_band[1]} />
          {a.personalized && <MeterChip label="personalised" ok />}
          <span className="ml-auto text-[11px] tnum">
            <span className="text-muted-foreground">style</span>{" "}
            <span className={`font-semibold ${a.style_score >= 85 ? "text-[color:var(--success)]" : a.style_score >= 65 ? "text-[color:var(--warning)]" : "text-[color:var(--red)]"}`}>
              {a.style_score}
            </span>
          </span>
        </div>

        {/* Prediction */}
        <PredictionRow p={v.prediction} />

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-[10px] text-muted-foreground">{v.source}</span>
          <button onClick={() => setOpen(!open)}
            className="text-[11px] text-[color:var(--cyan-deep)] hover:underline">
            {open ? "Hide checks" : `${a.checks.length} discipline checks`}
          </button>
        </div>
        {open && <ChecksList checks={a.checks} factors={v.prediction.factors} />}
      </div>
    </div>
  );
}

function PredictionRow({ p }: { p: CopyPrediction }) {
  const cell = (label: string, base: number, pred: number, delta: number, dp = 1) => (
    <div>
      <p className="label-mono !text-[8.5px] mb-1">{label}</p>
      <p className="text-[14px] font-semibold tnum font-heading text-[color:var(--ink)]">
        {pct(pred, dp)}
        {Math.abs(delta) >= 0.005 && (
          <span className={`ml-1.5 text-[10px] font-sans inline-flex items-center gap-0.5 ${delta > 0 ? "text-[color:var(--success)]" : "text-[color:var(--red)]"}`}>
            {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {delta > 0 ? "+" : ""}{(delta * 100).toFixed(0)}%
          </span>
        )}
      </p>
      <p className="text-[9.5px] text-muted-foreground tnum">baseline {pct(base, dp)}</p>
    </div>
  );
  return (
    <div className="mt-3 rounded-lg border border-border bg-white px-3.5 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <Chip kind="PREDICTED" title={p.confidence_reason} />
        <span className="text-[10px] text-muted-foreground">{p.confidence} confidence, deltas vs channel prior</span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {cell("Open", p.baseline.open, p.predicted.open, p.delta.open)}
        {cell("Click", p.baseline.click, p.predicted.click, p.delta.click)}
        {cell("Convert", p.baseline.convert, p.predicted.convert, p.delta.convert)}
        {p.funnel && (
          <div>
            <p className="label-mono !text-[8.5px] mb-1">Est. conversions</p>
            <p className="text-[14px] font-semibold tnum font-heading text-[color:var(--red)]">
              {n(p.funnel.converted)}
            </p>
            <p className="text-[9.5px] text-muted-foreground tnum">of {n(p.funnel.sent)} sent</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecksList({ checks, factors }: { checks: CopyAnalysis["checks"]; factors: string[] }) {
  return (
    <div className="mt-2.5 space-y-1.5">
      {checks.map((c) => (
        <div key={c.name} className="flex items-start gap-2 text-[11px]">
          <span className={`mt-[3px] w-2 h-2 rounded-full flex-shrink-0 ${
            c.status === "pass" ? "bg-[color:var(--success)]"
            : c.status === "warn" ? "bg-[color:var(--warning)]" : "bg-[color:var(--red)]"
          }`} />
          <span className="text-foreground font-medium">{c.name}</span>
          <span className="text-muted-foreground">{c.detail}</span>
        </div>
      ))}
      {factors.length > 0 && (
        <div className="rounded-md bg-[color:var(--cyan-wash)] border border-[color:#b3e8ee] px-3 py-2 mt-2">
          <p className="label-mono !text-[color:var(--cyan-deep)] mb-1">Prediction factors</p>
          {factors.map((f) => (
            <p key={f} className="text-[10.5px] text-foreground leading-relaxed">· {f}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisBlock({ analysis, prediction, channel }: {
  analysis: CopyAnalysis; prediction: CopyPrediction; channel: string;
}) {
  return (
    <div className="panel-flush p-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className={`chip ${analysis.category === "utility" ? "chip-derived" : "chip-predicted"}`}>
          {channel === "whatsapp" ? `WA ${analysis.category}` : analysis.category}
        </span>
        <span className="text-[11px] text-muted-foreground">{analysis.category_basis}</span>
        <span className="ml-auto text-[11px] tnum">
          style <span className="font-semibold">{analysis.style_score}</span>
        </span>
      </div>
      <PredictionRow p={prediction} />
      <ChecksList checks={analysis.checks} factors={prediction.factors} />
    </div>
  );
}

function MeterChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] tnum ${
      ok ? "border-border text-muted-foreground bg-white"
        : "border-[color:var(--red)]/40 text-[color:var(--red)] bg-[color:var(--red)]/[0.05]"
    }`}>
      {label}
    </span>
  );
}

/* ==========================================================================
   Simulation result (unchanged logic, channel chart now carries real logos)
   ========================================================================== */

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
      <Panel ground="aurora" ticked className="p-6">
        <div className="relative grid grid-cols-12 gap-7 items-center">
          <div className="col-span-12 lg:col-span-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="label-mono">Addressable audience</span>
              <Chip kind="DERIVED" />
            </div>
            <p className="figure text-[46px]">{n(r.audience.addressable)}</p>
            <p className="text-[12px] text-muted-foreground mt-2.5 leading-relaxed flex items-center gap-1.5 flex-wrap">
              {r.selection.cohorts.join(", ")} · {r.selection.org} · via
              <ChannelGlyph channel={r.channel.selected} size={15} />
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
        <ChartFrame
          title="Channel choice"
          sub="How many of the objective pool each channel can actually reach"
          chip="DERIVED"
          filename="channel-choice"
          caption="Addressable audience by channel. Crew M"
          className="col-span-12 lg:col-span-5"
        >
          <div className="h-[196px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical"
                margin={{ left: 14, right: 44, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={compact} {...AXIS} />
                <YAxis type="category" dataKey="channel" width={96}
                  tick={<ChannelTickY />} axisLine={false} tickLine={false} />
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

        <ChartFrame
          title="Projected funnel"
          sub="Modeled industry priors. No real campaign history exists for this account."
          chip="PREDICTED"
          filename="projected-funnel"
          caption="Projected campaign funnel, PREDICTED from modeled priors. Crew M"
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
                campaigns. Treat the shape as directional, not the absolute numbers.
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
      {hint && <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">{hint}</p>}
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
