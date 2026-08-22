"use client";

/**
 * WhatsApp message preview, built to the real anatomy of a template message
 * rather than a generic chat bubble.
 *
 * What a real WhatsApp template with a media header actually looks like, and
 * what is reproduced here:
 *
 *   - the image is INSIDE the bubble, inset by a few pixels, with its own
 *     rounded corners, sitting above the text. It is a header component of the
 *     template, not a separate message.
 *   - the body text is the caption underneath it, in the same bubble.
 *   - the timestamp sits bottom-right on the last text line, with delivery
 *     ticks beside it. Two ticks, and they are blue only once read.
 *   - marketing templates carry a call-to-action row below the body, divided
 *     off with a hairline and rendered in WhatsApp's link blue.
 *   - the bubble has a tail on its top-left, because a campaign send is an
 *     incoming message.
 *
 * The creative is chosen deterministically from the campaign objective, so the
 * same simulation always previews the same asset and a screenshot of a demo
 * stays true on a re-run.
 *
 * Provenance: only supplied, approved artwork is ever shown here. If the file
 * is absent the frame renders visibly empty and says so, and NO substitute is
 * drawn in its place: a generated stand-in that looks finished would be read as
 * the approved asset in a demo or a screenshot, which is worse than a gap.
 * See public/creative/README.md for the filenames and the rule.
 */

import { useEffect, useState } from "react";

const CREATIVE: Record<string, { src: string; alt: string }> = {
  th_activation: {
    src: "/creative/evening-call.png",
    alt: "A desk phone by a window at dusk, for an evening telehealth consult slot",
  },
  hc_activation: {
    src: "/creative/consult-handover.png",
    alt: "Two colleagues handing over health checkup paperwork",
  },
  hc_crosssell: {
    src: "/creative/rest-bench.png",
    alt: "Two people resting on a bench in evening light",
  },
  app_install: {
    src: "/creative/skyline-dusk.png",
    alt: "A city skyline at dusk",
  },
  reengagement: {
    src: "/creative/rest-bench.png",
    alt: "Two people resting on a bench in evening light",
  },
};

const FALLBACK = CREATIVE.th_activation;

export function creativeFor(objective: string | null | undefined) {
  return (objective && CREATIVE[objective]) || FALLBACK;
}

/** The CTA a marketing template would carry, per objective. */
const CTA: Record<string, string> = {
  th_activation: "Book a consult",
  hc_activation: "Book my checkup",
  hc_crosssell: "See my benefits",
  app_install: "Get the app",
  reengagement: "Open Plum",
};

export function WaMessage({
  body,
  objective,
  category,
  time = "10:04",
  showMedia = true,
}: {
  body: string;
  objective?: string | null;
  /** WhatsApp template category. Only marketing templates carry a CTA row. */
  category?: string;
  time?: string;
  showMedia?: boolean;
}) {
  const art = creativeFor(objective);
  const cta = (objective && CTA[objective]) || "Book a consult";
  const marketing = category === "marketing";
  // Reset when the objective changes, so a newly-placed file is picked up.
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [art.src]);

  return (
    <div className="wa-stage">
      <div className="wa-row">
        <div className="wa-bubble">
          <span className="wa-tail" aria-hidden />

          {showMedia && (
            <figure className="wa-media">
              {missing ? (
                <div className="wa-media-missing">
                  <span className="label-mono">Creative not placed</span>
                  <code>{art.src}</code>
                  <span>{art.alt}</span>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={art.src} alt={art.alt} width={1200} height={900}
                  onError={() => setMissing(true)} />
              )}
            </figure>
          )}

          <div className="wa-body">
            <p className="wa-text">{body}</p>
            <span className="wa-meta">
              <span className="wa-time tnum">{time}</span>
              <Ticks />
            </span>
          </div>

          {marketing && (
            <div className="wa-cta">
              <ArrowGlyph />
              {cta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Delivered-and-read double tick, in WhatsApp's blue. */
function Ticks() {
  return (
    <svg viewBox="0 0 18 12" width="16" height="11" aria-label="read"
      className="wa-ticks" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 6.6 L4.2 9.8 L10.4 2.4" />
      <path d="M7.4 6.6 L10.6 9.8 L16.8 2.4" />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M6 3.5 L11 8 L6 12.5" />
    </svg>
  );
}
