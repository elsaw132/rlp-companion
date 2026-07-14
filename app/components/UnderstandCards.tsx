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
import { stageColorFor } from "@/lib/stageColors";
import type { RevealCard } from "@/lib/stage3Reveal";

// Content-coded accent per washed card (fg = medallion + label, wash = top
// fade). Cream cards (opener, thread, finale) don't appear here.
const ACCENT: Record<string, { fg: string; wash: string }> = {
  strengths: { fg: "var(--reveal-strengths-fg)", wash: "var(--reveal-strengths-wash)" },
  values: { fg: "var(--reveal-values-fg)", wash: "var(--reveal-values-wash)" },
  protect: { fg: "var(--reveal-protect-fg)", wash: "var(--reveal-protect-wash)" },
  clearEyed: { fg: "var(--reveal-clear-fg)", wash: "var(--reveal-clear-wash)" },
};

// The quiet provenance line on the content cards that carry one (spec §3).
const PROVENANCE: Record<string, string> = {
  strengths: "From your Strengths session — the character strengths you confirmed.",
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
  currentStage,
  returnHref,
}: {
  cards: RevealCard[];
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

      <div
        className="band"
        style={{ background: stageColorFor(currentStage) }}
        aria-hidden="true"
      />

      {/* The reveal's framing — the same eyebrow + large serif title that opens
          the Imagine and Explore reveals, before Vita starts speaking. It steps
          aside on the final card, where the handover carries its own headline. */}
      {!onLast && (
        <header className="rhead">
          <div className="r-eyebrow">The heart of your plan</div>
          <h1 className="r-display">The person inside your picture</h1>
        </header>
      )}

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
          // Cream = Vita's own cards (the framing ones), including the handover.
          const cream =
            card.kind === "opener" ||
            card.kind === "thread" ||
            card.kind === "finale" ||
            card.kind === "forward";
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
              <CardBody card={card} />
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

function CardBody({ card }: { card: RevealCard }) {
  switch (card.kind) {
    case "opener":
      return (
        <div className="body-mid">
          <div className="vita">
            <VitaMark size={34} />
            <span className="vita-lbl">Vita</span>
          </div>
          <p className="lede h-md">{card.line}</p>
          <p className="tap-more">Tap to reveal more</p>
        </div>
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
        <div className="body-mid">
          <div className="vita">
            <VitaMark size={34} />
            <span className="vita-lbl">Vita noticed</span>
          </div>
          <p className="frame">One thing keeps surfacing underneath it all</p>
          <p className="hero h-lg">{card.name}</p>
          {card.trace && <p className="sub t-17">{card.trace}</p>}
        </div>
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
          </div>
        </>
      );

    case "forward":
      return (
        <div className="body-mid">
          <div className="eyebrow">What&rsquo;s next</div>
          <p className="hero h-lg">
            This is the heart of your Retirement Life Plan.
          </p>
          <p className="sub t-17">
            The strengths you will carry forward, the values you want to live
            by, and what matters most to you in this chapter — this is the
            ground everything else gets built on.
          </p>
          <p className="onward">
            Next, in <strong>Plan</strong>, we turn it into something you can
            actually live: when and how you step back from work, and the goals
            worth moving toward.
          </p>
        </div>
      );
  }
}

const css = `
.rlp-ureveal{position:relative;max-width:600px;width:100%;margin:0 auto;font-family:var(--font-sans);color:var(--text);background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-md);overflow:hidden}
.rlp-ureveal *{box-sizing:border-box}
.rlp-ureveal .band{height:28px;width:100%}

/* reveal framing — mirrors StageReveal's eyebrow + display title */
.rlp-ureveal .rhead{padding:30px 32px 4px;text-align:center}
.rlp-ureveal .r-eyebrow{font-size:var(--fs-eyebrow);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);font-weight:600;margin-bottom:10px}
.rlp-ureveal .r-display{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;line-height:1.12;color:var(--ink);letter-spacing:-.01em;margin:0}
@media(max-width:600px){.rlp-ureveal .rhead{padding:24px 22px 2px}.rlp-ureveal .r-display{font-size:28px}}
.rlp-ureveal .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.rlp-ureveal a{text-decoration:none}

/* the thread */
.rlp-ureveal .thread{display:flex;align-items:center;padding:16px 22px 6px}
.rlp-ureveal .thread .node{flex:none;width:8px;height:8px;border-radius:50%;background:var(--info-line);transition:all .3s ease}
.rlp-ureveal .thread .seg{flex:1;height:1.5px;background:var(--info-line);transition:background .3s ease}
.rlp-ureveal .thread .node.done,.rlp-ureveal .thread .node.now{background:var(--ink)}
.rlp-ureveal .thread .seg.done{background:var(--ink)}
.rlp-ureveal .thread .node.now{box-shadow:0 0 0 4px color-mix(in srgb, var(--ink) 14%, transparent)}
.rlp-ureveal .thread .node.bloom.done{width:11px;height:11px;box-shadow:0 0 0 5px color-mix(in srgb, var(--ink) 11%, transparent)}

/* cards */
.rlp-ureveal .stage{position:relative;min-height:430px}
.rlp-ureveal .card{position:absolute;inset:0;padding:26px 28px 22px;display:none;flex-direction:column;text-align:center;opacity:0;transition:opacity .32s ease;background:var(--bg)}
.rlp-ureveal .card.on{display:flex;opacity:1}
.rlp-ureveal .card.washed{background:linear-gradient(180deg,color-mix(in srgb, var(--accbg) 72%, var(--warm-surface)) 0%,var(--warm-surface) 40%)}
.rlp-ureveal .card.cream{background:var(--warm-surface)}

.rlp-ureveal .med{width:46px;height:46px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;background:var(--accbg);color:var(--acc)}
.rlp-ureveal .vita{display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:14px}
.rlp-ureveal .vita-lbl{font-family:var(--font-serif);font-size:16px;color:var(--color-vita);font-weight:600}

/* Eyebrows match the shared reveal shell (muted, .12em) — the aspect colour is
   carried by the medallion alone, so the cards don't read as a different system. */
.rlp-ureveal .eyebrow{font-size:var(--fs-eyebrow);font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px}
.rlp-ureveal .profile-tag{font-size:var(--fs-eyebrow);font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px}

.rlp-ureveal .body-mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.rlp-ureveal .lede,.rlp-ureveal .hero,.rlp-ureveal .sub{font-family:var(--font-serif);margin:0}
.rlp-ureveal .lede{color:var(--ink);line-height:1.4}
.rlp-ureveal .hero{color:var(--ink);font-weight:600;line-height:1.28}
.rlp-ureveal .sub{color:var(--text);line-height:1.5;margin-top:14px}
.rlp-ureveal .frame{font-family:var(--font-sans);font-size:13.5px;color:var(--text-muted);line-height:1.55;margin:0 0 8px}
.rlp-ureveal .tap-more{font-family:var(--font-sans);font-size:13px;color:var(--text-muted);margin:16px 0 0}
/* the handover line into Plan — set apart above the actions */
.rlp-ureveal .onward{font-family:var(--font-sans);font-size:14.5px;line-height:1.6;color:var(--text);margin:18px auto 0;max-width:44ch;padding-top:16px;border-top:1px solid var(--warm-line)}
.rlp-ureveal .onward strong{color:var(--ink);font-weight:600}
.rlp-ureveal .h-xl{font-size:34px;letter-spacing:-.01em}.rlp-ureveal .h-lg{font-size:27px;letter-spacing:-.01em}.rlp-ureveal .h-md{font-size:22px}
.rlp-ureveal .t-17{font-size:17px}.rlp-ureveal .t-19{font-size:19px}

.rlp-ureveal .chips{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin-top:14px}
.rlp-ureveal .chips b{font-family:var(--font-serif);font-weight:500;font-size:14.5px;color:var(--text);background:var(--bg);border:1px solid var(--border-strong);border-radius:var(--r-pill);padding:4px 12px}
.rlp-ureveal .carry{font-family:var(--font-sans);margin-top:15px;padding-top:13px;border-top:1px solid var(--border);font-size:14px;color:var(--text);line-height:1.5}
.rlp-ureveal .carry .k{font-weight:600;color:var(--ink)}

.rlp-ureveal .src-wrap{margin-top:auto;padding-top:14px}
.rlp-ureveal .srcbtn{font-family:var(--font-sans);background:none;border:none;padding:0;color:var(--acc);font-weight:600;font-size:12.5px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.rlp-ureveal .srctxt{font-size:12px;color:var(--text-muted);padding-top:8px;line-height:1.45;margin:0;max-width:42ch}

/* actions on the forward card — same navy + ghost pair as the shared shell */
.rlp-ureveal .actions{margin-top:18px;display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.rlp-ureveal .cta{background:var(--brand-primary);color:var(--brand-on-primary);border:none;border-radius:var(--r-sm);min-height:48px;padding:13px 22px;font-family:var(--font-sans);font-weight:600;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px}
.rlp-ureveal .cta:hover{background:var(--brand-primary-hover)}
.rlp-ureveal .ghost{background:transparent;color:var(--brand-primary);border:1.5px solid var(--border-strong);border-radius:var(--r-sm);min-height:48px;padding:13px 22px;font-family:var(--font-sans);font-weight:600;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.rlp-ureveal .ghost:hover{background:var(--brand-primary-tint)}

/* nav */
.rlp-ureveal .nav{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:0 22px 18px}
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
/* On a phone a long card can exceed the fixed 548px stage and get clipped (the
   reveal has overflow:hidden). Let the active card flow so the stage grows to
   fit it — 548px stays as a floor, and only-one-card-visible keeps the layout
   stable. Desktop keeps its fixed-height carousel. */
@media(max-width:880px){
  .rlp-ureveal .card.on{position:relative}
}
`;
