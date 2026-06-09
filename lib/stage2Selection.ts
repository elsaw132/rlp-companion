// Turns a user's six Stage 2 module outputs into a StatContext (the plain facts
// triggers test against), then selects which stats fire in the reveal — applying
// the spec's selection logic: filter by trigger, drop areas with none, prefer
// unseen stats (rotation), keep the reveal balanced, and stay sparse (a soft cap
// so a few areas are stat-free breathing room). Pure functions — no I/O — so the
// client gathers builds and the server need never re-read them.

import {
  type BuildResult,
  type CompositeResult,
  type RolePickerResult,
  type SlidersResult,
} from "@/lib/modules";
import {
  STATS,
  type Stat,
  type StatContext,
  type Stage2Area,
} from "@/lib/stage2Stats";

// The five stat-bearing areas, in reveal order. Senses (2.6) is deliberately
// excluded — it's stat-free by product decision.
const STAT_AREAS: Stage2Area[] = [
  "active",
  "cognitive",
  "social",
  "purpose",
  "vitality",
];

// ---- reading the real build shapes ----

function asComposite(b: BuildResult | null): BuildResult[] | null {
  return b && b.type === "composite" ? (b as CompositeResult).results : null;
}

function picksOf(b: BuildResult | null | undefined): string[] {
  return b && b.type === "role-picker" ? (b as RolePickerResult).picked : [];
}

// The 0–100 position of a slider identified by its summaryLabel, or null if that
// slider isn't present. Used for the "thin function" / "low lever" reads.
function sliderPosition(
  results: BuildResult[] | null,
  summaryLabel: string
): number | null {
  if (!results) return null;
  for (const r of results) {
    if (r.type === "sliders") {
      const s = r as SlidersResult;
      if (s.summaryLabel === summaryLabel && s.spectrums[0]) {
        return s.spectrums[0].position;
      }
    }
  }
  return null;
}

const hasAny = (list: string[], wanted: string[]): boolean =>
  list.some((p) => wanted.includes(p));

// A three-step slider reads "thin"/"low" at its left anchor (position below the
// midpoint). The Stage 2 function and lever sliders all use this shape.
const LOW = (pos: number | null): boolean => pos !== null && pos < 50;

// Build the StatContext from the six module builds. `getBuild` matches the
// userData accessor signature, so the client passes it straight through.
export function buildStatContext(
  getBuild: (moduleId: string) => BuildResult | null
): StatContext {
  // 2.1 — active
  const activePicks = picksOf(asComposite(getBuild("2.1"))?.[0]);
  const walking = hasAny(activePicks, [
    "Walking",
    "Walking the dog",
    "Hiking or rambling",
  ]);

  // 2.2 — cognitive
  const cognitivePicks = picksOf(getBuild("2.2"));
  const languages = cognitivePicks.includes("Learning a language");
  const puzzles = cognitivePicks.includes(
    "Puzzles, crosswords & brain games"
  );
  const newSkillAmbition = hasAny(cognitivePicks, [
    "Learning a language",
    "Playing or listening to music",
    "Photography",
    "Painting, drawing & crafts",
    "Knitting, sewing & textiles",
    "Computers, coding & gadgets",
  ]);

  // 2.3 — social
  const social = asComposite(getBuild("2.3"));
  const socialPicks = picksOf(social?.[0]);
  const hasGroup = hasAny(socialPicks, [
    "A community or faith group",
    "People around a hobby",
  ]);
  const thinTalk = LOW(sliderPosition(social, "Someone to talk to"));
  const thinPracticalHelp = LOW(sliderPosition(social, "Practical help"));
  const thinHabit = LOW(sliderPosition(social, "Healthy-habit company"));
  const thinCasualContact = LOW(
    sliderPosition(social, "Everyday casual contact")
  );
  // "Thin overall" = two or more of the four crisis/support functions read thin.
  const thinOverall =
    [thinTalk, thinPracticalHelp, thinHabit, thinCasualContact].filter(Boolean)
      .length >= 2;
  const closeTiesStrong =
    hasAny(socialPicks, ["Partner", "Close friends"]) && !thinTalk;

  // 2.4 — purpose
  const purposePicks = picksOf(getBuild("2.4"));
  const caring = hasAny(purposePicks, [
    "Caring for someone",
    "Helping raise grandchildren",
    "Supporting a neighbour",
    "Mentoring informally",
  ]);
  const contribution = hasAny(purposePicks, [
    "Volunteering",
    "Leading a local group",
    "Organising community events",
    "Helping a cause you care about",
    "A bit of paid work",
  ]);

  // 2.5 — vitality
  const vitality = asComposite(getBuild("2.5"));
  const energisers = picksOf(vitality?.[0]);
  const drains = picksOf(vitality?.[1]);
  const lever = picksOf(vitality?.[6])[0] ?? null;
  const outdoors = hasAny(energisers, [
    "Time outdoors",
    "Daylight in the morning",
  ]);
  const fullDiary = hasAny(drains, ["A full diary", "Overcommitting", "Rushing"]);
  const sleepRaised =
    lever === "Sleep" || LOW(sliderPosition(vitality, "Sleep"));
  const energyFlagged =
    LOW(sliderPosition(vitality, "Daytime energy")) || drains.includes("A nap");

  return {
    walking,
    languages,
    puzzles,
    newSkillAmbition,
    hasGroup,
    thinOverall,
    thinPracticalHelp,
    thinCasualContact,
    closeTiesStrong,
    caring,
    contribution,
    outdoors,
    fullDiary,
    sleepRaised,
    energyFlagged,
  };
}

// ---- selection ----

const EVIDENCE_WEIGHT: Record<Stat["evidence"], number> = {
  robust: 10,
  solid: 6,
  "solid-but-contested": 3,
  directional: 0,
};

// Is this an always-on stat (fires for everyone) vs. a conditional one matched to
// a specific choice? A conditional match is more personal, so it ranks higher —
// this is the spec's "match the stat to what the user chose" principle.
function isConditional(stat: Stat): boolean {
  // A stat whose trigger would still pass with every context flag false is
  // effectively always-on. Conditional stats depend on a real flag being set.
  const allFalse: StatContext = {
    walking: false,
    languages: false,
    puzzles: false,
    newSkillAmbition: false,
    hasGroup: false,
    thinOverall: false,
    thinPracticalHelp: false,
    thinCasualContact: false,
    closeTiesStrong: false,
    caring: false,
    contribution: false,
    outdoors: false,
    fullDiary: false,
    sleepRaised: false,
    energyFlagged: false,
  };
  return !stat.trigger(allFalse);
}

// A higher score means "prefer this stat". Conditional-match dominates, then
// freshness (unseen first → rotation), then evidence strength (robust over
// contested for tiebreak). Deterministic, so a revisit before save is stable.
function score(stat: Stat, seen: Set<string>): number {
  let s = 0;
  if (isConditional(stat)) s += 100;
  if (!seen.has(stat.id)) s += 50;
  s += EVIDENCE_WEIGHT[stat.evidence];
  return s;
}

// Every stat-bearing area shows a fact — Senses is the only deliberately
// stat-free area, and it isn't in STAT_AREAS at all. So the cap equals the
// number of stat areas: all of them appear, and the Balance rule is satisfied by
// swapping the stat WITHIN an area, never by dropping an area to breathing room.
const SOFT_CAP = STAT_AREAS.length;
const MIN_STATS = STAT_AREAS.length;

// Lower sorts first — used to choose which chosen stat to swap away when the
// encouraging floor needs help: take from an alarming area before a mixed one.
const REGISTER_RANK: Record<Stat["register"], number> = {
  alarming: 0,
  mixed: 1,
  encouraging: 2,
};

// Select the stats that fire in this reveal — exactly one per stat-bearing area
// (all five; only Senses is stat-free), in reveal order. Applies the spec's
// selection logic: filter by trigger, prefer unseen (rotation) and
// matched-conditional stats, then the Balance rule (≥2 encouraging; alarming ≤
// half). Because every area carries both a non-alarming and an encouraging
// option, balance is satisfied by swapping the stat WITHIN its area — never by
// dropping an area, so each area always carries a fact.
export function selectStats(ctx: StatContext, seen: string[]): Stat[] {
  const seenSet = new Set(seen);
  const by = (s: Stat) => score(s, seenSet);

  // Eligible stats per area, best-scoring first. Areas with none are dropped.
  const eligibleByArea = new Map<Stage2Area, Stat[]>();
  for (const area of STAT_AREAS) {
    const el = STATS.filter((s) => s.area === area && s.trigger(ctx)).sort(
      (a, b) => by(b) - by(a)
    );
    if (el.length) eligibleByArea.set(area, el);
  }

  // Rank areas by their strongest stat, then keep the strongest few.
  const areasByStrength = [...eligibleByArea.keys()].sort(
    (a, b) => by(eligibleByArea.get(b)![0]) - by(eligibleByArea.get(a)![0])
  );
  const cap = Math.max(MIN_STATS, Math.min(areasByStrength.length, SOFT_CAP));

  // chosen: area → the stat currently picked for it (start with each area's best).
  const chosen = new Map<Stage2Area, Stat>();
  for (const area of areasByStrength.slice(0, cap)) {
    chosen.set(area, eligibleByArea.get(area)![0]);
  }

  const reg = (s: Stat) => s.register;
  const countReg = (r: Stat["register"]) =>
    [...chosen.values()].filter((s) => reg(s) === r).length;
  const altIn = (area: Stage2Area, want: (s: Stat) => boolean) =>
    eligibleByArea.get(area)!.find(want);

  // Balance — alarming may be no more than half the shown stats. Prefer to
  // soften an offending area to a non-alarming stat; drop it only if it has none.
  while (countReg("alarming") > Math.floor(chosen.size / 2)) {
    const worst = [...chosen.entries()]
      .filter(([, s]) => reg(s) === "alarming")
      .sort((a, b) => by(a[1]) - by(b[1]))[0];
    if (!worst) break;
    const [area] = worst;
    const alt = altIn(area, (s) => reg(s) !== "alarming");
    if (alt) chosen.set(area, alt);
    else if (chosen.size > MIN_STATS) chosen.delete(area);
    else break;
  }

  // Balance — at least two clearly encouraging stats. First try to turn a chosen
  // area's pick encouraging (alarming areas first, then mixed). If no chosen area
  // can, pull in an unchosen area that offers an encouraging stat.
  let guard = 0;
  while (countReg("encouraging") < 2 && guard++ < STAT_AREAS.length * 2) {
    const swapArea = [...chosen.entries()]
      .filter(
        ([area, s]) =>
          reg(s) !== "encouraging" &&
          !!altIn(area, (e) => reg(e) === "encouraging")
      )
      .sort((a, b) => REGISTER_RANK[reg(a[1])] - REGISTER_RANK[reg(b[1])])[0];
    if (swapArea) {
      const [area] = swapArea;
      chosen.set(area, altIn(area, (e) => reg(e) === "encouraging")!);
      continue;
    }
    const newArea = areasByStrength.find(
      (a) => !chosen.has(a) && !!altIn(a, (e) => reg(e) === "encouraging")
    );
    if (!newArea) break;
    const dropArea = [...chosen.entries()]
      .filter(([, s]) => reg(s) !== "encouraging")
      .sort((a, b) => by(a[1]) - by(b[1]))[0]?.[0];
    if (dropArea && chosen.size >= cap) chosen.delete(dropArea);
    chosen.set(newArea, altIn(newArea, (e) => reg(e) === "encouraging")!);
  }

  // Return in reveal (area) order, not score order.
  return STAT_AREAS.flatMap((area) =>
    chosen.has(area) ? [chosen.get(area)!] : []
  );
}
