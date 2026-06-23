"use client";

import { useState } from "react";
import type {
  PriorityChoicesInteraction,
  PriorityChoicesResult,
} from "@/lib/modules";
import type { Stage3Seed } from "@/lib/stage3Seed";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

// 3.3 "What matters most" — quick-fire either/or trade-offs drawn from this
// person's own picture, then an adjustable ranking of the values those choices
// were really about. Nothing here is a test; the pairs only surface tension.

type PairState = {
  left: string;
  right: string;
  chose: string | null;
  why: string;
  showWhy: boolean;
};

export function priorityChoicesSummaryText(
  result: PriorityChoicesResult
): string {
  const label = result.summaryLabel || "What matters most";
  const parts: string[] = [];
  if (result.ranked.length) {
    parts.push(`${label}, in order: ${result.ranked.join(", ")}.`);
  }
  const leanings = result.choices
    .filter((c) => c.chose)
    .map((c) => (c.why ? `${c.chose} (${c.why})` : c.chose));
  if (leanings.length) {
    parts.push(`When pushed, they leaned toward: ${leanings.join("; ")}.`);
  }
  return parts.join(" ") || `${label}: nothing weighed yet.`;
}

type Props = {
  interaction: PriorityChoicesInteraction;
  seed: Stage3Seed | null;
  onFinish: (result: PriorityChoicesResult) => void;
} & EditableProps<PriorityChoicesResult>;

export default function PriorityChoices({
  interaction,
  seed,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: Props) {
  const seedPairs =
    seed && seed.type === "priority-choices" ? seed.pairs : [];
  const seedValues =
    seed && seed.type === "priority-choices" ? seed.values : [];

  const [pairs, setPairs] = useState<PairState[]>(() => {
    if (initial) {
      return initial.choices.map((c) => ({
        left: c.left,
        right: c.right,
        chose: c.chose || null,
        why: c.why ?? "",
        showWhy: Boolean(c.why),
      }));
    }
    return seedPairs.map((p) => ({
      left: p.left,
      right: p.right,
      chose: null,
      why: "",
      showWhy: false,
    }));
  });

  const [ranked, setRanked] = useState<string[]>(() => {
    if (initial) return [...initial.ranked];
    return [...seedValues];
  });

  function choose(index: number, side: "left" | "right") {
    setPairs((prev) =>
      prev.map((p, i) =>
        i === index
          ? { ...p, chose: side === "left" ? p.left : p.right }
          : p
      )
    );
  }

  function toggleWhy(index: number) {
    setPairs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, showWhy: !p.showWhy } : p))
    );
  }

  function setWhy(index: number, value: string) {
    setPairs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, why: value } : p))
    );
  }

  function move(index: number, dir: -1 | 1) {
    setRanked((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const anyChosen = pairs.some((p) => p.chose !== null);
  const canFinish = anyChosen || ranked.length > 0;

  function finish() {
    onFinish({
      type: "priority-choices",
      choices: pairs.map((p) => ({
        left: p.left,
        right: p.right,
        chose: p.chose ?? "",
        ...(p.why.trim() ? { why: p.why.trim() } : {}),
      })),
      ranked,
      summaryLabel: interaction.summaryLabel,
    });
  }

  return (
    <section style={styles.wrap}>
      <style>{choicesCss}</style>
      <p style={styles.instruction}>{interaction.instruction}</p>

      <div style={styles.helperGroup}>
        <HelperLine>Tap whichever pulls harder.</HelperLine>
        <div style={styles.pairList}>
        {pairs.map((pair, i) => (
          <div key={`${pair.left}-${i}`} style={styles.pair}>
            <div style={styles.optionRow}>
              <button
                type="button"
                className="pc-option"
                style={{
                  ...styles.option,
                  ...(pair.chose === pair.left ? styles.optionOn : null),
                }}
                aria-pressed={pair.chose === pair.left}
                onClick={() => choose(i, "left")}
              >
                {pair.left}
              </button>
              <span style={styles.orMark}>or</span>
              <button
                type="button"
                className="pc-option"
                style={{
                  ...styles.option,
                  ...(pair.chose === pair.right ? styles.optionOn : null),
                }}
                aria-pressed={pair.chose === pair.right}
                onClick={() => choose(i, "right")}
              >
                {pair.right}
              </button>
            </div>
            <div style={styles.whyRow}>
              {pair.showWhy ? (
                <input
                  type="text"
                  className="pc-why"
                  style={styles.whyInput}
                  placeholder="What pulled you that way?"
                  value={pair.why}
                  autoFocus
                  onChange={(e) => setWhy(i, e.target.value)}
                  onBlur={() => {
                    if (!pair.why.trim()) toggleWhy(i);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="pc-why-toggle"
                  style={styles.whyToggle}
                  onClick={() => toggleWhy(i)}
                >
                  Say why?
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>

      {ranked.length > 0 && (
        <div style={styles.rankBlock}>
          <p style={styles.subLabel}>{interaction.rankLabel}</p>
          <HelperLine>
            Tap the arrows to put them in order, most important first.
          </HelperLine>
          <ol style={styles.rankList}>
            {ranked.map((value, i) => (
              <li key={value} style={styles.rankItem}>
                <span style={styles.rankNum}>{i + 1}</span>
                <span style={styles.rankValue}>{value}</span>
                <div style={styles.rankControls}>
                  <button
                    type="button"
                    className="pc-move"
                    style={styles.moveBtn}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${value} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="pc-move"
                    style={styles.moveBtn}
                    onClick={() => move(i, 1)}
                    disabled={i === ranked.length - 1}
                    aria-label={`Move ${value} down`}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <FinishControls
        mode={mode}
        disabled={!canFinish}
        onFinish={finish}
        onCancel={onCancel}
        hint={canFinish ? undefined : "Lean into a few of these to continue."}
      />
    </section>
  );
}

export function PriorityChoicesSummary({
  result,
}: {
  result: PriorityChoicesResult;
}) {
  const leanings = result.choices.filter((c) => c.chose);
  return (
    <>
      <p style={summaryStyles.heading}>
        {result.summaryLabel || "What matters most"}
      </p>
      {result.ranked.length > 0 && (
        <ol style={summaryStyles.rankList}>
          {result.ranked.map((value, i) => (
            <li key={value} style={summaryStyles.rankItem}>
              <span style={summaryStyles.rankNum}>{i + 1}</span>
              {value}
            </li>
          ))}
        </ol>
      )}
      {leanings.length > 0 && (
        <div style={summaryStyles.leanings}>
          {leanings.map((c, i) => (
            <span key={`${c.chose}-${i}`} style={summaryStyles.chip}>
              {c.chose}
              {c.why ? ` — ${c.why}` : ""}
            </span>
          ))}
        </div>
      )}
    </>
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
  // Keep the helper line close above the first pair (tighter than the wrap's
  // 24px gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  pairList: { display: "flex", flexDirection: "column", gap: "14px" },
  pair: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    boxShadow: "var(--shadow-sm)",
  },
  optionRow: {
    display: "flex",
    alignItems: "stretch",
    gap: "10px",
  },
  option: {
    flex: 1,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "14px 16px",
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.3,
    color: "var(--ink)",
    cursor: "pointer",
    textAlign: "center",
  },
  optionOn: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    fontWeight: 600,
  },
  orMark: {
    alignSelf: "center",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
  whyRow: { display: "flex" },
  whyToggle: {
    background: "none",
    border: "none",
    padding: "2px 0",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  whyInput: {
    flex: 1,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "8px 10px",
  },
  rankBlock: { display: "flex", flexDirection: "column", gap: "10px" },
  subLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  rankList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  rankItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "12px 14px",
  },
  rankNum: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--brand-primary)",
    minWidth: "18px",
  },
  rankValue: {
    flex: 1,
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  rankControls: { display: "flex", gap: "6px" },
  moveBtn: {
    width: "34px",
    height: "34px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    cursor: "pointer",
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
  rankList: {
    listStyle: "none",
    margin: "0 0 14px",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  rankItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    color: "var(--ink)",
  },
  rankNum: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--brand-primary)",
  },
  leanings: { display: "flex", flexWrap: "wrap", gap: "8px" },
  chip: {
    background: "var(--brand-primary-tint)",
    borderRadius: "var(--r-pill)",
    padding: "6px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
};

const choicesCss = `
  .pc-option:hover { border-color: var(--brand-primary); }
  .pc-move:not(:disabled):hover { border-color: var(--brand-primary); }
  .pc-move:disabled { opacity: 0.35; cursor: not-allowed; }
  .pc-why-toggle:hover { color: var(--text); }
  .pc-option:focus-visible, .pc-move:focus-visible, .pc-why:focus-visible,
  .pc-why-toggle:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
`;
