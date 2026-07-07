// The Retirement Life Plan — one assembled data model, rendered twice.
//
// Stage 4 is seven siloed modules. The plan is the place their outputs are read
// back as a single, calm, first-person document the member keeps and returns to.
// This file assembles ONE typed `RlpPlan` from the captured module results (plus
// the Stage 3 values and the prior-stage user model) — the same object the
// in-app document and, later, the still PDF keepsake both render. The assembly is
// deterministic: it reads what the member already curated and re-presents it, it
// never re-derives or re-asks anything.
//
// The spine is the balanced-retirement framework — five areas (Restore, Move,
// Think, Connect, Contribute). Three lenses run through it in their own lanes:
// the five areas organise the goals and the overview; the VALUES are the compass
// (the why); the SEASONS are a property of each goal (the when). The plan
// SYNTHESISES rather than replays — but synthesis comes only from the member's
// own material, kept verbatim where they chose the wording.

import {
  STAGES,
  getModule,
  isRetired,
  type BuildResult,
  type BalancedAreaId,
  type BalancedGoalsResult,
  type BalancedGoalsInteraction,
  type GoalPathsResult,
  type SeasonsBoardResult,
  type WeekShapeResult,
  type ReadinessSnapshotResult,
  type FirstYearResult,
  type FirstYearInteraction,
} from "@/lib/modules";
import { RETIREMENT_PATHS } from "@/lib/flags";
import type { RetirementStage } from "@/lib/userData";
import {
  buildUserModel,
  BALANCED_AREAS,
  type ModelSource,
  type UserModel,
  type ValueEntry,
} from "@/lib/userModel";
import {
  coreValuesFromFacts,
  keepChangeLeaveFromFacts,
  unfinishedWorkFromFacts,
  retirementOnsetCircumstantial,
  windDownExitFromFacts,
} from "@/lib/resolverInputs";
import type { ConnectionsGraph } from "@/lib/planIntro";

// ---- The assembled plan ----

export type PlanMeta = {
  name: string | null;
  // Local ISO calendar dates (YYYY-MM-DD).
  dateCreated: string;
  dateLastReviewed: string;
  nextReviewDue: string;
};

// §1 — the chapter title, the cross-module synthesis, the one earned insight,
// and the single self-introduction. All generated ("" the deterministic default).
export type PlanOpening = {
  chapterTitle: string;
  // A short cross-module synthesis tying real threads together.
  overview: string;
  // The one earned insight — a single true throughline, never explicitly stated
  // by the member. "" when nothing genuine is there (omitted rather than forced).
  insight: string;
  // ONE complete, rounded first-person self-portrait the member can edit and
  // re-tone. "" until generation runs (deterministic fallback fills it).
  selfIntro: string;
};

// One goal as it sits in the balance overview (§2) and, when spotlit, in §5.
export type PlanGoal = {
  label: string;
  area: BalancedAreaId;
  track: "do" | "be";
  // Spotlit (one of the prioritised handful), with its rank and the member's own
  // note on what it means and the season it belongs to.
  focus: boolean;
  rank?: number;
  note?: string;
  season?: string;
  // do-goal specifics (kept verbatim); be-goal everyday picture.
  looksLike?: string;
  cadence?: string;
  stretch?: string;
  ordinaryWeek?: string;
};

export type PlanArea = {
  id: BalancedAreaId;
  label: string;
  blurb: string;
  goals: PlanGoal[];
  deliberateGap: boolean;
};

// §2 — the signature visual: the five areas and their relative fullness, plus
// one generated synthesis sentence naming the shape ("" when not generated). The
// goals themselves are NOT shown here — they appear in full in §5.
export type PlanBalance = {
  areas: PlanArea[];
  shape: string;
};

// §3 — values as the compass, plus how the member decides.
export type PlanScenario = {
  title: string;
  situation: string;
  optionA: string;
  optionB: string;
  lean: number;
  protect?: string;
  sacrifice?: string;
};

export type PlanValues = {
  coreValues: ValueEntry[];
  nonNegotiables: string[];
  flexible: string[];
  principles: string[];
  scenarios: PlanScenario[];
};

// §4 — the retirement the member is moving towards, as seasons.
export type PlanSeason = {
  id: string;
  label: string;
  hint?: string;
  items: { label: string; category?: string }[];
};

export type PlanSeasons = {
  // A short generated framing of how the retirement evolves ("" when not present).
  arc: string;
  // early → middle → later, in order. Each item sits in its PRIMARY season only.
  seasons: PlanSeason[];
  // The enduring lane — what runs across every season (genuinely-spanning items
  // surface here once, not repeated across columns).
  enduring: { label: string; category?: string }[];
};

// §6 — the route to each spotlit goal.
export type PlanPath = {
  goal: string;
  track: "do" | "be";
  milestones?: { label: string; when?: string; done?: boolean }[];
  alreadyHelps?: string[];
  wouldHelp?: string[];
  lean?: string;
};

export type PlanPaths = {
  paths: PlanPath[];
  // Strengths and resources to lean on across the goals.
  strengths: string[];
};

// §7 — how the week feels.
export type PlanWeek = {
  // 0 = highly structured, 100 = largely open.
  structure: number;
  structureLeft: string;
  structureRight: string;
  activities: {
    label: string;
    frequency: string;
    anchor?: boolean;
    energy?: boolean;
    fixed?: boolean;
  }[];
  // A generated one/two-sentence characterisation of the rhythm ("" when not
  // present — the document then shows the activities as plain labels).
  rhythm: string;
};

// §8 — leaving work.
export type PlanLeavingWork = {
  lean: "clean-break" | "gradual";
  shape?: string;
  period?: string;
  window: { fromLabel: string; toLabel: string } | null;
  factors: { id: string; label: string; level: string }[];
  // The financial-confidence signal — surfaced and signposted, never advised on.
  financeLevel: string | null;
  financeDateKnown?: string;
  // Readiness factors that are still building / low — the conditions left to meet.
  stillBuilding: string[];
  // A generated, Consumer-Duty-safe financial-confidence sentence ("" when not
  // present — the document then shows a fixed neutral signpost).
  financeNote: string;
};

// §8, retired cohorts (Phase 5): the reset — carrying forward / reshaping /
// letting go, from the retired letter's keep_change_leave. Replaces the
// future-exit "leaving work" section, which reads wrong for someone already out.
export type PlanReset = {
  keep: string[];
  change: string[];
  leaveBehind: string[];
};

// §8, winding-down decided path (Phase 5): the settled exit, from the
// wind_down_exit fact (rather than the 4.1 readiness widget).
export type PlanWindDownExit = {
  label: string;
  currentShape: string;
  windingDuration: string;
};

// A goal the plan surfaces from the retirement-paths facts — a change the person
// named (from the reset) or an unfinished-work thread. Offered, never imposed.
export type PlanCandidateGoal = { label: string; source: "change" | "unfinished" };

// §9 — the first year.
export type PlanFirstYearItem = {
  label: string;
  kind: "trip" | "goal" | "project" | "rhythm" | "work";
  top?: boolean;
  note?: string;
  fixed?: boolean;
};

export type PlanFirstYear = {
  narrative: string;
  seasons: { id: string; label: string; items: PlanFirstYearItem[] }[];
  allYearLabel: string;
  allYear: PlanFirstYearItem[];
  workLabel: string;
  work: PlanFirstYearItem[];
  noWorkLabel: string;
};

// A scene for a piece of bespoke imagery — a place, never a face. Drawn from the
// member's own goals / first year. Rendered as a clearly-marked placeholder for
// now; the prompt is what an image model would later turn into a soft, muted,
// painterly illustration, generated once and cached.
export type PlanScene = {
  // Where it sits: the chapter hero, or one of the first-year phases.
  slot: "hero" | string;
  // The scene to render — a short, grounded description of a place.
  prompt: string;
};

export type RlpPlan = {
  meta: PlanMeta;
  opening: PlanOpening;
  balance: PlanBalance;
  values: PlanValues;
  movingTowards: PlanSeasons;
  // §5 — the prioritised goals, grouped by area (a view over balance.areas).
  prioritisedAreas: PlanArea[];
  paths: PlanPaths;
  week: PlanWeek | null;
  leavingWork: PlanLeavingWork | null;
  // ---- Retirement paths (Phase 5). All empty/null for working + flag-off. ----
  // A one-line orientation at the top of the plan, per cohort ("" = none).
  orientation: string;
  // Retired §8 replacement (keep / change / leave). null unless retired with a
  // captured keep_change_leave.
  reset: PlanReset | null;
  // Winding-down §8, decided path — the settled exit from the wind_down_exit
  // fact. null unless winding-down with a settled plan (undecided uses
  // leavingWork, from the 4.1 readiness build).
  windDownExit: PlanWindDownExit | null;
  // Goals surfaced from the facts — reset "change" items + unfinished_work. []
  // the default. Offered as candidates, never imposed.
  candidateGoals: PlanCandidateGoal[];
  // The "keep" items the rhythm is built around (retired). [] the default.
  anchors: string[];
  // Framing tone: true when leaving work wasn't fully their own choice, so the
  // plan stays gentle and never celebrates a chosen fresh start.
  onsetGentle: boolean;
  firstYear: PlanFirstYear | null;
  // The signature web of real links between goals, values and people. Generated;
  // null until generation runs (or when there isn't enough real linkage).
  connections: ConnectionsGraph | null;
  // §10 — things still in motion. Generated; [] the default.
  openThreads: string[];
  scenes: PlanScene[];
  // Whether there's enough Stage 4 material to render a real plan.
  hasPlan: boolean;
};

// ---- Typed reader over the source ----

function typed<T extends BuildResult["type"]>(
  source: ModelSource,
  id: string,
  type: T
): Extract<BuildResult, { type: T }> | null {
  const b = source.getBuild(id);
  return b && b.type === type
    ? (b as Extract<BuildResult, { type: T }>)
    : null;
}

// Pull a module's interaction config (for labels the results store only by id).
function interaction(id: string) {
  return getModule(id)?.module.interaction ?? null;
}

// ---- §1 generators ----
// These are the only "written" parts; they're composed deterministically from
// the member's own nouns so they read as recognisably them and never invent.
// An image/LLM seam could later replace them, generated once at plan creation.

function generateChapterTitle(model: UserModel): string {
  // A calm, honest default the member can edit. Second person — Vita presenting
  // the plan back. Never an invented flourish.
  return model.onboarding.withPartner
    ? "The years you get to choose"
    : "The next chapter, on your own terms";
}

function listToProse(items: string[]): string {
  const xs = items.filter(Boolean);
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

// Two or three first-person drafts, each from a different angle (purpose-led,
// people-and-place, values-led). Built only from fields the member supplied;
// any draft missing its material is dropped.
export function generateSelfIntroDrafts(model: UserModel): string[] {
  const drafts: string[] = [];
  const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  const purpose = model.energySources.slice(0, 2).map(lc);
  const activities = model.aspirations.slice(0, 2).map((a) => lc(a.text));
  const people = model.relationships.slice(0, 2).map(lc);
  const topValues = model.coreValues.slice(0, 2).map((v) => lc(v.value));
  const aliveRole = model.roles.mostAlive[0] ?? model.roles.all[0];

  // Purpose-led.
  if (purpose.length) {
    drafts.push(
      `These days I give my time to ${listToProse(purpose)} — it keeps me useful, and it's mine to shape.`
    );
  }
  // People-and-place.
  if (aliveRole && (activities.length || people.length)) {
    const where = activities.length ? listToProse(activities) : listToProse(people);
    drafts.push(
      `I'm ${lc(aliveRole)} first and foremost, and you'll usually find me ${where}.`
    );
  }
  // Values-led.
  if (topValues.length) {
    const doing = activities.length
      ? listToProse(activities)
      : purpose.length
        ? listToProse(purpose)
        : "the things that matter to me";
    drafts.push(
      `I'm someone who cares about ${listToProse(topValues)}; mostly I spend my time ${doing}.`
    );
  }

  return drafts.slice(0, 3);
}

// ---- §2 / §5 — balance + prioritised goals ----

function areaBlurbs(): Record<string, string> {
  const it = interaction("4.3") as BalancedGoalsInteraction | null;
  const out: Record<string, string> = {};
  for (const a of it?.areas ?? []) out[a.id] = a.blurb;
  return out;
}

function areaLabels(): Record<string, string> {
  const it = interaction("4.3") as BalancedGoalsInteraction | null;
  const out: Record<string, string> = {};
  for (const a of it?.areas ?? []) out[a.id] = a.label;
  return out;
}

function seasonLabel43(id?: string): string | undefined {
  if (!id) return undefined;
  const it = interaction("4.3") as BalancedGoalsInteraction | null;
  return it?.seasons.find((s) => s.id === id)?.label ?? id;
}

function buildBalance(goalsResult: BalancedGoalsResult | null): PlanArea[] {
  const blurbs = areaBlurbs();
  const labels = areaLabels();
  const gaps = new Set(goalsResult?.deliberateGaps ?? []);

  // Preserve the canonical area order from the result where present, else the
  // five-area default.
  const order: { id: BalancedAreaId; label: string }[] =
    goalsResult?.areas?.length
      ? goalsResult.areas
      : BALANCED_AREAS.map((id) => ({ id, label: labels[id] ?? id }));

  return order.map(({ id, label }) => {
    const goals: PlanGoal[] = (goalsResult?.goals ?? [])
      .filter((g) => g.area === id)
      .map((g) => ({
        label: g.label,
        area: g.area,
        track: g.track,
        focus: !!g.focus,
        ...(g.rank ? { rank: g.rank } : {}),
        ...(g.note ? { note: g.note } : {}),
        ...(g.season ? { season: g.season } : {}),
        ...(g.looksLike ? { looksLike: g.looksLike } : {}),
        ...(g.cadence ? { cadence: g.cadence } : {}),
        ...(g.stretch ? { stretch: g.stretch } : {}),
        ...(g.ordinaryWeek ? { ordinaryWeek: g.ordinaryWeek } : {}),
      }));
    return {
      id,
      label,
      blurb: blurbs[id] ?? "",
      goals,
      deliberateGap: gaps.has(id),
    };
  });
}

// §5 view: only the spotlit goals, area by area, each area's goals by rank.
function prioritisedAreas(areas: PlanArea[]): PlanArea[] {
  return areas
    .map((a) => ({
      ...a,
      goals: a.goals
        .filter((g) => g.focus)
        .sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99)),
    }))
    .filter((a) => a.goals.length > 0);
}

// ---- §6 — paths ----

function buildPaths(
  pathsResult: GoalPathsResult | null,
  model: UserModel
): { paths: PlanPath[]; strengths: string[] } {
  const paths: PlanPath[] = (pathsResult?.paths ?? []).map((p) => ({
    goal: p.goal,
    track: p.track,
    ...(p.milestones ? { milestones: p.milestones } : {}),
    ...(p.alreadyHelps ? { alreadyHelps: p.alreadyHelps } : {}),
    ...(p.wouldHelp ? { wouldHelp: p.wouldHelp } : {}),
    ...(p.lean ? { lean: p.lean } : {}),
  }));

  // Strengths to lean on: the signature strengths, plus any named "lean" from a
  // path that isn't already one of them.
  const sig = model.strengths.signature.length
    ? model.strengths.signature
    : model.strengths.all.slice(0, 4);
  const leanExtras = paths
    .map((p) => p.lean)
    .filter((x): x is string => !!x)
    .filter((x) => !sig.some((s) => s.toLowerCase() === x.toLowerCase()));
  const strengths = [...sig, ...leanExtras];

  return { paths, strengths };
}

// ---- §4 — seasons ----

// Each placed item appears ONCE. An item the member put in its own single season
// sits in that season; an item they spread across two adjacent seasons takes its
// earliest (primary) season; an item placed in the enduring lane — or genuinely
// spanning every season — surfaces once as an enduring thread, never repeated
// across columns. A season that ends up with nothing is left honestly empty (the
// document frames it as deliberate openness, not a broken dash).
function buildSeasons(board: SeasonsBoardResult | null): PlanSeasons {
  const it = interaction("4.2");
  const cfgSeasons = it && it.type === "seasons-board" ? it.seasons : [];
  const enduringLabel =
    it && it.type === "seasons-board" ? it.enduringLane.label : "Throughout";

  const orderLabels = cfgSeasons.map((s) => s.label);
  const rank = new Map(orderLabels.map((l, i) => [l, i]));

  const bySeason = new Map<string, { label: string; category?: string }[]>();
  for (const l of orderLabels) bySeason.set(l, []);
  const enduring: { label: string; category?: string }[] = [];
  const enduringSeen = new Set<string>();

  for (const p of board?.placements ?? []) {
    const item = { label: p.label, category: p.category };
    const inOrdered = p.seasons.filter((s) => rank.has(s));
    const spansAll = orderLabels.length > 0 && inOrdered.length === orderLabels.length;
    const isEnduring = p.seasons.includes(enduringLabel) || spansAll;

    if (isEnduring) {
      const key = p.label.trim().toLowerCase();
      if (!enduringSeen.has(key)) {
        enduringSeen.add(key);
        enduring.push(item);
      }
      continue;
    }
    if (inOrdered.length === 0) continue; // unplaced — leave it out
    // Primary season: the earliest one it was placed in.
    const primary = inOrdered.sort((a, b) => (rank.get(a)! - rank.get(b)!))[0];
    bySeason.get(primary)!.push(item);
  }

  const seasons: PlanSeason[] = cfgSeasons.map((s) => ({
    id: s.id,
    label: s.label,
    hint: s.hint,
    items: bySeason.get(s.label) ?? [],
  }));

  return { arc: "", seasons, enduring };
}

// ---- §7 — week ----

function buildWeek(week: WeekShapeResult | null): PlanWeek | null {
  if (!week) return null;
  const it = interaction("4.6");
  const left = it && it.type === "week-shape" ? it.structurePoleLeft : "Structured";
  const right = it && it.type === "week-shape" ? it.structurePoleRight : "Open";

  // No template texture — the rhythm sentence is generated (or dropped).
  return {
    structure: week.structure,
    structureLeft: left,
    structureRight: right,
    activities: week.activities.map((a) => ({
      label: a.label,
      frequency: a.frequency,
      ...(a.anchor ? { anchor: true } : {}),
      ...(a.energy ? { energy: true } : {}),
      ...(a.fixed ? { fixed: true } : {}),
    })),
    rhythm: "",
  };
}

// ---- §8 — leaving work ----

function buildLeavingWork(
  snap: ReadinessSnapshotResult | null
): PlanLeavingWork | null {
  if (!snap) return null;
  const financeFactor = snap.factors.find((f) => f.id === "finances");
  const stillBuilding = snap.factors
    .filter((f) => f.level === "Low" || f.level === "Building")
    .map((f) => f.label);

  return {
    lean: snap.transition.lean,
    ...(snap.transition.shape ? { shape: snap.transition.shape } : {}),
    ...(snap.transition.period ? { period: snap.transition.period } : {}),
    window: snap.window,
    factors: snap.factors,
    financeLevel: financeFactor?.level ?? null,
    ...(snap.finance.dateKnown ? { financeDateKnown: snap.finance.dateKnown } : {}),
    stillBuilding,
    financeNote: "",
  };
}

// ---- §9 — first year ----

function buildFirstYear(fy: FirstYearResult | null): PlanFirstYear | null {
  if (!fy) return null;
  const it = interaction("4.7") as FirstYearInteraction | null;
  const cfgSeasons = it?.seasons ?? [];
  const allYearLabel = it?.allYearLabel ?? "Across the whole year";
  const workLabel = it?.workLaneLabel ?? "Work";
  const noWorkLabel = it?.noWorkLabel ?? "A clean break — my time is my own";

  const toItem = (i: FirstYearResult["items"][number]): PlanFirstYearItem => ({
    label: i.label,
    kind: i.kind,
    ...(i.top ? { top: true } : {}),
    ...(i.note ? { note: i.note } : {}),
    ...(i.fixed ? { fixed: true } : {}),
  });

  const inSeason = (id: string) =>
    fy.items.filter((i) => i.season === id && i.kind !== "work").map(toItem);

  return {
    narrative: fy.narrative,
    seasons: cfgSeasons.map((s) => ({
      id: s.id,
      label: s.label,
      items: inSeason(s.id),
    })),
    allYearLabel,
    allYear: fy.items
      .filter((i) => i.season === "all-year" && i.kind !== "work")
      .map(toItem),
    workLabel,
    work: fy.items.filter((i) => i.kind === "work").map(toItem),
    noWorkLabel,
  };
}

// ---- Imagery scenes (places, not faces) ----
// Restraint: a hero, plus roughly one per first-year phase that holds something.
// Each prompt is grounded in a real goal / first-year item.

function buildScenes(
  prioritised: PlanArea[],
  firstYear: PlanFirstYear | null
): PlanScene[] {
  const scenes: PlanScene[] = [];

  // Hero — from the top-ranked spotlit goal, framed as a place.
  const topGoal = prioritised
    .flatMap((a) => a.goals)
    .sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99))[0];
  if (topGoal) {
    scenes.push({
      slot: "hero",
      prompt: `A simple, gently abstract scene that clearly evokes this: ${topGoal.label}.`,
    });
  }

  // One per first-year phase that holds something — the image evokes that
  // phase's headline activity, not the season name. (Empty phases get no scene,
  // and the document doesn't render them.)
  for (const s of firstYear?.seasons ?? []) {
    const anchor = s.items.find((i) => i.top) ?? s.items[0];
    if (anchor) {
      scenes.push({
        slot: s.id,
        prompt: `A simple, gently abstract scene that clearly evokes this: ${anchor.label}.`,
      });
    }
  }

  return scenes;
}

// ---- Dates ----

function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, (m - 1) + months, d);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// The one-line orientation at the top of the plan, per retirement stage. Empty
// for working + flag-off (the plan opens as it does today). Present-tense for the
// retired cohorts (living it), present-progressive for winding-down (exit in
// motion) — never the future "as you approach retirement" framing.
function buildOrientation(rs: RetirementStage | null): string {
  switch (rs) {
    case "recently_retired":
      return "You've not long retired and are still settling in. This plan is a way to shape the retirement you're already living, as it finds its feet.";
    case "established":
      return "You've been retired a while now. This plan is a chance to take stock and reassess — to shape the years ahead on your own terms.";
    case "winding_down":
      return "You're winding down, with the shift out of work already underway. This plan holds where you are now and the retirement you're moving into.";
    default:
      return "";
  }
}

// ---- The assembler ----

export type BuildPlanOptions = {
  name: string | null;
  // The day the plan was created (local ISO date). Review cadence is annual.
  dateCreated: string;
  dateLastReviewed?: string;
};

export function buildRlpPlan(
  source: ModelSource,
  opts: BuildPlanOptions
): RlpPlan {
  const model = buildUserModel(source);

  const goalsResult = typed(source, "4.3", "balanced-goals");
  const pathsResult = typed(source, "4.4", "goal-paths");
  const tradeOffs = typed(source, "4.5", "trade-offs");
  const board = typed(source, "4.2", "seasons-board");
  const weekResult = typed(source, "4.6", "week-shape");
  const snap = typed(source, "4.1", "readiness-snapshot");
  const fyResult = typed(source, "4.7", "first-year");

  const { paths, strengths } = buildPaths(pathsResult, model);
  const areas = buildBalance(goalsResult);
  const prioritised = prioritisedAreas(areas);

  // Values come from the canonical profile when it's available: the user's
  // verbatim descriptions plus the 3.4 threat/protectors (which the old user
  // model had no read path for). Falls back to the model's derivation otherwise.
  const factCoreValues = coreValuesFromFacts(source.getActiveFacts?.() ?? []);

  const values: PlanValues = {
    coreValues: factCoreValues.length ? factCoreValues : model.coreValues,
    nonNegotiables: (tradeOffs?.values ?? [])
      .filter((v) => v.bucket === "non-negotiable")
      .map((v) => v.value),
    flexible: (tradeOffs?.values ?? [])
      .filter((v) => v.bucket === "flexible")
      .map((v) => v.value),
    principles: tradeOffs?.principles ?? [],
    scenarios: (tradeOffs?.scenarios ?? []).map((s) => ({
      title: s.title,
      situation: s.situation,
      optionA: s.optionA,
      optionB: s.optionB,
      lean: s.lean,
      ...(s.protect ? { protect: s.protect } : {}),
      ...(s.sacrifice ? { sacrifice: s.sacrifice } : {}),
    })),
  };

  const movingTowards = buildSeasons(board);
  const week = buildWeek(weekResult);

  // ---- Retirement paths (Phase 5): read the Phase 3–4 facts into §8, the
  // orientation line, candidate goals, rhythm anchors, and the framing tone.
  // rs is null (so all of this is inert) with the flag off or for the working
  // cohort, keeping the plan byte-identical to today for them.
  const facts = source.getActiveFacts?.() ?? [];
  const rs: RetirementStage | null = RETIREMENT_PATHS
    ? (model.onboarding.retirementStage ?? null)
    : null;

  let reset: PlanReset | null = null;
  let windDownExit: PlanWindDownExit | null = null;
  let leavingWork: PlanLeavingWork | null = null;
  let candidateGoals: PlanCandidateGoal[] = [];
  let anchors: string[] = [];

  if (isRetired(rs)) {
    // §8 becomes the reset (keep / change / leave); no future-exit section.
    const kcl = keepChangeLeaveFromFacts(facts);
    if (kcl.keep.length || kcl.change.length || kcl.leaveBehind.length) {
      reset = kcl;
    }
    anchors = kcl.keep;
    candidateGoals = [
      ...kcl.change.map((label) => ({ label, source: "change" as const })),
      ...unfinishedWorkFromFacts(facts).map((label) => ({
        label,
        source: "unfinished" as const,
      })),
    ];
  } else if (rs === "winding_down") {
    // Two sources: a settled plan reads from the wind_down_exit fact; otherwise
    // fall back to the 4.1 readiness build ("completing the exit").
    const exit = windDownExitFromFacts(facts);
    if (exit) {
      windDownExit = {
        label: exit.label,
        currentShape: exit.currentShape,
        windingDuration: exit.windingDuration,
      };
    } else {
      leavingWork = buildLeavingWork(snap);
    }
  } else {
    // Working + flag-off: today's §8, unchanged.
    leavingWork = buildLeavingWork(snap);
  }

  const orientation = buildOrientation(rs);
  const onsetGentle = retirementOnsetCircumstantial(facts);

  const firstYear = buildFirstYear(fyResult);
  const scenes = buildScenes(prioritised, firstYear);

  const dateCreated = opts.dateCreated;
  const dateLastReviewed = opts.dateLastReviewed ?? dateCreated;

  return {
    meta: {
      name: opts.name,
      dateCreated,
      dateLastReviewed,
      nextReviewDue: addMonthsISO(dateLastReviewed, 12),
    },
    opening: {
      chapterTitle: generateChapterTitle(model),
      overview: "",
      insight: "",
      // Deterministic fallback: the first generated draft, as one whole intro.
      selfIntro: generateSelfIntroDrafts(model)[0] ?? "",
    },
    balance: { areas, shape: "" },
    values,
    movingTowards,
    prioritisedAreas: prioritised,
    paths: { paths, strengths },
    week,
    leavingWork,
    orientation,
    reset,
    windDownExit,
    candidateGoals,
    anchors,
    onsetGentle,
    firstYear,
    connections: null,
    openThreads: [],
    scenes,
    hasPlan:
      !!goalsResult ||
      !!snap ||
      !!fyResult ||
      areas.some((a) => a.goals.length > 0),
  };
}

// Season-label resolver for §5 goal cards (4.3 season ids → labels).
export { seasonLabel43 };

// Re-export STAGES presence so callers don't import modules just for the arc.
export function planStageArc(completedIds: string[]) {
  const done = new Set(completedIds);
  return STAGES.map((stage) => ({
    number: stage.number,
    name: stage.name,
    done:
      stage.modules.length > 0 && stage.modules.every((m) => done.has(m.id)),
  }));
}
