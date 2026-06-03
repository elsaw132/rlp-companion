"use client";

// TESTING AIDS — these reset controls wipe the signed-in user's localStorage
// data so the flow can be re-run easily during testing. Hide or remove them
// before real users see the app.

import { useUserData } from "@/lib/userData";

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
  const data = useUserData();

  async function handleRestart() {
    await data.resetModule(sessionId);
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
