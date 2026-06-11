"use client";

// Presentation-only. The Wrapped-style card sequence that is the body of the
// Stage 3 (Understand) reveal: full-width cards shown one at a time, a fine
// thread with a node per card running across the top (it blooms at the finale),
// content-coded colour washes with a motif medallion, cream cards where Vita
// speaks, and a quiet "Where's this from?" disclosure on the content cards. It
// renders content only; all data, generation and graceful-degradation stay in
// UnderstandReveal. Tap right/left, ‹ › arrows and the arrow keys all step;
// reduced motion is respected.

import { useEffect, useState } from "react";
import Link from "next/link";
import VitaMark from "./VitaMark";
import type { RevealCard } from "@/lib/stage3Reveal";

type ArcStage = { number: number; name: string; done: boolean };

// Content-coded accent per washed card (fg = medallion + label, wash = top
// fade). Cream cards (opener, thread, finale) don't appear here.
const ACCENT: Record<string, { fg: string; wash: string }> = {
  strengths: { fg: "var(--reveal-strengths-fg)", wash: "var(--reveal-strengths-wash)" },
  values: { fg: "var(--reveal-values-fg)", wash: "var(--reveal-values-wash)" },
  protect: { fg: "var(--reveal-protect-fg)", wash: "var(--reveal-protect-wash)" },
  clearEyed: { fg: "var(--reveal-clear-fg)", wash: "var(--reveal-clear-wash)" },
  forward: { fg: "var(--reveal-forward-fg)", wash: "var(--reveal-forward-wash)" },
};

// The quiet provenance line on the content cards that carry one (spec §3).
const PROVENANCE: Record<string, string> = {
  strengths: "From your Strengths module — the character strengths you confirmed.",
  values: "From Your values — in the wording you chose.",
  protect: "From Living your values — the protectors you set.",
};

// --- motif medallions: simple stroke glyphs, coloured by the card's accent ---
function Motif({ kind, size = 23 }: { kind: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "strengths")
    return (
      <svg {...common}>
        <path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13l1-7.5z" />
      </svg>
    );
  if (kind === "values")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" />
      </svg>
    );
  if (kind === "protect")
    return (
      <svg {...common}>
        <circle cx="12" cy="5" r="2.4" />
        <path d="M12 7.4V21" />
        <path d="M5 13a7 7 0 0 0 14 0" />
        <path d="M3.5 13H7" />
        <path d="M17 13h3.5" />
      </svg>
    );
  if (kind === "clearEyed")
    return (
      <svg {...common}>
        <path d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7-9.5-7-9.5-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  // forward
  return (
    <svg {...common}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export default function UnderstandCards({
  cards,
  arc,
  currentStage,
  returnHref,
}: {
  cards: RevealCard[];
  arc: ArcStage[];
  currentStage: number;
  returnHref: string;
}) {
  const n = cards.length;
  const [cur, setCur] = useState(0);
  const [srcOpen, setSrcOpen] = useState(false);

  function go(to: number) {
    const next = Math.max(0, Math.min(n - 1, to));
    if (next === cur) return;
    setCur(next);
    setSrcOpen(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(cur + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(cur - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // re-bound on cur so the closure steps from the live index
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, n]);

  const onLast = cur === n - 1;

  return (
    <div className="rlp-ureveal">
      <style>{css}</style>

      <h2 className="sr-only">
        A thread runs through a sequence of cards — the person inside your
        picture, your strengths, your values, the one thing running through it
        all, what you&rsquo;ll protect, the worries you named, what these years
        are for, and a step into Plan. Use the arrows or arrow keys to move.
      </h2>

      {/* the thread: one node per card, blooming at the finale */}
      <div className="thread" aria-hidden="true">
        {cards.map((_, k) => (
          <div key={k} style={{ display: "contents" }}>
            <span
              className={`node${k === n - 1 ? " bloom" : ""}${
                k < cur ? " done" : k === cur ? " now" : ""
              }`}
            />
            {k < n - 1 && <span className={`seg${k < cur ? " done" : ""}`} />}
          </div>
        ))}
      </div>

      <div className="stage">
        {cards.map((card, i) => {
          const cream =
            card.kind === "opener" ||
            card.kind === "thread" ||
            card.kind === "finale";
          const accent = ACCENT[card.kind];
          return (
            <section
              key={i}
              className={`card ${cream ? "cream" : "washed"}${
                i === cur ? " on" : ""
              }`}
              style={
                accent
                  ? ({
                      "--acc": accent.fg,
                      "--accbg": accent.wash,
                    } as React.CSSProperties)
                  : undefined
              }
              aria-hidden={i === cur ? undefined : true}
            >
              <CardBody card={card} arc={arc} currentStage={currentStage} />
              {PROVENANCE[card.kind] && (
                <div className="src-wrap">
                  <button
                    type="button"
                    className="srcbtn"
                    aria-expanded={srcOpen}
                    onClick={() => setSrcOpen((v) => !v)}
                  >
                    {srcOpen ? "Hide source" : "Where\u2019s this from?"}
                  </button>
                  {srcOpen && <p className="srctxt">{PROVENANCE[card.kind]}</p>}
                </div>
              )}
              {card.kind === "forward" && (
                <div className="actions">
                  <Link className="cta" href={card.primaryHref}>
                    Continue to Plan <span aria-hidden="true">&rarr;</span>
                  </Link>
                  <Link className="ghost" href={returnHref}>
                    Return home
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* stepping zones + arrows — hidden on the final card */}
      {!onLast && (
        <>
          <button
            type="button"
            className="tapzone l"
            aria-label="Previous card"
            onClick={() => go(cur - 1)}
          />
          <button
            type="button"
            className="tapzone r"
            aria-label="Next card"
            onClick={() => go(cur + 1)}
          />
        </>
      )}

      <div className="nav" style={{ visibility: onLast ? "hidden" : "visible" }}>
        <span className="dot-hint">Tap to continue</span>
        <div className="arrows">
          <button
            type="button"
            aria-label="Previous"
            disabled={cur === 0}
            onClick={() => go(cur - 1)}
          >
            &lsaquo;
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={cur === n - 1}
            onClick={() => go(cur + 1)}
          >
            &rsaquo;
          </button>
        </div>
      </div>
    </div>
  );
}

function CardBody({
  card,
  arc,
  currentStage,
}: {
  card: RevealCard;
  arc: ArcStage[];
  currentStage: number;
}) {
  switch (card.kind) {
    case "opener":
      return (
        <>
          <div className="vita">
            <VitaMark size={34} />
            <span className="vita-lbl">Vita · your retirement coach</span>
          </div>
          <div className="stage-arc">
            {arc.map((s, i) => (
              <span key={s.number} className="arc-item">
                {i > 0 && <span className="arc-line" aria-hidden="true" />}
                <span
                  className={`arc-name${
                    s.number === currentStage
                      ? " now"
                      : s.done
                        ? " done"
                        : ""
                  }`}
                >
                  {s.done && (
                    <span className="arc-tick" aria-hidden="true">
                      {"\u2713"}
                    </span>
                  )}
                  {s.name}
                </span>
              </span>
            ))}
          </div>
          <div className="body-mid">
            <p className="lede h-md">{card.line}</p>
          </div>
        </>
      );

    case "strengths":
      return (
        <>
          <div className="med">
            <Motif kind="strengths" />
          </div>
          <div className="profile-tag">Your strengths profile</div>
          <div className="body-mid">
            <p className="hero h-lg">{card.profile}</p>
            {card.chips.length > 0 && (
              <div className="chips">
                {card.chips.map((c, i) => (
                  <b key={i}>{c}</b>
                ))}
              </div>
            )}
            {card.carry && (
              <p className="carry">
                <span className="k">Carried into retirement</span> {card.carry}
              </p>
            )}
          </div>
        </>
      );

    case "values":
      return (
        <>
          <div className="med">
            <Motif kind="values" />
          </div>
          <div className="profile-tag">Your values profile</div>
          <div className="body-mid">
            <p className="hero h-lg">{card.profile}</p>
            {card.top && <p className="sub t-17">{card.top}</p>}
            {card.chips.length > 0 && (
              <div className="chips">
                {card.chips.map((c, i) => (
                  <b key={i}>{c}</b>
                ))}
              </div>
            )}
            {card.breadth && (
              <p className="carry">
                <span className="k">Already shaping</span> {card.breadth}
              </p>
            )}
          </div>
        </>
      );

    case "thread":
      return (
        <>
          <div className="vita">
            <VitaMark size={34} />
            <span className="vita-lbl">Vita noticed</span>
          </div>
          <div className="body-mid">
            <p className="frame">One thing keeps surfacing underneath it all</p>
            <p className="hero h-lg">{card.name}</p>
            {card.trace && <p className="sub t-17">{card.trace}</p>}
          </div>
        </>
      );

    case "protect":
      return (
        <>
          <div className="med">
            <Motif kind="protect" />
          </div>
          <div className="eyebrow">What you&rsquo;ll protect</div>
          <div className="body-mid">
            <p className="hero h-md">You&rsquo;ve already named what you&rsquo;ll guard.</p>
            <p className="sub t-17">{card.line}</p>
          </div>
        </>
      );

    case "clearEyed":
      return (
        <>
          <div className="med">
            <Motif kind="clearEyed" />
          </div>
          <div className="eyebrow">And clear-eyed about the rest</div>
          <div className="body-mid">
            <p className="hero h-md">You didn&rsquo;t look away from the harder parts.</p>
            <p className="sub t-17">{card.line}</p>
          </div>
        </>
      );

    case "finale":
      return (
        <>
          <div className="eyebrow">What these years are for</div>
          <div className="body-mid">
            {card.chapterTitle ? (
              <>
                <p className="frame">If this chapter had a name</p>
                <p className="hero h-xl">{card.chapterTitle}</p>
                <p className="sub t-19">{card.meaning}</p>
              </>
            ) : (
              <p className="hero h-lg">{card.meaning}</p>
            )}
            <div className="scene" aria-hidden="true">
              <div className="sky" />
              <div className="sun" />
              <div className="hills" />
            </div>
          </div>
        </>
      );

    case "forward":
      return (
        <>
          <div className="med">
            <Motif kind="forward" />
          </div>
          <div className="eyebrow">The heart of your plan</div>
          <div className="body-mid">
            <p className="hero h-md">This is the heart of your Retirement Life Plan.</p>
            <p className="frame">
              Next, in <strong>Plan</strong>, we turn it into something you can
              actually live.
            </p>
          </div>
        </>
      );
  }
}

const css = `
.rlp-ureveal{position:relative;max-width:600px;width:100%;margin:0 auto;font-family:var(--font-sans);color:var(--text);background:var(--bg);border:1px solid var(--border-strong);border-radius:var(--r-lg);overflow:hidden}
.rlp-ureveal *{box-sizing:border-box}
.rlp-ureveal .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.rlp-ureveal a{text-decoration:none}

/* the thread */
.rlp-ureveal .thread{display:flex;align-items:center;padding:16px 22px 6px}
.rlp-ureveal .thread .node{flex:none;width:8px;height:8px;border-radius:50%;background:var(--info-line);transition:all .3s ease}
.rlp-ureveal .thread .seg{flex:1;height:1.5px;background:var(--info-line);transition:background .3s ease}
.rlp-ureveal .thread .node.done,.rlp-ureveal .thread .node.now{background:var(--brand-primary)}
.rlp-ureveal .thread .seg.done{background:var(--brand-primary)}
.rlp-ureveal .thread .node.now{box-shadow:0 0 0 4px rgba(1,50,129,.13)}
.rlp-ureveal .thread .node.bloom.done{width:11px;height:11px;box-shadow:0 0 0 5px rgba(1,50,129,.10)}

/* cards */
.rlp-ureveal .stage{position:relative;min-height:548px}
.rlp-ureveal .card{position:absolute;inset:0;padding:22px 24px 20px;display:none;flex-direction:column;opacity:0;transition:opacity .32s ease;background:var(--bg)}
.rlp-ureveal .card.on{display:flex;opacity:1}
.rlp-ureveal .card.washed{background:linear-gradient(180deg,var(--accbg) 0%,var(--bg) 46%)}
.rlp-ureveal .card.cream{background:var(--warm-surface)}

.rlp-ureveal .med{width:46px;height:46px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;margin-bottom:14px;background:var(--accbg);color:var(--acc)}
.rlp-ureveal .vita{display:flex;align-items:center;gap:9px;margin-bottom:14px}
.rlp-ureveal .vita-lbl{font-size:11.5px;color:var(--coach-pill-text);font-weight:600}

.rlp-ureveal .eyebrow{font-size:var(--fs-eyebrow);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--acc);margin-bottom:10px}
.rlp-ureveal .card.cream .eyebrow{color:var(--coach-pill-text)}
.rlp-ureveal .profile-tag{font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--acc);margin-bottom:8px}

.rlp-ureveal .body-mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.rlp-ureveal .lede,.rlp-ureveal .hero,.rlp-ureveal .sub{font-family:var(--font-serif);margin:0}
.rlp-ureveal .lede{color:var(--ink);line-height:1.4}
.rlp-ureveal .hero{color:var(--ink);font-weight:600;line-height:1.28}
.rlp-ureveal .sub{color:var(--text);line-height:1.5;margin-top:14px}
.rlp-ureveal .frame{font-family:var(--font-sans);font-size:13.5px;color:var(--text-muted);line-height:1.55;margin:0 0 8px}
.rlp-ureveal .h-xl{font-size:29px}.rlp-ureveal .h-lg{font-size:24px}.rlp-ureveal .h-md{font-size:21px}
.rlp-ureveal .t-17{font-size:17px}.rlp-ureveal .t-19{font-size:19px}

.rlp-ureveal .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
.rlp-ureveal .chips b{font-family:var(--font-serif);font-weight:500;font-size:14.5px;color:var(--text);background:var(--bg);border:1px solid var(--border-strong);border-radius:var(--r-pill);padding:4px 12px}
.rlp-ureveal .carry{font-family:var(--font-sans);margin-top:15px;padding-top:13px;border-top:1px solid var(--border);font-size:14px;color:var(--text);line-height:1.5}
.rlp-ureveal .carry .k{font-weight:600;color:var(--acc)}

.rlp-ureveal .src-wrap{margin-top:auto;padding-top:14px}
.rlp-ureveal .srcbtn{font-family:var(--font-sans);background:none;border:none;padding:0;color:var(--acc);font-weight:600;font-size:12.5px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.rlp-ureveal .srctxt{font-size:12px;color:var(--text-muted);padding-top:8px;line-height:1.45;margin:0;max-width:42ch}

/* opener stage arc */
.rlp-ureveal .stage-arc{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:4px}
.rlp-ureveal .arc-item{display:inline-flex;align-items:center;gap:5px}
.rlp-ureveal .arc-line{width:12px;height:1px;background:var(--border-strong)}
.rlp-ureveal .arc-name{display:inline-flex;align-items:center;gap:3px;font-size:12px;color:var(--text-faint);font-weight:500}
.rlp-ureveal .arc-name.done{color:var(--ink)}
.rlp-ureveal .arc-name.now{color:var(--brand-primary);font-weight:700}
.rlp-ureveal .arc-tick{color:var(--success-text);font-size:11px}

/* finale landscape — home scene with a HIGH sun (a bright day ahead) */
.rlp-ureveal .scene{margin-top:18px;height:108px;border-radius:var(--r-md);overflow:hidden;position:relative;border:1px solid var(--warm-line)}
.rlp-ureveal .scene .sky{position:absolute;inset:0;background:linear-gradient(180deg,var(--ill-sky-pale) 0%,var(--ill-sky) 46%,var(--ill-hill) 64%,var(--ill-hill-deep) 100%)}
.rlp-ureveal .scene .sun{position:absolute;left:50%;top:10px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#FFF3CF,var(--sun));transform:translateX(-50%);box-shadow:0 0 24px rgba(251,210,78,.55)}
.rlp-ureveal .scene .hills{position:absolute;left:0;right:0;bottom:0;height:46px;background:radial-gradient(150% 130% at 20% 100%,var(--ill-hill) 0%,var(--ill-hill) 58%,transparent 59%),radial-gradient(160% 140% at 80% 100%,var(--ill-hill-deep) 0%,var(--ill-hill-deep) 52%,transparent 53%)}

/* actions on the forward card */
.rlp-ureveal .actions{margin-top:16px}
.rlp-ureveal .cta{width:100%;background:var(--brand-primary);color:var(--brand-on-primary);border:none;border-radius:var(--r-sm);min-height:48px;font-family:var(--font-sans);font-weight:600;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.rlp-ureveal .cta:hover{background:var(--brand-primary-hover)}
.rlp-ureveal .ghost{width:100%;margin-top:10px;background:transparent;color:var(--brand-primary);border:1.5px solid var(--border-strong);border-radius:var(--r-sm);min-height:46px;font-family:var(--font-sans);font-weight:600;font-size:14.5px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.rlp-ureveal .ghost:hover{background:var(--brand-primary-tint)}

/* nav */
.rlp-ureveal .nav{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 22px 18px}
.rlp-ureveal .dot-hint{font-size:12px;color:var(--text-muted)}
.rlp-ureveal .arrows{display:flex;gap:8px}
.rlp-ureveal .arrows button{width:40px;height:40px;border-radius:var(--r-sm);border:1.5px solid var(--border-strong);background:var(--bg);color:var(--brand-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1}
.rlp-ureveal .arrows button:disabled{opacity:.35;cursor:default}

/* stepping zones — kept clear of the bottom so the finale actions stay tappable */
.rlp-ureveal .tapzone{position:absolute;top:60px;bottom:96px;border:none;background:transparent;padding:0;margin:0;cursor:pointer;z-index:2}
.rlp-ureveal .tapzone.l{left:0;width:38%}
.rlp-ureveal .tapzone.r{right:0;width:62%}

.rlp-ureveal :focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}

@media(prefers-reduced-motion:reduce){
  .rlp-ureveal .card{transition:none}
  .rlp-ureveal .thread .node,.rlp-ureveal .thread .seg{transition:none}
}
`;
