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
  ValueDefinitionsResult,
  MirrorCardsResult,
  TradeOffsResult,
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

// Optional per-goal detail revealed in the expandable card. Only the fields the
// member actually filled in are present.
export type GoalDetail = {
  area?: string;
  note?: string;
  cadence?: string;
  season?: string;
  looksLike?: string;
  ordinaryWeek?: string;
};
export type GoalEntry = { label: string; both: boolean; detail?: GoalDetail };
export type ValueEntry = {
  label: string;
  both: boolean;
  description?: string;
  nonNegotiable?: boolean;
};
export type StrengthEntry = { label: string; both: boolean; note?: string };

export type ComparisonAssembly = {
  partners: { a: PartnerMeta; b: PartnerMeta };
  shared: { a: ParticipantShared; b: ParticipantShared };
  deterministic: {
    goals: { a: GoalEntry[]; b: GoalEntry[] };
    values: { a: ValueEntry[]; b: ValueEntry[] };
    strengths: { a: StrengthEntry[]; b: StrengthEntry[] };
    hopes: { slot: "a" | "b"; text: string }[];
    fears: { slot: "a" | "b"; text: string }[];
    principles: { slot: "a" | "b"; text: string }[];
  };
};

// Everything one participant shared, in richer form than ParticipantShared:
// carries the detail (descriptions/notes) the expandable view reveals. The
// generation only ever sees the labels via `base`.
type RichShared = {
  base: ParticipantShared;
  goals: { label: string; detail?: GoalDetail }[];
  values: { label: string; description?: string; nonNegotiable?: boolean }[];
  strengths: { label: string; note?: string }[];
  principles: string[];
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
): RichShared {
  const set = new Set(sharedRefs);
  const items = deriveShareableItems(data, []);

  const rs = retirementStage(data);
  const week = result<WeekShapeResult>(data, "4.6", "week-shape");
  const day = result<DayBuilderResult>(data, "1.day", "day-builder");
  const readiness = result<ReadinessSnapshotResult>(data, "4.1", "readiness-snapshot");
  const balanced = result<BalancedGoalsResult>(data, "4.3", "balanced-goals");
  const firstYear = result<FirstYearResult>(data, "4.7", "first-year");
  const valueDefs = result<ValueDefinitionsResult>(data, "3.4", "value-definitions");
  const mirror = result<MirrorCardsResult>(data, "3.1", "mirror-cards");
  const tradeOffs = result<TradeOffsResult>(data, "4.5", "trade-offs");

  // Detail lookups, keyed by normalised label.
  const goalDetail = new Map<string, GoalDetail>();
  for (const g of balanced?.goals ?? []) {
    // Area is always present, so every goal has at least that to reveal — the
    // expand affordance is then consistent across all goals.
    const d: GoalDetail = {
      ...(g.area?.trim() ? { area: g.area.trim() } : {}),
      ...(g.note ? { note: g.note } : {}),
      ...(g.cadence ? { cadence: g.cadence } : {}),
      ...(g.season ? { season: g.season } : {}),
      ...(g.looksLike ? { looksLike: g.looksLike } : {}),
      ...(g.ordinaryWeek ? { ordinaryWeek: g.ordinaryWeek } : {}),
    };
    if (Object.keys(d).length) goalDetail.set(norm(g.label), d);
  }
  const valueDesc = new Map<string, string>();
  for (const v of valueDefs?.values ?? []) {
    if (v.description?.trim()) valueDesc.set(norm(v.value), v.description.trim());
  }
  const nonNegotiable = new Set<string>();
  for (const v of tradeOffs?.values ?? []) {
    if (v.bucket === "non-negotiable") nonNegotiable.add(norm(v.value));
  }
  const strengthNote = new Map<string, string>();
  for (const s of mirror?.kept ?? []) {
    if (s.note?.trim()) strengthNote.set(norm(s.label), s.note.trim());
  }

  const goals = items
    .filter((i) => i.ref.startsWith("goal:") && set.has(i.ref))
    .map((i) => ({ label: i.label, detail: goalDetail.get(norm(i.label)) }));
  const values = items
    .filter((i) => i.group === "values" && set.has(i.ref))
    .map((i) => ({
      label: i.label,
      description: valueDesc.get(norm(i.label)),
      nonNegotiable: nonNegotiable.has(norm(i.label)) || undefined,
    }));
  const strengths = items
    .filter((i) => i.group === "strengths" && set.has(i.ref))
    .map((i) => ({ label: i.label, note: strengthNote.get(norm(i.label)) }));
  const principles = items
    .filter((i) => i.group === "principles" && set.has(i.ref))
    .map((i) => i.label);
  const hopeItem = items.find((i) => i.ref === "hope:main" && set.has(i.ref));
  const fears = items
    .filter((i) => i.group === "fears" && set.has(i.ref))
    .map((i) => i.label);

  const base: ParticipantShared = {
    slot,
    name,
    cohort: cohortLabel(rs),
    planName: planNameFor(rs),
    // Carry each goal's season into the generation input (not the deterministic
    // view) so Vita can speak to timing without a dedicated seasons section.
    goals: goals.map((g) =>
      g.detail?.season ? `${g.label} (season: ${g.detail.season})` : g.label
    ),
    values: values.map((v) => v.label),
    nonNegotiables: values.filter((v) => v.nonNegotiable).map((v) => v.label),
    strengths: strengths.map((s) => s.label),
    hope: hopeItem ? hopeItem.label : null,
    fears,
    rhythm: set.has("plan:rhythm") ? rhythmSummary(week, day) : null,
    travel: set.has("plan:travel") ? travelSummary(balanced, firstYear) : null,
    leavingWork: set.has("plan:leaving-work")
      ? leavingWorkSummary(readiness)
      : null,
    principles,
  };

  return { base, goals, values, strengths, principles };
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

  // "both" marking: a labelled item is shared-in-common when the same label is
  // in the other partner's shared set (case-insensitive).
  const labelSet = (arr: { label: string }[]) => new Set(arr.map((x) => norm(x.label)));
  const inB = labelSet(b.goals);
  const inA = labelSet(a.goals);
  const goalsA: GoalEntry[] = a.goals.map((g) => ({
    label: g.label,
    both: inB.has(norm(g.label)),
    ...(g.detail ? { detail: g.detail } : {}),
  }));
  const goalsB: GoalEntry[] = b.goals.map((g) => ({
    label: g.label,
    both: inA.has(norm(g.label)),
    ...(g.detail ? { detail: g.detail } : {}),
  }));

  const vInB = labelSet(b.values);
  const vInA = labelSet(a.values);
  const valueEntry = (
    v: RichShared["values"][number],
    otherSet: Set<string>
  ): ValueEntry => ({
    label: v.label,
    both: otherSet.has(norm(v.label)),
    ...(v.description ? { description: v.description } : {}),
    ...(v.nonNegotiable ? { nonNegotiable: true } : {}),
  });
  const valuesA = a.values.map((v) => valueEntry(v, vInB));
  const valuesB = b.values.map((v) => valueEntry(v, vInA));

  const sInB = labelSet(b.strengths);
  const sInA = labelSet(a.strengths);
  const strengthEntry = (
    s: RichShared["strengths"][number],
    otherSet: Set<string>
  ): StrengthEntry => ({
    label: s.label,
    both: otherSet.has(norm(s.label)),
    ...(s.note ? { note: s.note } : {}),
  });
  const strengthsA = a.strengths.map((s) => strengthEntry(s, sInB));
  const strengthsB = b.strengths.map((s) => strengthEntry(s, sInA));

  const hopes: { slot: "a" | "b"; text: string }[] = [];
  if (a.base.hope) hopes.push({ slot: "a", text: a.base.hope });
  if (b.base.hope) hopes.push({ slot: "b", text: b.base.hope });

  const fears: { slot: "a" | "b"; text: string }[] = [
    ...a.base.fears.map((text) => ({ slot: "a" as const, text })),
    ...b.base.fears.map((text) => ({ slot: "b" as const, text })),
  ];
  const principles: { slot: "a" | "b"; text: string }[] = [
    ...a.principles.map((text) => ({ slot: "a" as const, text })),
    ...b.principles.map((text) => ({ slot: "b" as const, text })),
  ];

  return {
    partners: {
      a: { slot: "a", name: a.base.name, cohort: a.base.cohort, planName: a.base.planName },
      b: { slot: "b", name: b.base.name, cohort: b.base.cohort, planName: b.base.planName },
    },
    shared: { a: a.base, b: b.base },
    deterministic: {
      goals: { a: goalsA, b: goalsB },
      values: { a: valuesA, b: valuesB },
      strengths: { a: strengthsA, b: strengthsB },
      hopes,
      fears,
      principles,
    },
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
