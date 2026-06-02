"use client";

import { useState } from "react";
import type { RolePickerInteraction, RolePickerResult } from "@/lib/modules";

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
};

export default function RolePicker({ interaction, onFinish }: RolePickerProps) {
  const { instruction, groups } = interaction;

  const [selected, setSelected] = useState<string[]>([]);
  const [starred, setStarred] = useState<string[]>([]);
  const [extras, setExtras] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function toggleSelect(role: string) {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
    // Deselecting a role also drops its star.
    setStarred((prev) => prev.filter((r) => r !== role || !selected.includes(role)));
    if (selected.includes(role)) {
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

  return (
    <section style={styles.wrap}>
      <style>{rolePickerCss}</style>

      <p style={styles.instruction}>{instruction}</p>

      <div style={styles.groups}>
        {groups.map((group) => {
          const options = [...group.options, ...(extras[group.name] ?? [])];
          return (
            <div key={group.name} style={styles.group}>
              <p style={styles.groupName}>{group.name}</p>
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
                      {isSelected && (
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
            </div>
          );
        })}
      </div>

      <div style={styles.finishRow}>
        <button
          type="button"
          className="finish-btn"
          style={{
            ...styles.finishButton,
            ...(selected.length === 0 ? styles.finishButtonDisabled : null),
          }}
          disabled={selected.length === 0}
          onClick={() =>
            onFinish({ type: "role-picker", picked: selected, starred })
          }
        >
          Talk it through with Vita →
        </button>
        <p style={styles.finishHint}>
          {selected.length === 0
            ? "Pick at least one role to carry forward."
            : "Star up to three that feel most alive."}
        </p>
      </div>
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
// conversation. Picked roles as inert chips; starred ones marked. The neutral
// card wrapper is provided by the caller.
export function RolePickerSummary({ result }: { result: RolePickerResult }) {
  return (
    <>
      <p style={summaryStyles.heading}>Your roles</p>
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
  .role-chip:focus-visible, .star-btn:focus-visible, .custom-add:focus-visible,
  .finish-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .custom-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .star-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .finish-btn:not(:disabled):hover { background: var(--brand-primary-hover); }
`;
