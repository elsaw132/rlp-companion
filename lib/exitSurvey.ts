// The exit survey's fixed option lists and free-text caps, in one place so the
// public page (which renders them) and the /api/exit-survey route (which
// allowlist-validates them) can never drift apart — the same reason
// lib/moduleFeedback.ts exists for the per-session card. An option missing from
// a list here is silently dropped by the route rather than stored.
//
// The stored value for a choice is its exact label text, so the admin portal is
// readable without a code lookup. "Something else" / "Other" options keep their
// label AND carry the person's free text in a matching *_other field.

// Q1 — which best describes your situation? (single choice)
export const SITUATION_OPTIONS = [
  "I never started the programme.",
  "I started but stopped after the first session.",
  "I completed some sessions but won't be continuing.",
  "Something else (please tell us).",
] as const;
// The single option that reveals — and needs — a free-text follow-up.
export const SITUATION_OTHER = "Something else (please tell us).";

// Q2 — main reason you weren't able to continue? (multi-select)
export const REASON_OPTIONS = [
  "I simply didn't have enough time.",
  "Other things became a higher priority.",
  "I forgot to come back to it.",
  "I found the programme longer than I expected.",
  "I wasn't sure it was right for me.",
  "I experienced technical difficulties.",
  "I wasn't motivated to continue.",
  "Other (please tell us).",
] as const;
export const REASON_OTHER = "Other (please tell us).";

// Q3 — which statement feels closest to the truth? (single choice)
export const LOOKING_BACK_OPTIONS = [
  "The timing wasn't right, but I'd like to try again later.",
  "I liked the idea but couldn't fit it into my life.",
  "I wasn't quite sure what I would gain from completing it.",
  "I realised it wasn't really for me.",
  "Something else.",
] as const;
export const LOOKING_BACK_OTHER = "Something else.";

// Q7 — would you be interested in hearing from us again? (single choice)
export const RECONTACT_OPTIONS = [
  "Yes, when the programme develops further.",
  "Yes, if a shorter version becomes available.",
  "Yes, when the final version launches.",
  "Yes, because I am interested in what you're trying to build at Chorus Life.",
  "No thanks.",
] as const;

// Demographics — kept in step with the onboarding questionnaire so the two
// cohorts (who stayed vs who left) are comparable.
export const GENDER_OPTIONS = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer to self-describe",
  "Prefer not to say",
] as const;
export const GENDER_SELF_DESCRIBE = "Prefer to self-describe";

// Same labels as onboarding's STATUS_OPTIONS. Stored as the label (not the
// internal code) so the admin portal reads plainly.
export const WORK_STATUS_OPTIONS = [
  "Still working, planning ahead",
  "Winding down / phasing out of work",
  "Retired in the last 2 years",
  "Retired more than 2 years ago",
] as const;

// Free-text limits. Generous enough that no one is cut off mid-thought, capped
// so a single field can't be used to dump unbounded data into the table.
export const SHORT_TEXT_MAX = 300; // the "please tell us" follow-ups
export const LONG_TEXT_MAX = 2000; // Q5 "what would have made it easier", Q6 "why"
export const EMAIL_MAX = 200;

// The 1–5 clarity scale (Q4) and 0–10 NPS scale (Q6).
export const CLARITY_MIN = 1;
export const CLARITY_MAX = 5;
export const NPS_MIN = 0;
export const NPS_MAX = 10;

// Plausible human ages; anything outside is treated as a mistype and dropped.
export const AGE_MIN = 16;
export const AGE_MAX = 120;
