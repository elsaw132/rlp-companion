"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import VitaMark from "../VitaMark";

// A one-time confirm before the share step: we prefill the partner's first name
// from their account, but the person confirms (or corrects) it rather than us
// guessing silently. The confirmed name is then used throughout the module.
export default function ConfirmPartnerName({ guess }: { guess: string }) {
  const router = useRouter();
  const [name, setName] = useState(guess === "your partner" ? "" : guess);
  const [saving, setSaving] = useState(false);

  async function confirm() {
    const value = name.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/partner/confirm-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Plan with your partner</p>
        <div style={styles.lockup}>
          <VitaMark size={34} />
          <span style={styles.vitaName}>Vita</span>
        </div>
        <h1 style={styles.h1}>Who are you planning with?</h1>
        <p style={styles.body}>
          I&rsquo;ll use their name throughout, so let&rsquo;s get it right rather
          than me guessing.
        </p>

        <label style={styles.label} htmlFor="partner-name">
          Your partner&rsquo;s first name
        </label>
        <input
          id="partner-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
          }}
          placeholder="Their first name"
          autoComplete="off"
          style={styles.input}
        />
        <button
          type="button"
          onClick={confirm}
          disabled={saving || !name.trim()}
          style={{
            ...styles.primary,
            ...(saving || !name.trim() ? styles.primaryDisabled : null),
          }}
        >
          That&rsquo;s them
        </button>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "70vh",
    display: "grid",
    placeItems: "center",
    padding: "32px 20px",
    fontFamily: "var(--font-sans)",
    color: "var(--text)",
  },
  card: {
    maxWidth: 460,
    width: "100%",
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-lg)",
    padding: "34px 30px 30px",
  },
  eyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 700,
    margin: "0 0 18px",
  },
  lockup: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  vitaName: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    fontWeight: 600,
    color: "var(--color-vita)",
  },
  h1: {
    fontFamily: "var(--font-serif)",
    fontWeight: 600,
    fontSize: "var(--fs-h2)",
    lineHeight: 1.2,
    margin: "0 0 8px",
    color: "var(--ink)",
  },
  body: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-reading)",
    lineHeight: 1.55,
    color: "var(--ink)",
    margin: "0 0 22px",
  },
  label: {
    display: "block",
    fontSize: "var(--fs-label)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: "0 0 6px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    fontSize: "var(--fs-body)",
    fontFamily: "var(--font-sans)",
    color: "var(--text)",
    background: "#fff",
    marginBottom: 18,
  },
  primary: {
    border: "none",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontWeight: 600,
    fontSize: "var(--fs-body)",
    borderRadius: "var(--r-sm)",
    padding: "13px 26px",
    cursor: "pointer",
    minHeight: 48,
  },
  primaryDisabled: { opacity: 0.55, cursor: "default" },
};
