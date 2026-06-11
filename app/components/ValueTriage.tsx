"use client";

import { useState } from "react";
import type { ValueTriageInteraction, ValueTriageResult } from "@/lib/modules";
import { VALUE_CLUSTERS, type Stage3Seed } from "@/lib/stage3Seed";
import { FinishControls, type EditableProps } from "./InteractionShell";

// 3.2 "Your values" — a triage surface built on the fixed value set, so the
// module is recognition against a known set (the same way 3.1 uses VIA). Seeded
// candidate value cards are sorted into three trays; the "not sure" tray is
// first-class and carries forward. The rest of the set, grouped by cluster, is
// browsable beneath, with a rare free-text escape hatch. Labels always come
// from the set — the person's own wording for a value is drawn out later, in
// Vita's conversation, not edited here.

type Tray = "me" | "unsure" | "not";

const TRAYS: { id: Tray; label: string }[] = [
  { id: "me", label: "That's me" },
  { id: "unsure", label: "Not sure" },
  { id: "not", label: "Not really" },
];

type CardState = {
  label: string;
  evidence: string;
  tray: Tray | null;
};

export function valueTriageSummaryText(result: ValueTriageResult): string {
  const label = result.summaryLabel || "Values";
  const by = (tray: Tray) =>
    result.sorted.filter((s) => s.tray === tray).map((s) => s.label);
  const me = by("me");
  const unsure = by("unsure");
  const not = by("not");
  const core = result.core ?? [];
  const parts: string[] = [];
  if (core.length)
    parts.push(`The values they marked most core: ${core.join(", ")}.`);
  if (me.length) parts.push(`${label} that feel like them: ${me.join(", ")}.`);
  if (unsure.length) parts.push(`Still unsure about: ${unsure.join(", ")}.`);
  if (not.length) parts.push(`Not really theirs: ${not.join(", ")}.`);
  return parts.join(" ") || `${label}: nothing sorted yet.`;
}

type Props = {
  interaction: ValueTriageInteraction;
  seed: Stage3Seed | null;
  onFinish: (result: ValueTriageResult) => void;
} & EditableProps<ValueTriageResult>;

export default function ValueTriage({
  interaction,
  seed,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: Props) {
  const seedCards = seed && seed.type === "value-triage" ? seed.cards : [];

  const [cards, setCards] = useState<CardState[]>(() => {
    if (initial) {
      return initial.sorted.map((s) => ({
        label: s.label,
        evidence: s.evidence ?? "",
        tray: s.tray,
      }));
    }
    return seedCards.map((c) => ({ label: c.label, evidence: c.evidence, tray: null }));
  });
  const [core, setCore] = useState<string[]>(initial?.core ?? []);
  const [customDraft, setCustomDraft] = useState("");

  function setTray(index: number, tray: Tray) {
    const label = cards[index]?.label;
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, tray } : c))
    );
    // A value only stays core while it's in the "that's me" tray.
    if (tray !== "me" && label) {
      setCore((prev) => prev.filter((l) => l !== label));
    }
  }

  function toggleCore(label: string) {
    setCore((prev) => {
      if (prev.includes(label)) return prev.filter((l) => l !== label);
      if (prev.length >= interaction.coreMax) return prev;
      return [...prev, label];
    });
  }

  function hasCard(label: string): boolean {
    return cards.some((c) => c.label.toLowerCase() === label.toLowerCase());
  }

  function addFromPalette(option: string) {
    if (hasCard(option)) return;
    setCards((prev) => [...prev, { label: option, evidence: "", tray: "me" }]);
  }

  function addCustom() {
    const label = customDraft.trim();
    if (!label) return;
    if (!hasCard(label)) {
      setCards((prev) => [...prev, { label, evidence: "", tray: "me" }]);
    }
    setCustomDraft("");
  }

  const meCards = cards.filter((c) => c.tray === "me");
  const allSorted = cards.length > 0 && cards.every((c) => c.tray !== null);
  // Once everything is sorted, at least one core value must be marked (unless
  // nothing landed in "that's me" at all).
  const coreChosen = meCards.length === 0 || core.length > 0;
  const canFinish = allSorted && coreChosen;

  const finishHint = !allSorted
    ? "Place each value in a tray to continue."
    : !coreChosen
      ? "Mark the value or two that feel most core to continue."
      : undefined;

  function finish() {
    onFinish({
      type: "value-triage",
      sorted: cards
        .filter((c) => c.tray !== null)
        .map((c) => ({
          label: c.label,
          tray: c.tray as Tray,
          ...(c.evidence ? { evidence: c.evidence } : {}),
        })),
      core: core.filter((l) => meCards.some((c) => c.label === l)),
      summaryLabel: interaction.summaryLabel,
    });
  }

  return (
    <section style={styles.wrap}>
      <style>{triageCss}</style>
      <p style={styles.instruction}>{interaction.instruction}</p>

      <div style={styles.cardList}>
        {cards.map((card, i) => (
          <div key={`${card.label}-${i}`} style={styles.card}>
            <div style={styles.cardMain}>
              <span style={styles.cardLabel}>{card.label}</span>
              {card.evidence && <span style={styles.evidence}>{card.evidence}</span>}
            </div>
            <div style={styles.trayRow}>
              {TRAYS.map((t) => {
                const on = card.tray === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="vt-tray"
                    style={{
                      ...styles.trayBtn,
                      ...(on ? trayOnStyle(t.id) : null),
                    }}
                    aria-pressed={on}
                    onClick={() => setTray(i, t.id)}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.paletteBlock}>
        <p style={styles.subLabel}>{interaction.paletteLabel}</p>
        <p style={styles.paletteIntro}>{interaction.paletteIntro}</p>
        {VALUE_CLUSTERS.map((cluster) => {
          const remaining = cluster.values.filter((v) => !hasCard(v));
          if (remaining.length === 0) return null;
          return (
            <div key={cluster.name} style={styles.clusterBlock}>
              <p style={styles.clusterName}>{cluster.name}</p>
              <div style={styles.paletteRow}>
                {remaining.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="vt-palette"
                    style={styles.paletteChip}
                    onClick={() => addFromPalette(option)}
                  >
                    + {option}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div style={styles.customBlock}>
          <p style={styles.customLabel}>{interaction.customLabel}</p>
          <div style={styles.customRow}>
            <input
              type="text"
              className="vt-custom"
              style={styles.customInput}
              placeholder="A value in your own words…"
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
              }}
            />
            <button
              type="button"
              className="vt-add"
              style={styles.addBtn}
              onClick={addCustom}
              disabled={!customDraft.trim()}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {meCards.length > 0 && (
        <div style={styles.coreBlock}>
          <p style={styles.subLabel}>{interaction.coreLabel}</p>
          <div style={styles.coreRow}>
            {meCards.map((card) => {
              const on = core.includes(card.label);
              const full = !on && core.length >= interaction.coreMax;
              return (
                <button
                  key={card.label}
                  type="button"
                  className="vt-core"
                  style={{
                    ...styles.coreChip,
                    ...(on ? styles.coreChipOn : null),
                    ...(full ? styles.coreChipDisabled : null),
                  }}
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggleCore(card.label)}
                >
                  {card.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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

function trayOnStyle(tray: Tray): React.CSSProperties {
  if (tray === "me") return styles.trayMe;
  if (tray === "unsure") return styles.trayUnsure;
  return styles.trayNot;
}

export function ValueTriageSummary({ result }: { result: ValueTriageResult }) {
  const core = result.core ?? [];
  const group = (tray: Tray) => result.sorted.filter((s) => s.tray === tray);
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel || "Your values"}</p>
      <div style={summaryStyles.groups}>
        {core.length > 0 && (
          <div style={summaryStyles.group}>
            <span style={summaryStyles.groupLabel}>Most core</span>
            <div style={summaryStyles.chips}>
              {core.map((label) => (
                <span key={label} style={summaryStyles.coreChip}>
                  ★ {label}
                </span>
              ))}
            </div>
          </div>
        )}
        {TRAYS.map((t) => {
          const items = group(t.id);
          if (items.length === 0) return null;
          return (
            <div key={t.id} style={summaryStyles.group}>
              <span style={summaryStyles.groupLabel}>{t.label}</span>
              <div style={summaryStyles.chips}>
                {items.map((s) => (
                  <span key={s.label} style={summaryStyles.chip}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
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
    color: "var(--text-muted)",
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
  cardMain: { display: "flex", flexDirection: "column", gap: "4px" },
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
  trayRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  trayBtn: {
    flex: 1,
    minWidth: "90px",
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
  trayMe: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
  },
  trayUnsure: {
    background: "var(--warm-surface)",
    border: "1px solid var(--accent-strong)",
    color: "var(--ink)",
  },
  trayNot: {
    background: "var(--muted-surface)",
    border: "1px solid var(--text-muted)",
    color: "var(--text-muted)",
  },
  paletteBlock: { display: "flex", flexDirection: "column", gap: "14px" },
  subLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  paletteIntro: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: "-6px 0 0",
  },
  clusterBlock: { display: "flex", flexDirection: "column", gap: "8px" },
  clusterName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    margin: 0,
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
  customBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingTop: "14px",
    borderTop: "1px solid var(--border)",
  },
  customLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: 0,
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
  coreBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    paddingTop: "20px",
    borderTop: "1px solid var(--border)",
  },
  coreRow: { display: "flex", flexWrap: "wrap", gap: "8px" },
  coreChip: {
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
  coreChipOn: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  coreChipDisabled: { opacity: 0.4, cursor: "not-allowed" },
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
  groups: { display: "flex", flexDirection: "column", gap: "14px" },
  group: { display: "flex", flexDirection: "column", gap: "8px" },
  groupLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: "8px" },
  chip: {
    background: "var(--brand-primary-tint)",
    borderRadius: "var(--r-pill)",
    padding: "6px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  coreChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    borderRadius: "var(--r-pill)",
    padding: "6px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
};

const triageCss = `
  .vt-palette:hover { border-color: var(--brand-primary); color: var(--ink); }
  .vt-core:hover { border-color: var(--brand-primary); color: var(--ink); }
  .vt-tray:focus-visible, .vt-palette:focus-visible, .vt-add:focus-visible,
  .vt-custom:focus-visible, .vt-core:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
  .vt-add:disabled, .vt-core:disabled { opacity: 0.4; cursor: not-allowed; }
`;
