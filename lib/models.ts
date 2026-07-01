// Central model routing for the app's Claude calls.
//
// Policy (see findings/cost-investigation-result.md → recommendation R2):
// - SONNET runs the member-visible prose: Vita's conversation (/api/chat, via
//   COACH_MODEL in lib/chatPrompt.ts), the plan prose (/api/plan-intro), the
//   Stage-4 draft seeds (balanced-goals, goal-paths, trade-offs, week-shape,
//   first-year), and /api/takeaway. Takeaway also extracts the context-profile
//   fact deltas (additions/removals) in the same call: at its 300-token cap
//   Haiku writes a longer summary, runs out of budget, and truncates that JSON —
//   the route then silently drops ALL facts. Verified in a Haiku-vs-Sonnet A/B
//   (Sonnet fit every time; Haiku only held up at ~700 tokens). The context
//   profile is the highest-stakes path, so takeaway stays on Sonnet.
// - HAIKU runs the other mechanical calls: summarisation and candidate
//   generation against fixed lists (the Stage-3 seeds, the stage reveals,
//   stage3-values, dreams, and the letter helpers). Haiku is ~3× cheaper in and
//   out with no user-visible quality loss on this kind of work.
//
// To move a route between tiers, change the model constant it imports here —
// there's nothing else to touch.
export const SONNET_MODEL = "claude-sonnet-4-6";
export const HAIKU_MODEL = "claude-haiku-4-5";
