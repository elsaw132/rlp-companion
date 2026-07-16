"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";

// Self-service data deletion, with a deliberate confirmation gate. The user must
// tick the acknowledgement before the destructive button enables, so the
// deletion is never one stray tap away. On success the account is already gone
// server-side, so the "done" state signs the (now-invalid) session out and sends
// them to the public home.
type Status = "review" | "deleting" | "done" | "error";

export default function DeleteAccountView() {
  const { signOut } = useClerk();
  const [acknowledged, setAcknowledged] = useState(false);
  const [status, setStatus] = useState<Status>("review");

  async function handleDelete() {
    setStatus("deleting");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) throw new Error(`delete failed: ${res.status}`);

      // Clear residual client-side storage on this device too (the legacy rlp_*
      // keys the migration never removed, plus any sessionStorage).
      if (typeof window !== "undefined") {
        try {
          const stale: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("rlp_")) stale.push(k);
          }
          stale.forEach((k) => localStorage.removeItem(k));
          sessionStorage.clear();
        } catch {
          // Storage can throw (private mode / disabled) — best-effort only.
        }
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {status === "done" ? (
          <>
            <h1 style={styles.h1}>Your data has been deleted</h1>
            <p style={styles.lead}>
              Everything tied to your account has been permanently removed, and
              you&rsquo;ve been signed out. There&rsquo;s nothing left for us to
              recover. Thank you for spending time with Chorus Life.
            </p>
            <button
              type="button"
              style={styles.primary}
              onClick={() => void signOut({ redirectUrl: "/" })}
            >
              Return to Chorus Life
            </button>
          </>
        ) : status === "error" ? (
          <>
            <h1 style={styles.h1}>Something went wrong</h1>
            <p style={styles.lead}>
              Your data has not been deleted. Please try again — and if it keeps
              failing, email{" "}
              <a style={styles.link} href="mailto:elsa@chorus-life.com">
                elsa@chorus-life.com
              </a>{" "}
              and we&rsquo;ll remove it for you.
            </p>
            <button
              type="button"
              style={styles.primary}
              onClick={() => setStatus("review")}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <h1 style={styles.h1}>Delete all your data</h1>
            <p style={styles.lead}>
              This permanently removes everything Chorus Life holds for you.{" "}
              <strong>It cannot be undone.</strong>
            </p>
            <ul style={styles.list}>
              <li style={styles.li}>Your account and sign-in</li>
              <li style={styles.li}>Every conversation you had with Vita</li>
              <li style={styles.li}>
                Your answers, values, plan and any generated images
              </li>
              <li style={styles.li}>Any feedback you sent us</li>
            </ul>

            <label style={styles.ack}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={styles.checkbox}
                disabled={status === "deleting"}
              />
              <span>
                I understand this deletes everything permanently and signs me out,
                and that it can&rsquo;t be undone.
              </span>
            </label>

            <button
              type="button"
              style={{
                ...styles.primary,
                ...(acknowledged && status !== "deleting"
                  ? {}
                  : styles.primaryDisabled),
              }}
              disabled={!acknowledged || status === "deleting"}
              onClick={handleDelete}
            >
              {status === "deleting"
                ? "Deleting…"
                : "Permanently delete everything"}
            </button>
            <a style={styles.cancel} href="/home">
              Cancel and keep my data
            </a>
          </>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  h1: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    color: "var(--ink)",
    margin: 0,
  },
  lead: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.5,
    color: "var(--text)",
    margin: 0,
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  li: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.45,
    color: "var(--text)",
  },
  ack: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    lineHeight: 1.45,
    color: "var(--text)",
    background: "var(--bg-alt)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    cursor: "pointer",
  },
  checkbox: {
    marginTop: "2px",
    width: "18px",
    height: "18px",
    flexShrink: 0,
    cursor: "pointer",
  },
  primary: {
    appearance: "none",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    borderRadius: "var(--r-pill)",
    padding: "13px 20px",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    border: "none",
    cursor: "pointer",
    minHeight: "48px",
  },
  primaryDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  cancel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    textAlign: "center",
    textDecoration: "underline",
    padding: "8px",
  },
  link: {
    color: "var(--brand-primary)",
    textDecoration: "underline",
  },
};
