"use client";

import type { CSSProperties } from "react";

// Shown when an AI draft genuinely fails to generate. We NEVER fabricate content
// in the person's voice as a fallback (a fake "quote", a goal they didn't choose):
// that reads as the AI making things up. Instead we are honest that generation
// failed, reassure that their answers are safe, and offer a manual retry.
export function DraftFailed({
  message,
  onRetry,
  retrying = false,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div style={styles.card}>
      <p style={styles.text}>{message}</p>
      <button
        type="button"
        style={styles.button}
        onClick={onRetry}
        disabled={retrying}
      >
        {retrying ? "Trying again…" : "Try again"}
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    padding: "32px 24px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    textAlign: "center",
  },
  text: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
    maxWidth: "34ch",
  },
  button: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--brand-on-primary)",
    background: "var(--brand-primary)",
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "10px 22px",
    cursor: "pointer",
  },
};
