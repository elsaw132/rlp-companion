"use client";

import { useState } from "react";
import type {
  BiggerPictureInteraction,
  BiggerPictureResult,
} from "@/lib/modules";
import type { Stage3Seed } from "@/lib/stage3Seed";
import { FinishControls, type EditableProps } from "./InteractionShell";

// 3.6 "The bigger picture" — a reflective writing surface in the spirit of the
// Stage 1 letter. Seeded threads are true starting lines drawn from the person's
// own answers; they pick any up, write freely, then mark a few lines that stand
// for them. This module carries safeguarding weight: it holds, it never grades.

export function biggerPictureSummaryText(result: BiggerPictureResult): string {
  const label = result.summaryLabel || "The bigger picture";
  if (result.body.trim()) return `${label}: "${result.body.trim()}"`;
  return `${label}: nothing written yet.`;
}

type Props = {
  interaction: BiggerPictureInteraction;
  seed: Stage3Seed | null;
  onFinish: (result: BiggerPictureResult) => void;
} & EditableProps<BiggerPictureResult>;

export default function BiggerPicture({
  interaction,
  seed,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: Props) {
  const seedData = seed && seed.type === "bigger-picture" ? seed : null;
  const threads = seedData ? seedData.threads : [];

  const [body, setBody] = useState(() => {
    if (initial) return initial.body;
    return seedData?.draft ?? "";
  });
  const [usedThreads, setUsedThreads] = useState<string[]>([]);

  function applyThread(thread: string) {
    setBody((prev) => {
      const trimmed = prev.trimEnd();
      const sep = trimmed.length ? "\n\n" : "";
      return `${trimmed}${sep}${thread} `;
    });
    setUsedThreads((prev) =>
      prev.includes(thread) ? prev : [...prev, thread]
    );
  }

  const canFinish = body.trim().length > 0;

  function finish() {
    onFinish({
      type: "bigger-picture",
      body: body.trim(),
      summaryLabel: interaction.summaryLabel,
    });
  }

  const remainingThreads = threads.filter((t) => !usedThreads.includes(t));

  return (
    <section style={styles.wrap}>
      <style>{bpCss}</style>
      <p style={styles.prompt}>{interaction.prompt}</p>

      {remainingThreads.length > 0 && (
        <div style={styles.threadBlock}>
          <p style={styles.subLabel}>{interaction.threadsLabel}</p>
          <div style={styles.threadRow}>
            {remainingThreads.map((thread) => (
              <button
                key={thread}
                type="button"
                className="bp-thread"
                style={styles.threadChip}
                onClick={() => applyThread(thread)}
              >
                {thread}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        className="bp-body"
        style={styles.body}
        rows={10}
        placeholder={interaction.placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <FinishControls
        mode={mode}
        disabled={!canFinish}
        onFinish={finish}
        onCancel={onCancel}
        hint={canFinish ? undefined : "Write a few lines to continue."}
      />
    </section>
  );
}

export function BiggerPictureSummary({
  result,
}: {
  result: BiggerPictureResult;
}) {
  return (
    <>
      <p style={summaryStyles.heading}>
        {result.summaryLabel || "The bigger picture"}
      </p>
      {result.body && <p style={summaryStyles.body}>{result.body}</p>}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  prompt: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-lead)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: 0,
  },
  threadBlock: { display: "flex", flexDirection: "column", gap: "10px" },
  subLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--text-muted)",
    margin: 0,
  },
  threadRow: { display: "flex", flexWrap: "wrap", gap: "8px" },
  threadChip: {
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
  },
  body: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.7,
    color: "var(--ink)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    resize: "vertical",
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg)",
  },
};

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
  body: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.7,
    color: "var(--ink)",
    whiteSpace: "pre-wrap",
    margin: 0,
  },
};

const bpCss = `
  .bp-thread:hover { border-color: var(--brand-primary); color: var(--ink); }
  .bp-thread:focus-visible, .bp-body:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
`;
