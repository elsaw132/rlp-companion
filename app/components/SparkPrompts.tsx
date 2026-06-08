"use client";

import { useState } from "react";
import type {
  SparkPromptsInteraction,
  SparkPromptsResult,
} from "@/lib/modules";
import { FinishControls, type EditableProps } from "./InteractionShell";

// The coach-facing summary, e.g.
// "Somewhere you'd go: a month on the Amalfi coast. An everyday indulgence: fresh flowers every week."
export function sparkPromptsSummaryText(result: SparkPromptsResult): string {
  return result.entries
    .map((e) => `${e.label}: ${e.text}.`)
    .join(" ");
}

type SparkPromptsProps = {
  interaction: SparkPromptsInteraction;
  onFinish: (result: SparkPromptsResult) => void;
} & EditableProps<SparkPromptsResult>;

export default function SparkPrompts({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: SparkPromptsProps) {
  const { instruction, prompts } = interaction;

  // In edit mode, pre-fill from the earlier entries, keyed by prompt id.
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    const map: Record<string, string> = {};
    for (const entry of initial.entries) map[entry.id] = entry.text;
    return map;
  });

  function setValue(id: string, text: string) {
    setValues((prev) => ({ ...prev, [id]: text }));
  }

  const filledCount = prompts.filter((p) => (values[p.id] ?? "").trim()).length;

  function finish() {
    const entries = prompts
      .filter((p) => (values[p.id] ?? "").trim())
      .map((p) => ({ id: p.id, label: p.label, text: values[p.id].trim() }));
    onFinish({ type: "spark-prompts", entries });
  }

  return (
    <section style={styles.wrap}>
      <style>{sparkPromptsCss}</style>

      <p style={styles.instruction}>{instruction}</p>

      <div style={styles.fields}>
        {prompts.map((prompt) => (
          <div key={prompt.id} style={styles.field}>
            <label htmlFor={`spark-${prompt.id}`} style={styles.label}>
              {prompt.label}
            </label>
            <textarea
              id={`spark-${prompt.id}`}
              className="spark-input"
              style={styles.input}
              rows={2}
              placeholder={prompt.placeholder}
              value={values[prompt.id] ?? ""}
              onChange={(e) => setValue(prompt.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      <FinishControls
        mode={mode}
        disabled={filledCount === 0}
        onFinish={finish}
        onCancel={onCancel}
        hint={
          filledCount === 0
            ? "Fill in at least one to carry forward."
            : "Leave the rest blank if nothing sparks."
        }
      />
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
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
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
  },
  input: {
    width: "100%",
    background: "var(--bg)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "11px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation. Each filled want as a label + the words they wrote. The neutral
// card wrapper is provided by the caller.
export function SparkPromptsSummary({ result }: { result: SparkPromptsResult }) {
  return (
    <>
      <p style={summaryStyles.heading}>What you&rsquo;d do</p>
      <div style={summaryStyles.list}>
        {result.entries.map((entry) => (
          <div key={entry.id} style={summaryStyles.item}>
            <p style={summaryStyles.itemLabel}>{entry.label}</p>
            <p style={summaryStyles.itemText}>{entry.text}</p>
          </div>
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
    margin: "0 0 14px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  itemLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    margin: 0,
  },
  itemText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: 0,
  },
};

const sparkPromptsCss = `
  .spark-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .spark-input::placeholder { color: var(--text-faint); }
`;
