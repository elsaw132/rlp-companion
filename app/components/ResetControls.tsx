"use client";

// TESTING AIDS — these reset controls wipe the signed-in user's localStorage
// data so the flow can be re-run easily during testing. Hide or remove them
// before real users see the app.

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

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

// Clears this module's saved conversation and any built interaction (e.g. the
// day builder), then reloads so it starts fresh from the reading. Onboarding is
// left intact.
export function ResetModuleLink({ sessionId }: { sessionId: string }) {
  const { user } = useUser();

  function handleRestart() {
    if (!user) return;
    localStorage.removeItem(`rlp_session_${user.id}_${sessionId}`);
    localStorage.removeItem(`rlp_build_${user.id}_${sessionId}`);
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

// Clears every rlp_ key belonging to this user (onboarding + all conversations),
// then sends them to onboarding to start over. Confirms first since it wipes
// onboarding too.
export function ResetAllDataLink() {
  const { user } = useUser();
  const router = useRouter();

  function handleResetAll() {
    if (!user) return;
    const confirmed = window.confirm(
      "This clears all your answers and conversations. Start over?"
    );
    if (!confirmed) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("rlp_") && key.includes(user.id)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    router.push("/onboarding");
  }

  return (
    <>
      <style>{hoverCss}</style>
      <button
        type="button"
        className="reset-link"
        style={linkStyle}
        onClick={handleResetAll}
      >
        Reset all my data
      </button>
    </>
  );
}
