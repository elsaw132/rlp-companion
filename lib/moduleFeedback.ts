// The shape of the per-session feedback card, in one place.
//
// The card (client), the route that validates it (server) and the admin portal
// that reads it back all have to agree on the scale and the allowed answers.
// When those definitions live in three files they drift, and the failure is
// silent: an answer the form offers but the server's allowlist doesn't know is
// simply dropped on save, and a rating read back on the wrong scale is averaged
// into nonsense. So they are defined here once and imported everywhere.
//
// No "server-only" marker: this is plain data, and the card needs it in the
// browser.

// The rating scale, 1–5. The pilot survey asks for 1–5 on both rating
// questions, and 5 is always the good end.
export const RATING_MIN = 1;
export const RATING_MAX = 5;

// Every valid rating, as the strings actually stored ("1".."5"). null means the
// question was skipped.
export const RATINGS: string[] = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => String(RATING_MIN + i)
);

export function isRating(v: unknown): v is string {
  return typeof v === "string" && RATINGS.includes(v);
}

// "Did everything work correctly?" — stored as the answer itself rather than a
// boolean, so a skipped question stays distinguishable from a "no" (null vs
// "no"), which matters: "nobody answered" and "it broke" are very different.
export type Worked = "yes" | "no";

export function isWorked(v: unknown): v is Worked {
  return v === "yes" || v === "no";
}

// Free-text caps. Generous enough to describe a bug or a thought, bounded so a
// single submission can't be unreasonable.
export const ISSUE_MAX_CHARS = 1000;
export const COMMENT_MAX_CHARS = 2000;
