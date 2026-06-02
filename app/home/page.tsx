import Link from "next/link";
import { ResetAllDataLink } from "../components/ResetControls";
import { STAGES, TOTAL_STAGES } from "@/lib/modules";

export default function HomePage() {
  const stage = STAGES[0];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-alt)" }}>
      <style>{cardCss}</style>

      {/* Dark navy header bar */}
      <div
        style={{
          background: "var(--ink)",
          padding: "32px 48px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--fs-display)",
            color: "#fff",
            margin: 0,
            fontWeight: 400,
          }}
        >
          Good morning, Elsa
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: "var(--content-max)",
          margin: "0 auto",
          padding: "40px 24px",
        }}
      >
        <p style={styles.eyebrow}>
          Stage {stage.number} of {TOTAL_STAGES} · {stage.name}
        </p>

        <div style={styles.cardList}>
          {stage.modules.map((mod) => (
            <Link
              key={mod.id}
              href={`/session/${mod.id}`}
              className="module-card"
              style={styles.card}
            >
              <div style={styles.cardText}>
                <p style={styles.cardTitle}>{mod.title}</p>
                <p style={styles.cardDescription}>{mod.description}</p>
              </div>
              <div style={styles.cardMeta}>
                <span style={styles.durationChip}>🕐 {mod.durationMin} min</span>
                <span style={styles.cardArrow} aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "32px" }}>
          <ResetAllDataLink />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  eyebrow: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    margin: "0 0 16px",
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    padding: "20px 24px",
    background: "#fff",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
    textDecoration: "none",
  },
  cardText: {
    minWidth: 0,
  },
  cardTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: "0 0 4px",
  },
  cardDescription: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
    margin: 0,
    lineHeight: 1.4,
  },
  cardMeta: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexShrink: 0,
  },
  durationChip: {
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    color: "var(--text-muted)",
    background: "#fff",
    border: "1px solid var(--border)",
    borderRadius: "999px",
    padding: "4px 12px",
    whiteSpace: "nowrap",
  },
  cardArrow: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--brand-primary)",
  },
};

const cardCss = `
  .module-card:hover { box-shadow: var(--shadow-md); }
  .module-card:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
`;
