"use client";

import { useState } from "react";
import type { CardSortInteraction, CardSortResult } from "@/lib/modules";

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

// Group the assigned cards by bucket, in bucket order, keeping the card order
// from the original list. Unsorted cards are left out.
function groupByBucket(
  buckets: string[],
  allCards: string[],
  assignments: Record<string, string>
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const bucket of buckets) {
    grouped[bucket] = allCards.filter((card) => assignments[card] === bucket);
  }
  return grouped;
}

// The coach-facing summary, e.g.
// "Keep: a sense of purpose, being needed. Leave behind: the commute.
//  Want more of: rest." Empty buckets are omitted.
export function cardSortSummaryText(result: CardSortResult): string {
  return result.buckets
    .filter((bucket) => (result.assigned[bucket] ?? []).length > 0)
    .map(
      (bucket) =>
        `${bucket}: ${result.assigned[bucket].map(lowerFirst).join(", ")}.`
    )
    .join(" ");
}

type CardSortProps = {
  interaction: CardSortInteraction;
  onFinish: (result: CardSortResult) => void;
};

export default function CardSort({ interaction, onFinish }: CardSortProps) {
  const { instruction, buckets, cards } = interaction;

  const [extras, setExtras] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");

  const allCards = [...cards, ...extras];
  const unsorted = allCards.filter((card) => !assignments[card]);
  const grouped = groupByBucket(buckets, allCards, assignments);
  const sortedCount = allCards.length - unsorted.length;

  // Tap a bucket on a card: assign it, or unassign if it's already there.
  function assign(card: string, bucket: string) {
    setAssignments((prev) => {
      if (prev[card] === bucket) {
        const next = { ...prev };
        delete next[card];
        return next;
      }
      return { ...prev, [card]: bucket };
    });
  }

  function addCustom() {
    const text = draft.trim();
    if (!text) return;
    if (!allCards.includes(text)) setExtras((prev) => [...prev, text]);
    setDraft("");
  }

  function renderCard(card: string) {
    const current = assignments[card];
    return (
      <div key={card} style={styles.card}>
        <span style={styles.cardLabel}>{card}</span>
        <div style={styles.bucketChoices}>
          {buckets.map((bucket) => {
            const isActive = current === bucket;
            return (
              <button
                key={bucket}
                type="button"
                className="bucket-choice"
                style={{
                  ...styles.bucketChoice,
                  ...(isActive ? styles.bucketChoiceActive : null),
                }}
                aria-pressed={isActive}
                onClick={() => assign(card, bucket)}
              >
                {bucket}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section style={styles.wrap}>
      <style>{cardSortCss}</style>

      <p style={styles.instruction}>{instruction}</p>

      {unsorted.length > 0 && (
        <div style={styles.section}>
          <p style={styles.sectionHeading}>To sort ({unsorted.length})</p>
          <div style={styles.cardList}>{unsorted.map(renderCard)}</div>
        </div>
      )}

      <div style={styles.customRow}>
        <input
          type="text"
          className="custom-input"
          style={styles.customInput}
          placeholder="Add your own…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button
          type="button"
          className="custom-add"
          style={styles.customAdd}
          onClick={addCustom}
        >
          Add
        </button>
      </div>

      {buckets.map((bucket) =>
        grouped[bucket].length > 0 ? (
          <div key={bucket} style={styles.section}>
            <p style={styles.bucketHeading}>{bucket}</p>
            <div style={styles.cardList}>{grouped[bucket].map(renderCard)}</div>
          </div>
        ) : null
      )}

      <div style={styles.finishRow}>
        <button
          type="button"
          className="finish-btn"
          style={{
            ...styles.finishButton,
            ...(sortedCount === 0 ? styles.finishButtonDisabled : null),
          }}
          disabled={sortedCount === 0}
          onClick={() =>
            onFinish({ type: "card-sort", buckets, assigned: grouped })
          }
        >
          Talk it through with Vita →
        </button>
        <p style={styles.finishHint}>
          {sortedCount === 0
            ? "Sort at least one card to carry forward."
            : "Sort as many as feel right — you can leave some unsorted."}
        </p>
      </div>
    </section>
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
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionHeading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--text-muted)",
    margin: 0,
  },
  bucketHeading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
    padding: "14px 16px",
  },
  cardLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 500,
    color: "var(--ink)",
  },
  bucketChoices: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  bucketChoice: {
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
  bucketChoiceActive: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  customRow: {
    display: "flex",
    gap: "8px",
    alignItems: "stretch",
    maxWidth: "420px",
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
// conversation: the buckets with their cards listed under each. The neutral
// card wrapper is provided by the caller.
export function CardSortSummary({ result }: { result: CardSortResult }) {
  const filled = result.buckets.filter(
    (bucket) => (result.assigned[bucket] ?? []).length > 0
  );
  return (
    <>
      <p style={summaryStyles.heading}>What you sorted</p>
      <div style={summaryStyles.buckets}>
        {filled.map((bucket) => (
          <div key={bucket} style={summaryStyles.bucket}>
            <p style={summaryStyles.bucketName}>{bucket}</p>
            <div style={summaryStyles.chipWrap}>
              {result.assigned[bucket].map((card) => (
                <span key={card} style={summaryStyles.chip}>
                  {card}
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
  buckets: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  bucket: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  bucketName: {
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

const cardSortCss = `
  .bucket-choice:focus-visible, .custom-add:focus-visible,
  .finish-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .custom-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .finish-btn:not(:disabled):hover { background: var(--brand-primary-hover); }
`;
