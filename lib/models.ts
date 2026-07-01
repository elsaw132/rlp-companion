// Central model routing for the app's Claude calls.
//
// Policy (see findings/cost-investigation-result.md → recommendation R2):
// - SONNET runs the member-visible prose: Vita's conversation (/api/chat, via
//   COACH_MODEL in lib/chatPrompt.ts), the plan prose (/api/plan-intro), and the
//   Stage-4 draft seeds (balanced-goals, goal-paths, trade-offs, week-shape,
//   first-year) — those produce drafts the member reads, so they stay on Sonnet
//   until a separate quality test clears a move.
// - HAIKU runs the mechanical calls: summarisation, extraction, and candidate
//   generation against fixed lists (takeaways, the Stage-3 seeds, the stage
//   reveals, stage3-values, dreams, and the letter helpers). Haiku is ~3× cheaper
//   in and out with no user-visible quality loss on this kind of work.
//
// To move a route between tiers, change the model constant it imports here —
// there's nothing else to touch.
export const SONNET_MODEL = "claude-sonnet-4-6";
export const HAIKU_MODEL = "claude-haiku-4-5";
