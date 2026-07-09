"use client";

import { useState } from "react";
import type {
  SeasonsBoardInteraction,
  SeasonsBoardResult,
} from "@/lib/modules";
import type { SeasonCard } from "@/lib/userModel";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

// One card on the board: the label, the category it was drawn from (absent for
// cards the person added), whether they added it, and the season labels it
// currently sits in (empty while unplaced).
type Item = {
  label: string;
  category?: string;
  own?: boolean;
  seasons: string[];
};

// The coach-facing summary, grouping the placed cards by season in display
// order, e.g.
// "Your seasons board. Early years: travelling, badminton. Middle years: …
//  Throughout: family, learning. (Left unplaced: gardening.)"
export function seasonsBoardSummaryText(result: SeasonsBoardResult): string {
  const label = result.summaryLabel ?? "Your seasons board";
  const lines = result.seasonOrder
    .map((season) => {
      const cards = result.placements
        .filter((p) => p.seasons.includes(season))
        .map((p) => p.label);
      return cards.length ? `${season}: ${cards.join(", ")}.` : "";
    })
    .filter(Boolean);

  const unplaced = result.placements
    .filter((p) => p.seasons.length === 0)
    .map((p) => p.label);
  const unplacedLine = unplaced.length
    ? `Left unplaced: ${unplaced.join(", ")}.`
    : "";

  return [`${label}.`, ...lines, unplacedLine].filter(Boolean).join(" ");
}

type SeasonsBoardProps = {
  interaction: SeasonsBoardInteraction;
  // Cards drawn from the person's earlier answers, assembled in SessionContainer
  // from the user model. Empty if there's nothing to seed from.
  cards: SeasonCard[];
  onFinish: (result: SeasonsBoardResult) => void;
} & EditableProps<SeasonsBoardResult>;

export default function SeasonsBoard({
  interaction,
  cards,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: SeasonsBoardProps) {
  const { boardInstruction, seasons, enduringLane, addOwnLabel, addOwnPlaceholder, summaryLabel } =
    interaction;

  const enduringLabel = enduringLane.label;
  const seasonOrder = [...seasons.map((s) => s.label), enduringLabel];

  // Restore the placed cards when editing; otherwise start from the seeded
  // cards with nothing placed yet.
  const [items, setItems] = useState<Item[]>(() => {
    if (initial) {
      return initial.placements.map((p) => ({
        label: p.label,
        category: p.category,
        own: p.own,
        seasons: [...p.seasons],
      }));
    }
    return cards.map((c) => ({
      label: c.label,
      category: c.category,
      seasons: [],
    }));
  });
  const [draft, setDraft] = useState("");

  // Toggle a season for a card. The enduring lane and the three seasons are
  // mutually exclusive: a card runs across all of them, or sits in specific
  // ones — never both.
  function toggle(index: number, season: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const has = item.seasons.includes(season);
        if (season === enduringLabel) {
          return { ...item, seasons: has ? [] : [enduringLabel] };
        }
        const without = item.seasons.filter(
          (s) => s !== season && s !== enduringLabel
        );
        return { ...item, seasons: has ? without : [...without, season] };
      })
    );
  }

  function addOwn() {
    const text = draft.trim();
    if (!text) return;
    if (
      items.some((i) => i.label.toLowerCase() === text.toLowerCase())
    ) {
      setDraft("");
      return;
    }
    setItems((prev) => [...prev, { label: text, own: true, seasons: [] }]);
    setDraft("");
  }

  function removeOwn(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const placedCount = items.filter((i) => i.seasons.length > 0).length;
  const enoughPlaced = placedCount >= 2;

  function buildResultObject(): SeasonsBoardResult {
    return {
      type: "seasons-board",
      placements: items
        .filter((i) => i.label.trim())
        .map((i) => ({
          label: i.label,
          ...(i.category ? { category: i.category } : {}),
          ...(i.own ? { own: true } : {}),
          seasons: i.seasons,
        })),
      seasonOrder,
      summaryLabel,
    };
  }

  return (
    <section style={styles.wrap}>
      <style>{seasonsCss}</style>

      <p style={styles.instruction}>{boardInstruction}</p>

      {/* The cards to place */}
      <div style={styles.helperGroup}>
        <HelperLine>
          Tap a card&apos;s seasons to place it — a card can sit in more than one.
        </HelperLine>
        <div style={styles.cardList}>
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.cardLabel}>{item.label}</span>
              {item.category && (
                <span style={styles.cardCategory}>{item.category}</span>
              )}
              {item.own && (
                <button
                  type="button"
                  className="seasons-remove"
                  style={styles.removeButton}
                  aria-label={`Remove ${item.label}`}
                  onClick={() => removeOwn(index)}
                >
                  ✕
                </button>
              )}
            </div>
            <div style={styles.seasonChips}>
              {seasons.map((season) => {
                const selected = item.seasons.includes(season.label);
                return (
                  <button
                    key={season.id}
                    type="button"
                    className="seasons-chip"
                    style={{
                      ...styles.chip,
                      ...(selected ? styles.chipSelected : null),
                    }}
                    aria-pressed={selected}
                    onClick={() => toggle(index, season.label)}
                  >
                    {season.label}
                  </button>
                );
              })}
              <span style={styles.chipDivider} aria-hidden="true" />
              <button
                type="button"
                className="seasons-chip"
                style={{
                  ...styles.chip,
                  ...styles.enduringChip,
                  ...(item.seasons.includes(enduringLabel)
                    ? styles.enduringChipSelected
                    : null),
                }}
                aria-pressed={item.seasons.includes(enduringLabel)}
                onClick={() => toggle(index, enduringLabel)}
              >
                {enduringLabel}
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Add your own */}
      <div style={styles.addRow}>
        <label style={styles.addLabel}>{addOwnLabel}</label>
        <div style={styles.addControls}>
          <input
            type="text"
            className="seasons-input"
            style={styles.addInput}
            placeholder={addOwnPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOwn();
              }
            }}
          />
          <button
            type="button"
            className="seasons-add-btn"
            style={styles.addButton}
            disabled={!draft.trim()}
            onClick={addOwn}
          >
            Add
          </button>
        </div>
      </div>

      {/* Live board preview */}
      <div style={styles.board}>
        <div className="season-columns" style={styles.seasonColumns}>
          {seasons.map((season) => {
            const placed = items.filter((i) =>
              i.seasons.includes(season.label)
            );
            return (
              <div key={season.id} style={styles.column}>
                <div style={styles.columnHead}>
                  <span style={styles.columnTitle}>{season.label}</span>
                  {season.hint && (
                    <span style={styles.columnHint}>{season.hint}</span>
                  )}
                </div>
                <div style={styles.columnBody}>
                  {placed.length ? (
                    placed.map((i) => (
                      <span key={i.label} style={styles.placedCard}>
                        {i.label}
                      </span>
                    ))
                  ) : (
                    <span style={styles.columnEmpty}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={styles.enduringLaneRow}>
          <div style={styles.columnHead}>
            <span style={styles.columnTitle}>{enduringLabel}</span>
            {enduringLane.hint && (
              <span style={styles.columnHint}>{enduringLane.hint}</span>
            )}
          </div>
          <div style={styles.enduringBody}>
            {items.filter((i) => i.seasons.includes(enduringLabel)).length ? (
              items
                .filter((i) => i.seasons.includes(enduringLabel))
                .map((i) => (
                  <span key={i.label} style={styles.placedCard}>
                    {i.label}
                  </span>
                ))
            ) : (
              <span style={styles.columnEmpty}>—</span>
            )}
          </div>
        </div>
      </div>

      <FinishControls
        mode={mode}
        disabled={!enoughPlaced}
        onFinish={() => onFinish(buildResultObject())}
        onCancel={onCancel}
        hint={
          enoughPlaced
            ? undefined
            : "Place a few cards into the seasons where they feel most alive to carry on."
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
  // Keep the helper line close above the cards (tighter than the wrap's 28px
  // gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  cardLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  cardCategory: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  removeButton: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    padding: "2px 6px",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  seasonChips: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
  chip: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 14px",
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
  chipDivider: {
    width: "1px",
    alignSelf: "stretch",
    margin: "2px 2px",
    background: "var(--border)",
  },
  enduringChip: {
    fontStyle: "italic",
  },
  enduringChipSelected: {
    background: "var(--warm-surface)",
    border: "1px solid var(--accent-strong)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  addRow: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  addLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
  },
  addControls: {
    display: "flex",
    gap: "10px",
  },
  addInput: {
    flex: 1,
    minHeight: "44px",
    padding: "10px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
  },
  addButton: {
    minHeight: "44px",
    padding: "10px 20px",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    cursor: "pointer",
  },
  board: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "20px",
    background: "var(--warm-surface)",
    borderRadius: "var(--r-md)",
  },
  seasonColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    background: "var(--bg)",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--border)",
    minHeight: "120px",
  },
  columnHead: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  columnTitle: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
  },
  columnHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  columnBody: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    alignContent: "flex-start",
  },
  enduringLaneRow: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
    background: "var(--bg)",
    borderRadius: "var(--r-sm)",
    border: "1px dashed var(--accent-strong)",
  },
  enduringBody: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  placedCard: {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--ink)",
    background: "var(--brand-primary-tint)",
    borderRadius: "var(--r-pill)",
    padding: "4px 10px",
  },
  columnEmpty: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation. The neutral card wrapper is provided by the caller.
export function SeasonsBoardSummary({
  result,
}: {
  result: SeasonsBoardResult;
}) {
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel}</p>
      <div style={summaryStyles.seasons}>
        {result.seasonOrder.map((season) => {
          const cards = result.placements
            .filter((p) => p.seasons.includes(season))
            .map((p) => p.label);
          return (
            <div key={season} style={summaryStyles.seasonRow}>
              <span style={summaryStyles.seasonName}>{season}</span>
              <span style={summaryStyles.seasonCards}>
                {cards.length ? cards.join(", ") : "—"}
              </span>
            </div>
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
    margin: "0 0 16px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  seasons: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  seasonRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  seasonName: {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--ink)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  seasonCards: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
};

const seasonsCss = `
  /* The 3-across board crushes to ~90px columns on a phone. Stack it to one
     column so each season card is readable. Desktop keeps the 3-column grid.
     !important overrides the inline grid-template-columns. */
  @media (max-width: 880px) {
    .season-columns { grid-template-columns: 1fr !important; }
  }
  .seasons-chip:focus-visible, .seasons-add-btn:focus-visible, .seasons-remove:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .seasons-chip:not([aria-pressed="true"]):hover { border-color: var(--brand-primary); }
  .seasons-input:focus-visible {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .seasons-add-btn:not(:disabled):hover { background: var(--brand-primary-hover); }
  .seasons-add-btn:disabled { background: var(--muted-surface); color: var(--text-muted); cursor: not-allowed; }
  .seasons-remove:hover { color: var(--text); }
`;
