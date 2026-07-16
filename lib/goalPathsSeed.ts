// Module 4.4 (goal-paths) drafting contract.
//
// For every goal the person spotlighted in 4.3, Vita drafts a PATH the person
// then curates. A do/achieve goal gets a short milestone ladder — three to five
// stepping stones from where they are now to the goal, in rough order, with the
// ones already behind them marked done. A way-of-being goal gets no ladder:
// instead a light note on what already helps it and the one or two things that
// would help it take root. One structured Claude call (/api/goal-paths) reads
// the picture built up across the earlier stages and returns one path per goal,
// in the same order. Anything that goes wrong falls back to a goal-specific
// generic path so the surface always renders.

import type { BalancedGoalsResult, GoalPathsResult } from "@/lib/modules";
import type { RetirementStage } from "@/lib/userData";
import { fetchSeedWithRetry } from "@/lib/seedRetry";

// One stepping stone on a do/achieve ladder. `when` is an optional ROUGH sense
// of timing (never a date); `done` marks a rung already behind the person.
export type Milestone = { label: string; when?: string; done?: boolean };

// One drafted path. Mirrors a GoalPathsResult path so the surface, the seed and
// the saved result share a shape. do-goals carry `milestones`; be-goals carry
// `alreadyHelps` / `wouldHelp`. Either may carry `lean` (a strength or resource).
export type GoalPath = {
  goal: string;
  track: "do" | "be";
  milestones?: Milestone[];
  alreadyHelps?: string[];
  wouldHelp?: string[];
  // The person's OWN named strengths (from their Stage-3 strengths list) that most
  // apply to this goal — surfaced verbatim, never invented. Replaces the old prose
  // `lean` line; `lean` is kept only for reading back older saved paths.
  strengths?: string[];
  lean?: string;
};

export type GoalPathsSeed = { paths: GoalPath[] };

// One spotlighted goal, as the draft sees it. Pulled from the 4.3 result.
export type GoalPathInput = {
  goal: string;
  track: "do" | "be";
  // Where it sits and what it means to them — context for a personal path.
  area?: string;
  note?: string;
  season?: string;
};

// The picture the draft is built from. Assembled by the caller.
export type GoalPathsDraftInput = {
  userModel: string;
  onboarding: string;
  hasPartner: boolean;
  // Where they are with work and retirement, or null when uncaptured. Carried on
  // the same rail as hasPartner for later phases; nothing branches on it yet.
  retirementStage: RetirementStage | null;
  goals: GoalPathInput[];
  // The person's named strengths (their Stage-3 strengths list). The model picks the
  // few that fit each goal, verbatim — it never invents a strength.
  strengths: string[];
};

// Pull the spotlighted goals out of the 4.3 result, in the order the person
// ranked them. These are the goals 4.4 draws a path for — one each, no cap.
export function spotlightGoalInputs(
  prior: BalancedGoalsResult | null
): GoalPathInput[] {
  if (!prior || !Array.isArray(prior.goals)) return [];
  return prior.goals
    .filter((g) => g.focus && typeof g.label === "string" && g.label.trim())
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((g) => ({
      goal: g.label.trim(),
      track: g.track === "be" ? "be" : "do",
      ...(g.area ? { area: String(g.area) } : {}),
      ...(g.note ? { note: g.note } : {}),
      ...(g.season ? { season: g.season } : {}),
    }));
}

// Call the drafting route. Returns the drafted seed, or null on any failure so
// the caller can fall back. Shared so the surface and an earlier prefetch (run
// while the person reads the intro) use exactly the same request.
export async function fetchGoalPathsDraft(
  input: GoalPathsDraftInput
): Promise<GoalPathsSeed | null> {
  return fetchSeedWithRetry<GoalPathsSeed>(
    "/api/goal-paths",
    input,
    (s) => s.paths.length > 0
  );
}

// ---- Fallback (generic, never empty) ----
// Only used when the model call fails entirely. Builds a modest, goal-specific
// path for each spotlighted goal so it reads as a reasonable starting point the
// person edits, never a dead end. do-goals get a generic four-rung ladder;
// be-goals get a light support note.
export function fallbackGoalPaths(goals: GoalPathInput[]): GoalPathsSeed {
  const source = goals.length
    ? goals
    : [{ goal: "Your most important goal", track: "do" as const }];

  const paths: GoalPath[] = source.map((g) => {
    if (g.track === "be") {
      return {
        goal: g.goal,
        track: "be",
        alreadyHelps: [
          "The people already close to you",
          "The ordinary moments where it shows up now",
        ],
        wouldHelp: ["A little more room in the week for it"],
      };
    }
    return {
      goal: g.goal,
      track: "do",
      milestones: [
        { label: "Get clear on what the first version looks like", done: false },
        { label: "Try a small, low-stakes first go", when: "early on", done: false },
        { label: "Build it up as it starts to feel natural", done: false },
        { label: "Make it real and go", when: "down the line", done: false },
      ],
    };
  });

  return { paths };
}

// ---- Coercion ----
// Clean one stepping stone, or null if it has no usable label.
function coerceMilestone(raw: unknown): Milestone | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;
  const when = typeof o.when === "string" ? o.when.trim() : "";
  return {
    label,
    ...(when ? { when } : {}),
    done: o.done === true,
  };
}

// Clean a list of short strings into a capped, trimmed array.
function coerceStrings(raw: unknown, cap: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = typeof item === "string" ? item.trim() : "";
    if (s) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

// Keep only the strengths the model returned that MATCH one of the person's own
// named strengths (case-insensitive), in the list's canonical casing — so a path
// never shows an invented strength. De-duplicated, capped.
function coerceStrengths(raw: unknown, allowed: string[], cap = 3): string[] {
  if (!Array.isArray(raw) || !allowed.length) return [];
  const canon = new Map<string, string>();
  for (const a of allowed) {
    const k = a.trim().toLowerCase();
    if (k && !canon.has(k)) canon.set(k, a.trim());
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const k = typeof item === "string" ? item.trim().toLowerCase() : "";
    if (!k || seen.has(k)) continue;
    const c = canon.get(k);
    if (c) {
      seen.add(k);
      out.push(c);
    }
    if (out.length >= cap) break;
  }
  return out;
}

// Validate and clean whatever the model returned into the seed shape. Driven by
// the INPUT goals so there's exactly one path per spotlighted goal, in order,
// with the track taken authoritatively from 4.3 — the model only supplies the
// path content. Any goal the model skipped or returned unusably falls back to a
// goal-specific generic path, so the surface always has one path per goal.
export function coerceGoalPaths(
  raw: unknown,
  goals: GoalPathInput[],
  strengthsList: string[] = []
): GoalPathsSeed {
  const fallback = fallbackGoalPaths(goals);
  if (!goals.length) return fallback;

  const arr =
    raw && typeof raw === "object"
      ? (raw as { paths?: unknown }).paths
      : undefined;
  const drafted = Array.isArray(arr) ? arr : [];

  // Match drafted paths to input goals by goal label (case-insensitive), so
  // order and track stay anchored to 4.3 regardless of what the model returned.
  const byGoal = new Map<string, Record<string, unknown>>();
  for (const item of drafted) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.goal === "string" ? o.goal.trim().toLowerCase() : "";
    if (key && !byGoal.has(key)) byGoal.set(key, o);
  }

  const paths: GoalPath[] = goals.map((g, i) => {
    const match = byGoal.get(g.goal.toLowerCase());
    const fb = fallback.paths[i];

    const strengths = match ? coerceStrengths(match.strengths, strengthsList) : [];

    if (g.track === "be") {
      const alreadyHelps = match ? coerceStrings(match.alreadyHelps, 4) : [];
      const wouldHelp = match ? coerceStrings(match.wouldHelp, 3) : [];
      if (!alreadyHelps.length && !wouldHelp.length) {
        return { ...fb, ...(strengths.length ? { strengths } : {}) };
      }
      return {
        goal: g.goal,
        track: "be",
        alreadyHelps,
        wouldHelp,
        ...(strengths.length ? { strengths } : {}),
      };
    }

    const milestones: Milestone[] = [];
    if (match && Array.isArray(match.milestones)) {
      for (const m of match.milestones) {
        const cleaned = coerceMilestone(m);
        if (cleaned) milestones.push(cleaned);
        if (milestones.length >= 5) break;
      }
    }
    if (!milestones.length) {
      return { ...fb, ...(strengths.length ? { strengths } : {}) };
    }
    return {
      goal: g.goal,
      track: "do",
      milestones,
      ...(strengths.length ? { strengths } : {}),
    };
  });

  return { paths };
}

// Shape a saved result back into a seed (for re-opening the editor). The result
// path shape already matches GoalPath, so this is a straight pass-through with a
// guard.
export function seedFromResult(result: GoalPathsResult | null): GoalPathsSeed {
  if (!result || !Array.isArray(result.paths)) return { paths: [] };
  return { paths: result.paths };
}
