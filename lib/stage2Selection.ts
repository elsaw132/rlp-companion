// Turns a user's six Stage 2 module outputs into a StatContext (the picks a
// trigger tests and an anchor names), then selects which stats fire in the
// reveal. Pure functions — no I/O — so the client gathers builds and the server
// need never re-read them.
//
// Selection follows the v0.4 spec's two connective modes, which is where a
// mismatched stat stops being unlikely and starts being impossible:
//
//   Mode 1 — personal bridge. The stat's anchor resolves to a specific, named
//            item in this person's picks, and the connective names that item.
//   Mode 2 — "Did you know…". The stat is eligible at area level but there's no
//            specific item to anchor to, so it runs as a standalone general fact
//            that makes NO claim about the user. It cannot mismatch, because it
//            asserts no connection at all.
//   Blank  — neither is available. A stat-free area is breathing room, not a
//            gap; a calm blank always beats a forced bridge.
//
// The order is Mode 1 → Mode 2 → blank, per area. Never force a bridge to reach
// a stat.
//
// What used to be here and is deliberately gone: the Balance rule (≥2
// encouraging, alarming ≤ half) and the floor that made every area carry a stat.
// Rule A retired or reframed every alarming stat, so balancing registers has
// nothing left to balance — the pool is warm by construction rather than by
// arithmetic. And the floor directly contradicted "sparse beats relentless".

import {
  type BuildResult,
  type CompositeResult,
  type RolePickerResult,
  type SlidersResult,
} from "@/lib/modules";
import {
  STAGE2_VOCAB,
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

// How a chosen stat is presented. The mode is decided here, not by the model, so
// a did-you-know can never quietly acquire a personal claim downstream.
export type StatMode = "bridge" | "did-you-know";

export type SelectedStat = {
  stat: Stat;
  mode: StatMode;
  // The single item the connective must name. Non-null exactly when
  // mode === "bridge".
  anchor: string | null;
  // The same item as a list — what the reveal has now "spent", so a later area
  // doesn't name it again.
  anchorItems: string[];
  // Picks the area's forward line must not name, because they collide with an
  // example inside this stat's locked claim (see Stat.exampleCollisions).
  suppressFromForwardLine: string[];
};

// ---- reading the real build shapes ----

function asComposite(b: BuildResult | null): BuildResult[] | null {
  return b && b.type === "composite" ? (b as CompositeResult).results : null;
}

function picksOf(b: BuildResult | null | undefined): string[] {
  return b && b.type === "role-picker" ? (b as RolePickerResult).picked : [];
}

// The 0–100 position of a slider identified by its summaryLabel, or null if that
// slider isn't present.
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

// Keep only the picks that are in a known vocabulary, preserving the order the
// person picked them — so `one()` and `two()` name what they reached for first.
const only = (picks: string[], vocab: string[]): string[] =>
  picks.filter((p) => vocab.includes(p));

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
  const V = STAGE2_VOCAB;

  // 2.1 — active. Composite; results[0] is the activity picker.
  const activities = picksOf(asComposite(getBuild("2.1"))?.[0]);

  // 2.2 — cognitive. A plain role-picker of curiosities.
  const curiosities = picksOf(getBuild("2.2"));

  // 2.3 — social. Composite; results[0] is the people picker, then the sliders.
  const social = asComposite(getBuild("2.3"));
  const people = picksOf(social?.[0]);
  const thinTalk = LOW(sliderPosition(social, "Someone to talk to"));

  // 2.4 — purpose. A plain role-picker of sources of meaning.
  const meanings = picksOf(getBuild("2.4"));

  // 2.5 — vitality. Composite: [0] energisers, [1] drains, [2..5] sliders,
  // [6] the lever picker.
  const vitality = asComposite(getBuild("2.5"));
  const energisers = picksOf(vitality?.[0]);
  const drains = picksOf(vitality?.[1]);
  const lever = picksOf(vitality?.[6])[0] ?? null;

  return {
    activities,
    walkingPicks: only(activities, V.WALKING),
    balancePicks: only(activities, V.BALANCE_ACTIVITIES),
    capabilityPicks: only(activities, V.CAPABILITY_ACTIVITIES),

    curiosities,
    languagePicks: only(curiosities, V.LANGUAGES),
    puzzlePicks: only(curiosities, V.PUZZLES),
    newSkillPicks: only(curiosities, V.NEW_SKILLS),

    people,
    closeTiePicks: only(people, V.CLOSE_TIES),
    groupPicks: only(people, V.GROUPS),
    // Close ties are "strong" when they have some AND the talk-to function isn't
    // reading thin — having a partner listed doesn't help if there's no one to
    // talk to.
    closeTiesStrong: hasAny(people, ["Partner", "Close friends"]) && !thinTalk,
    thinCasualContact: LOW(sliderPosition(social, "Everyday casual contact")),

    meanings,
    caringPicks: only(meanings, V.CARING),
    contributionPicks: only(meanings, V.CONTRIBUTION),

    energisers,
    drains,
    lever,
    outdoorPicks: only(energisers, V.OUTDOORS),
    sedentaryDrainPicks: only(drains, V.SEDENTARY_DRAINS),
    // Sleep shows up on either side of the sort — "Good sleep" energises, "Screens
    // late" drains — and both are the person raising sleep as a live subject.
    sleepPicks: [...only(energisers, V.SLEEP_ITEMS), ...only(drains, V.SLEEP_ITEMS)],
    sleepRaised: lever === "Sleep" || LOW(sliderPosition(vitality, "Sleep")),
    energyFlagged:
      LOW(sliderPosition(vitality, "Daytime energy")) || drains.includes("A nap"),
  };
}

// ---- selection ----

// Sparse beats relentless. Only five areas can carry a stat at all, so this is a
// guard rather than a live constraint — but it states the spec's target (3–5)
// where a future area would otherwise widen the reveal silently.
const MAX_STATS = 5;

// Lower sorts first: unseen stats before seen ones (rotation, so a return visit
// finds fresh material), then the area's explicit priority order. Deterministic,
// so a revisit before save is stable.
function rank(stat: Stat, seen: Set<string>): number {
  return (seen.has(stat.id) ? 1000 : 0) + stat.priority;
}

// Everything this person picked that an area's copy could draw on. Used to decide
// whether a stat's example collision is real for them, and exported so the client
// builds its forward-line context from the same source.
export function areaPicks(ctx: StatContext, area: Stage2Area): string[] {
  switch (area) {
    case "active":
      return ctx.activities;
    case "cognitive":
      return ctx.curiosities;
    case "social":
      return [...ctx.people, ...ctx.meanings];
    case "purpose":
      return ctx.meanings;
    case "vitality":
      return [...ctx.energisers, ...ctx.drains];
    case "senses":
      return [];
  }
}

// Select the stats that fire in this reveal — at most one per area, in reveal
// order, each tagged with the mode it must be rendered in.
export function selectStats(ctx: StatContext, seen: string[]): SelectedStat[] {
  const seenSet = new Set(seen);
  const chosen: SelectedStat[] = [];

  // Items already named by an earlier area in THIS reveal. A person who picked
  // "Volunteering" as their source of meaning would otherwise hear about it on
  // the social card and again on the purpose card — both bridges honest, both
  // subject-matched, and the pair reading like nobody was watching. Spending an
  // item here makes a later area reach for its next real one instead.
  const named = new Set<string>();

  for (const area of STAT_AREAS) {
    const picks = areaPicks(ctx, area);
    // Rule D: eligible only when the user's model actually contains the subject.
    const eligible = STATS.filter((s) => s.area === area && s.trigger(ctx)).sort(
      (a, b) => rank(a, seenSet) - rank(b, seenSet)
    );

    // Mode 1 — the first eligible stat left with an unspent item to name.
    let pick: SelectedStat | null = null;
    for (const stat of eligible) {
      const fresh = stat.anchor(ctx).filter((item) => !named.has(item));
      if (fresh.length) {
        // Exactly one item, always. A roster ("the photography and history and
        // puzzles you picked") reads as a list being played back rather than a
        // person being noticed, and it spends items other areas could have used.
        const items = fresh.slice(0, 1);
        pick = {
          stat,
          mode: "bridge",
          anchor: items[0],
          anchorItems: items,
          // Only suppress what they actually picked — an example collision that
          // isn't in their data is not a collision.
          suppressFromForwardLine: (stat.exampleCollisions ?? []).filter((c) =>
            picks.includes(c)
          ),
        };
        break;
      }
    }

    // Mode 2 — no unspent item, but an area-level fit and a stat willing to run
    // as a standalone fact. Note this is also where an area lands when its only
    // bridges were to items already named — a general fact beats a repeat.
    if (!pick) {
      const carrier = eligible.find((s) => s.didYouKnow);
      if (carrier) {
        pick = {
          stat: carrier,
          mode: "did-you-know",
          anchor: null,
          anchorItems: [],
          suppressFromForwardLine: (carrier.exampleCollisions ?? []).filter((c) =>
            picks.includes(c)
          ),
        };
      }
    }

    // Otherwise the area stays blank, which is a legitimate outcome.
    if (pick) {
      for (const item of pick.anchorItems) named.add(item);
      chosen.push(pick);
    }
  }

  return chosen.slice(0, MAX_STATS);
}
