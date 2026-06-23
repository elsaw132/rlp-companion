"use client";

import type React from "react";

// Whether an interaction is being filled in for the first time, or re-opened to
// adjust earlier choices. Edit mode pre-fills from the stored result and swaps
// the finish row for "Save changes" + "Cancel".
export type InteractionMode = "create" | "edit";

// The extra props every interaction component accepts so editing works the same
// way everywhere: the starting value to pre-fill from, the current mode, and a
// cancel handler used only in edit mode.
export type EditableProps<R> = {
  mode?: InteractionMode;
  initial?: R;
  onCancel?: () => void;
};

// The one per-exercise instruction line, used everywhere an interaction needs a
// plain cue for how to act on it (slider, selection, drag, clickable visual).
// One short line in the UI font, muted, a notch smaller than reading text — a
// helper, not content — placed directly above the interactive element. Keep the
// wording plain, present-tense, and about the physical action the person takes.
// `align="center"` is used where the element it sits over is centred (the
// radial reveals); it defaults to left for the stacked interactions.
export function HelperLine({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return <p style={{ ...helperLineStyle, textAlign: align }}>{children}</p>;
}

const helperLineStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-sm)",
  lineHeight: 1.5,
  color: "var(--text-muted)",
  margin: 0,
};

type FinishControlsProps = {
  mode: InteractionMode;
  disabled: boolean;
  onFinish: () => void;
  onCancel?: () => void;
  hint?: React.ReactNode;
};

// The shared finish row used by every interaction. In create mode it's the
// single "Talk it through with Vita →" button; in edit mode it becomes
// "Save changes" plus a quiet Cancel that returns to the conversation unchanged.
export function FinishControls({
  mode,
  disabled,
  onFinish,
  onCancel,
  hint,
}: FinishControlsProps) {
  const isEdit = mode === "edit";
  return (
    <div style={styles.finishRow}>
      <style>{finishCss}</style>
      <button
        type="button"
        className="shell-finish-btn"
        style={{
          ...styles.finishButton,
          ...(disabled ? styles.finishButtonDisabled : null),
        }}
        disabled={disabled}
        onClick={onFinish}
      >
        {isEdit ? "Save changes" : "Talk it through with Vita →"}
      </button>
      {isEdit && onCancel && (
        <button
          type="button"
          className="shell-cancel-btn"
          style={styles.cancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
      {hint && <p style={styles.finishHint}>{hint}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  cancelButton: {
    background: "none",
    border: "none",
    padding: "4px 8px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  finishHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
};

const finishCss = `
  .shell-finish-btn:not(:disabled):hover { background: var(--brand-primary-hover); }
  .shell-finish-btn:focus-visible, .shell-cancel-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
  .shell-cancel-btn:hover { color: var(--text); }
`;
