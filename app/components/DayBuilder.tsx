"use client";

import { useState } from "react";
import type { DayBuilderInteraction } from "@/lib/modules";

// Emoji stand-ins for activity images. Unknown activities (including the
// person's own additions) fall back to a neutral dot.
const ACTIVITY_ICONS: Record<string, string> = {
  Walk: "🚶",
  Run: "🏃",
  Gym: "🏋️",
  Swim: "🏊",
  Cycle: "🚴",
  "Yoga or stretch": "🧘",
  Golf: "⛳",
  "A class": "🤸",
  Dance: "💃",
  "Cook a proper meal": "🍳",
  Bake: "🧁",
  Gardening: "🌱",
  "DIY & repairs": "🔧",
  "A project": "🛠️",
  "Crafts or sewing": "🧵",
  Decorating: "🎨",
  "Sort & declutter": "🧹",
  "Time with your partner": "❤️",
  Family: "👨‍👩‍👧",
  Grandkids: "🧒",
  "See friends": "👋",
  "Have people over": "🏠",
  "A call with someone far away": "📞",
  "A club or group": "👥",
  "Time on your own": "🧍",
  Read: "📚",
  "A course or class": "🎓",
  "Learn a language": "🗣️",
  "Play music": "🎵",
  "Write or journal": "✍️",
  "Puzzles or games": "🧩",
  "Look into something that interests you": "🔍",
  "Coffee out": "☕",
  "The market or shops": "🛍️",
  "A walk somewhere new": "🗺️",
  "Time in nature": "🌳",
  "A museum or gallery": "🖼️",
  "A day trip": "🚗",
  "Away somewhere": "✈️",
  Volunteer: "🤝",
  "Mentor or advise": "🧑‍🏫",
  "A bit of paid work": "💼",
  "Help a cause you care about": "💚",
  "Help family practically": "🛒",
  "A lie-in": "🛌",
  "Slow breakfast": "🥐",
  "Sit with a coffee": "☕",
  "A nap": "😴",
  "TV or a film": "📺",
  "Music or radio": "📻",
  "Potter about": "🌀",
  "Time in the garden": "🌷",
  "Do nothing much": "☁️",
};

function iconFor(activity: string): string {
  return ACTIVITY_ICONS[activity] ?? "•";
}

// Turn the assembled day into the readable sentence Vita opens from. Empty
// parts are skipped, e.g. "Morning: Slow breakfast, Run. Evening: Family."
function buildSummary(parts: string[], assigned: Record<string, string[]>): string {
  return parts
    .filter((part) => (assigned[part]?.length ?? 0) > 0)
    .map((part) => `${part}: ${assigned[part].join(", ")}.`)
    .join(" ");
}

type DayBuilderProps = {
  interaction: DayBuilderInteraction;
  onFinish: (summary: string) => void;
};

export default function DayBuilder({ interaction, onFinish }: DayBuilderProps) {
  const { parts, categories } = interaction;

  const emptyDay = () =>
    Object.fromEntries(parts.map((p) => [p, [] as string[]]));

  const [assigned, setAssigned] = useState<Record<string, string[]>>(emptyDay);
  const [pending, setPending] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const total = parts.reduce((n, p) => n + (assigned[p]?.length ?? 0), 0);

  function addToPart(part: string) {
    if (!pending) return;
    setAssigned((prev) => {
      const current = prev[part] ?? [];
      if (current.includes(pending)) return prev;
      return { ...prev, [part]: [...current, pending] };
    });
    setPending(null);
  }

  function removeFrom(part: string, activity: string) {
    setAssigned((prev) => ({
      ...prev,
      [part]: (prev[part] ?? []).filter((a) => a !== activity),
    }));
  }

  function submitCustom(category: string) {
    const text = (drafts[category] ?? "").trim();
    if (!text) return;
    setPending(text);
    setDrafts((prev) => ({ ...prev, [category]: "" }));
  }

  return (
    <section style={styles.wrap}>
      <style>{builderCss}</style>

      <div style={styles.intro}>
        <p style={styles.introTitle}>Build your Tuesday</p>
        <p style={styles.introBody}>
          Tap whatever you&apos;d like in your day and choose when it happens.
          There are no right answers — pick what feels like a good, ordinary day.
        </p>
      </div>

      {/* The day as it fills */}
      <div style={styles.dayPanel}>
        {parts.map((part) => {
          const items = assigned[part] ?? [];
          return (
            <div key={part} style={styles.dayColumn}>
              <p style={styles.dayPartName}>{part}</p>
              {items.length === 0 ? (
                <p style={styles.dayEmpty}>Nothing yet</p>
              ) : (
                <div style={styles.chipWrap}>
                  {items.map((activity) => (
                    <button
                      key={activity}
                      type="button"
                      className="day-chip"
                      style={styles.dayChip}
                      onClick={() => removeFrom(part, activity)}
                      title="Remove"
                    >
                      <span aria-hidden="true">{iconFor(activity)}</span>
                      {activity}
                      <span aria-hidden="true" style={styles.chipRemove}>
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Activity palette */}
      <div style={styles.categories}>
        {categories.map((category) => (
          <div key={category.name} style={styles.category}>
            <p style={styles.categoryName}>{category.name}</p>
            <div style={styles.tileWrap}>
              {category.activities.map((activity) => (
                <button
                  key={activity}
                  type="button"
                  className="tile"
                  style={styles.tile}
                  onClick={() => setPending(activity)}
                >
                  <span style={styles.tileIcon} aria-hidden="true">
                    {iconFor(activity)}
                  </span>
                  {activity}
                </button>
              ))}
            </div>
            <div style={styles.customRow}>
              <input
                type="text"
                className="custom-input"
                style={styles.customInput}
                placeholder="Add your own…"
                value={drafts[category.name] ?? ""}
                onChange={(e) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [category.name]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitCustom(category.name);
                  }
                }}
              />
              <button
                type="button"
                className="custom-add"
                style={styles.customAdd}
                onClick={() => submitCustom(category.name)}
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.finishRow}>
        <button
          type="button"
          className="finish-btn"
          style={{
            ...styles.finishButton,
            ...(total === 0 ? styles.finishButtonDisabled : null),
          }}
          disabled={total === 0}
          onClick={() => onFinish(buildSummary(parts, assigned))}
        >
          Talk it through with Vita →
        </button>
        {total === 0 && (
          <p style={styles.finishHint}>Add at least one thing to your day.</p>
        )}
      </div>

      {/* Part picker — appears after tapping an activity */}
      {pending && (
        <div
          style={styles.overlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setPending(null)}
        >
          <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <p style={styles.dialogTitle}>
              <span aria-hidden="true">{iconFor(pending)}</span> {pending}
            </p>
            <p style={styles.dialogQuestion}>When does this happen?</p>
            <div style={styles.dialogParts}>
              {parts.map((part) => (
                <button
                  key={part}
                  type="button"
                  className="part-btn"
                  style={styles.partButton}
                  onClick={() => addToPart(part)}
                >
                  {part}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cancel-btn"
              style={styles.cancelButton}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
        </div>
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
  intro: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  introTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  introBody: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },

  // The assembled day
  dayPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-lg)",
    padding: "20px",
  },
  dayColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  dayPartName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  dayEmpty: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-faint)",
    margin: 0,
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  dayChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--bg)",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--r-pill)",
    padding: "6px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
  },
  chipRemove: {
    color: "var(--text-muted)",
    fontSize: "16px",
    lineHeight: 1,
  },

  // Palette
  categories: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  category: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  categoryName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  tileWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  tile: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "10px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
    boxShadow: "var(--shadow-sm)",
  },
  tileIcon: {
    fontSize: "18px",
    lineHeight: 1,
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

  // Part-picker dialog
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.35)",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    zIndex: 50,
  },
  dialog: {
    background: "var(--bg)",
    borderRadius: "var(--r-lg)",
    boxShadow: "var(--shadow-md)",
    padding: "28px",
    width: "100%",
    maxWidth: "380px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  dialogTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  dialogQuestion: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
  dialogParts: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  partButton: {
    width: "100%",
    minHeight: "48px",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 20px",
    cursor: "pointer",
  },
  cancelButton: {
    background: "none",
    border: "none",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "4px",
  },
};

const builderCss = `
  .tile:hover { border-color: var(--brand-primary); box-shadow: var(--shadow-md); }
  .tile:focus-visible, .day-chip:focus-visible, .custom-add:focus-visible,
  .part-btn:focus-visible, .cancel-btn:focus-visible, .finish-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .custom-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .day-chip:hover { border-color: var(--brand-primary); }
  .part-btn:hover { background: var(--brand-primary-hover); }
  .finish-btn:not(:disabled):hover { background: var(--brand-primary-hover); }
`;
