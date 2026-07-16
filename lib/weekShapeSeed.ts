// Module 4.6 ("The rhythm of your week") drafting contract.
//
// Vita reads back the person's REAL recurring activities — drawn from everything
// they've said across the programme, including the actual conversations with Vita
// (a regular badminton night, a weekly swim, Sunday dinner with the family) — and
// lays them out as the rhythm of an ordinary week. Each activity carries only what
// someone can honestly answer years ahead: a rough frequency, whether it's a
// regular anchor or stays loose, and whether it gives them energy. No day of the
// week, no time of day — that precision is false this far out. The person sets the
// overall structure-to-freedom feel (pre-set to where they landed in Stage 1),
// adjusts the activities, and adds or removes anything. One structured Claude call
// (/api/week-shape) returns the activities and a suggested feel. Anything that goes
// wrong falls back to a grounded generic rhythm so the surface always renders.

import type {
  BalancedGoalsResult,
  ReadinessSnapshotResult,
} from "@/lib/modules";
import type { RetirementStage } from "@/lib/userData";
import { fetchSeedWithRetry } from "@/lib/seedRetry";

// The rough frequencies — the grain people can answer this far out. These strings
// are exactly what the result stores and what the component renders as options.
export const FREQUENCIES = [
  "Most days",
  "A few times a week",
  "Weekly",
  "Now and then",
] as const;

// One drafted activity — a real, recurring thing in the person's week. The person
// sets the frequency, whether it's a fixed anchor, and the energy tag on the
// surface (the draft's suggestions seed those).
export type WeekActivitySeed = {
  label: string;
  category?: string;
  frequency: string;
  // A regular anchor the week is built around (vs something that stays loose).
  anchor?: boolean;
  energy?: boolean;
  // An ongoing-work commitment they plan around (only when phasing out of work).
  fixed?: boolean;
};

export type WeekShapeSeed = {
  // Suggested overall feel, 0 (highly structured) – 100 (largely open).
  structure: number;
  activities: WeekActivitySeed[];
};

// One goal, as the draft sees it — extra grounding for the activities. The area
// label and focus flag let the draft cover the full balance of a retirement.
export type WeekShapeGoal = {
  goal: string;
  track: "do" | "be";
  area?: string;
  focus?: boolean;
  season?: string;
  note?: string;
};

// The work-transition shape from 4.1. Used only to decide whether ongoing work
// belongs in the week as a fixed anchor the person plans around.
export type TransitionShape = {
  lean: "clean-break" | "gradual";
  shape?: string;
  period?: string;
};

// One real recurring activity, from the structured recurring_activity facts —
// the source of truth for the week, replacing the old transcript scrape.
export type RecurringActivityInput = { label: string; domain: string | null };

// The picture the draft is built from. Assembled by the caller.
export type WeekShapeDraftInput = {
  userModel: string;
  onboarding: string;
  hasPartner: boolean;
  // Where they are with work and retirement, or null when uncaptured. Carried on
  // the same rail as hasPartner for later phases; nothing branches on it yet.
  retirementStage: RetirementStage | null;
  goals: WeekShapeGoal[];
  transition: TransitionShape | null;
  // The person's real, recurring activities — drawn from structured
  // recurring_activity facts (the canonical profile), not a transcript scrape.
  recurring: RecurringActivityInput[];
};

// ---- Pull the inputs out of the earlier modules' saved results ----

// All the goals the person named across the balanced areas in 4.3, each carrying
// its area label so the week can cover the full balance of a retirement. The ones
// they spotlighted are flagged and sorted first, but none are dropped.
export function weekShapeGoalInputs(
  prior: BalancedGoalsResult | null
): WeekShapeGoal[] {
  if (!prior || !Array.isArray(prior.goals)) return [];
  const areaLabel = new Map<string, string>();
  if (Array.isArray(prior.areas)) {
    for (const a of prior.areas) {
      if (a && typeof a.id === "string" && typeof a.label === "string") {
        areaLabel.set(a.id, a.label.trim());
      }
    }
  }
  const usable = prior.goals.filter(
    (g) => typeof g.label === "string" && g.label.trim()
  );
  return usable
    .sort((a, b) => {
      const fa = a.focus ? 0 : 1;
      const fb = b.focus ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (a.rank ?? 99) - (b.rank ?? 99);
    })
    .map((g) => {
      const label = g.area ? areaLabel.get(g.area) : "";
      return {
        goal: g.label.trim(),
        track: g.track === "be" ? "be" : "do",
        ...(label ? { area: label } : {}),
        ...(g.focus ? { focus: true } : {}),
        ...(g.season ? { season: g.season } : {}),
        ...(g.note ? { note: g.note } : {}),
      };
    });
}

// The work-transition shape from 4.1's readiness snapshot, or null.
export function transitionShape(
  prior: ReadinessSnapshotResult | null
): TransitionShape | null {
  if (!prior || !prior.transition) return null;
  const t = prior.transition;
  const lean = t.lean === "gradual" ? "gradual" : "clean-break";
  return {
    lean,
    ...(t.shape ? { shape: t.shape } : {}),
    ...(t.period ? { period: t.period } : {}),
  };
}

// Call the drafting route. Returns the drafted seed, or null on any failure so
// the caller can fall back.
export async function fetchWeekShapeDraft(
  input: WeekShapeDraftInput
): Promise<WeekShapeSeed | null> {
  return fetchSeedWithRetry<WeekShapeSeed>(
    "/api/week-shape",
    input,
    (s) => s.activities.length > 0
  );
}

// ---- Fallback (grounded where it can be, never empty) ----
// Only used when the model call fails entirely. Builds a reasonable ordinary
// rhythm from whatever inputs exist, so the surface reads as a sensible starting
// point the person shapes, never a dead end.
export function fallbackWeekShape(input: WeekShapeDraftInput): WeekShapeSeed {
  const activities: WeekActivitySeed[] = [];

  // A few universal threads of an ordinary week.
  activities.push(
    {
      label: "A regular walk or bit of movement",
      category: "movement",
      frequency: "Most days",
      anchor: true,
      energy: true,
    },
    {
      label: "Time with the people close to you",
      category: "people",
      frequency: "Weekly",
      anchor: true,
      energy: true,
    },
    {
      label: "A slower, unplanned stretch",
      category: "rest",
      frequency: "Most days",
    }
  );

  // Turn a few goals into activities so the rhythm feels theirs and spans areas.
  for (const g of (input.goals ?? []).slice(0, 5)) {
    activities.push({
      label: g.goal,
      category: g.track === "be" ? "way of living" : "goal",
      frequency: "Weekly",
      energy: true,
    });
  }

  // If they're phasing out of work, the week is planned around it.
  if (input.transition?.lean === "gradual") {
    activities.push({
      label: "Ongoing work",
      category: "work",
      frequency: "A few times a week",
      anchor: true,
      fixed: true,
    });
  }

  return { structure: 50, activities };
}

// ---- Coercion ----
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Normalise whatever the model wrote for the frequency into a canonical value.
function normalizeFrequency(raw: unknown): string {
  const low = str(raw).toLowerCase();
  if (!low) return "Weekly";
  if (low.includes("most") || low.includes("daily") || low.includes("every day"))
    return "Most days";
  if (
    low.includes("few") ||
    low.includes("couple") ||
    low.includes("twice") ||
    low.includes("two or three") ||
    low.includes("2-3") ||
    low.includes("several times")
  )
    return "A few times a week";
  if (
    low.includes("now and then") ||
    low.includes("occasional") ||
    low.includes("sometimes") ||
    low.includes("month") ||
    low.includes("rare") ||
    low.includes("once in a while")
  )
    return "Now and then";
  if (low.includes("week")) return "Weekly";
  return "Weekly";
}

function clampStructure(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function coerceActivity(raw: unknown): WeekActivitySeed | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = str(o.label);
  if (!label) return null;
  return {
    label,
    ...(str(o.category) ? { category: str(o.category) } : {}),
    frequency: normalizeFrequency(o.frequency),
    ...(o.anchor === true ? { anchor: true } : {}),
    ...(o.energy === true ? { energy: true } : {}),
    ...(o.fixed === true ? { fixed: true } : {}),
  };
}

// Validate and clean whatever the model returned into the seed shape. The model
// supplies the activities and a suggested feel; anything missing falls back to
// the grounded generic rhythm. Activities sharing a label are de-duplicated so an
// activity never appears more than once.
export function coerceWeekShape(
  raw: unknown,
  input: WeekShapeDraftInput
): WeekShapeSeed {
  const fb = fallbackWeekShape(input);
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const activities: WeekActivitySeed[] = [];
  const byLabel = new Map<string, WeekActivitySeed>();
  if (Array.isArray(obj.activities)) {
    for (const a of obj.activities) {
      const cleaned = coerceActivity(a);
      if (!cleaned) continue;
      const key = cleaned.label.toLowerCase();
      const existing = byLabel.get(key);
      if (existing) {
        // Fold any stronger tags into the one already kept.
        if (cleaned.anchor) existing.anchor = true;
        if (cleaned.energy) existing.energy = true;
        if (cleaned.fixed) existing.fixed = true;
        continue;
      }
      byLabel.set(key, cleaned);
      activities.push(cleaned);
      if (activities.length >= 16) break;
    }
  }

  return {
    structure: obj.structure === undefined ? 50 : clampStructure(obj.structure),
    activities: activities.length ? activities : fb.activities,
  };
}
