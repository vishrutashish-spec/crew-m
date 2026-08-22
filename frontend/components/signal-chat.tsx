"use client";

/**
 * SIGNAL: the chat surface on the cohorts page.
 *
 * Presented as a phone in a glass shell, because the thing being discussed is
 * a message that lands on a phone. The frame is real chrome (notch, status
 * bar, home indicator) so the conversation reads as a product, not a form.
 *
 * Every reply carries the facts it used with provenance chips and a quality
 * score against the published 10-parameter rubric, which is available in a
 * dropdown. The scoring is computed server-side from the reply object.
 */

import { useEffect, useRef, useState } from "react";
import {
  askAssistant, getSignalSuggestions, getRules, n, SPECTRUM,
  type AssistantReply, type DecisionParam,
} from "@/lib/api";
import { Chip } from "@/components/kit";
import { SignalBadge, SignalAvatar } from "@/components/signal-avatar";
import { Send, RotateCw, ChevronDown, Sparkles, Wifi, BatteryFull } from "lucide-react";

interface Msg {
  role: "user" | "ai";
  text: string;
  reply?: AssistantReply;
}

export function SignalChat({
  cohortKeys, org, compact = false,
}: {
  cohortKeys: string[];
  org: string | null;
  /** Dock mode: tighter padding and a stacked layout for the floating panel. */
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [rubric, setRubric] = useState<DecisionParam[] | null>(null);
  const [rubricOpen, setRubricOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSignalSuggestions(cohortKeys).then((r) => setSuggested(r.suggestions)).catch(() => {});
  }, [cohortKeys.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getRules().then((r) => {
      const rule = r.rules.find((x) => x.id === "signal_quality");
      if (rule) setRubric(rule.parameters);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setBusy(true);
    try {
      const reply = await askAssistant({
        message: msg, cohort_keys: cohortKeys, org,
      });
      setMessages((m) => [...m, { role: "ai", text: reply.answer, reply }]);
    } catch (e) {
      setMessages((m) => [...m, {
        role: "ai",
        text: e instanceof Error ? `That did not work: ${e.message}` : "That did not work.",
      }]);
    } finally {
      setBusy(false);
    }
  }

  const avg = messages.filter((m) => m.reply).length
    ? (messages.reduce((s, m) => s + (m.reply?.score.total ?? 0), 0) /
       messages.filter((m) => m.reply).length)
    : null;

  return (
    <section className="mac-panel">
      {/* header */}
      <div className="mac-bar">
        <span className="mac-dot mac-dot-r" />
        <span className="mac-dot mac-dot-y" />
        <span className="mac-dot mac-dot-g" />
        <span className="mac-title">signal / cohort analyst</span>
      </div>

      <div className={`grid-ground aurora ${compact ? "px-4 py-4" : "px-6 py-6"}`}>
        <div className="relative grid grid-cols-12 gap-7">
          {/* ---------------- identity + rubric ---------------- */}
          <div className={compact ? "col-span-12 xl:col-span-5" : "col-span-12 lg:col-span-4"}>
            <div className="flex items-start gap-4">
              <SignalBadge size={56} />
              <div className="min-w-0">
                <h2 className="section-title !text-[26px]">SIGNAL</h2>
                <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                  Cohort analyst. Reads the cohort model, 133,218 real consults and
                  36,526 checkup bookings. Answers with numbers those actually hold.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Chip kind="OBSERVED" title="Clinical evidence is measured, not modeled" />
              <Chip kind="DERIVED" />
              {avg !== null && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-[color:var(--card)] text-[10px]">
                  <span className="label-mono !text-[9px]">Session quality</span>
                  <span className="tnum font-bold text-[13px] text-[color:var(--success)]">
                    {avg.toFixed(1)}
                  </span>
                </span>
              )}
            </div>

            <div className="relative mt-4">
              <button className="btn !px-3 !py-2 !text-[11.5px] w-full justify-between"
                onClick={() => setRubricOpen(!rubricOpen)}>
                Scored on {rubric?.length ?? 10} parameters
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${rubricOpen ? "rotate-180" : ""}`} />
              </button>
              {rubricOpen && rubric && (
                <div className="glass absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl p-4 max-h-[320px] overflow-y-auto">
                  <p className="label-mono mb-2.5">Answer quality rubric, weights sum to 100</p>
                  <div className="space-y-2">
                    {rubric.map((p, i) => (
                      <div key={p.key} className="flex items-start gap-2 text-[11px]">
                        <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                          style={{ background: SPECTRUM[i % SPECTRUM.length] }} />
                        <span className="flex-1">
                          <span className="font-medium">{p.label}</span>
                          <span className="text-muted-foreground block text-[10px] leading-snug">{p.desc}</span>
                        </span>
                        <span className="tnum font-semibold flex-shrink-0">{p.weight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {suggested.length > 0 && (
              <div className="mt-4">
                <p className="label-mono mb-2">Try</p>
                <div className="flex flex-col gap-2">
                  {suggested.slice(0, 4).map((q) => (
                    <button key={q} onClick={() => send(q)}
                      className="btn !px-3 !py-2 !text-[11.5px] !justify-start text-left">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---------------- the phone ---------------- */}
          <div className={`flex justify-center ${compact ? "col-span-12 xl:col-span-7" : "col-span-12 lg:col-span-8"}`}>
            <div className="phone">
              <div className="phone-frame">
                <div className="phone-screen">
                  {/* status bar */}
                  <div className="phone-status">
                    <span className="tnum">9:41</span>
                    <span className="phone-notch" aria-hidden />
                    <span className="flex items-center gap-1.5">
                      <Wifi className="w-3 h-3" />
                      <BatteryFull className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* thread header */}
                  <div className="phone-head">
                    <SignalAvatar size={30} live thinking={busy} />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold leading-none">SIGNAL</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {busy ? "typing" : "online"}
                      </p>
                    </div>
                  </div>

                  {/* thread */}
                  <div ref={scrollRef} className="phone-thread">
                    {messages.length === 0 && (
                      <div className="flex items-start gap-2">
                        <SignalAvatar size={24} />
                        <div className="bubble bubble-ai min-w-0">
                          <p className="text-[12px] leading-relaxed">
                            Ask me which biomarker is off in a cohort, what the consult
                            pattern looks like, or which filters build a segment. I only
                            answer with numbers the data actually holds.
                          </p>
                        </div>
                      </div>
                    )}

                    {messages.map((m, i) =>
                      m.role === "user" ? (
                        <div key={i} className="flex justify-end">
                          <div className="bubble bubble-me min-w-0">
                            <p className="text-[12px] leading-relaxed">{m.text}</p>
                          </div>
                        </div>
                      ) : (
                        <AiBubble key={i} msg={m} />
                      )
                    )}

                    {busy && (
                      <div className="flex items-start gap-2">
                        <SignalAvatar size={24} live thinking />
                        <div className="bubble bubble-ai">
                          <span className="typing"><i /><i /><i /></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* composer */}
                  <div className="phone-composer">
                    <input
                      className="phone-input"
                      placeholder="Ask SIGNAL"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && send()}
                    />
                    <button onClick={() => send()} disabled={busy || !input.trim()}
                      className="phone-send" aria-label="Send">
                      {busy ? <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="phone-home" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AiBubble({ msg }: { msg: Msg }) {
  const [open, setOpen] = useState(false);
  const r = msg.reply;
  return (
    <div className="flex items-start gap-2 min-w-0">
      <SignalAvatar size={24} live />
      <div className="bubble bubble-ai min-w-0">
        <p className="text-[12px] leading-relaxed whitespace-pre-line">{msg.text}</p>

        {r?.action && (
          <p className="text-[11.5px] mt-2.5 pt-2.5 border-t border-border leading-relaxed">
            <span className="label-mono !text-[color:var(--cyan-deep)] !text-[9px] block mb-1">
              Do this
            </span>
            {r.action}
          </p>
        )}

        {r && r.facts.length > 0 && (
          <div className="mt-2.5 space-y-1.5">
            {r.facts.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-[10.5px]">
                <Chip kind={f.provenance} />
                <span className="text-muted-foreground flex-1 min-w-0">{f.label}</span>
                <span className="tnum font-semibold flex-shrink-0">{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {r && (
          <>
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border">
              <button onClick={() => setOpen(!open)}
                className="text-[10.5px] text-[color:var(--cyan-deep)] hover:underline">
                {open ? "Hide scoring" : "How this was scored"}
              </button>
              <span className="inline-flex items-center gap-1.5">
                <span className="label-mono !text-[9px]">Quality</span>
                <span className={`tnum font-bold text-[13px] ${
                  r.score.total >= 9 ? "text-[color:var(--success)]"
                  : r.score.total >= 7 ? "text-[color:var(--warning)]"
                  : "text-[color:var(--red)]"}`}>
                  {r.score.total}/{r.score.out_of}
                </span>
              </span>
            </div>
            {open && (
              <div className="mt-2 space-y-1">
                {r.score.parameters.map((p, i) => (
                  <div key={p.key} className="flex items-center gap-2 text-[10px]">
                    <span className="w-[86px] text-muted-foreground truncate flex-shrink-0">
                      {p.label}
                    </span>
                    <div className="ribbon flex-1 !h-[5px]">
                      <span style={{ width: `${p.score * 100}%`,
                        background: SPECTRUM[i % SPECTRUM.length] }} />
                    </div>
                    <span className="tnum w-9 text-right text-muted-foreground flex-shrink-0">
                      {p.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
