"use client";

// The letter module's interaction. Unlike the other modules it replaces the
// turn-by-turn conversation entirely: the person chooses who they're writing to,
// then writes a short letter from their future self on a dedicated surface.
// Optional suggestion chips (drawn from their earlier Stage 1 work) beat the
// blank page. On save, Vita reads the letter once and either acknowledges it or
// offers a single gentle nudge to add detail — at most one enrichment pass.
// When the letter is finalised it hands the result and Vita's closing line back
// to the parent, which records completion and shows the reveal.

import { useState } from "react";
import VitaMark from "./VitaMark";
import type { LetterInteraction, LetterResult } from "@/lib/modules";

type Suggestion = { chip: string; seed: string };

type LetterFlowProps = {
  interaction: LetterInteraction;
  // A readable summary of earlier Stage 1 work, for personalised suggestions.
  priorReflections: string;
  // A saved draft to resume from, if any.
  initial?: LetterResult;
  // Optional reframed placeholder for the writing surface (the retired
  // "retirement so far" reflection). Falls back to the future-self prompt.
  writingPlaceholder?: string;
  // True for the retired letter (Phase 6): the starting-point chips reflect on
  // retirement so far rather than a future they've imagined.
  retired?: boolean;
  // Called once the letter is finalised: the result to store, plus Vita's
  // closing acknowledgement to show alongside the reveal.
  onComplete: (result: LetterResult, vitaMessage: string) => void;
};

// Shown if the person declines the nudge, or if the review call fails — a warm,
// descriptive close that never asks for more.
const LEAVE_AS_IS_ACK =
  "Then we'll leave it just as it is — a real picture of the life, in your own words.";

export default function LetterFlow({
  interaction,
  priorReflections,
  initial,
  writingPlaceholder,
  retired,
  onComplete,
}: LetterFlowProps) {
  const [step, setStep] = useState<"recipient" | "writing">(
    initial ? "writing" : "recipient"
  );
  const [recipientId, setRecipientId] = useState(initial?.recipientId ?? "");
  const [recipientLabel, setRecipientLabel] = useState(
    initial?.recipientLabel ?? ""
  );
  const [customName, setCustomName] = useState("");
  const [body, setBody] = useState(initial?.body ?? "");

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [usedChips, setUsedChips] = useState<Set<number>>(new Set());

  const [saving, setSaving] = useState(false);
  // Vita's single gentle nudge, shown above the surface when the letter is thin.
  const [nudge, setNudge] = useState<string | null>(null);
  // True once the person has taken the one allowed enrichment pass — the next
  // save finalises with an acknowledgement, never another nudge.
  const [enrichmentUsed, setEnrichmentUsed] = useState(false);

  // Move into the writing surface for the chosen recipient and fetch the
  // optional, personalised starting points.
  function goToWriting(id: string, label: string) {
    setRecipientId(id);
    setRecipientLabel(label);
    setStep("writing");
    void loadSuggestions(label);
  }

  async function loadSuggestions(label: string) {
    try {
      const res = await fetch("/api/letter-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientLabel: label, priorReflections, retired }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { suggestions?: Suggestion[] };
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        setSuggestions(data.suggestions);
      }
    } catch {
      // Suggestions are optional scaffolding — silently skip if they fail.
    }
  }

  function applySuggestion(i: number, seed: string) {
    setBody((prev) => {
      // Start each applied prompt on its own paragraph so the letter builds as
      // distinct paragraphs, not one run-on block. (The surface itself takes
      // line breaks freely; this just keeps seeded starts from smashing together.)
      const sep = prev.trim() ? (prev.endsWith("\n") ? "" : "\n\n") : "";
      return prev + sep + seed;
    });
    setUsedChips((prev) => new Set(prev).add(i));
  }

  function finish(result: LetterResult, message: string) {
    onComplete(result, message);
  }

  async function handleSave() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);

    const result: LetterResult = {
      type: "letter",
      recipientId,
      recipientLabel,
      body: text,
    };

    // The one enrichment pass has already been taken — finalise with an
    // acknowledgement, never another nudge.
    const isFinalPass = enrichmentUsed;

    try {
      const res = await fetch("/api/letter-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientLabel,
          body: text,
          final: isFinalPass,
        }),
      });
      if (!res.ok) throw new Error(`Review failed: ${res.status}`);
      const data = (await res.json()) as { rich: boolean; message: string };

      if (isFinalPass || data.rich) {
        finish(result, data.message || LEAVE_AS_IS_ACK);
        return;
      }

      // Thin letter, first pass — show one gentle nudge and let them add to it.
      setNudge(data.message);
      setEnrichmentUsed(true);
      setSuggestions(null);
      setSaving(false);
    } catch {
      // Never trap them in the review step — close warmly.
      finish(result, LEAVE_AS_IS_ACK);
    }
  }

  // Decline the nudge and finalise as written.
  function handleLeaveAsIs() {
    const text = body.trim();
    finish(
      {
        type: "letter",
        recipientId,
        recipientLabel,
        body: text,
      },
      LEAVE_AS_IS_ACK
    );
  }

  // ---- RECIPIENT CHOOSER ----
  if (step === "recipient") {
    return (
      <section style={styles.wrap}>
        <style>{css}</style>
        <div style={styles.chooser}>
          {interaction.recipients.map((r) => (
            <button
              key={r.id}
              type="button"
              className="letter-recipient"
              style={styles.recipientCard}
              onClick={() => goToWriting(r.id, r.label.toLowerCase())}
            >
              {r.label}
            </button>
          ))}

          {interaction.allowCustom && (
            <div style={styles.customRow}>
              <input
                type="text"
                className="letter-input"
                style={styles.customInput}
                placeholder="Someone else — who?"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customName.trim()) {
                    goToWriting("custom", customName.trim());
                  }
                }}
              />
              <button
                type="button"
                className="letter-primary"
                style={{
                  ...styles.primaryButton,
                  ...(customName.trim() ? null : styles.primaryButtonDisabled),
                }}
                disabled={!customName.trim()}
                onClick={() => goToWriting("custom", customName.trim())}
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ---- WRITING SURFACE ----
  const showChips = !nudge && suggestions && suggestions.length > 0;

  return (
    <section style={styles.wrap}>
      <style>{css}</style>

      {nudge && (
        <div style={styles.vitaLockup}>
          <VitaMark size={34} />
          <span style={styles.vitaName}>Vita</span>
        </div>
      )}
      {nudge && (
        <div style={styles.coachRow}>
          <div style={styles.coachBubble}>{nudge}</div>
        </div>
      )}

      <div style={styles.surface}>
        <p style={styles.addressLine}>To {recipientLabel},</p>

        {showChips && (
          <div style={styles.chipBlock}>
            <p style={styles.chipLabel}>A few places you could start —</p>
            <div style={styles.chips}>
              {suggestions!.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="letter-chip"
                  style={{
                    ...styles.chip,
                    ...(usedChips.has(i) ? styles.chipUsed : null),
                  }}
                  disabled={usedChips.has(i)}
                  onClick={() => applySuggestion(i, s.seed)}
                >
                  {s.chip}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          className="letter-textarea"
          style={styles.textarea}
          placeholder={
            writingPlaceholder ??
            "Tell them how it all looks now — what fills your days, the people around you, an ordinary good week…"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
        />
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          className="letter-primary"
          style={{
            ...styles.primaryButton,
            ...styles.saveButton,
            ...(body.trim() && !saving ? null : styles.primaryButtonDisabled),
          }}
          disabled={!body.trim() || saving}
          onClick={handleSave}
        >
          {saving
            ? "Vita is reading…"
            : nudge
              ? "Save your additions"
              : "Save your letter"}
        </button>
        {nudge && (
          <button
            type="button"
            className="letter-quiet"
            style={styles.quietButton}
            onClick={handleLeaveAsIs}
          >
            It&apos;s good as it is →
          </button>
        )}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },

  // Recipient chooser
  chooser: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  recipientCard: {
    width: "100%",
    textAlign: "left",
    background: "var(--bg)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "16px 18px",
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    color: "var(--ink)",
    cursor: "pointer",
  },
  customRow: {
    display: "flex",
    gap: "12px",
    alignItems: "stretch",
    marginTop: "4px",
  },
  customInput: {
    flex: 1,
    background: "var(--bg)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "13px 16px",
    minHeight: "48px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    outline: "none",
  },

  // Vita lockup + nudge bubble
  vitaLockup: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },
  vitaName: {
    fontFamily: "var(--font-serif)",
    fontSize: "19px",
    fontWeight: 600,
    color: "var(--color-vita)",
  },
  coachRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  coachBubble: {
    background: "var(--warm-surface)",
    color: "var(--ink)",
    border: "1px solid var(--warm-line)",
    borderRadius: "18px 18px 18px 4px",
    padding: "16px 18px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    maxWidth: "85%",
    textAlign: "left",
  },

  // Writing surface
  surface: {
    background: "var(--bg)",
    border: "0.5px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "24px",
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  addressLine: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  chipBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  chipLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
    margin: 0,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-pill)",
    padding: "8px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--ink)",
    cursor: "pointer",
  },
  chipUsed: {
    opacity: 0.45,
    cursor: "default",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "16px 18px",
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    outline: "none",
    resize: "vertical",
    minHeight: "240px",
  },

  // Actions
  actions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  primaryButton: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    minHeight: "48px",
    cursor: "pointer",
  },
  saveButton: {
    width: "100%",
    maxWidth: "360px",
  },
  primaryButtonDisabled: {
    background: "var(--muted-surface)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  },
  quietButton: {
    background: "none",
    border: "none",
    padding: "4px 8px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
};

const css = `
  .letter-recipient:hover {
    border-color: var(--brand-primary);
    background: var(--bg-alt);
  }
  .letter-recipient:focus-visible,
  .letter-chip:focus-visible,
  .letter-primary:focus-visible,
  .letter-quiet:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
  .letter-chip:not(:disabled):hover { background: var(--warm-line); }
  .letter-primary:not(:disabled):hover { background: var(--brand-primary-hover); }
  .letter-quiet:hover { color: var(--text); }
  .letter-input:focus-visible,
  .letter-textarea:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
`;
