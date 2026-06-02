"use client";

import { useState } from "react";
import type {
  QualitiesPickerInteraction,
  QualitiesPickerResult,
} from "@/lib/modules";

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

// The coach-facing summary, e.g.
// "Qualities they want to grow into: grounded, generous, curious, present."
export function qualitiesPickerSummaryText(
  result: QualitiesPickerResult
): string {
  if (result.picked.length === 0) return "";
  return `Qualities they want to grow into: ${result.picked
    .map(lowerFirst)
    .join(", ")}.`;
}

type QualitiesPickerProps = {
  interaction: QualitiesPickerInteraction;
  onFinish: (result: QualitiesPickerResult) => void;
};

export default function QualitiesPicker({
  interaction,
  onFinish,
}: QualitiesPickerProps) {
  const { instruction, options } = interaction;

  const [picked, setPicked] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  function toggle(option: string) {
    setPicked((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option]
    );
  }

  function submitCustom() {
    const text = draft.trim();
    if (!text) return;
    setExtras((prev) => (prev.includes(text) ? prev : [...prev, text]));
    setPicked((prev) => (prev.includes(text) ? prev : [...prev, text]));
    setDraft("");
  }

  const allOptions = [...options, ...extras];

  return (
    <section style={styles.wrap}>
      <style>{qualitiesPickerCss}</style>

      <p style={styles.instruction}>{instruction}</p>

      <div style={styles.chipWrap}>
        {allOptions.map((option) => {
          const isSelected = picked.includes(option);
          return (
            <button
              key={option}
              type="button"
              className="quality-chip"
              style={{
                ...styles.chip,
                ...(isSelected ? styles.chipSelected : null),
              }}
              aria-pressed={isSelected}
              onClick={() => toggle(option)}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div style={styles.customRow}>
        <input
          type="text"
          className="custom-input"
          style={styles.customInput}
          placeholder="Add your own…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitCustom();
            }
          }}
        />
        <button
          type="button"
          className="custom-add"
          style={styles.customAdd}
          onClick={submitCustom}
        >
          Add
        </button>
      </div>

      <div style={styles.finishRow}>
        <button
          type="button"
          className="finish-btn"
          style={{
            ...styles.finishButton,
            ...(picked.length === 0 ? styles.finishButtonDisabled : null),
          }}
          disabled={picked.length === 0}
          onClick={() => onFinish({ type: "qualities-picker", picked })}
        >
          Talk it through with Vita →
        </button>
        <p style={styles.finishHint}>
          {picked.length === 0
            ? "Pick at least one to carry forward."
            : "A few that feel most like you are enough."}
        </p>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  chip: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    boxShadow: "var(--shadow-sm)",
    padding: "10px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
  },
  chipSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  customRow: {
    display: "flex",
    gap: "8px",
    alignItems: "stretch",
    maxWidth: "360px",
  },
  customInput: {
    flex: 1,
    background: "var(--bg)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    outline: "none",
  },
  customAdd: {
    background: "var(--bg)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "9px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    cursor: "pointer",
    flexShrink: 0,
  },
  finishRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    paddingTop: "8px",
  },
  finishButton: {
    width: "100%",
    maxWidth: "360px",
    minHeight: "48px",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    cursor: "pointer",
  },
  finishButtonDisabled: {
    background: "var(--muted-surface)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  },
  finishHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation: the picked qualities as inert chips. The neutral card wrapper is
// provided by the caller.
export function QualitiesPickerSummary({
  result,
}: {
  result: QualitiesPickerResult;
}) {
  return (
    <>
      <p style={summaryStyles.heading}>Who you want to become</p>
      <div style={summaryStyles.chipWrap}>
        {result.picked.map((option) => (
          <span key={option} style={summaryStyles.chip}>
            {option}
          </span>
        ))}
      </div>
    </>
  );
}

const summaryStyles: Record<string, React.CSSProperties> = {
  heading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 16px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    background: "var(--bg-alt)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "6px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
  },
};

const qualitiesPickerCss = `
  .quality-chip:focus-visible, .custom-add:focus-visible,
  .finish-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .custom-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .finish-btn:not(:disabled):hover { background: var(--brand-primary-hover); }
`;
