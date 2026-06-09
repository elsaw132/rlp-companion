"use client";

// The reusable stage-close reveal shell. It owns everything shared across every
// stage's completion screen — the five-stage arc, the cream reveal card, the
// Vita lockup, the threads pattern, the staggered entrance motion, and the
// actions — and takes all stage-specific content as props. The Imagine stage is
// the first instance (see ImagineReveal); later stages plug into this same shell
// by passing their own motif, copy, threads, payoff and CTA.
//
// Layout, spacing, copy structure and motion mirror design-reference's
// imagine-reveal.html. CSS is scoped under .rlp-reveal so it can't leak.

import Link from "next/link";
import VitaMark from "./VitaMark";
import type { RevealThread } from "@/lib/stageReveal";

export type StageRevealProps = {
  // The five stages in order, each flagged done (real progress drives this).
  arc: { number: number; name: string; done: boolean }[];
  // Decorative header illustration at the top of the card (Imagine = dawn).
  motif?: React.ReactNode;
  eyebrow: string;
  title: string;
  // The intro line beneath the Vita lockup (names the person).
  vitaIntro: string;
  // The threads pattern (Imagine = three theme + quote pairs). Omit when a stage
  // supplies its own body via `children` (Explore = the six area cards).
  threads?: RevealThread[];
  // A custom body slot rendered in place of the threads block — a stage that
  // doesn't fit the threads pattern passes its own markup here. It sits inside
  // .rlp-reveal, so the shared rise/dN motion classes are available to it.
  children?: React.ReactNode;
  // Optional payoff slot between the body and the hook (Imagine = the archetype).
  payoff?: React.ReactNode;
  forwardHook: string;
  primaryCta: { label: string; href: string };
  returnHref: string;
};

export default function StageReveal({
  arc,
  motif,
  eyebrow,
  title,
  vitaIntro,
  threads,
  children,
  payoff,
  forwardHook,
  primaryCta,
  returnHref,
}: StageRevealProps) {
  return (
    <main className="rlp-reveal">
      <style>{css}</style>

      {/* Five-stage arc — one of five done, nothing more. */}
      <div className="arc rise d1">
        {arc.map((s, i) => (
          <div key={s.number} className={`s ${s.done ? "done" : "todo"}`}>
            <div className="d">{s.done ? "\u2713" : s.number}</div>
            <div className="c">{s.name}</div>
            {i < arc.length - 1 && <span className="line" aria-hidden="true" />}
          </div>
        ))}
      </div>

      <section className="reveal">
        {motif}

        <div className="body">
          <div className="eyebrow rise d2">{eyebrow}</div>
          <h1 className="display rise d2">{title}</h1>

          <div className="vita rise d3">
            <VitaMark size={34} />
            <span className="name">Vita</span>
            <span className="pill">Your retirement coach</span>
          </div>

          <p className="intro rise d3">{vitaIntro}</p>

          {children ?? (
            <div className="threads">
              {(threads ?? []).map((t, i) => (
                <div
                  key={i}
                  className={`thread rise ${["d4", "d5", "d6"][i] ?? "d6"}`}
                >
                  <div className="lab">{t.themeLabel}</div>
                  <div className="quote">&ldquo;{t.quote}&rdquo;</div>
                </div>
              ))}
            </div>
          )}

          {payoff && <div className="rise d7">{payoff}</div>}

          <p className="hook rise d8">{forwardHook}</p>

          <div className="actions">
            <Link className="btn-navy rise d8" href={primaryCta.href}>
              {primaryCta.label} <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link className="btn-ghost rise d9" href={returnHref}>
              Return home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const css = `
.rlp-reveal{max-width:860px;margin:0 auto;padding:40px 24px 96px}
.rlp-reveal a{text-decoration:none}

/* slim stage arc */
.rlp-reveal .arc{display:flex;align-items:flex-start;gap:0;margin:0 auto 28px;max-width:480px}
.rlp-reveal .arc .s{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative}
.rlp-reveal .arc .d{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;z-index:1}
.rlp-reveal .arc .s.done .d{background:var(--brand-primary);color:#fff}
.rlp-reveal .arc .s.todo .d{background:var(--border);color:var(--text-faint)}
.rlp-reveal .arc .c{font-size:var(--fs-eyebrow);font-weight:600;color:var(--text-muted);text-align:center}
.rlp-reveal .arc .s.done .c{color:var(--ink)}
.rlp-reveal .arc .s .line{position:absolute;top:13px;left:50%;width:100%;height:2px;background:var(--border)}
.rlp-reveal .arc .s.done .line{background:var(--brand-primary)}

/* reveal card (cream = the coach is present) */
.rlp-reveal .reveal{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-md);overflow:hidden}
.rlp-reveal .body{padding:44px 56px 40px}

.rlp-reveal .eyebrow{font-size:var(--fs-eyebrow);letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);font-weight:600;text-align:center;margin-bottom:10px}
.rlp-reveal .display{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;line-height:1.12;color:var(--ink);text-align:center;letter-spacing:-.01em}

/* Vita lockup */
.rlp-reveal .vita{display:flex;align-items:center;justify-content:center;gap:10px;margin:22px 0 18px}
.rlp-reveal .vita .name{font-family:var(--font-serif);font-size:var(--fs-title);font-weight:600;color:var(--ink)}
.rlp-reveal .vita .pill{font-size:var(--fs-label);font-weight:600;color:var(--coach-pill-text);background:var(--coach-pill);border-radius:var(--r-pill);padding:4px 11px}

.rlp-reveal .intro{font-family:var(--font-serif);font-size:var(--fs-h2);line-height:1.5;color:var(--text);text-align:center;max-width:54ch;margin:0 auto 34px}

/* the three threads */
.rlp-reveal .threads{display:flex;flex-direction:column;gap:22px;margin:0 auto;max-width:54ch}
.rlp-reveal .thread{border-left:2px solid var(--warm-line);padding:2px 0 2px 20px}
.rlp-reveal .thread .lab{font-family:var(--font-serif);font-size:var(--fs-title);font-weight:600;color:var(--ink);display:flex;align-items:baseline;gap:9px}
.rlp-reveal .thread .lab::before{content:"";flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--sun);transform:translateY(-3px)}
.rlp-reveal .thread .quote{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-h2);line-height:1.45;color:var(--text);margin-top:5px}

.rlp-reveal .hook{font-family:var(--font-serif);font-size:var(--fs-h2);color:var(--text);text-align:center;max-width:50ch;margin:36px auto 28px}

.rlp-reveal .actions{display:flex;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:14px}
.rlp-reveal .btn-navy{font-family:var(--font-sans);font-size:15px;font-weight:600;color:#fff;background:var(--brand-primary);border:none;border-radius:var(--r-sm);padding:13px 22px;min-height:48px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;line-height:1}
.rlp-reveal .btn-navy:hover{background:var(--brand-primary-hover)}
.rlp-reveal .btn-ghost{font-family:var(--font-sans);font-size:15px;font-weight:600;color:var(--brand-primary);background:transparent;border:1.5px solid var(--border-strong);border-radius:var(--r-sm);padding:13px 22px;min-height:48px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1}
.rlp-reveal .btn-ghost:hover{background:var(--brand-primary-tint)}
.rlp-reveal :focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}

/* entrance motion: each part rises in on a stagger, so the chapter composes itself */
.rlp-reveal .rise{opacity:0;transform:translateY(14px);animation:rlp-rise .62s cubic-bezier(.22,.61,.36,1) forwards}
.rlp-reveal .d1{animation-delay:.15s}.rlp-reveal .d2{animation-delay:.32s}.rlp-reveal .d3{animation-delay:.5s}
.rlp-reveal .d4{animation-delay:.68s}.rlp-reveal .d5{animation-delay:.84s}.rlp-reveal .d6{animation-delay:1s}
.rlp-reveal .d7{animation-delay:1.34s}.rlp-reveal .d8{animation-delay:1.64s}.rlp-reveal .d9{animation-delay:1.84s}
@keyframes rlp-rise{to{opacity:1;transform:none}}

@media(prefers-reduced-motion:reduce){
  .rlp-reveal .rise{opacity:1;transform:none;animation:none}
}

@media(max-width:600px){
  .rlp-reveal .body{padding:32px 22px 32px}
  .rlp-reveal .display{font-size:28px}
  .rlp-reveal .intro,.rlp-reveal .thread .quote,.rlp-reveal .hook{font-size:18px}
}
`;
