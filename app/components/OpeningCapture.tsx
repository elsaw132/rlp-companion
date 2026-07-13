"use client";

// The Stage 1 opening capture — "Where you're starting from". A stage-opening
// step shown once, after the Imagine intro and before module 1.1. It is NOT a
// module: it has no completion state and never affects the module count or
// progress. A single open, skippable text field where the person jots down what
// they already think about retirement, before any module frames it for them. On
// save, Vita gives one brief, warm acknowledgement, then they continue back to
// the dashboard with module 1.1 queued as their next step.
//
// The prompt is deliberately generative — hopes, ideas, things they've always
// said they'd do — never worries or feelings. A calm full-width cream surface
// (Vita is speaking): her lockup, a serif prompt, low-friction controls.

import { useState } from "react";
import VitaMark from "./VitaMark";
import { useUserData } from "@/lib/userData";
import { RETIREMENT_PATHS } from "@/lib/flags";
import { isRetired } from "@/lib/modules";

// Placeholder copy — pending sign-off. The retired cohorts are taking stock of a
// retirement they're already living, so their prompt reflects rather than imagines
// (Stage 1 is "Review" for them, not "Imagine").
const PROMPT =
  "Before we start imagining in detail — what's already on your mind about retirement? Rough thoughts are fine: things you're looking forward to, ideas you've had, anything you've always said you'd do. Or skip ahead if nothing's come to you yet.";

const PROMPT_RETIRED =
  "Before we look at your retirement in detail — what's already on your mind about how it's going? Rough thoughts are fine: what's working, what you'd change, anything you keep meaning to get to. Or skip ahead if nothing's come to you yet.";

const ACK = "Lovely — let's start building on that.";

export default function OpeningCapture({
  onComplete,
}: {
  // Called when the step is done. The text is what they wrote, or null if they
  // skipped (or left it blank). The parent persists it and dismisses the step.
  onComplete: (text: string | null) => void;
}) {
  const userData = useUserData();
  // Retired cohorts see "Review" framing here, not "Imagine" (Phase 6). null /
  // flag-off keeps the original Imagine copy.
  const retired = RETIREMENT_PATHS && isRetired(userData.getRetirementStage());
  const prompt = retired ? PROMPT_RETIRED : PROMPT;
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  const trimmed = text.trim();

  // The acknowledgement moment after saving — one warm line, then continue.
  if (saved) {
    return (
      <main className="rlp-opening">
        <style>{css}</style>
        <div className="wrap">
          <div className="vita">
            <VitaMark size={40} />
            <span className="name">Vita</span>
          </div>
          <p className="ack">{ACK}</p>
          <button
            type="button"
            className="btn btn-navy"
            onClick={() => onComplete(trimmed)}
          >
            Let&rsquo;s begin
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="rlp-opening">
      <style>{css}</style>
      <div className="wrap">
        <div className="vita">
          <VitaMark size={40} />
          <span className="name">Vita</span>
        </div>
        <div className="eyebrow">Stage 1 · {retired ? "Review" : "Imagine"}</div>
        <h1 className="heading">Where you&rsquo;re starting from</h1>
        <p className="prompt">{prompt}</p>

        <textarea
          className="field"
          rows={6}
          placeholder="Whatever comes to mind…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="What's already on your mind about retirement"
        />

        <div className="actions">
          <button
            type="button"
            className="btn btn-navy"
            disabled={!trimmed}
            onClick={() => setSaved(true)}
          >
            Save and continue
          </button>
          <button
            type="button"
            className="skip"
            onClick={() => onComplete(null)}
          >
            Skip for now →
          </button>
        </div>
      </div>
    </main>
  );
}

const css = `
.rlp-opening{min-height:calc(100dvh - var(--header-h));background:var(--warm-surface);display:flex;align-items:center;justify-content:center;padding:64px 24px}
.rlp-opening .wrap{max-width:600px;width:100%}
.rlp-opening .vita{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.rlp-opening .vita .name{font-family:var(--font-serif);font-size:22px;font-weight:600;color:var(--color-vita)}
.rlp-opening .eyebrow{font-family:var(--font-sans);font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--text-muted);margin-bottom:14px}
.rlp-opening .heading{font-family:var(--font-serif);font-size:32px;font-weight:600;color:var(--ink);line-height:1.18;margin:0 0 18px}
.rlp-opening .prompt{font-family:var(--font-serif);font-size:19px;line-height:1.6;color:var(--text);margin:0 0 24px;max-width:56ch}
.rlp-opening .ack{font-family:var(--font-serif);font-size:24px;font-weight:600;color:var(--ink);line-height:1.4;margin:0 0 26px;max-width:48ch}
.rlp-opening .field{width:100%;box-sizing:border-box;background:var(--bg);border:1.5px solid var(--warm-line);border-radius:var(--r-sm);padding:14px 16px;font-family:var(--font-sans);font-size:17px;line-height:1.6;color:var(--text);outline:none;resize:vertical}
.rlp-opening .field::placeholder{color:var(--text-faint)}
.rlp-opening .field:focus-visible{border-color:var(--brand-primary);box-shadow:var(--focus-ring)}
.rlp-opening .actions{display:flex;align-items:center;gap:18px;margin-top:22px;flex-wrap:wrap}
.rlp-opening .btn{font-family:var(--font-sans);font-size:15px;font-weight:600;border-radius:var(--r-sm);padding:14px 26px;cursor:pointer;border:none;line-height:1;min-height:48px}
.rlp-opening .btn-navy{background:var(--brand-primary);color:var(--brand-on-primary)}
.rlp-opening .btn-navy:hover{background:var(--brand-primary-hover)}
.rlp-opening .btn:disabled{opacity:.45;cursor:default}
.rlp-opening .btn:disabled:hover{background:var(--brand-primary)}
.rlp-opening .skip{background:none;border:none;cursor:pointer;font-family:var(--font-sans);font-size:15px;font-weight:600;color:var(--brand-primary);padding:8px 4px;min-height:44px}
.rlp-opening .skip:hover{text-decoration:underline}
.rlp-opening :focus-visible{outline:none}
.rlp-opening .btn:focus-visible,.rlp-opening .skip:focus-visible{box-shadow:var(--focus-ring)}
@media (max-width:560px){
  .rlp-opening{padding:40px 18px}
  .rlp-opening .heading{font-size:26px}
  .rlp-opening .prompt{font-size:17px}
}
`;
