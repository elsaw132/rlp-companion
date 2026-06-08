"use client";

// A post-conversation commitment step: after a module closes, Vita invites the
// person to set a concrete plan entry (the senses module's eye/hearing-check
// rhythm, plus an optional first action). Mirrors PlanNextModule — a Vita-voiced
// moment on a cream surface, with tappable options and a navy primary. It never
// blocks the way home: skipping stores nothing and goes straight on.

import { useState } from "react";
import VitaMark from "./VitaMark";
import type { ClosingCommitment, ScreeningCommitment } from "@/lib/modules";

export default function ScreeningCommitment({
  config,
  initial,
  onConfirm,
  onSkip,
}: {
  config: ClosingCommitment;
  // A commitment already on file, pre-filled so they can confirm or change it.
  initial?: ScreeningCommitment;
  onConfirm: (commitment: ScreeningCommitment) => void;
  onSkip: () => void;
}) {
  const [frequency, setFrequency] = useState(initial?.frequency ?? "");
  const [nextAction, setNextAction] = useState(initial?.nextAction ?? "");

  const valid = frequency !== "";

  return (
    <section className="rlp-commit" aria-labelledby="commit-prompt">
      <style>{css}</style>

      <div className="vita">
        <VitaMark size={30} />
        <span className="name">Vita</span>
      </div>

      <p id="commit-prompt" className="prompt">
        {config.prompt}
      </p>

      <div className="field">
        <span className="field-label">{config.frequencyLabel}</span>
        <div className="options">
          {config.frequencyOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`opt${frequency === option ? " opt-on" : ""}`}
              aria-pressed={frequency === option}
              onClick={() =>
                setFrequency((prev) => (prev === option ? "" : option))
              }
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field-label">{config.actionLabel}</span>
        <input
          type="text"
          className="action-input"
          placeholder={config.actionPlaceholder}
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
      </label>

      <div className="actions">
        <button
          type="button"
          className="btn-navy"
          disabled={!valid}
          onClick={() =>
            valid && onConfirm({ frequency, nextAction: nextAction.trim() })
          }
        >
          {config.confirmLabel}
        </button>
        <button type="button" className="btn-skip" onClick={onSkip}>
          {config.skipLabel}
        </button>
      </div>
    </section>
  );
}

const css = `
.rlp-commit{
  background:var(--warm-surface);
  border:1px solid var(--warm-line);
  border-radius:var(--r-lg);
  box-shadow:var(--shadow-sm);
  padding:28px 28px 26px;
  display:flex;flex-direction:column;gap:18px;
  width:100%;max-width:420px;margin:0 auto;
}
.rlp-commit .vita{display:flex;align-items:center;gap:9px}
.rlp-commit .vita .name{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--ink)}
.rlp-commit .prompt{
  font-family:var(--font-serif);
  font-size:var(--fs-h2);
  line-height:1.4;
  color:var(--ink);
  margin:0;
}
.rlp-commit .field{display:flex;flex-direction:column;gap:7px}
.rlp-commit .field-label{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  font-weight:600;
  color:var(--text-muted);
}
.rlp-commit .options{display:flex;flex-wrap:wrap;gap:10px}
.rlp-commit .opt{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  font-weight:500;
  color:var(--text);
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:var(--r-pill);
  box-shadow:var(--shadow-sm);
  padding:10px 18px;
  min-height:44px;
  cursor:pointer;
}
.rlp-commit .opt-on{
  background:var(--brand-primary-tint);
  border:1px solid var(--brand-primary);
  color:var(--ink);
  font-weight:600;
}
.rlp-commit .action-input{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  color:var(--text);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:var(--r-sm);
  padding:12px 14px;
  min-height:48px;
  width:100%;
  box-sizing:border-box;
}
.rlp-commit .action-input:focus-visible{
  outline:none;
  border-color:var(--brand-primary);
  box-shadow:var(--focus-ring);
}
.rlp-commit .actions{display:flex;flex-direction:column;gap:10px;margin-top:2px}
.rlp-commit .btn-navy{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  font-weight:600;
  color:var(--brand-on-primary);
  background:var(--brand-primary);
  border:none;
  border-radius:var(--r-sm);
  padding:13px 24px;
  min-height:48px;
  cursor:pointer;
}
.rlp-commit .btn-navy:hover:not(:disabled){background:var(--brand-primary-hover)}
.rlp-commit .btn-navy:disabled{opacity:.45;cursor:not-allowed}
.rlp-commit .btn-skip{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  color:var(--text-muted);
  background:none;
  border:none;
  padding:6px 8px;
  cursor:pointer;
  text-decoration:underline;
  text-underline-offset:3px;
}
.rlp-commit .btn-skip:hover{color:var(--text)}
.rlp-commit .opt:focus-visible,.rlp-commit .btn-navy:focus-visible,.rlp-commit .btn-skip:focus-visible{
  outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)
}
`;
