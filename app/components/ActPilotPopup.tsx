"use client";

// The Act (stage 5) pilot stand-in, shown as a popup once the person is looking
// at Act while it has no sessions to open. Act's real intro can't ride a first
// session the way the other stages' intros now do (there are no sessions yet),
// so this dialog stands in — in Vita's voice — until Act's sessions ship, at
// which point the real intro takes over on Act's first session. Copy lives on
// PILOT_CALLOUT in lib/modules.ts; this only renders it.

import { useEffect } from "react";
import VitaMark from "./VitaMark";
import { PILOT_CALLOUT } from "@/lib/modules";

export default function ActPilotPopup({
  // Primary action ("Back to my plan"): records the callout as seen and leaves.
  onBackToPlan,
  // Dismiss (close button, backdrop, or Escape): records it as seen and stays on
  // the Act view.
  onClose,
}: {
  onBackToPlan: () => void;
  onClose: () => void;
}) {
  // Escape closes it, matching the other in-app dialogs.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="rlp-act-pop"
      role="dialog"
      aria-modal="true"
      aria-label={PILOT_CALLOUT.heading}
      onClick={onClose}
    >
      <style>{css}</style>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="close"
          aria-label="Close"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="vita">
          <VitaMark size={38} />
          <span className="name">Vita</span>
        </div>
        <h2 className="heading">{PILOT_CALLOUT.heading}</h2>
        {PILOT_CALLOUT.body.map((p, i) => (
          <p key={i} className="body">
            {p}
          </p>
        ))}
        <button type="button" className="btn btn-navy" onClick={onBackToPlan}>
          {PILOT_CALLOUT.buttonLabel}
        </button>
      </div>
    </div>
  );
}

// Cream card (Vita is speaking) centred over a dimmed backdrop; brand tokens
// throughout, matching StageIntro's surface and the app's other dialogs.
const css = `
.rlp-act-pop{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:24px}
.rlp-act-pop .card{position:relative;width:100%;max-width:480px;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-md);padding:30px 32px 32px}
.rlp-act-pop .close{position:absolute;top:8px;right:8px;width:44px;height:44px;background:none;border:none;color:var(--text-muted);font-size:24px;line-height:1;cursor:pointer;border-radius:var(--r-sm)}
.rlp-act-pop .close:hover{background:var(--warm-surface-2);color:var(--ink)}
.rlp-act-pop .vita{display:flex;align-items:center;gap:10px;margin-bottom:18px}
.rlp-act-pop .vita .name{font-family:var(--font-serif);font-size:var(--fs-title);font-weight:600;color:var(--color-vita)}
.rlp-act-pop .heading{font-family:var(--font-serif);font-size:var(--fs-h2);font-weight:600;color:var(--ink);line-height:1.2;margin:0 0 18px}
.rlp-act-pop .body{font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);color:var(--text);margin:0 0 18px;max-width:56ch}
.rlp-act-pop .btn{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;border-radius:var(--r-sm);padding:14px 26px;cursor:pointer;border:none;line-height:1;min-height:48px;margin-top:4px}
.rlp-act-pop .btn-navy{background:var(--brand-primary);color:var(--brand-on-primary)}
.rlp-act-pop .btn-navy:hover{background:var(--brand-primary-hover)}
.rlp-act-pop :focus-visible{outline:none;box-shadow:var(--focus-ring)}
`;
