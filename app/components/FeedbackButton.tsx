"use client";

import { useState } from "react";
import FeedbackPanel from "./FeedbackPanel";

// The global feedback affordance: a fixed bottom-right pill that opens the
// shared in-app feedback panel. Testers stay inside the app — no WhatsApp, no
// mail client, no install. The panel itself (and the POST to /api/feedback)
// lives in FeedbackPanel, reused by the header's Support button too.

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{launchCss}</style>

      {/* The floating launcher — present on every screen. */}
      <button
        type="button"
        className="fb-launch"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={styles.launch}
      >
        <span aria-hidden="true">💬</span> Feedback
      </button>

      {/* Mounted only while open so each open starts from a clean panel. */}
      {open && <FeedbackPanel open onClose={() => setOpen(false)} />}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  launch: {
    position: "fixed",
    right: "22px",
    bottom: "22px",
    background: "var(--surface)",
    color: "var(--brand-primary)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-pill)",
    padding: "11px 18px",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    fontWeight: 600,
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
    zIndex: 60,
  },
};

const launchCss = `
  .fb-launch:hover { background: #000; }
  .fb-launch:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  /* On mobile this floating pill overlapped content and collided with the chat
     composer/keyboard, so it's hidden here — feedback is reached via the app
     bar's Menu ("Send feedback"). Desktop keeps the pill. !important overrides
     the inline display:flex on the button. */
  @media (max-width: 880px) { .fb-launch { display: none !important; } }
`;
