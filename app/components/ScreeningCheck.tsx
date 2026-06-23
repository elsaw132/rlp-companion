"use client";

import { useState } from "react";
import type {
  ScreeningCheckInteraction,
  ScreeningCheckResult,
} from "@/lib/modules";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

// The coach-facing summary, e.g.
// "When did you last have an eye test? Within the last 2 years. When did you
//  last have a hearing check? Longer ago."
export function screeningCheckSummaryText(result: ScreeningCheckResult): string {
  return result.answers
    .filter((a) => a.choice)
    .map((a) => `${a.prompt} ${a.choice}.`)
    .join(" ");
}

type ScreeningCheckProps = {
  interaction: ScreeningCheckInteraction;
  onFinish: (result: ScreeningCheckResult) => void;
} & EditableProps<ScreeningCheckResult>;

export default function ScreeningCheck({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: ScreeningCheckProps) {
  const { instruction, questions } = interaction;

  // questionId → chosen option. In edit mode, restore the earlier answers.
  const [choices, setChoices] = useState<Record<string, string>>(() => {
    if (!initial) return {};
    return Object.fromEntries(initial.answers.map((a) => [a.id, a.choice]));
  });

  function choose(id: string, option: string) {
    setChoices((prev) =>
      prev[id] === option
        ? // Tapping the chosen option again clears it.
          Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id))
        : { ...prev, [id]: option }
    );
  }

  const allAnswered = questions.every((q) => choices[q.id]);

  function buildResult(): ScreeningCheckResult {
    return {
      type: "screening-check",
      answers: questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        choice: choices[q.id] ?? "",
      })),
    };
  }

  return (
    <section style={styles.wrap}>
      <style>{screeningCss}</style>

      <p style={styles.instruction}>{instruction}</p>

      <HelperLine>Tap one answer for each question.</HelperLine>

      <div style={styles.questions}>
        {questions.map((q) => (
          <div key={q.id} style={styles.question}>
            <p style={styles.prompt}>{q.prompt}</p>
            <div style={styles.options}>
              {q.options.map((option) => {
                const isSelected = choices[q.id] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className="screening-chip"
                    style={{
                      ...styles.chip,
                      ...(isSelected ? styles.chipSelected : null),
                    }}
                    aria-pressed={isSelected}
                    onClick={() => choose(q.id, option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <FinishControls
        mode={mode}
        disabled={!allAnswered}
        onFinish={() => onFinish(buildResult())}
        onCancel={onCancel}
        hint={allAnswered ? undefined : "Tap an answer for each."}
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
  questions: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  question: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  prompt: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  options: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  chip: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    boxShadow: "var(--shadow-sm)",
    padding: "10px 18px",
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
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation. Each question shows the chosen answer as an inert chip. The
// neutral card wrapper is provided by the caller.
export function ScreeningCheckSummary({
  result,
}: {
  result: ScreeningCheckResult;
}) {
  return (
    <>
      <p style={summaryStyles.heading}>Where you are with the basics</p>
      <div style={summaryStyles.rows}>
        {result.answers.map((a) => (
          <div key={a.id} style={summaryStyles.row}>
            <span style={summaryStyles.rowPrompt}>{a.prompt}</span>
            <span style={summaryStyles.rowChoice}>{a.choice}</span>
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
  rows: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: "6px 10px",
  },
  rowPrompt: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    flex: 1,
    minWidth: "180px",
  },
  rowChoice: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
    background: "var(--bg-alt)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "4px 12px",
  },
};

const screeningCss = `
  .screening-chip:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
`;
