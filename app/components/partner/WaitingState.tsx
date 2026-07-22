import Link from "next/link";
import type { CSSProperties } from "react";

// Shown to whoever finishes their share step first, while the other hasn't. The
// motif's own side is filled with a tick; the partner's is a dashed outline. No
// countdown, no progress, no nudge — and the copy must not imply an automatic
// alert (there's no notification in the pilot), hence "pop back any time".
export default function WaitingState({
  partnerFirstName,
}: {
  partnerFirstName: string;
}) {
  const name = partnerFirstName || "your partner";
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Plan with your partner</p>

        <svg
          style={styles.motif}
          viewBox="0 0 190 104"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* your circle: filled tint + solid stroke + tick */}
          <circle
            cx="72"
            cy="52"
            r="40"
            fill="color-mix(in srgb, var(--brand-primary) 15%, #fff)"
            stroke="var(--brand-primary)"
            strokeWidth="2.2"
          />
          {/* partner circle: pending dashed outline */}
          <circle
            cx="118"
            cy="52"
            r="40"
            fill="none"
            stroke="var(--text-faint)"
            strokeWidth="2.2"
            strokeDasharray="4 5"
          />
          <path
            d="M55 52 l10 10 l18 -20"
            fill="none"
            stroke="var(--brand-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div style={styles.labels}>
          <span style={{ ...styles.label, color: "var(--brand-primary)" }}>
            <span style={{ ...styles.labelDot, background: "var(--brand-primary)" }} />
            You
            <small style={styles.labelSmall}>done</small>
          </span>
          <span style={{ ...styles.label, color: "var(--text-muted)" }}>
            <span
              style={{
                ...styles.labelDot,
                background: "transparent",
                border: "1.5px solid var(--text-faint)",
              }}
            />
            {name}
            <small style={styles.labelSmall}>still to come</small>
          </span>
        </div>

        <h1 style={styles.h1}>You&rsquo;re all set.</h1>
        <p style={styles.body}>
          {`We'll open your shared view here as soon as ${name} has done the same — pop back any time to check.`}
        </p>
        <p style={styles.rush}>
          {`There's no rush. ${name} can do theirs whenever they're ready.`}
        </p>

        <Link href="/home" style={styles.primary}>
          Back to Home
        </Link>
        <div>
          <Link href="/partner?edit=1" style={styles.secondary}>
            Change what you&rsquo;re sharing
          </Link>
        </div>
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
    padding: "38px 34px 32px",
    textAlign: "center",
  },
  eyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 600,
    margin: "0 0 26px",
  },
  motif: { margin: "0 auto 24px", width: 190, height: 104 },
  labels: {
    display: "flex",
    justifyContent: "center",
    gap: 44,
    margin: "-6px 0 24px",
  },
  label: {
    fontSize: "var(--fs-label)",
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  labelDot: { width: 7, height: 7, borderRadius: "50%" },
  labelSmall: { fontWeight: 400, color: "var(--text-muted)", fontSize: 11 },
  h1: {
    fontFamily: "var(--font-serif)",
    fontWeight: 600,
    fontSize: "var(--fs-h2)",
    lineHeight: 1.2,
    margin: "0 0 12px",
    color: "var(--ink)",
  },
  body: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.55,
    color: "var(--text)",
    margin: "0 auto 6px",
    maxWidth: "34ch",
  },
  rush: { fontSize: "var(--fs-sm)", color: "var(--text-muted)", margin: "0 0 28px" },
  primary: {
    display: "inline-block",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontWeight: 600,
    fontSize: "var(--fs-body)",
    borderRadius: "var(--r-sm)",
    padding: "13px 30px",
    textDecoration: "none",
  },
  secondary: {
    display: "inline-block",
    marginTop: 16,
    fontSize: "var(--fs-sm)",
    color: "var(--color-vita)",
    textDecoration: "underline",
  },
};
