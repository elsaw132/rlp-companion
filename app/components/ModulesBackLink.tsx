"use client";

// The "← Your modules" exit link in the module's top nav. Normally it's just a
// link to the hub. But once this module is finished, leaving this way is a
// return-home moment too — so it offers the same optional plan-capture step the
// "Back to home" button does, shown here in a light modal before the hub. The
// backdrop and Escape simply dismiss and stay on the module, so it never traps
// the person, and it never fires mid-module (asking about the next module only
// makes sense once this one is done).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUserData } from "@/lib/userData";
import { todayISODate } from "@/lib/planDate";
import PlanNextModule from "./PlanNextModule";

export function ModulesBackLink({ sessionId }: { sessionId: string }) {
  const userData = useUserData();
  const router = useRouter();
  const [showPlan, setShowPlan] = useState(false);

  const finished = userData.getCompletedIds().includes(sessionId);

  // Pre-fill a future plan that's already on file, so they confirm or change it.
  const existing = userData.getPlannedNextModule();
  const prefillDate =
    existing && existing.date >= todayISODate() ? existing.date : undefined;

  // Escape dismisses the capture and stays on the module — never a forced step.
  useEffect(() => {
    if (!showPlan) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPlan(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPlan]);

  function handleClick(e: React.MouseEvent) {
    if (!finished) return; // mid-module: leave normally, no capture
    e.preventDefault();
    setShowPlan(true);
  }

  async function handleConfirm(date: string) {
    await userData.setPlannedNextModule(date);
    router.push("/home");
  }

  function handleSkip() {
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
        ← Your modules
      </Link>

      {showPlan && (
        <div
          className="plan-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Plan your next module"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPlan(false);
          }}
        >
          <PlanNextModule
            initialDate={prefillDate}
            onConfirm={handleConfirm}
            onSkip={handleSkip}
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
