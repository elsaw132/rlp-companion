"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import FeedbackPanel from "./FeedbackPanel";

// True when the focused element is somewhere the user types — so we can pull the
// floating pill out of the way while they answer (on an iPad it otherwise sits
// over the composer / just above the keyboard). Covers text inputs, textareas,
// and rich-text fields; ignores buttons, checkboxes, and the like.
function isTextEntry(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el.getAttribute("type") ?? "text").toLowerCase();
    return !["button", "submit", "checkbox", "radio", "range", "file", "reset", "color", "image"].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

// The global feedback affordance: a fixed bottom-right pill that opens the
// shared in-app feedback panel. Testers stay inside the app — no WhatsApp, no
// mail client, no install. The panel itself (and the POST to /api/feedback)
// lives in FeedbackPanel, reused by the header's Support button too.

export default function FeedbackButton() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  // While the user is typing in a field, hide the pill so it never overlaps the
  // answer box (the collision an iPad tester reported). It comes straight back
  // on blur. Track focus at the document level so this works no matter which
  // field — the session composer, an onboarding input — has focus.
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) =>
      setTyping(isTextEntry(e.target as Element | null));
    const onFocusOut = () => setTyping(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // The public marketing home and the standalone privacy notice have no in-app
  // chrome — a logged-out visitor shouldn't see the tester feedback pill.
  // (MobileAppBar hides on these likewise.)
  if (pathname === "/" || pathname.startsWith("/privacy")) return null;

  return (
    <>
      <style>{launchCss}</style>

      {/* The floating launcher — present on every screen, but stepped out of the
          way while the user is typing so it can't overlap the answer box. */}
      {!typing && (
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
      )}

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
  .fb-launch:hover { background: var(--brand-primary); color: #fff; border-color: var(--brand-primary); }
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
