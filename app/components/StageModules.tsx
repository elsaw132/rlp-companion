"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getCompletedIds } from "@/lib/progress";

type ModuleSummary = {
  id: string;
  title: string;
  description: string;
  durationMin: number;
};

type StageModulesProps = {
  stageNumber: number;
  stageName: string;
  totalStages: number;
  modules: ModuleSummary[];
};

export default function StageModules({
  stageNumber,
  stageName,
  totalStages,
  modules,
}: StageModulesProps) {
  const { user } = useUser();
  const [completed, setCompleted] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Read the completed list once, during render rather than in an effect. The
  // first client render matches the server (empty), then this fills it in once
  // Clerk has resolved the user. localStorage is browser-only, so guard for it.
  if (user && !loaded && typeof window !== "undefined") {
    setLoaded(true);
    setCompleted(getCompletedIds(user.id));
  }

  const doneCount = modules.filter((m) => completed.includes(m.id)).length;

  return (
    <div>
      <style>{cardCss}</style>

      <p style={styles.eyebrow}>
        Stage {stageNumber} of {totalStages} · {stageName}
      </p>
      <p style={styles.count}>
        {doneCount} of {modules.length} modules complete
      </p>

      <div style={styles.cardList}>
        {modules.map((mod) => {
          const isDone = completed.includes(mod.id);
          return (
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
                {isDone ? (
                  <span style={styles.donePill}>Done ✓</span>
                ) : (
                  <span style={styles.cardArrow} aria-hidden="true">
                    →
                  </span>
                )}
              </div>
            </Link>
          );
        })}
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
    margin: "0 0 6px",
  },
  count: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
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
  donePill: {
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--success-text)",
    background: "var(--bg)",
    border: "1.5px solid var(--success-line)",
    borderRadius: "999px",
    padding: "4px 12px",
    whiteSpace: "nowrap",
  },
};

const cardCss = `
  .module-card:hover { box-shadow: var(--shadow-md); }
  .module-card:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
`;
