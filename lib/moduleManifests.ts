// The one declarative layer that says, per module, which slices of the canonical
// profile it reads — replacing the scattered hand-maintained registries
// (CARRY_FORWARD, buildStage3Context, balancedSpringboardsFromModel, the per-seed
// input builders, and the weekShapeSeed transcript scrape). Appendix A of the
// phase-2 brief is encoded here verbatim; the resolver (lib/contextResolver.ts)
// reads this map and renders each module its compact, status=active view.
//
// Pure and dependency-free at runtime (type-only imports + a date helper), so it
// loads on the client (Vita context, seed inputs) and the server (the RLP) alike.

import type { FactCategory, RecurringDomain, StoredFact } from "@/lib/contextFacts";
import { ageFromDob } from "@/lib/planDate";

// Which view an input feeds: the structured seed view (the exercise-generation
// call), Vita's prose view ({priorReflections}), or both.
export type ManifestRole = "seed" | "vita" | "both";

export type ManifestInput = {
  category: FactCategory;
  // Hard domain filter for recurring_activity (Move/Think/Connect/Contribute/
  // Restore). Omitted = all domains ("recurring_activity(all)").
  domain?: RecurringDomain;
  // A semantic sub-filter (movement / mind / people / contribution / helping /
  // restful / partner / timeframe / age / work-transition) resolved by the tag
  // predicate registry below. Omitted = the whole category.
  tag?: TagName;
  role: ManifestRole;
  // Enrichment from another module's output — resolve if present, never an error
  // if the source module isn't done yet. The value is that source module's id
  // (documentation + lets the population check distinguish cross-refs).
  crossRef?: string;
  // For `value`: include the user's verbatim description, and (4.5) the threat +
  // protectors. Never a re-distillation.
  withDescription?: boolean;
  withThreatProtector?: boolean;
};

export type ModuleManifest = {
  moduleId: string;
  inputs: ManifestInput[];
};

// ---- Semantic tag predicates ------------------------------------------------
// Ported from the curated vocab the old carry-forward used, so Stage-2 callbacks
// keep their fidelity. A tag selects a subset of a category's facts by matching
// the fact's label (for day_picture_item / role) or a data field (onboarding,
// readiness). `age` selects the DOB fact; the resolver computes the number.

export type TagName =
  | "movement"
  | "mind"
  | "people"
  | "contribution"
  | "helping"
  | "restful"
  | "partner"
  | "timeframe"
  | "age"
  | "work-transition";

const MOVEMENT_ACTIVITIES = new Set<string>([
  "Walk", "Run", "Gym", "Swim", "Cycle", "Yoga or stretch", "Golf", "A class",
  "Dance", "Gardening", "DIY & repairs", "A walk somewhere new", "Time in nature",
  "A day trip", "Away somewhere", "The market or shops", "Coffee out",
  "A museum or gallery",
]);
const MOVEMENT_ROLES = new Set<string>([
  "Traveller", "Gardener", "Host", "Carer", "Sportsperson or team player",
]);
const MIND_ACTIVITIES = new Set<string>([
  "Read", "A course or class", "Learn a language", "Play music", "Write or journal",
  "Puzzles or games", "Look into something that interests you",
]);
const MIND_ROLES = new Set<string>(["Learner", "Creator or maker", "Storyteller"]);
const PEOPLE_ROLES = new Set<string>([
  "Partner", "Parent", "Grandparent", "Friend", "Sibling", "Neighbour", "Carer", "Host",
]);
const PEOPLE_ACTIVITIES = new Set<string>([
  "Time with your partner", "Family", "Grandkids", "See friends", "Have people over",
  "A call with someone far away", "A club or group",
]);
const CONTRIBUTION_ROLES = new Set<string>([
  "Mentor", "Volunteer", "Helper", "Leader", "Adviser", "Campaigner",
]);
const CONTRIBUTION_ACTIVITIES = new Set<string>([
  "Volunteer", "Mentor or advise", "A bit of paid work", "Help a cause you care about",
  "Help family practically",
]);
const REST_ACTIVITIES = new Set<string>([
  "A lie-in", "Slow breakfast", "Sit with a coffee", "A nap", "TV or a film",
  "Music or radio", "Potter about", "Time in the garden", "Do nothing much",
]);

const label = (f: StoredFact): string => (f.data.label ?? "").trim();
const field = (f: StoredFact): string =>
  typeof f.data.field === "string" ? f.data.field : "";

// Each predicate decides whether a fact passes the tag. day_picture_item and role
// share a tag name but match different sets, so the predicate switches on the
// fact's category.
export const TAG_PREDICATES: Record<TagName, (f: StoredFact) => boolean> = {
  movement: (f) =>
    f.category === "role"
      ? MOVEMENT_ROLES.has(label(f))
      : MOVEMENT_ACTIVITIES.has(label(f)),
  mind: (f) =>
    f.category === "role" ? MIND_ROLES.has(label(f)) : MIND_ACTIVITIES.has(label(f)),
  people: (f) =>
    f.category === "role" ? PEOPLE_ROLES.has(label(f)) : PEOPLE_ACTIVITIES.has(label(f)),
  contribution: (f) =>
    f.category === "role"
      ? CONTRIBUTION_ROLES.has(label(f))
      : CONTRIBUTION_ACTIVITIES.has(label(f)),
  helping: (f) => CONTRIBUTION_ACTIVITIES.has(label(f)),
  restful: (f) => REST_ACTIVITIES.has(label(f)),
  partner: (f) => field(f) === "partner",
  timeframe: (f) => field(f) === "horizon",
  // The age gate reads the DOB fact; the resolver turns it into a number.
  age: (f) => field(f) === "dob",
  // The work-transition readiness fact (4.1's lean), not the readiness factors.
  "work-transition": (f) =>
    f.category === "readiness" &&
    typeof f.data.lean === "string" &&
    f.data.kind !== "factor" &&
    f.data.kind !== "window",
};

// Compute the age a DOB fact implies (or null). Exposed so the resolver can
// render `{age}` without re-importing the date helper everywhere.
export function ageFromDobFact(f: StoredFact): number | null {
  return ageFromDob(label(f));
}

// ---- Builders for the manifest table (keep the table readable) --------------

const v = (category: FactCategory, extra: Partial<ManifestInput> = {}): ManifestInput => ({
  category,
  role: "vita",
  ...extra,
});
const e = (category: FactCategory, extra: Partial<ManifestInput> = {}): ManifestInput => ({
  category,
  role: "seed",
  ...extra,
});
const ev = (category: FactCategory, extra: Partial<ManifestInput> = {}): ManifestInput => ({
  category,
  role: "both",
  ...extra,
});

// Stage 1 ids are semantic (1.day…), so Appendix A's 1.1–1.5 map across.
export const MODULE_MANIFESTS: Record<string, ModuleManifest> = {
  // ---- Stage 1 — Imagine ----
  // Winding-down only (Phase 3). Reads onboarding context; writes wind_down_exit.
  "1.winddown": { moduleId: "1.winddown", inputs: [v("onboarding_fact")] },
  "1.day": { moduleId: "1.day", inputs: [v("onboarding_fact")] },
  "1.money": { moduleId: "1.money", inputs: [v("onboarding_fact")] },
  "1.roles": {
    moduleId: "1.roles",
    inputs: [v("day_picture_item", { crossRef: "1.day" })],
  },
  "1.week": {
    moduleId: "1.week",
    inputs: [
      v("day_picture_item", { crossRef: "1.day" }),
      v("role", { crossRef: "1.roles" }),
    ],
  },
  "1.letter": {
    moduleId: "1.letter",
    inputs: [
      e("day_picture_item"),
      e("role"),
      e("week_shape_pref"),
      e("one_off_dream"),
      e("aspiration"),
    ],
  },

  // ---- Stage 2 — Explore (fixed palettes — seeding foregrounds only) ----
  "2.1": {
    moduleId: "2.1",
    inputs: [
      v("day_picture_item", { tag: "movement" }),
      v("role", { tag: "movement" }),
      v("week_shape_pref"),
      v("letter_thread"),
    ],
  },
  "2.2": {
    moduleId: "2.2",
    inputs: [
      v("day_picture_item", { tag: "mind" }),
      v("role", { tag: "mind" }),
      v("aspiration"),
    ],
  },
  "2.3": {
    moduleId: "2.3",
    inputs: [
      v("role", { tag: "people" }),
      v("day_picture_item", { tag: "people" }),
      v("week_shape_pref"),
    ],
  },
  "2.4": {
    moduleId: "2.4",
    inputs: [
      ev("role", { tag: "contribution" }),
      ev("day_picture_item", { tag: "helping" }),
      ev("aspiration"),
    ],
  },
  "2.5": {
    moduleId: "2.5",
    inputs: [
      v("day_picture_item", { tag: "restful" }),
      v("week_shape_pref"),
      v("recurring_activity", { domain: "Move", crossRef: "2.1" }),
    ],
  },
  "2.6": {
    moduleId: "2.6",
    inputs: [e("onboarding_fact", { tag: "age" }), v("letter_thread")],
  },

  // ---- Stage 3 — Understand (foreground fixed VIA/values sets, never narrow) ----
  "3.1": {
    moduleId: "3.1",
    inputs: [
      ev("day_picture_item"),
      ev("role"),
      ev("recurring_activity"),
      ev("relationship"),
      ev("aspiration"),
      ev("energy_pattern"),
    ],
  },
  "3.2": {
    moduleId: "3.2",
    inputs: [
      ev("day_picture_item"),
      ev("role"),
      ev("recurring_activity"),
      ev("relationship"),
      ev("aspiration"),
      e("one_off_dream"),
      ev("energy_pattern"),
      ev("letter_thread"),
    ],
  },
  "3.3": {
    moduleId: "3.3",
    inputs: [ev("value"), e("day_picture_item")],
  },
  "3.4": {
    moduleId: "3.4",
    inputs: [
      ev("value", { withDescription: true }),
      e("day_picture_item"),
      e("week_shape_pref"),
      e("recurring_activity"),
    ],
  },
  "3.5": {
    moduleId: "3.5",
    inputs: [
      ev("value"),
      ev("strength"),
      e("relationship"),
      e("recurring_activity"),
      ev("concern"),
      e("onboarding_fact", { tag: "partner" }),
    ],
  },
  "3.6": {
    moduleId: "3.6",
    inputs: [ev("strength"), ev("value"), ev("relationship")],
  },

  // ---- Stage 4 — Plan (dream wall throughout — NO one_off_dream) ----
  "4.1": {
    moduleId: "4.1",
    inputs: [
      v("value"),
      v("role"),
      v("strength"),
      v("concern"),
      v("onboarding_fact", { tag: "timeframe" }),
    ],
  },
  "4.2": {
    moduleId: "4.2",
    inputs: [
      ev("aspiration"),
      ev("recurring_activity"),
      ev("relationship"),
      ev("energy_pattern"),
      ev("value"),
      ev("hope"),
    ],
  },
  "4.3": {
    moduleId: "4.3",
    inputs: [
      ev("recurring_activity"),
      ev("value"),
      ev("aspiration"),
      e("energy_pattern"),
      e("relationship"),
      v("onboarding_fact", { tag: "partner" }),
    ],
  },
  "4.4": {
    moduleId: "4.4",
    inputs: [
      ev("goal", { crossRef: "4.3" }),
      ev("strength"),
      e("relationship"),
      v("readiness", { crossRef: "4.1" }),
      e("recurring_activity"),
    ],
  },
  "4.5": {
    moduleId: "4.5",
    inputs: [
      ev("value", { withDescription: true, withThreatProtector: true }),
      ev("value_priority"),
      e("goal", { crossRef: "4.3" }),
      e("readiness", { crossRef: "4.1" }),
    ],
  },
  "4.6": {
    moduleId: "4.6",
    inputs: [
      ev("recurring_activity"),
      ev("energy_pattern"),
      ev("week_shape_pref"),
      e("readiness", { tag: "work-transition", crossRef: "4.1" }),
      e("goal", { crossRef: "4.3" }),
    ],
  },
  "4.7": {
    moduleId: "4.7",
    inputs: [
      ev("goal", { crossRef: "4.3" }),
      e("week_plan", { crossRef: "4.6" }),
      e("chapter", { crossRef: "4.2" }),
      ev("readiness", { crossRef: "4.1" }),
      e("goal_path", { crossRef: "4.4" }),
      e("principle", { crossRef: "4.5" }),
    ],
  },
};

export function getManifest(moduleId: string): ModuleManifest | null {
  return MODULE_MANIFESTS[moduleId] ?? null;
}

// ---- Validation + the dream-wall build gate ---------------------------------

// The Stage-4 plan modules the dream wall covers: one_off_dream must never reach
// a plan, or a money-no-object fantasy bleeds into the actionable plan.
export const DREAM_WALL_MODULES = ["4.2", "4.3", "4.5", "4.6", "4.7"];

// The categories one_off_dream IS allowed to reach (reflective surfaces only).
const ONE_OFF_DREAM_ALLOWED = new Set(["1.letter", "3.1", "3.2", "3.6"]);

// The full, real category catalogue — kept in sync with FactCategory so the
// manifest can't declare a category that doesn't exist.
const REAL_CATEGORIES = new Set<FactCategory>([
  "day_picture_item", "role", "week_shape_pref", "letter_thread", "one_off_dream",
  "aspiration", "recurring_activity", "energy_pattern", "relationship",
  "social_balance_pref", "commitment", "strength", "value", "value_priority",
  "hope", "fear", "meaning_thread", "readiness", "chapter", "goal", "goal_path",
  "principle", "week_plan", "first_year_plan", "concern", "onboarding_fact",
  "wind_down_exit", "retirement_onset", "unfinished_work", "keep_change_leave",
]);

// Check the manifest table for structural errors. Returns a list of problems
// (empty = valid). Covers: every declared category is real; the dream wall holds;
// a recurring_activity domain is a real domain. Run as a build gate (it throws at
// import, below) and asserted in tests.
export function validateManifests(): string[] {
  const errors: string[] = [];
  const REAL_DOMAINS = new Set(["Restore", "Move", "Think", "Connect", "Contribute"]);

  for (const [moduleId, manifest] of Object.entries(MODULE_MANIFESTS)) {
    for (const input of manifest.inputs) {
      if (!REAL_CATEGORIES.has(input.category)) {
        errors.push(`${moduleId}: unknown category "${input.category}"`);
      }
      if (input.domain && !REAL_DOMAINS.has(input.domain)) {
        errors.push(`${moduleId}: unknown domain "${input.domain}"`);
      }
      if (input.category === "one_off_dream") {
        if (DREAM_WALL_MODULES.includes(moduleId)) {
          errors.push(
            `DREAM WALL: ${moduleId} (a Stage-4 plan module) declares one_off_dream`
          );
        } else if (!ONE_OFF_DREAM_ALLOWED.has(moduleId)) {
          errors.push(
            `DREAM WALL: ${moduleId} declares one_off_dream but is not an allowed reflective surface`
          );
        }
      }
    }
  }
  return errors;
}

// Build gate: a malformed manifest (a typo'd category, a dream-wall breach) fails
// the build the moment this module is imported, rather than shipping a silent
// bleed. The table is static, so this can only trip on a bad edit — exactly when
// we want it to.
const MANIFEST_ERRORS = validateManifests();
if (MANIFEST_ERRORS.length > 0) {
  throw new Error(
    `Invalid module manifests:\n${MANIFEST_ERRORS.map((e) => `  - ${e}`).join("\n")}`
  );
}
