"use client";

// Part A of the commitment loop: a light, optional capture step shown only on
// the return-home path after a module finishes. Vita asks, in her own voice,
// when the person plans to do their next module, and offers a single calendar
// date picker (future dates only) plus an easy out. It never blocks the way
// home — skipping stores nothing and goes straight to the hub.
//
// A Vita-present moment, so it sits on a cream surface (--warm-surface) with her
// serif voice; the picker and buttons use Inter and the navy primary. No
// reminders, no notifications — capture only.

import { useState } from "react";
import VitaMark from "./VitaMark";
import { todayISODate } from "@/lib/planDate";

export default function PlanNextModule({
  initialDate,
  onConfirm,
  onSkip,
}: {
  // A future plan already on file, pre-filled so they can confirm or change it.
  initialDate?: string;
  onConfirm: (date: string) => void;
  onSkip: () => void;
}) {
  const today = todayISODate();
  const [date, setDate] = useState(initialDate ?? "");

  // Future dates only — today onward. Guards against a stale pre-fill that has
  // since passed, and against any typed-in past date.
  const valid = date !== "" && date >= today;

  return (
    <section className="rlp-plan" aria-labelledby="plan-prompt">
      <style>{css}</style>

      <div className="vita">
        <VitaMark size={30} />
        <span className="name">Vita</span>
      </div>

      <p id="plan-prompt" className="prompt">
        Before you go — when do you plan to do your next module?
      </p>

      <label className="field">
        <span className="field-label">Pick a day</span>
        <input
          type="date"
          className="date-input"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      <div className="actions">
        <button
          type="button"
          className="btn-navy"
          disabled={!valid}
          onClick={() => valid && onConfirm(date)}
        >
          Set this day
        </button>
        <button type="button" className="btn-skip" onClick={onSkip}>
          I&apos;m not sure yet
        </button>
      </div>
    </section>
  );
}

const css = `
.rlp-plan{
  background:var(--warm-surface);
  border:1px solid var(--warm-line);
  border-radius:var(--r-lg);
  box-shadow:var(--shadow-sm);
  padding:28px 28px 26px;
  display:flex;flex-direction:column;gap:18px;
  width:100%;max-width:420px;margin:0 auto;
}
.rlp-plan .vita{display:flex;align-items:center;gap:9px}
.rlp-plan .vita .name{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--ink)}
.rlp-plan .prompt{
  font-family:var(--font-serif);
  font-size:var(--fs-h2);
  line-height:1.4;
  color:var(--ink);
  margin:0;
}
.rlp-plan .field{display:flex;flex-direction:column;gap:7px}
.rlp-plan .field-label{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  font-weight:600;
  color:var(--text-muted);
}
.rlp-plan .date-input{
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
.rlp-plan .date-input:focus-visible{
  outline:none;
  border-color:var(--brand-primary);
  box-shadow:var(--focus-ring);
}
.rlp-plan .actions{display:flex;flex-direction:column;gap:10px;margin-top:2px}
.rlp-plan .btn-navy{
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
.rlp-plan .btn-navy:hover:not(:disabled){background:var(--brand-primary-hover)}
.rlp-plan .btn-navy:disabled{opacity:.45;cursor:not-allowed}
.rlp-plan .btn-skip{
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
.rlp-plan .btn-skip:hover{color:var(--text)}
.rlp-plan :focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
`;
