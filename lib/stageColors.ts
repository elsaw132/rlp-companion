// Central Chorus stage-colour mapping — one source of truth so components never
// re-declare per-stage colour logic. Every stage-level surface uses the same
// refined treatment: a LIGHT tint fill of the stage colour, with a crisp solid
// mark (outline, number circle, tick, progress bar, ring) on top — never a heavy
// solid block. Values are semantic CSS tokens (see app/tokens.css); only the eight
// exact Chorus brand colours are used.

export const stageColors = {
  imagine: "var(--color-stage-imagine)",
  explore: "var(--color-stage-explore)",
  understand: "var(--color-stage-understand)",
  plan: "var(--color-stage-plan)",
  act: "var(--color-stage-act)",
} as const;

// The solid MARK colour for each stage (outline, number circle, tick, bar, ring).
// Plan and Act use their own saturated brand colour; the three pale stages use
// Chorus Dark Green — the partner the brand book pairs with the lighter colours —
// because blue/yellow/pink are too pale to read as marks against white. White text
// sits on every mark.
const stageMarks = {
  imagine: "var(--chorus-dark-green)",
  explore: "var(--chorus-dark-green)",
  understand: "var(--chorus-dark-green)",
  plan: "var(--color-stage-plan)",
  act: "var(--color-stage-act)",
} as const;

// The light tint FILL each stage uses for its selected row / completion panel /
// tiles — a pale wash of the stage's own colour, never a solid block. The pale
// stages need a higher percentage of themselves than the saturated Plan/Act to
// reach a comparable, gentle visual weight. All are tints of the exact brand
// colours — no new hex.
const stageWashes = {
  imagine: "color-mix(in srgb, var(--color-stage-imagine) 42%, #fff)",
  explore: "color-mix(in srgb, var(--color-stage-explore) 42%, #fff)",
  understand: "color-mix(in srgb, var(--color-stage-understand) 55%, #fff)",
  plan: "color-mix(in srgb, var(--color-stage-plan) 11%, #fff)",
  act: "color-mix(in srgb, var(--color-stage-act) 11%, #fff)",
} as const;

// Stages are addressed by their 1–5 number across the app (see STAGES in
// lib/modules.ts); this maps that number to the colour keys above.
const STAGE_KEYS = ["imagine", "explore", "understand", "plan", "act"] as const;

export function stageColorFor(stageNumber: number): string {
  const key = STAGE_KEYS[stageNumber - 1];
  return key ? stageColors[key] : "var(--brand-primary)";
}

export function stageMarkFor(stageNumber: number): string {
  const key = STAGE_KEYS[stageNumber - 1];
  return key ? stageMarks[key] : "var(--brand-primary)";
}

export function stageWashFor(stageNumber: number): string {
  const key = STAGE_KEYS[stageNumber - 1];
  return key ? stageWashes[key] : "color-mix(in srgb, var(--brand-primary) 10%, #fff)";
}
