"use client";

import { useState } from "react";
import type { MirrorCardsInteraction, MirrorCardsResult } from "@/lib/modules";
import { VIA_CLUSTERS, type Stage3Seed } from "@/lib/stage3Seed";
import { FinishControls, type EditableProps } from "./InteractionShell";

// 3.1 "Your strengths" — a mirror surface built on the fixed VIA character
// strengths, so the whole module is recognition against a known list. Three
// movements on one surface:
//   1. The ones that fit. Seeded candidate strengths start undecided; each must
//      be explicitly Kept or Set aside (the labels are fixed VIA strengths, so
//      there's nothing to reword).
//   2. The rest of the list. The remaining VIA strengths shown as a compact
//      tappable set; tapping adds one as a card the person can note a line on.
//   3. Narrow. Star a signature few (up to five) — the last action on the
//      surface. Where each strength shows up in retirement is drawn out
//      afterwards, in Vita's conversation.
// Vita reflects, never grades: she holds, offers, and reads the few back warmly.

// Each strength is a fixed VIA label, so there's no rewording — the only call
// is whether it stays. Seeded cards start undecided and must be explicitly Kept
// or Set aside before the conversation; cards added from the rest of the list
// arrive already Kept.
type Decision = "undecided" | "keep" | "aside";

type CardState = {
  label: string;
  // The seed's grounding line (seeded cards only).
  evidence: string;
  // The person's own one-liner on where it shows up (cards they added only).
  note: string;
  decision: Decision;
  // True when the person added it from the rest of the list (vs. seeded).
  added: boolean;
};

export function mirrorCardsSummaryText(result: MirrorCardsResult): string {
  const kept = result.kept.map((c) => c.label);
  const label = result.summaryLabel || "Strengths";
  if (kept.length === 0) return `${label}: none kept yet.`;
  const parts = [`${label}: ${kept.join(", ")}.`];
  if (result.starred.length) {
    parts.push(`The ones that feel most like them: ${result.starred.join(", ")}.`);
  }
  if (result.rejected.length) {
    parts.push(`Set aside: ${result.rejected.join(", ")}.`);
  }
  return parts.join(" ");
}

type Props = {
  interaction: MirrorCardsInteraction;
  seed: Stage3Seed | null;
  onFinish: (result: MirrorCardsResult) => void;
} & EditableProps<MirrorCardsResult>;

export default function MirrorCards({
  interaction,
  seed,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: Props) {
  const seedCards = seed && seed.type === "mirror-cards" ? seed.cards : [];

  // In edit mode, rebuild from the stored result; otherwise from the seed.
  const [cards, setCards] = useState<CardState[]>(() => {
    if (initial) {
      const kept = initial.kept.map((c) => ({
        label: c.label,
        evidence: c.evidence ?? "",
        note: c.note ?? "",
        decision: "keep" as Decision,
        added: !c.evidence,
      }));
      const rejected = initial.rejected.map((label) => ({
        label,
        evidence: "",
        note: "",
        decision: "aside" as Decision,
        added: true,
      }));
      return [...kept, ...rejected];
    }
    // Seeded candidates start undecided — the person makes the call on each.
    return seedCards.map((c) => ({
      label: c.label,
      evidence: c.evidence,
      note: "",
      decision: "undecided" as Decision,
      added: false,
    }));
  });
  const [starred, setStarred] = useState<string[]>(initial?.starred ?? []);

  const keptCards = cards.filter((c) => c.decision === "keep");
  const undecidedCount = cards.filter((c) => c.decision === "undecided").length;

  function hasCard(label: string): boolean {
    return cards.some((c) => c.label.toLowerCase() === label.toLowerCase());
  }

  function addStrength(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (hasCard(trimmed)) {
      // Already present — make sure it's kept.
      setCards((prev) =>
        prev.map((c) =>
          c.label.toLowerCase() === trimmed.toLowerCase()
            ? { ...c, decision: "keep" }
            : c
        )
      );
      return;
    }
    setCards((prev) => [
      ...prev,
      { label: trimmed, evidence: "", note: "", decision: "keep", added: true },
    ]);
  }

  function setDecision(index: number, decision: Decision) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, decision } : c))
    );
    // Setting aside drops it from the signature few.
    if (decision !== "keep") {
      const label = cards[index]?.label;
      if (label) setStarred((s) => s.filter((l) => l !== label));
    }
  }

  function setNote(index: number, value: string) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, note: value } : c))
    );
  }

  function toggleStar(label: string) {
    setStarred((prev) => {
      if (prev.includes(label)) return prev.filter((l) => l !== label);
      if (prev.length >= interaction.starMax) return prev;
      return [...prev, label];
    });
  }

  function finish() {
    const result: MirrorCardsResult = {
      type: "mirror-cards",
      kept: cards
        .filter((c) => c.decision === "keep")
        .map((c) => ({
          label: c.label,
          ...(c.evidence ? { evidence: c.evidence } : {}),
          ...(c.note.trim() ? { note: c.note.trim() } : {}),
        })),
      rejected: cards.filter((c) => c.decision === "aside").map((c) => c.label),
      starred,
      summaryLabel: interaction.summaryLabel,
    };
    onFinish(result);
  }

  return (
    <section style={styles.wrap}>
      <style>{cardsCss}</style>
      <p style={styles.instruction}>{interaction.instruction}</p>

      {/* Movement 1 — the ones that fit */}
      <div style={styles.cardList}>
        {cards.map((card, i) => (
          <div
            key={`${card.label}-${i}`}
            style={{
              ...styles.card,
              ...(card.decision === "aside" ? styles.cardRejected : null),
            }}
          >
            <div style={styles.cardMain}>
              <span style={styles.cardLabel}>{card.label}</span>
              {card.evidence ? (
                <span style={styles.evidence}>{card.evidence}</span>
              ) : card.added && card.decision === "keep" ? (
                <input
                  type="text"
                  className="mc-note"
                  style={styles.noteInput}
                  placeholder={interaction.notePlaceholder}
                  value={card.note}
                  onChange={(e) => setNote(i, e.target.value)}
                />
              ) : null}
            </div>
            <div style={styles.cardActions}>
              <button
                type="button"
                className="mc-choice"
                style={{
                  ...styles.choiceBtn,
                  ...(card.decision === "keep" ? styles.choiceBtnKeep : null),
                }}
                aria-pressed={card.decision === "keep"}
                onClick={() => setDecision(i, "keep")}
              >
                Keep
              </button>
              <button
                type="button"
                className="mc-choice"
                style={{
                  ...styles.choiceBtn,
                  ...(card.decision === "aside" ? styles.choiceBtnAside : null),
                }}
                aria-pressed={card.decision === "aside"}
                onClick={() => setDecision(i, "aside")}
              >
                Set aside
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Movement 2 — the rest of the list */}
      <div style={styles.addBlock}>
        <p style={styles.subLabel}>{interaction.restLabel}</p>
        <p style={styles.addIntro}>{interaction.restIntro}</p>
        {VIA_CLUSTERS.map((cluster) => {
          const remaining = cluster.strengths.filter((s) => !hasCard(s));
          if (remaining.length === 0) return null;
          return (
            <div key={cluster.name} style={styles.clusterBlock}>
              <p style={styles.clusterName}>{cluster.name}</p>
              <div style={styles.chipRow}>
                {remaining.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="mc-palette"
                    style={styles.paletteChip}
                    onClick={() => addStrength(s)}
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Movement 3 — narrow and express */}
      {keptCards.length > 0 && (
        <div style={styles.starBlock}>
          <p style={styles.subLabel}>{interaction.starLabel}</p>
          <div style={styles.starRow}>
            {keptCards.map((card) => {
              const on = starred.includes(card.label);
              const full = !on && starred.length >= interaction.starMax;
              return (
                <button
                  key={card.label}
                  type="button"
                  className="mc-star"
                  style={{
                    ...styles.starChip,
                    ...(on ? styles.starChipOn : null),
                    ...(full ? styles.starChipDisabled : null),
                  }}
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggleStar(card.label)}
                >
                  <span aria-hidden="true">{on ? "★" : "☆"}</span> {card.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <FinishControls
        mode={mode}
        disabled={undecidedCount > 0 || keptCards.length === 0}
        onFinish={finish}
        onCancel={onCancel}
        hint={
          undecidedCount > 0
            ? `Choose Keep or Set aside for each strength before carrying on (${undecidedCount} to go).`
            : keptCards.length === 0
            ? "Keep at least one to carry forward."
            : undefined
        }
      />
    </section>
  );
}

// Read-only recap shown above Vita's first message.
export function MirrorCardsSummary({ result }: { result: MirrorCardsResult }) {
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel || "Your strengths"}</p>
      <div style={summaryStyles.list}>
        {result.kept.map((c) => (
          <span key={c.label} style={summaryStyles.chip}>
            {result.starred.includes(c.label) && (
              <span aria-hidden="true" style={summaryStyles.star}>
                ★
              </span>
            )}
            {c.label}
          </span>
        ))}
      </div>
      {result.rejected.length > 0 && (
        <p style={summaryStyles.aside}>Set aside: {result.rejected.join(", ")}</p>
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
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  card: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    boxShadow: "var(--shadow-sm)",
  },
  cardRejected: {
    opacity: 0.5,
    background: "var(--muted-surface)",
  },
  cardMain: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: 1,
    minWidth: 0,
  },
  cardLabel: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  evidence: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  noteInput: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "6px 10px",
    marginTop: "2px",
    width: "100%",
    maxWidth: "320px",
    boxSizing: "border-box",
    background: "var(--bg)",
  },
  cardActions: {
    display: "flex",
    gap: "8px",
    flexShrink: 0,
  },
  choiceBtn: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: "6px 14px",
    whiteSpace: "nowrap",
  },
  choiceBtnKeep: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
  },
  choiceBtnAside: {
    background: "var(--muted-surface)",
    border: "1px solid var(--text-muted)",
    color: "var(--ink)",
  },
  addBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    background: "var(--muted-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "20px 22px",
  },
  addIntro: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: "0 0 2px",
  },
  subLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  clusterBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  clusterName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    margin: 0,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  paletteChip: {
    background: "var(--bg)",
    border: "1px dashed var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
  },
  starBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingTop: "20px",
    borderTop: "1px solid var(--border)",
  },
  starRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  starChip: {
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
  starChipOn: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  starChipDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
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
  list: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--brand-primary-tint)",
    borderRadius: "var(--r-pill)",
    padding: "6px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  star: {
    color: "var(--accent-strong)",
  },
  aside: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: "14px 0 0",
  },
};

const cardsCss = `
  .mc-choice:hover { border-color: var(--brand-primary); color: var(--ink); }
  .mc-palette:hover { border-color: var(--brand-primary); color: var(--ink); }
  .mc-choice:focus-visible, .mc-palette:focus-visible, .mc-star:focus-visible,
  .mc-note:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
`;
