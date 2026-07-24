"use client";

import { useState } from "react";
import type {
  ValueDefinitionsInteraction,
  ValueDefinitionsResult,
} from "@/lib/modules";
import type { Stage3Seed } from "@/lib/stage3Seed";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

// 3.4 "Living your values" — one card per priority value. The description is
// carried over read-only from 3.2. Each card runs a single two-beat flow: a
// seeded threat (the specific thing most likely to get in the way week to week)
// shown as a finished statement the person can edit, and the protectors — simple
// things they'd commit to keeping the value alive — multi-selected from three
// seeded candidates and/or written in their own words.

type ValueState = {
  value: string;
  description: string;
  threat: string;
  // The three seeded protector candidates this person picks from. Fixed for the
  // life of the surface.
  protectorOptions: string[];
  // Which of the seeded options are ticked (any number).
  chosen: string[];
  // True once they tick "Write my own"; `ownText` then holds their free text,
  // which counts as an additional protector when non-empty.
  ownActive: boolean;
  ownText: string;
};

// The threat reads as a sentence, so show it with a leading capital even if the
// model or an edit left it lower case.
function sentence(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function valueDefinitionsSummaryText(
  result: ValueDefinitionsResult
): string {
  const label = result.summaryLabel || "Living your values";
  const lines = result.values.map((v) => {
    const bits = [v.value];
    if (v.description) bits.push(`(${v.description})`);
    if (v.threat) bits.push(`— at risk from ${sentence(v.threat)}`);
    if (v.protectors.length)
      bits.push(`— protected by ${v.protectors.join("; ")}`);
    return bits.join(" ");
  });
  return lines.length
    ? `${label}. ${lines.join(". ")}.`
    : `${label}: nothing captured yet.`;
}

type Props = {
  interaction: ValueDefinitionsInteraction;
  seed: Stage3Seed | null;
  onFinish: (result: ValueDefinitionsResult) => void;
} & EditableProps<ValueDefinitionsResult>;

export default function ValueDefinitions({
  interaction,
  seed,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: Props) {
  const seedValues =
    seed && seed.type === "value-definitions" ? seed.values : [];

  // The protector options are seeded; on a re-edit `initial` carries only the
  // chosen protectors, so look the options back up from the seed by value.
  const optionsByValue = new Map(
    seedValues.map((v) => [v.value.toLowerCase(), v.protectors ?? []])
  );

  const [values, setValues] = useState<ValueState[]>(() => {
    if (initial) {
      return initial.values.map((v) => {
        const options = optionsByValue.get(v.value.toLowerCase()) ?? [];
        const picked = v.protectors ?? [];
        const chosen = picked.filter((p) => options.includes(p));
        const own = picked.filter((p) => !options.includes(p));
        return {
          value: v.value,
          description: v.description ?? "",
          threat: v.threat ?? "",
          protectorOptions: options,
          chosen,
          ownActive: own.length > 0,
          ownText: own.join("; "),
        };
      });
    }
    return seedValues.map((v) => ({
      value: v.value,
      description: v.description ?? "",
      threat: v.threat ?? "",
      protectorOptions: v.protectors ?? [],
      chosen: [],
      ownActive: false,
      ownText: "",
    }));
  });

  const [editingThreat, setEditingThreat] = useState<Record<number, boolean>>(
    {}
  );

  function update(index: number, patch: Partial<ValueState>) {
    setValues((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...patch } : v))
    );
  }

  function toggleOption(index: number, option: string) {
    setValues((prev) =>
      prev.map((v, i) =>
        i === index
          ? {
              ...v,
              chosen: v.chosen.includes(option)
                ? v.chosen.filter((c) => c !== option)
                : [...v.chosen, option],
            }
          : v
      )
    );
  }

  function toggleOwn(index: number) {
    update(index, { ownActive: !values[index].ownActive });
  }

  // The protectors a value currently has: ticked options plus any own text.
  function protectorsOf(v: ValueState): string[] {
    const own = v.ownActive ? v.ownText.trim() : "";
    return [...v.chosen, ...(own ? [own] : [])];
  }

  const canFinish =
    values.length > 0 &&
    values.every(
      (v) => v.threat.trim().length > 0 && protectorsOf(v).length > 0
    );

  function finish() {
    onFinish({
      type: "value-definitions",
      values: values.map((v) => ({
        value: v.value,
        description: v.description,
        threat: sentence(v.threat.trim()),
        protectors: protectorsOf(v),
      })),
      summaryLabel: interaction.summaryLabel,
    });
  }

  return (
    <section style={styles.wrap}>
      <style>{defCss}</style>
      <p style={styles.instruction}>{interaction.instruction}</p>

      <div style={styles.helperGroup}>
        <HelperLine>Tap to keep each one as it is, or swap it.</HelperLine>
        <div style={styles.cardList}>
        {values.map((v, i) => {
          // A value is "captured" once it has a threat and at least one
          // protector — the same bar as finishing. Showing it per-card gives the
          // visible confirmation testers found missing ("it doesn't register the
          // choice for each value as you go down the list").
          const done =
            v.threat.trim().length > 0 && protectorsOf(v).length > 0;
          return (
          <div
            key={`${v.value}-${i}`}
            style={{ ...styles.card, ...(done ? styles.cardDone : {}) }}
          >
            <div style={styles.cardHead}>
              <p style={styles.valueName}>{v.value}</p>
              {done && <span style={styles.doneBadge}>✓ Captured</span>}
            </div>
            {v.description && (
              <p style={styles.description}>{sentence(v.description)}</p>
            )}

            <div style={styles.divider} />

            <div style={styles.field}>
              <p style={styles.fieldLabel}>{interaction.threatLabel}</p>
              {editingThreat[i] ? (
                <textarea
                  className="vd-input"
                  style={styles.textarea}
                  rows={2}
                  value={v.threat}
                  placeholder="What would quietly get in the way…"
                  autoFocus
                  onChange={(e) => update(i, { threat: e.target.value })}
                  onBlur={() =>
                    setEditingThreat((s) => ({ ...s, [i]: false }))
                  }
                />
              ) : (
                <div style={styles.statementRow}>
                  <p style={styles.statement}>{sentence(v.threat)}</p>
                  <button
                    type="button"
                    className="vd-edit"
                    style={styles.editBtn}
                    onClick={() =>
                      setEditingThreat((s) => ({ ...s, [i]: true }))
                    }
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div style={styles.field}>
              <p style={styles.fieldLabel}>{interaction.protectorLabel}</p>
              <p style={styles.fieldHint}>
                Tick anything simple enough to commit to as part of your plan —
                choose more than one if it helps, or write your own.
              </p>
              <div style={styles.optionList} role="group">
                {v.protectorOptions.map((opt) => {
                  const selected = v.chosen.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className="vd-option"
                      style={{
                        ...styles.option,
                        ...(selected ? styles.optionSelected : {}),
                      }}
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleOption(i, opt)}
                    >
                      <span
                        style={{
                          ...styles.check,
                          ...(selected ? styles.checkOn : {}),
                        }}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      <span style={styles.optionText}>{opt}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="vd-option"
                  style={{
                    ...styles.option,
                    ...(v.ownActive ? styles.optionSelected : {}),
                  }}
                  role="checkbox"
                  aria-checked={v.ownActive}
                  onClick={() => toggleOwn(i)}
                >
                  <span
                    style={{
                      ...styles.check,
                      ...(v.ownActive ? styles.checkOn : {}),
                    }}
                  >
                    {v.ownActive ? "✓" : ""}
                  </span>
                  <span style={styles.optionText}>Write my own…</span>
                </button>
              </div>
              {v.ownActive && (
                <textarea
                  className="vd-input"
                  style={styles.textarea}
                  rows={2}
                  value={v.ownText}
                  placeholder={interaction.protectorPlaceholder}
                  autoFocus
                  onChange={(e) => update(i, { ownText: e.target.value })}
                />
              )}
            </div>
          </div>
          );
        })}
        </div>
      </div>

      <FinishControls
        mode={mode}
        disabled={!canFinish}
        onFinish={finish}
        onCancel={onCancel}
        hint={
          canFinish
            ? undefined
            : "For each value, choose at least one thing you'd protect to keep it."
        }
      />
    </section>
  );
}

export function ValueDefinitionsSummary({
  result,
}: {
  result: ValueDefinitionsResult;
}) {
  return (
    <>
      <p style={summaryStyles.heading}>
        {result.summaryLabel || "Living your values"}
      </p>
      <div style={summaryStyles.list}>
        {result.values.map((v, i) => (
          <div key={`${v.value}-${i}`} style={summaryStyles.item}>
            <span style={summaryStyles.valueName}>{v.value}</span>
            {v.description && (
              <span style={summaryStyles.description}>
                {sentence(v.description)}
              </span>
            )}
            {v.threat && (
              <span style={summaryStyles.line}>
                <span style={summaryStyles.lineLabel}>Gets in the way: </span>
                {sentence(v.threat)}
              </span>
            )}
            {v.protectors.length > 0 && (
              <span style={summaryStyles.line}>
                <span style={summaryStyles.lineLabel}>Protect: </span>
                {v.protectors.join("; ")}
              </span>
            )}
          </div>
        ))}
      </div>
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
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  // Keep the helper line close above the first card (tighter than the wrap's
  // 24px gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  cardList: { display: "flex", flexDirection: "column", gap: "16px" },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "18px 20px",
    boxShadow: "var(--shadow-sm)",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  cardDone: {
    borderColor: "var(--brand-primary)",
  },
  doneBadge: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--brand-primary)",
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    borderRadius: "999px",
    padding: "2px 10px",
    whiteSpace: "nowrap",
  },
  valueName: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-lead)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  description: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    fontStyle: "italic",
    margin: 0,
  },
  divider: {
    height: "1px",
    background: "var(--border)",
    margin: "2px 0",
  },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  fieldLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--text-muted)",
    margin: 0,
  },
  fieldHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: "-2px 0 4px",
  },
  textarea: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "10px 12px",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
  },
  statementRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },
  statement: {
    flex: 1,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: 0,
  },
  editBtn: {
    flexShrink: 0,
    background: "none",
    border: "none",
    padding: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--accent-strong)",
    cursor: "pointer",
  },
  optionList: { display: "flex", flexDirection: "column", gap: "8px" },
  option: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    textAlign: "left",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  },
  optionSelected: {
    borderColor: "var(--brand-primary)",
    background: "var(--brand-primary-tint)",
  },
  check: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    marginTop: "2px",
    borderRadius: "var(--r-xs)",
    border: "2px solid var(--border)",
    background: "var(--bg)",
    boxSizing: "border-box",
    color: "var(--brand-on-primary)",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
  },
  checkOn: {
    borderColor: "var(--brand-primary)",
    background: "var(--brand-primary)",
  },
  optionText: { flex: 1 },
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
  list: { display: "flex", flexDirection: "column", gap: "14px" },
  item: { display: "flex", flexDirection: "column", gap: "4px" },
  valueName: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  description: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    lineHeight: 1.4,
  },
  line: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    lineHeight: 1.4,
  },
  lineLabel: {
    fontWeight: 700,
    color: "var(--text-muted)",
  },
};

const defCss = `
  .vd-input:focus-visible, .vd-option:focus-visible, .vd-edit:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
  .vd-option:hover { border-color: var(--brand-primary); }
  .vd-edit:hover { text-decoration: underline; }
`;
