// Canonical retirement-sentiment question definitions, shared so the baseline
// (asked at the end of onboarding) and the post-completion survey (asked when
// the plan is finished) put the SAME question with the SAME options to the same
// person. The pilot's whole point is the before/after comparison, and that is
// only valid if these two never drift — so they are defined once here and
// imported by the onboarding form, the baseline API allowlist, and the
// post-completion survey config. Change a wording or an option and both surveys
// move together.
//
// Plain data (no "server-only" marker): the onboarding form and the survey card
// both need it in the browser.

// "How do you feel about your retirement right now?" — select up to three.
// Ordered on a positive → neutral → difficult gradient. The four beyond the
// original nine ("Relieved", "Settled", "At a loose end", "Lonely") speak to
// someone already retired. Adding, removing, or reordering an option changes
// what every survey using this list offers — keep it deliberate.
export const FEELINGS_OPTIONS: string[] = [
  "Excited",
  "Curious",
  "Hopeful",
  "Confident",
  "Relieved",
  "Settled",
  "Neutral",
  "Uncertain",
  "At a loose end",
  "Lonely",
  "Overwhelmed",
  "Anxious",
  "Avoiding thinking about it",
];

// The multi-select limit ("Choose up to three").
export const FEELINGS_MAX = 3;

// The allowlist the APIs write against — anything outside it is dropped on save.
// Derived from FEELINGS_OPTIONS so it can never fall out of step with what the
// forms offer.
export const FEELINGS_SET: ReadonlySet<string> = new Set(FEELINGS_OPTIONS);

// The exact heading both surveys show above the feelings question.
export const FEELINGS_QUESTION = "How do you feel about your retirement right now?";

// "How confident do you feel in your plans for retirement?" — a 1–5 scale where
// 5 is the good end, carrying these exact end labels on both surveys. Stored as
// an int in both the baseline_survey and post_completion_survey tables, so the
// two numbers mean the same thing and can be subtracted.
export const CONFIDENCE_MIN = 1;
export const CONFIDENCE_MAX = 5;
export const CONFIDENCE_LOW_LABEL = "Not at all confident";
export const CONFIDENCE_HIGH_LABEL = "Very confident";
export const CONFIDENCE_QUESTION =
  "How confident do you feel in your plans for retirement?";
