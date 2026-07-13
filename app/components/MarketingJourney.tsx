"use client";

// The five-stage journey section. Interactive like MarketingPlanCard, so it lives
// as a client child; all styling is in MarketingHome's scoped .rlp-landing block.
//
// Two modes:
//  • No `pathway` prop (the public logged-out page): renders the two-tab control
//    so a visitor self-selects their pathway. Default tab: Pre-retirement.
//  • `pathway` supplied (future in-app reuse, where the user's stage is known):
//    renders that single journey with NO tabs.
//
// Between pathways only stage 1's name (Imagine ↔ Review) and the descriptions
// change; the five nodes keep their order and stage colours. Copy is verbatim from
// the approved mock (descriptions are drafts pending SMW sign-off).

import { useCallback, useEffect, useRef, useState } from "react";

export type JourneyKey = "pre" | "in";

type Stage = { name: string; desc: string };

const JOURNEYS: Record<JourneyKey, Stage[]> = {
  pre: [
    { name: "Imagine", desc: "Picture what your retirement might look like." },
    { name: "Explore", desc: "Explore what a balanced retirement looks like — health, people, purpose." },
    { name: "Understand", desc: "Get clear on what matters most to you." },
    { name: "Plan", desc: "Turn it into concrete goals, timing and next steps." },
    { name: "Act", desc: "Start making it real, with support to keep going." },
  ],
  in: [
    { name: "Review", desc: "Review the retirement you’ve lived so far, and imagine what’s round the corner." },
    { name: "Explore", desc: "Explore what a balanced retirement looks like — health, people, purpose." },
    { name: "Understand", desc: "Get clear on what matters most to you now." },
    { name: "Plan", desc: "Shape the changes you want, and how to make them happen." },
    { name: "Act", desc: "Take the first steps, with support to keep thriving." },
  ],
};

const TABS: { key: JourneyKey; label: string }[] = [
  { key: "pre", label: "Pre-retirement" },
  { key: "in", label: "In retirement" },
];

// The path fades out (160ms) before its content swaps, matching the mock; the CSS
// transition on .jrow does the visible fade.
const SWAP_MS = 160;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function Path({ stages }: { stages: Stage[] }) {
  return (
    <>
      {stages.map((s, i) => (
        <div key={i} className={`jnode s${i + 1}`}>
          <div className="jnum">{i + 1}</div>
          <div className="jbody">
            <div className="jname">{s.name}</div>
            <div className="jdesc">{s.desc}</div>
          </div>
        </div>
      ))}
    </>
  );
}

export default function MarketingJourney({ pathway }: { pathway?: JourneyKey }) {
  const hasTabs = !pathway;
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState<JourneyKey>(pathway ?? "pre");
  const [opacity, setOpacity] = useState(1);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabRefs = useRef<Record<JourneyKey, HTMLButtonElement | null>>({ pre: null, in: null });

  const select = useCallback(
    (next: JourneyKey) => {
      if (next === active) return;
      if (reduced) {
        setActive(next);
        return;
      }
      setOpacity(0);
      if (swapTimer.current) clearTimeout(swapTimer.current);
      swapTimer.current = setTimeout(() => {
        setActive(next);
        setOpacity(1);
      }, SWAP_MS);
    },
    [active, reduced]
  );

  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
    },
    []
  );

  // Left/Right arrow moves between the two tabs (automatic activation), and moves
  // focus to the newly selected tab.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next: JourneyKey = active === "pre" ? "in" : "pre";
    select(next);
    tabRefs.current[next]?.focus();
  };

  const panelId = "journey-panel";

  return (
    <section className="journey">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">The journey</span>
          <h2>Five stages, at your own pace.</h2>
          <p>Each stage builds gently on the last — and Vita guides you the whole way.</p>
        </div>

        {hasTabs && (
          <div className="jtabs-wrap">
            <div className="jtabs" role="tablist" aria-label="Choose your pathway" onKeyDown={onKeyDown}>
              {TABS.map((t) => {
                const selected = active === t.key;
                return (
                  <button
                    key={t.key}
                    ref={(el) => {
                      tabRefs.current[t.key] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`journey-tab-${t.key}`}
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    className={`jtab${selected ? " is-active" : ""}`}
                    onClick={() => select(t.key)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          className="jrow"
          id={panelId}
          role={hasTabs ? "tabpanel" : undefined}
          aria-labelledby={hasTabs ? `journey-tab-${active}` : undefined}
          tabIndex={hasTabs ? 0 : undefined}
          style={{ opacity }}
        >
          <Path stages={JOURNEYS[active]} />
        </div>
      </div>
    </section>
  );
}
