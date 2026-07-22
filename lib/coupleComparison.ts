// Assembles a couple's comparison from both participants' SHARED-ONLY data. It
// produces three things from the same filtered inputs, so they can never
// disagree: the partner labels, the deterministic goals/hopes/fears lists (what
// the view renders directly), and the ParticipantShared blocks + input hash that
// drive the Vita generation. Nothing a participant didn't share ever reaches any
// of these.
//
// Not React, but reads only the passed-in data maps (a partner's data map comes
// from getAllUserData(partnerId) behind the pairing authorization check).

import type {
  BalancedGoalsResult,
  WeekShapeResult,
  DayBuilderResult,
  ReadinessSnapshotResult,
  FirstYearResult,
} from "@/lib/modules";
import type { RetirementStage } from "@/lib/userData";
import { cohortLabel, planNameFor } from "@/lib/couples";
import { deriveShareableItems } from "@/lib/coupleShare";
import {
  type ParticipantShared,
  PROMPT_VERSION,
} from "@/lib/comparisonPrompt";

export type PartnerMeta = {
  slot: "a" | "b";
  name: string;
  cohort: string;
  planName: string;
};

export type GoalEntry = { label: string; both: boolean };

export type ComparisonAssembly = {
  partners: { a: PartnerMeta; b: PartnerMeta };
  shared: { a: ParticipantShared; b: ParticipantShared };
  deterministic: {
    goals: { a: GoalEntry[]; b: GoalEntry[] };
    hopes: { slot: "a" | "b"; text: string }[];
    fears: { slot: "a" | "b"; text: string }[];
  };
};

function result<T extends { type: string }>(
  data: Record<string, unknown>,
  moduleId: string,
  type: T["type"]
): T | null {
  const v = data[`interaction:${moduleId}`];
  if (v && typeof v === "object" && (v as { type?: unknown }).type === type) {
    return v as T;
  }
  return null;
}

function retirementStage(data: Record<string, unknown>): RetirementStage | null {
  const o = data["onboarding"];
  const rs =
    o && typeof o === "object"
      ? (o as { retirementStage?: unknown }).retirementStage
      : null;
  return rs === "working" ||
    rs === "winding_down" ||
    rs === "recently_retired" ||
    rs === "established"
    ? rs
    : null;
}

const TRAVEL_HINT =
  /\b(travel|trip|trips|abroad|holiday|holidays|journey|journeys|voyage|cruise)\b/i;
const norm = (s: string) => s.trim().toLowerCase();

// --- summaries (only built for shared plan facets) -------------------------

function rhythmSummary(
  week: WeekShapeResult | null,
  day: DayBuilderResult | null
): string | null {
  if (week) {
    const s = week.structure;
    const feel =
      s <= 40
        ? "likes a structured week with regular anchors"
        : s >= 60
          ? "wants an open, largely unstructured week"
          : "wants a balance of structure and openness";
    const anchors = week.activities
      .filter((a) => a.anchor)
      .map((a) => a.label)
      .slice(0, 5);
    const energy = week.activities
      .filter((a) => a.energy)
      .map((a) => a.label)
      .slice(0, 5);
    const parts = [feel];
    if (anchors.length) parts.push(`regular anchors: ${anchors.join(", ")}`);
    if (energy.length) parts.push(`gives energy: ${energy.join(", ")}`);
    return parts.join("; ");
  }
  if (day) {
    const filled = day.parts
      .filter((p) => (day.assigned[p] ?? []).length > 0)
      .join(", ");
    return filled ? `Has shaped a typical day across: ${filled}` : null;
  }
  return null;
}

function leavingWorkSummary(r: ReadinessSnapshotResult | null): string | null {
  if (!r) return null;
  const parts: string[] = [];
  parts.push(
    r.transition.lean === "gradual"
      ? "leaning toward a gradual wind-down"
      : "leaning toward a clean break"
  );
  if (r.transition.shape) parts.push(r.transition.shape);
  if (r.transition.period) parts.push(`over ${r.transition.period}`);
  if (r.window) parts.push(`window ${r.window.fromLabel}–${r.window.toLabel}`);
  // Consumer Duty: state only how settled the timing feels — never advise.
  if (r.finance?.dateKnown) parts.push(`on timing of finances: ${r.finance.dateKnown}`);
  return parts.join("; ");
}

function travelSummary(
  goals: BalancedGoalsResult | null,
  firstYear: FirstYearResult | null
): string | null {
  const labels: string[] = [];
  if (goals) {
    for (const g of goals.goals) {
      if (TRAVEL_HINT.test(g.label) || TRAVEL_HINT.test(g.area ?? "")) {
        labels.push(g.label);
      }
    }
  }
  if (firstYear) {
    for (const it of firstYear.items) {
      if (it.kind === "trip") labels.push(it.label);
    }
  }
  const uniq = Array.from(new Set(labels)).slice(0, 5);
  return uniq.length ? uniq.join("; ") : null;
}

function buildShared(
  data: Record<string, unknown>,
  sharedRefs: string[],
  name: string,
  slot: "a" | "b"
): ParticipantShared {
  const set = new Set(sharedRefs);
  const items = deriveShareableItems(data, []);

  const goals = items
    .filter((i) => i.group === "plan" && i.ref.startsWith("goal:") && set.has(i.ref))
    .map((i) => i.label);
  const hopeItem = items.find((i) => i.ref === "hope:main" && set.has(i.ref));
  const fears = items
    .filter((i) => i.group === "fears" && set.has(i.ref))
    .map((i) => i.label);

  const rs = retirementStage(data);
  const week = result<WeekShapeResult>(data, "4.6", "week-shape");
  const day = result<DayBuilderResult>(data, "1.day", "day-builder");
  const readiness = result<ReadinessSnapshotResult>(data, "4.1", "readiness-snapshot");
  const balanced = result<BalancedGoalsResult>(data, "4.3", "balanced-goals");
  const firstYear = result<FirstYearResult>(data, "4.7", "first-year");

  return {
    slot,
    name,
    cohort: cohortLabel(rs),
    planName: planNameFor(rs),
    goals,
    hope: hopeItem ? hopeItem.label : null,
    fears,
    rhythm: set.has("plan:rhythm") ? rhythmSummary(week, day) : null,
    travel: set.has("plan:travel") ? travelSummary(balanced, firstYear) : null,
    leavingWork: set.has("plan:leaving-work")
      ? leavingWorkSummary(readiness)
      : null,
  };
}

export function buildComparisonAssembly(input: {
  aData: Record<string, unknown>;
  bData: Record<string, unknown>;
  aSharedRefs: string[];
  bSharedRefs: string[];
  aName: string;
  bName: string;
}): ComparisonAssembly {
  const a = buildShared(input.aData, input.aSharedRefs, input.aName, "a");
  const b = buildShared(input.bData, input.bSharedRefs, input.bName, "b");

  const aSet = new Set(a.goals.map(norm));
  const bSet = new Set(b.goals.map(norm));
  const goalsA: GoalEntry[] = a.goals.map((label) => ({
    label,
    both: bSet.has(norm(label)),
  }));
  const goalsB: GoalEntry[] = b.goals.map((label) => ({
    label,
    both: aSet.has(norm(label)),
  }));

  const hopes: { slot: "a" | "b"; text: string }[] = [];
  if (a.hope) hopes.push({ slot: "a", text: a.hope });
  if (b.hope) hopes.push({ slot: "b", text: b.hope });

  const fears: { slot: "a" | "b"; text: string }[] = [
    ...a.fears.map((text) => ({ slot: "a" as const, text })),
    ...b.fears.map((text) => ({ slot: "b" as const, text })),
  ];

  return {
    partners: {
      a: { slot: "a", name: a.name, cohort: a.cohort, planName: a.planName },
      b: { slot: "b", name: b.name, cohort: b.cohort, planName: b.planName },
    },
    shared: { a, b },
    deterministic: { goals: { a: goalsA, b: goalsB }, hopes, fears },
  };
}

// A stable hash of everything that feeds generation: if it's unchanged, the
// cached payload is still valid. Changes when either selection or either plan's
// shared content changes, or when the prompt version bumps.
export function comparisonInputHash(a: ParticipantShared, b: ParticipantShared): string {
  const payload = JSON.stringify({ v: PROMPT_VERSION, a, b });
  // Small, dependency-free FNV-1a — this only needs to detect change, not resist
  // collisions adversarially.
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
