"use client";

// TESTING AIDS — these reset controls wipe the signed-in user's localStorage
// data so the flow can be re-run easily during testing. Hide or remove them
// before real users see the app.

import { useUser } from "@clerk/nextjs";
import { clearModuleComplete } from "@/lib/progress";
import { clearTakeaway } from "@/lib/takeaways";

const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "8px 4px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-sm)",
  fontWeight: 600,
  color: "var(--text-muted)",
  cursor: "pointer",
};

const hoverCss = `
  .reset-link:hover { color: var(--text); text-decoration: underline; }
  .reset-link:focus-visible {
    outline: none;
    border-radius: var(--r-sm);
    box-shadow: var(--focus-ring);
  }
`;

// Clears this module's saved conversation, any built interaction (e.g. the day
// builder), its takeaway, and its completion flag, then reloads so it starts
// fresh from the reading and redoing it regenerates the takeaway. Onboarding is
// left intact.
export function ResetModuleLink({ sessionId }: { sessionId: string }) {
  const { user } = useUser();

  function handleRestart() {
    if (!user) return;
    localStorage.removeItem(`rlp_session_${user.id}_${sessionId}`);
    localStorage.removeItem(`rlp_build_${user.id}_${sessionId}`);
    clearTakeaway(user.id, sessionId);
    clearModuleComplete(user.id, sessionId);
    window.location.reload();
  }

  return (
    <>
      <style>{hoverCss}</style>
      <button
        type="button"
        className="reset-link"
        style={linkStyle}
        onClick={handleRestart}
      >
        Restart this module
      </button>
    </>
  );
}
