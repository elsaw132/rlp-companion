"use client";

// The "← Your modules" exit link in the module's top nav. Normally it's just a
// link to the hub. But once this module is finished, leaving this way is a
// module-close moment too — so it shows the same short feedback card the
// completion buttons do, once per module, in a light modal before the hub. The
// backdrop and Escape simply dismiss and stay on the module, so it never traps
// the person; it never fires mid-module (the module isn't finished yet), and it
// never fires again once the card has already been shown for this module.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserData } from "@/lib/userData";
import ModuleFeedbackCard from "./ModuleFeedbackCard";

export function ModulesBackLink({ sessionId }: { sessionId: string }) {
  const userData = useUserData();
  const router = useRouter();
  const [showFeedback, setShowFeedback] = useState(false);

  const finished = userData.getCompletedIds().includes(sessionId);
  // Only prompt for feedback the first time this finished module is left this
  // way — never again on a revisit.
  const shouldPrompt = finished && !userData.hasPromptedModuleFeedback(sessionId);

  // Escape dismisses the card and stays on the module — never a forced step.
  useEffect(() => {
    if (!showFeedback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowFeedback(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showFeedback]);

  function handleClick(e: React.MouseEvent) {
    // Mid-module, or the card has already been shown for this module: leave
    // normally, letting the link navigate home on its own.
    if (!shouldPrompt) return;
    e.preventDefault();
    void userData.markModuleFeedbackPrompted(sessionId);
    setShowFeedback(true);
  }

  function handleContinue() {
    router.push("/home");
  }

  return (
    <>
      <style>{css}</style>
      <Link
        href="/home"
        className="ghost-link"
        style={ghostLink}
        onClick={handleClick}
      >
        ← Your sessions
      </Link>

      {showFeedback && (
        <div
          className="plan-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="A quick word on this session"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFeedback(false);
          }}
        >
          <ModuleFeedbackCard
            moduleId={sessionId}
            onDone={handleContinue}
            onSkip={handleContinue}
          />
        </div>
      )}
    </>
  );
}

const ghostLink: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-sm)",
  fontWeight: 600,
  color: "var(--brand-primary)",
  textDecoration: "none",
  padding: "8px 4px",
};

const css = `
  .ghost-link:hover { text-decoration: underline; }
  .ghost-link:focus-visible {
    outline: none;
    border-radius: var(--r-sm);
    box-shadow: var(--focus-ring);
  }
  .plan-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(22, 32, 46, 0.45);
    animation: plan-overlay-in 0.18s ease-out;
  }
  @keyframes plan-overlay-in { from { opacity: 0 } to { opacity: 1 } }
  @media (prefers-reduced-motion: reduce) {
    .plan-overlay { animation: none }
  }
`;
