"use client";

// The short feedback card shown at the close of every module (all 24), in place
// of the old return-date pop-up. Its job is a quick, in-the-moment read on each
// module so modules can be compared across the pilot. Fatigue is the real risk
// (it fires up to 24 times), so it's one lightweight, fully skippable screen:
// one tap per rating, the note optional, and Skip always there. Any subset — or
// nothing — lets the person move on; it never blocks the way forward.
//
// The card posts to /api/module-feedback itself (which records it and, unlike
// the support panel, sends no email). Done saves whatever was answered; Skip
// saves nothing. Both then hand control back via onDone / onSkip so the caller
// can navigate on. Saving is best-effort — a failed save never traps anyone.

import { useState } from "react";

type Rating = "very" | "somewhat" | "not_really";

const OPTIONS: { value: Rating; label: string }[] = [
  { value: "very", label: "Very" },
  { value: "somewhat", label: "Somewhat" },
  { value: "not_really", label: "Not really" },
];

export default function ModuleFeedbackCard({
  moduleId,
  onDone,
  onSkip,
}: {
  moduleId: string;
  // Called after a Done submission (the answers are already saved). The caller
  // continues to wherever they were headed.
  onDone: () => void;
  // Called on Skip — nothing is saved. The caller continues.
  onSkip: () => void;
}) {
  const [useful, setUseful] = useState<Rating | null>(null);
  const [engaging, setEngaging] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Tap to choose; tap the same option again to clear it, so a mis-tap is easy
  // to undo and nothing is ever forced.
  function pick(
    current: Rating | null,
    value: Rating,
    set: (v: Rating | null) => void
  ) {
    set(current === value ? null : value);
  }

  async function handleDone() {
    if (saving) return;
    setSaving(true);
    // Best-effort save — we never block the person's exit on it. Whatever they
    // answered (possibly nothing) is recorded; then we hand back to the caller.
    try {
      await fetch("/api/module-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          useful,
          engaging,
          comment,
        }),
      });
    } catch {
      // Swallow — a failed save must not trap them on the card.
    }
    onDone();
  }

  return (
    <section className="mfc" aria-labelledby="mfc-heading">
      <style>{css}</style>

      <p id="mfc-heading" className="heading">
        Before you go
      </p>

      <fieldset className="question">
        <legend className="q-label">How useful was this module?</legend>
        <div className="options" role="group">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="opt"
              aria-pressed={useful === o.value}
              onClick={() => pick(useful, o.value, setUseful)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="question">
        <legend className="q-label">How engaging was it?</legend>
        <div className="options" role="group">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="opt"
              aria-pressed={engaging === o.value}
              onClick={() => pick(engaging, o.value, setEngaging)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="question">
        <span className="q-label">
          Anything confusing, or that you&apos;d change?{" "}
          <span className="optional">(optional)</span>
        </span>
        <textarea
          className="note"
          rows={2}
          value={comment}
          placeholder="A word or two is plenty…"
          onChange={(e) => setComment(e.target.value)}
        />
      </label>

      <div className="actions">
        <button
          type="button"
          className="btn-navy"
          disabled={saving}
          onClick={handleDone}
        >
          {saving ? "Saving…" : "Done"}
        </button>
        <button
          type="button"
          className="btn-skip"
          disabled={saving}
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    </section>
  );
}

const css = `
.mfc{
  background:var(--warm-surface);
  border:1px solid var(--warm-line);
  border-radius:var(--r-lg);
  box-shadow:var(--shadow-sm);
  padding:26px 26px 24px;
  display:flex;flex-direction:column;gap:20px;
  width:100%;max-width:420px;margin:0 auto;
}
.mfc .heading{
  font-family:var(--font-serif);
  font-size:var(--fs-h2);
  line-height:1.35;
  color:var(--ink);
  margin:0;
}
.mfc .question{
  border:none;padding:0;margin:0;
  display:flex;flex-direction:column;gap:9px;
}
.mfc .q-label{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  font-weight:600;
  color:var(--ink);
  padding:0;
}
.mfc .optional{
  font-weight:500;
  color:var(--text-muted);
}
.mfc .options{
  display:flex;gap:8px;
}
.mfc .opt{
  flex:1;
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  font-weight:600;
  color:var(--ink);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:var(--r-sm);
  padding:11px 6px;
  min-height:46px;
  cursor:pointer;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
.mfc .opt:hover{border-color:var(--brand-primary)}
.mfc .opt[aria-pressed="true"]{
  background:var(--brand-primary);
  border-color:var(--brand-primary);
  color:var(--brand-on-primary);
}
.mfc .note{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  line-height:var(--lh-body);
  color:var(--ink);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:var(--r-sm);
  padding:12px 14px;
  min-height:64px;
  resize:vertical;
  width:100%;
  box-sizing:border-box;
}
.mfc .note::placeholder{color:var(--text-faint)}
.mfc .actions{display:flex;flex-direction:column;gap:10px;margin-top:2px}
.mfc .btn-navy{
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
.mfc .btn-navy:hover:not(:disabled){background:var(--brand-primary-hover)}
.mfc .btn-navy:disabled{opacity:.55;cursor:default}
.mfc .btn-skip{
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
.mfc .btn-skip:hover:not(:disabled){color:var(--text)}
.mfc .opt:focus-visible,
.mfc .note:focus-visible,
.mfc .btn-navy:focus-visible,
.mfc .btn-skip:focus-visible{
  outline:none;
  box-shadow:var(--focus-ring);
  border-radius:var(--r-sm);
}
.mfc .note:focus{border-color:var(--brand-primary)}
`;
