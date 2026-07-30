// The shape of the post-completion survey, in one place — the same discipline as
// lib/moduleFeedback.ts. The card (client), the route that validates it (server)
// and the admin portal that reads it back all have to agree on the scale and the
// allowed answers; when those definitions live in three files they drift, and the
// failure is silent (an answer the form offers but the server's allowlist doesn't
// know is simply dropped on save). So they are defined here once and imported
// everywhere.
//
// The two questions that mirror the onboarding baseline — feelings and planning
// confidence — are NOT redefined here. They are re-exported from
// lib/retirementSentiment.ts, the single source both surveys share, so the
// pilot's before/after comparison stays valid by construction.
//
// Plain data (no "server-only" marker): the card needs it in the browser.

import {
  FEELINGS_OPTIONS,
  FEELINGS_MAX,
  FEELINGS_SET,
  FEELINGS_QUESTION,
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
  CONFIDENCE_LOW_LABEL,
  CONFIDENCE_HIGH_LABEL,
  CONFIDENCE_QUESTION,
} from "@/lib/retirementSentiment";

// Re-exported so consumers can import the whole survey from one module.
export {
  FEELINGS_OPTIONS,
  FEELINGS_MAX,
  FEELINGS_SET,
  FEELINGS_QUESTION,
  CONFIDENCE_MIN,
  CONFIDENCE_MAX,
  CONFIDENCE_LOW_LABEL,
  CONFIDENCE_HIGH_LABEL,
  CONFIDENCE_QUESTION,
};

// Every rating question here uses a 1–5 scale stored as an integer — matching the
// baseline's planning_confidence column, so ratings across the two surveys are
// directly comparable. 5 is always the good end; null means the question was
// skipped (kept distinct from a 1, which is a real low answer).
export const RATING_MIN = 1;
export const RATING_MAX = 5;

export function isRating(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    v >= RATING_MIN &&
    v <= RATING_MAX
  );
}

// Coerce an incoming value to a valid 1–5 rating, or null for a skip / anything
// unusable. Used by the route so one bad field never rejects a whole submission.
export function toRating(v: unknown): number | null {
  return isRating(v) ? v : null;
}

// The five-part rating of Vita, the AI coach — each a 1–5 statement the user
// agrees with more or less. `key` drives the form state and the request payload;
// `column` is the DB column it lands in; `label` is the exact wording shown.
// Defined as one list so the card renders them and the route reads them back from
// the same place, in the same order.
export const VITA_RATINGS = [
  { key: "understood", column: "vita_understood", label: "Vita understood me" },
  {
    key: "goodQuestions",
    column: "vita_good_questions",
    label: "Vita asked good questions",
  },
  { key: "authentic", column: "vita_authentic", label: "Vita felt authentic" },
  {
    key: "challenged",
    column: "vita_challenged",
    label: "Vita challenged my thinking",
  },
  {
    key: "discovered",
    column: "vita_discovered",
    label: "Vita helped me discover something about myself",
  },
] as const;

export type VitaRatingKey = (typeof VITA_RATINGS)[number]["key"];

// Free-text caps. The "Before/After" sentences are short by design; the open
// reflections get more room. Bounded so a single submission can't be
// unreasonable.
export const SENTENCE_MAX_CHARS = 600; // each of the "Before/After Chorus Life" sentences
export const OPEN_MAX_CHARS = 2000; // expectations, comfort-improve, session "why", team message
export const FEELINGS_OTHER_MAX_CHARS = 600; // the optional free-text under the feelings chips

// Trim to `max`, or null when empty/absent. Shared by every free-text field so
// the same "empty means skipped" rule holds everywhere.
export function toText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

// Coerce the feelings multi-select to the allowlist, deduped and capped at the
// limit — identical treatment to the baseline, so the two are comparable.
export function toFeelings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item === "string" && FEELINGS_SET.has(item)) seen.add(item);
  }
  return Array.from(seen).slice(0, FEELINGS_MAX);
}
