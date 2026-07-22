// Pure domain helpers for the "Plan with your partner" module (5.1). No DB, no
// React — safe to import from a route, a server component, or a client one.

import type { RetirementStage } from "@/lib/userData";

// The pair is stored unordered: canonicalise to (lo, hi) by string order so
// (A,B) and (B,A) are the same pairing. DB writes normalise through this.
export function orderPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

// The two cohorts who are reshaping a retirement they're already in. Mirrors
// isRetired() in lib/modules.ts, kept local so this file has no cycle back to it.
function isRetiredStage(rs: RetirementStage | null): boolean {
  return rs === "recently_retired" || rs === "established";
}

// The human cohort label shown on a partner's card, e.g. "Winding down". This is
// the couples-view wording; it's deliberately its own small map rather than the
// onboarding option copy or the analysis CSV labels, which read wrong here.
export function cohortLabel(rs: RetirementStage | null): string {
  switch (rs) {
    case "working":
      return "Working";
    case "winding_down":
      return "Winding down";
    case "recently_retired":
      return "Recently retired";
    case "established":
      return "Established";
    default:
      return "";
  }
}

// The plan's name for a cohort, WITHOUT the "Your" prefix planTitleFor() adds —
// the partner label reads "[Name] · [Cohort] · [Plan name]". Per the pilot
// decision this maps the two retired cohorts to the Reset Plan regardless of the
// RETIREMENT_PATHS flag (the dashboard already calls it that for them), so the
// label is always truthful for the person reading it.
export function planNameFor(rs: RetirementStage | null): string {
  return isRetiredStage(rs) ? "Retirement Reset Plan" : "Retirement Life Plan";
}

// The initial shown on a partner's coloured dot in the comparison/waiting views.
export function initialFor(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : "·";
}
