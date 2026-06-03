"use client";

import { useState } from "react";
import type {
  KeepLeaveGainInteraction,
  KeepLeaveGainResult,
} from "@/lib/modules";
import { FinishControls, type EditableProps } from "./InteractionShell";

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

// The coach-facing summary, e.g.
// "Reluctant to lose: close relationships, a sense of purpose. Glad to leave
//  behind: the commute. Want to make space for: travel, more rest."
// Empty sections are omitted.
export function keepLeaveGainSummaryText(result: KeepLeaveGainResult): string {
  return result.sections
    .filter((section) => section.picked.length > 0)
    .map(
      (section) =>
        `${section.title}: ${section.picked.map(lowerFirst).join(", ")}.`
    )
    .join(" ");
}

type KeepLeaveGainProps = {
  interaction: KeepLeaveGainInteraction;
  onFinish: (result: KeepLeaveGainResult) => void;
} & EditableProps<KeepLeaveGainResult>;

export default function KeepLeaveGain({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: KeepLeaveGainProps) {
  const { sections } = interaction;

  // Picks and custom options are keyed by section key. In edit mode, pre-fill
  // each section's picks; any pick that isn't a listed option is restored as an
  // extra in that same section so it reappears as a chip.
  const [picked, setPicked] = useState<Record<string, string[]>>(() => {
    if (!initial) return {};
    return Object.fromEntries(initial.sections.map((s) => [s.key, [...s.picked]]));
  });
  const [extras, setExtras] = useState<Record<string, string[]>>(() => {
    if (!initial) return {};
    const result: Record<string, string[]> = {};
    for (const s of initial.sections) {
      const known = new Set(
        sections.find((sec) => sec.key === s.key)?.options ?? []
      );
      const customs = s.picked.filter((o) => !known.has(o));
      if (customs.length) result[s.key] = customs;
    }
    return result;
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function toggle(key: string, option: string) {
    setPicked((prev) => {
      const current = prev[key] ?? [];
      return {
        ...prev,
        [key]: current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option],
      };
    });
  }

  function submitCustom(key: string) {
    const text = (drafts[key] ?? "").trim();
    if (!text) return;
    setExtras((prev) => {
      const current = prev[key] ?? [];
      if (current.includes(text)) return prev;
      return { ...prev, [key]: [...current, text] };
    });
    setPicked((prev) => {
      const current = prev[key] ?? [];
      return current.includes(text)
        ? prev
        : { ...prev, [key]: [...current, text] };
    });
    setDrafts((prev) => ({ ...prev, [key]: "" }));
  }

  const totalPicked = sections.reduce(
    (sum, s) => sum + (picked[s.key]?.length ?? 0),
    0
  );

  return (
    <section style={styles.wrap}>
      <style>{keepLeaveGainCss}</style>

      <div style={styles.sections}>
        {sections.map((section) => {
          const options = [...section.options, ...(extras[section.key] ?? [])];
          const chosen = picked[section.key] ?? [];
          return (
            <div key={section.key} style={styles.section}>
              <p style={styles.sectionTitle}>{section.title}</p>
              <p style={styles.sectionPrompt}>{section.prompt}</p>
              <div style={styles.chipWrap}>
                {options.map((option) => {
                  const isSelected = chosen.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className="klg-chip"
                      style={{
                        ...styles.chip,
                        ...(isSelected ? styles.chipSelected : null),
                      }}
                      aria-pressed={isSelected}
                      onClick={() => toggle(section.key, option)}
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
                  value={drafts[section.key] ?? ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [section.key]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitCustom(section.key);
                    }
                  }}
                />
                <button
                  type="button"
                  className="custom-add"
                  style={styles.customAdd}
                  onClick={() => submitCustom(section.key)}
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <FinishControls
        mode={mode}
        disabled={totalPicked === 0}
        onFinish={() =>
          onFinish({
            type: "keep-leave-gain",
            sections: sections.map((s) => ({
              key: s.key,
              title: s.title,
              picked: picked[s.key] ?? [],
            })),
          })
        }
        onCancel={onCancel}
        hint={
          totalPicked === 0
            ? "Pick at least one to carry forward."
            : "Pick as many as feel right across the three lists."
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
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionTitle: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  sectionPrompt: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: "0 0 4px",
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
    padding: "10px 14px",
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
    marginTop: "2px",
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
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation: the three sections with their picked chips. The neutral card
// wrapper is provided by the caller.
export function KeepLeaveGainSummary({
  result,
}: {
  result: KeepLeaveGainResult;
}) {
  const filled = result.sections.filter((s) => s.picked.length > 0);
  return (
    <>
      <p style={summaryStyles.heading}>
        What you&apos;d keep, leave, and make space for
      </p>
      <div style={summaryStyles.sections}>
        {filled.map((section) => (
          <div key={section.key} style={summaryStyles.section}>
            <p style={summaryStyles.sectionTitle}>{section.title}</p>
            <div style={summaryStyles.chipWrap}>
              {section.picked.map((option) => (
                <span key={option} style={summaryStyles.chip}>
                  {option}
                </span>
              ))}
            </div>
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
    margin: "0 0 16px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionTitle: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    margin: 0,
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

const keepLeaveGainCss = `
  .klg-chip:focus-visible, .custom-add:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .custom-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
`;
