"use client";

import { useState } from "react";
import type {
  QualitiesPickerInteraction,
  QualitiesPickerResult,
} from "@/lib/modules";
import { FinishControls, type EditableProps } from "./InteractionShell";

const MAX_PICKS = 5;

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
} & EditableProps<QualitiesPickerResult>;

export default function QualitiesPicker({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: QualitiesPickerProps) {
  const { instruction, options } = interaction;

  // In edit mode, pre-fill the earlier picks; any pick that isn't a listed
  // option is restored as an extra so it reappears as a chip.
  const [picked, setPicked] = useState<string[]>(initial?.picked ?? []);
  const [extras, setExtras] = useState<string[]>(() =>
    initial ? initial.picked.filter((p) => !options.includes(p)) : []
  );
  const [draft, setDraft] = useState("");

  function toggle(option: string) {
    setPicked((prev) => {
      if (prev.includes(option)) return prev.filter((o) => o !== option);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, option];
    });
  }

  function submitCustom() {
    const text = draft.trim();
    if (!text) return;
    if (picked.length >= MAX_PICKS) return;
    setExtras((prev) => (prev.includes(text) ? prev : [...prev, text]));
    setPicked((prev) => (prev.includes(text) ? prev : [...prev, text]));
    setDraft("");
  }

  const allOptions = [...options, ...extras];
  const atLimit = picked.length >= MAX_PICKS;

  return (
    <section style={styles.wrap}>
      <style>{qualitiesPickerCss}</style>

      <div style={styles.instructionRow}>
        <p style={styles.instruction}>{instruction}</p>
        <span style={styles.counter}>
          {picked.length} of {MAX_PICKS} chosen
        </span>
      </div>

      <div style={styles.chipWrap}>
        {allOptions.map((option) => {
          const isSelected = picked.includes(option);
          const isDisabled = !isSelected && atLimit;
          return (
            <button
              key={option}
              type="button"
              className="quality-chip"
              style={{
                ...styles.chip,
                ...(isSelected ? styles.chipSelected : null),
                ...(isDisabled ? styles.chipDisabled : null),
              }}
              aria-pressed={isSelected}
              disabled={isDisabled}
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
          placeholder={atLimit ? "5 chosen — deselect one to add" : "Add your own…"}
          value={draft}
          disabled={atLimit}
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
          style={{
            ...styles.customAdd,
            ...(atLimit ? styles.customAddDisabled : null),
          }}
          disabled={atLimit}
          onClick={submitCustom}
        >
          Add
        </button>
      </div>

      <FinishControls
        mode={mode}
        disabled={picked.length === 0}
        onFinish={() => onFinish({ type: "qualities-picker", picked })}
        onCancel={onCancel}
        hint={
          picked.length === 0
            ? "Pick at least one to carry forward."
            : "A few that feel most like you are enough."
        }
      />
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
  instructionRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "8px",
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
    flex: 1,
    minWidth: "200px",
  },
  counter: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    flexShrink: 0,
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
  chipDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
    boxShadow: "none",
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
  customAddDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
    color: "var(--text-muted)",
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
  .quality-chip:focus-visible, .custom-add:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .custom-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
`;
