"use client";

import { useEffect, useState } from "react";
import type { RolePickerInteraction, RolePickerResult } from "@/lib/modules";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

const MAX_STARRED = 3;

// The coach-facing summary, e.g.
// "Roles picked: Grandparent, Maker, Mentor. Starred as most alive: Grandparent, Maker."
export function rolePickerSummaryText(result: RolePickerResult): string {
  const picked = result.picked.length
    ? `Roles picked: ${result.picked.join(", ")}.`
    : "";
  const starred = result.starred.length
    ? `Starred as most alive: ${result.starred.join(", ")}.`
    : "";
  return [picked, starred].filter(Boolean).join(" ");
}

type RolePickerProps = {
  interaction: RolePickerInteraction;
  onFinish: (result: RolePickerResult) => void;
  // Embedded inside a composite step: render without the finish button and
  // report the current selection upward on every change. The composite owns
  // finishing and validity.
  embedded?: boolean;
  onChange?: (result: RolePickerResult) => void;
} & EditableProps<RolePickerResult>;

export default function RolePicker({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
  embedded = false,
  onChange,
}: RolePickerProps) {
  const { instruction, groups, selectRange, summaryLabel } = interaction;
  // Starring is on by default (Stage 1); flat Stage 2 pickers turn it off.
  const starrable = interaction.starrable ?? true;
  // The "add your own" field is on by default; fixed-choice pickers (e.g. 2.5's
  // one-pick lever chooser) turn it off.
  const allowCustom = interaction.allowCustom ?? true;
  const minPicks = selectRange?.min ?? 1;
  const maxPicks = selectRange?.max;

  // In edit mode, pre-fill the earlier picks. Custom roles (any pick that isn't
  // one of the listed options) are restored as extras under the first group so
  // they reappear as chips.
  const knownOptions = new Set(groups.flatMap((g) => g.options));
  const [selected, setSelected] = useState<string[]>(initial?.picked ?? []);
  const [starred, setStarred] = useState<string[]>(initial?.starred ?? []);
  const [extras, setExtras] = useState<Record<string, string[]>>(() => {
    if (!initial || !groups[0]) return {};
    const customs = initial.picked.filter((r) => !knownOptions.has(r));
    return customs.length ? { [groups[0].name]: customs } : {};
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Keep the parent composite in step with the live selection.
  useEffect(() => {
    if (!embedded || !onChange) return;
    onChange({ type: "role-picker", picked: selected, starred, summaryLabel });
    // onChange is a fresh closure each render; selected/starred drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, starred, embedded]);

  function toggleSelect(role: string) {
    const isSelected = selected.includes(role);
    // Respect an upper bound when one is set — ignore picks beyond it.
    if (!isSelected && maxPicks !== undefined && selected.length >= maxPicks) {
      return;
    }
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    // Deselecting a role also drops its star.
    if (isSelected) {
      setStarred((prev) => prev.filter((r) => r !== role));
    }
  }

  function toggleStar(role: string) {
    setStarred((prev) => {
      if (prev.includes(role)) return prev.filter((r) => r !== role);
      if (prev.length >= MAX_STARRED) return prev;
      return [...prev, role];
    });
  }

  function submitCustom(group: string) {
    const text = (drafts[group] ?? "").trim();
    if (!text) return;
    setExtras((prev) => {
      const current = prev[group] ?? [];
      if (current.includes(text)) return prev;
      return { ...prev, [group]: [...current, text] };
    });
    setSelected((prev) => (prev.includes(text) ? prev : [...prev, text]));
    setDrafts((prev) => ({ ...prev, [group]: "" }));
  }

  const starLimitReached = starred.length >= MAX_STARRED;
  const countOk =
    selected.length >= minPicks &&
    (maxPicks === undefined || selected.length <= maxPicks);
  const rangeHint =
    selectRange && maxPicks !== undefined
      ? minPicks === maxPicks
        ? `Pick ${minPicks === 1 ? "one" : minPicks}.`
        : `Choose ${minPicks} to ${maxPicks}.`
      : null;
  // The button hint now carries only the count gate; how to act on the chips
  // (tap, add your own, star) lives in the helper line above the element.
  const finishHint = !countOk
    ? rangeHint ?? "Pick at least one to carry forward."
    : undefined;

  // The per-exercise cue, assembled from the picker's flags so it always matches
  // what's actually on screen (count rule, the add-your-own field, starring).
  const tapClause = selectRange
    ? "Tap the ones you'd like"
    : "Tap each one you'd like — as many or few as you want";
  let helperText = allowCustom
    ? `${tapClause}, then type your own and press Add.`
    : `${tapClause}.`;
  if (starrable) helperText += " Then star up to three that feel most alive.";

  return (
    <section
      style={
        embedded
          ? { ...styles.wrap, paddingTop: 0, marginTop: 0, borderTop: "none" }
          : styles.wrap
      }
    >
      <style>{rolePickerCss}</style>

      <p style={styles.instruction}>{instruction}</p>

      <div style={styles.helperGroup}>
        <HelperLine>{helperText}</HelperLine>
        <div style={styles.groups}>
        {groups.map((group) => {
          const options = [...group.options, ...(extras[group.name] ?? [])];
          return (
            <div key={group.name} style={styles.group}>
              {group.name && <p style={styles.groupName}>{group.name}</p>}
              <div style={styles.chipWrap}>
                {options.map((role) => {
                  const isSelected = selected.includes(role);
                  const isStarred = starred.includes(role);
                  return (
                    <span
                      key={role}
                      style={{
                        ...styles.chip,
                        ...(isSelected ? styles.chipSelected : null),
                      }}
                    >
                      <button
                        type="button"
                        className="role-chip"
                        style={styles.chipLabel}
                        aria-pressed={isSelected}
                        onClick={() => toggleSelect(role)}
                      >
                        {role}
                      </button>
                      {starrable && isSelected && (
                        <button
                          type="button"
                          className="star-btn"
                          style={styles.starButton}
                          aria-pressed={isStarred}
                          aria-label={
                            isStarred
                              ? `Unstar ${role}`
                              : `Star ${role} as most alive`
                          }
                          disabled={!isStarred && starLimitReached}
                          onClick={() => toggleStar(role)}
                        >
                          {isStarred ? "★" : "☆"}
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              {allowCustom && (
                <div style={styles.customRow}>
                  <input
                    type="text"
                    className="custom-input"
                    style={styles.customInput}
                    placeholder="Add your own…"
                    value={drafts[group.name] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [group.name]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitCustom(group.name);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="custom-add"
                    style={styles.customAdd}
                    onClick={() => submitCustom(group.name)}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {!embedded && (
        <FinishControls
          mode={mode}
          disabled={!countOk}
          onFinish={() =>
            onFinish({ type: "role-picker", picked: selected, starred, summaryLabel })
          }
          onCancel={onCancel}
          hint={finishHint}
        />
      )}
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
  // Keep the helper line close above the first chips (tighter than the wrap's
  // 28px gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  groups: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  groupName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    boxShadow: "var(--shadow-sm)",
    overflow: "hidden",
  },
  chipSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
  },
  chipLabel: {
    background: "none",
    border: "none",
    padding: "10px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
  },
  starButton: {
    background: "none",
    border: "none",
    borderLeft: "1px solid var(--brand-primary)",
    padding: "10px 12px",
    fontSize: "16px",
    lineHeight: 1,
    color: "var(--accent-strong)",
    cursor: "pointer",
    alignSelf: "stretch",
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
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation. Picked roles as inert chips; starred ones marked. The neutral
// card wrapper is provided by the caller.
export function RolePickerSummary({ result }: { result: RolePickerResult }) {
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel ?? "Your roles"}</p>
      <div style={summaryStyles.chipWrap}>
        {result.picked.map((role) => {
          const isStarred = result.starred.includes(role);
          return (
            <span
              key={role}
              style={{
                ...summaryStyles.chip,
                ...(isStarred ? summaryStyles.chipStarred : null),
              }}
            >
              {isStarred && <span aria-hidden="true">★</span>}
              {role}
            </span>
          );
        })}
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
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--bg-alt)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "6px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
  },
  chipStarred: {
    background: "var(--accent-surface)",
    border: "1px solid var(--accent-line)",
    color: "var(--ink)",
    fontWeight: 600,
  },
};

const rolePickerCss = `
  .role-chip:focus-visible, .star-btn:focus-visible, .custom-add:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .custom-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .star-btn:disabled { opacity: 0.4; cursor: not-allowed; }
`;
