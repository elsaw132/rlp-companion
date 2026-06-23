"use client";

import { useState } from "react";
import type { HopesFearsInteraction, HopesFearsResult } from "@/lib/modules";
import {
  FEAR_HORIZONS,
  fearHorizonsFor,
  PARTNER_FEARS,
  type Stage3Seed,
} from "@/lib/stage3Seed";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

// 3.5 "Hopes and fears" — the quieter half of the picture. A short read-only
// hopes line opens it as a warm on-ramp; then the person reacts to candidate fear
// cards grouped into three time horizons. Most cards are set aside ("Not me") —
// that's the point. The few that land can carry a specific note and a "weighs
// heavily" flag. The rest of each horizon's bank is browsable, with an
// add-your-own escape hatch. Recognition against a known bank, the same shape as
// 3.1/3.2, but three-way and grouped by when a worry tends to show up.

type Reaction = "on-my-mind" | "not-me" | "newly-recognised";

type CardState = {
  label: string;
  horizon: string;
  reaction: Reaction | null;
  note: string;
  weighs: boolean;
};

function isLanded(reaction: Reaction | null): boolean {
  return reaction === "on-my-mind" || reaction === "newly-recognised";
}

export function hopesFearsSummaryText(result: HopesFearsResult): string {
  const label = result.summaryLabel || "Hopes and fears";
  const landed = result.fears.filter((f) => isLanded(f.reaction));
  const parts: string[] = [];
  if (result.hopes.trim()) parts.push(`Hoping for: ${result.hopes.trim()}`);
  if (landed.length === 0) {
    parts.push(
      "None of the common worries landed — the hopes carry the picture for now."
    );
    return parts.join(". ") + ".";
  }
  for (const horizon of FEAR_HORIZONS) {
    const here = landed.filter((f) => f.horizon === horizon.name);
    if (here.length === 0) continue;
    const lines = here.map((f) => {
      const note = f.note?.trim() ? ` (${f.note.trim()})` : "";
      const weighs = f.weighs ? " [weighs heavily]" : "";
      return `${f.label}${note}${weighs}`;
    });
    parts.push(`${horizon.name} — ${lines.join("; ")}`);
  }
  const heavy = landed.filter((f) => f.weighs).map((f) => f.label);
  if (heavy.length) parts.push(`Weighs most: ${heavy.join(", ")}`);
  return `${label}. ${parts.join(". ")}.`;
}

type Props = {
  interaction: HopesFearsInteraction;
  seed: Stage3Seed | null;
  onFinish: (result: HopesFearsResult) => void;
  // Whether the person has a partner. Partner-only worries are kept off the
  // surface entirely for someone planning retirement alone.
  hasPartner: boolean;
} & EditableProps<HopesFearsResult>;

export default function HopesFears({
  interaction,
  seed,
  onFinish,
  hasPartner,
  mode = "create",
  initial,
  onCancel,
}: Props) {
  const hfSeed = seed && seed.type === "hopes-fears" ? seed : null;
  const hopes = initial?.hopes ?? hfSeed?.hopes ?? "";

  // The bank for this person — partner-only horizons stripped if they're solo.
  const horizons = fearHorizonsFor(hasPartner);

  const [cards, setCards] = useState<CardState[]>(() => {
    if (initial) {
      return initial.fears.map((f) => ({
        label: f.label,
        horizon: f.horizon,
        reaction: f.reaction,
        note: f.note ?? "",
        weighs: f.weighs ?? false,
      }));
    }
    const seeded: CardState[] = [];
    for (const h of hfSeed?.horizons ?? []) {
      for (const label of h.fears) {
        // Defensive: keep partner-only worries off the surface for a solo
        // person even if a stale or generic seed still carries them.
        if (!hasPartner && PARTNER_FEARS.has(label)) continue;
        seeded.push({
          label,
          horizon: h.horizon,
          reaction: null,
          note: "",
          weighs: false,
        });
      }
    }
    return seeded;
  });
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({});

  function setReaction(index: number, reaction: Reaction) {
    setCards((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        // A worry only keeps its "weighs heavily" flag while it's still landed.
        const weighs = isLanded(reaction) ? c.weighs : false;
        return { ...c, reaction, weighs };
      })
    );
  }

  function setNote(index: number, note: string) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, note } : c)));
  }

  function toggleWeighs(index: number) {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, weighs: !c.weighs } : c))
    );
  }

  function hasCard(label: string): boolean {
    return cards.some((c) => c.label.toLowerCase() === label.toLowerCase());
  }

  function addFromPalette(label: string, horizon: string) {
    if (hasCard(label)) return;
    setCards((prev) => [
      ...prev,
      { label, horizon, reaction: "on-my-mind", note: "", weighs: false },
    ]);
  }

  function addCustom(horizon: string) {
    const label = (customDraft[horizon] ?? "").trim();
    if (!label) return;
    if (!hasCard(label)) {
      setCards((prev) => [
        ...prev,
        { label, horizon, reaction: "on-my-mind", note: "", weighs: false },
      ]);
    }
    setCustomDraft((prev) => ({ ...prev, [horizon]: "" }));
  }

  const allReacted = cards.length === 0 || cards.every((c) => c.reaction !== null);
  const canFinish = allReacted;
  const finishHint = allReacted
    ? undefined
    : "Give each worry a response — most will be \u201cNot me\u201d — to continue.";

  function finish() {
    onFinish({
      type: "hopes-fears",
      hopes,
      fears: cards
        .filter((c) => c.reaction !== null)
        .map((c) => {
          const landed = isLanded(c.reaction);
          const note = landed && c.note.trim() ? c.note.trim() : undefined;
          const weighs = landed && c.weighs ? true : undefined;
          return {
            label: c.label,
            horizon: c.horizon,
            reaction: c.reaction as Reaction,
            ...(note ? { note } : {}),
            ...(weighs ? { weighs } : {}),
          };
        }),
      summaryLabel: interaction.summaryLabel,
    });
  }

  const reactions: { id: Reaction; label: string }[] = [
    { id: "on-my-mind", label: interaction.reactionLabels.onMyMind },
    { id: "not-me", label: interaction.reactionLabels.notMe },
    { id: "newly-recognised", label: interaction.reactionLabels.newlyRecognised },
  ];

  return (
    <section style={styles.wrap}>
      <style>{hfCss}</style>

      {hopes.trim() && (
        <div style={styles.hopesBox}>
          <span style={styles.hopesLabel}>{interaction.hopesLabel}</span>
          <p style={styles.hopesText}>{hopes.trim()}</p>
        </div>
      )}

      <p style={styles.instruction}>{interaction.instruction}</p>

      <div style={styles.helperGroup}>
        <HelperLine>Tap how each one sits with you.</HelperLine>
        <div style={styles.horizonList}>
      {horizons.map((horizon) => {
        const cardsHere = cards
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.horizon === horizon.name);
        const remaining = horizon.fears.filter((f) => !hasCard(f));
        return (
          <div key={horizon.name} style={styles.horizonBlock}>
            <p style={styles.horizonName}>{horizon.name}</p>

            <div style={styles.cardList}>
              {cardsHere.map(({ c: card, i }) => {
                const landed = isLanded(card.reaction);
                return (
                  <div key={`${card.label}-${i}`} style={styles.card}>
                    <span style={styles.cardLabel}>{card.label}</span>
                    <div style={styles.reactionRow}>
                      {reactions.map((r) => {
                        const on = card.reaction === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className="hf-react"
                            style={{
                              ...styles.reactionBtn,
                              ...(on ? reactionOnStyle(r.id) : null),
                            }}
                            aria-pressed={on}
                            onClick={() => setReaction(i, r.id)}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                    {landed && (
                      <div style={styles.landedBlock}>
                        <textarea
                          className="hf-note"
                          style={styles.noteInput}
                          placeholder={interaction.notePlaceholder}
                          rows={2}
                          value={card.note}
                          onChange={(e) => setNote(i, e.target.value)}
                          aria-label={interaction.noteLabel}
                        />
                        <button
                          type="button"
                          className="hf-weighs"
                          style={{
                            ...styles.weighsRow,
                            ...(card.weighs ? styles.weighsRowOn : null),
                          }}
                          role="checkbox"
                          aria-checked={card.weighs}
                          onClick={() => toggleWeighs(i)}
                        >
                          <span
                            style={{
                              ...styles.check,
                              ...(card.weighs ? styles.checkOn : null),
                            }}
                          >
                            {card.weighs ? "\u2713" : ""}
                          </span>
                          <span>{interaction.weighsLabel}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {remaining.length > 0 && (
              <div style={styles.paletteRow}>
                {remaining.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="hf-palette"
                    style={styles.paletteChip}
                    onClick={() => addFromPalette(option, horizon.name)}
                  >
                    + {option}
                  </button>
                ))}
              </div>
            )}

            <div style={styles.customRow}>
              <input
                type="text"
                className="hf-custom"
                style={styles.customInput}
                placeholder={interaction.customLabel}
                value={customDraft[horizon.name] ?? ""}
                onChange={(e) =>
                  setCustomDraft((prev) => ({
                    ...prev,
                    [horizon.name]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustom(horizon.name);
                }}
              />
              <button
                type="button"
                className="hf-add"
                style={styles.addBtn}
                onClick={() => addCustom(horizon.name)}
                disabled={!(customDraft[horizon.name] ?? "").trim()}
              >
                Add
              </button>
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
        hint={finishHint}
      />
    </section>
  );
}

function reactionOnStyle(reaction: Reaction): React.CSSProperties {
  if (reaction === "on-my-mind") return styles.reactOnMind;
  if (reaction === "not-me") return styles.reactNot;
  return styles.reactNew;
}

export function HopesFearsSummary({ result }: { result: HopesFearsResult }) {
  const landed = result.fears.filter((f) => isLanded(f.reaction));
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel || "Hopes and fears"}</p>
      {result.hopes.trim() && (
        <div style={summaryStyles.hopes}>
          <span style={summaryStyles.groupLabel}>Hoping for</span>
          <p style={summaryStyles.hopesText}>{result.hopes.trim()}</p>
        </div>
      )}
      {landed.length === 0 ? (
        <p style={summaryStyles.empty}>
          None of the common worries landed — the hopes carry the picture for now.
        </p>
      ) : (
        <div style={summaryStyles.groups}>
          {FEAR_HORIZONS.map((horizon) => {
            const here = landed.filter((f) => f.horizon === horizon.name);
            if (here.length === 0) return null;
            return (
              <div key={horizon.name} style={summaryStyles.group}>
                <span style={summaryStyles.groupLabel}>{horizon.name}</span>
                <div style={summaryStyles.items}>
                  {here.map((f, i) => (
                    <div key={`${f.label}-${i}`} style={summaryStyles.item}>
                      <span style={summaryStyles.itemLabel}>
                        {f.weighs ? "\u2605 " : ""}
                        {f.label}
                      </span>
                      {f.note?.trim() && (
                        <span style={summaryStyles.itemNote}>{f.note.trim()}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
  hopesBox: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
  },
  hopesLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  hopesText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: 0,
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },
  // Keep the helper line close above the first cards (tighter than the wrap's
  // 24px gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  // The horizon blocks keep the wrap's original 24px rhythm between them.
  horizonList: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  horizonBlock: { display: "flex", flexDirection: "column", gap: "12px" },
  horizonName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    margin: 0,
  },
  cardList: { display: "flex", flexDirection: "column", gap: "12px" },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    boxShadow: "var(--shadow-sm)",
  },
  cardLabel: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  reactionRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  reactionBtn: {
    flex: 1,
    minWidth: "100px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  reactOnMind: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
  },
  reactNot: {
    background: "var(--muted-surface)",
    border: "1px solid var(--text-muted)",
    color: "var(--text-muted)",
  },
  reactNew: {
    background: "var(--warm-surface)",
    border: "1px solid var(--accent-strong)",
    color: "var(--ink)",
  },
  landedBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingTop: "12px",
    borderTop: "1px solid var(--border)",
  },
  noteInput: {
    width: "100%",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    lineHeight: 1.5,
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "10px 12px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  weighsRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "none",
    border: "none",
    padding: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    textAlign: "left",
    cursor: "pointer",
  },
  weighsRowOn: { color: "var(--ink)", fontWeight: 600 },
  check: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    flexShrink: 0,
    border: "1px solid var(--border)",
    borderRadius: "var(--r-xs)",
    background: "var(--bg)",
    fontSize: "13px",
    color: "var(--brand-on-primary)",
  },
  checkOn: {
    background: "var(--brand-primary)",
    border: "1px solid var(--brand-primary)",
  },
  paletteRow: { display: "flex", flexWrap: "wrap", gap: "8px" },
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
  customRow: { display: "flex", gap: "8px" },
  customInput: {
    flex: 1,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "10px 12px",
  },
  addBtn: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "10px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
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
  hopes: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "16px",
  },
  hopesText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: 0,
  },
  empty: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: 0,
  },
  groups: { display: "flex", flexDirection: "column", gap: "14px" },
  group: { display: "flex", flexDirection: "column", gap: "8px" },
  groupLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  items: { display: "flex", flexDirection: "column", gap: "8px" },
  item: { display: "flex", flexDirection: "column", gap: "2px" },
  itemLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  itemNote: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
};

const hfCss = `
  .hf-palette:hover { border-color: var(--brand-primary); color: var(--ink); }
  .hf-react:focus-visible, .hf-palette:focus-visible, .hf-add:focus-visible,
  .hf-custom:focus-visible, .hf-note:focus-visible, .hf-weighs:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
  .hf-add:disabled { opacity: 0.4; cursor: not-allowed; }
`;
