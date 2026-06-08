// The Stage-1 → Stage-2 carry-forward contract.
//
// In Stage 2, Vita should open like a coach who already knows the person from
// Stage 1 — not a fresh chatbot. This file is the single, shared place that
// decides *which* Stage 1 outputs each Stage 2 module sees and shapes them
// tersely into the text that fills Vita's existing {priorReflections} slot.
//
// It is a registry keyed by Stage 2 module id. Each entry lists the Stage 1
// sources to read and a pure extractor for each. Adding a later module (2.2 …,
// or a Stage 3 module) is a one-line addition to CARRY_FORWARD — no new wiring.

import type {
  BuildResult,
  DayBuilderResult,
  LetterResult,
  RolePickerResult,
  SlidersResult,
  SparkPromptsResult,
} from "@/lib/modules";
import type { Takeaway } from "@/lib/takeaways";

// The minimal read surface the contract needs. The useUserData() API satisfies
// it directly, so SessionContainer can pass the hook straight through.
export type CarrySource = {
  getBuild: (moduleId: string) => BuildResult | null;
  getTakeaway: (moduleId: string) => Takeaway | null;
};

// Given a Stage 1 module's stored interaction and takeaway, return one terse
// line for Vita — or null when there's nothing relevant to carry.
type Extractor = (
  build: BuildResult | null,
  takeaway: Takeaway | null
) => string | null;

type Stage1Source = { moduleId: string; extract: Extractor };

// ---- Shared vocab the extractors filter against ----

// Day-builder activities that read as physically active (Body & movement, the
// active end of Home & making, and Out & about). Used to pull just the
// movement-flavoured items out of the day they pictured.
const MOVEMENT_ACTIVITIES = new Set<string>([
  "Walk",
  "Run",
  "Gym",
  "Swim",
  "Cycle",
  "Yoga or stretch",
  "Golf",
  "A class",
  "Dance",
  "Gardening",
  "DIY & repairs",
  "A walk somewhere new",
  "Time in nature",
  "A day trip",
  "Away somewhere",
  "The market or shops",
  "Coffee out",
  "A museum or gallery",
]);

// Roles that imply being out and active.
const MOVEMENT_ROLES = new Set<string>([
  "Traveller",
  "Gardener",
  "Host",
  "Carer",
  "Sportsperson or team player",
]);

function uniq(items: string[]): string[] {
  return [...new Set(items)];
}

// ---- Extractors for 2.1 (Staying Active) ----

function movementActivitiesFromDay(build: BuildResult | null): string | null {
  if (!build || build.type !== "day-builder") return null;
  const day = build as DayBuilderResult;
  const all = Object.values(day.assigned).flat();
  const movement = uniq(all.filter((a) => MOVEMENT_ACTIVITIES.has(a)));
  if (movement.length === 0) return null;
  return `Active things already in the day they pictured: ${movement.join(", ")}.`;
}

function movementImplyingRoles(build: BuildResult | null): string | null {
  if (!build || build.type !== "role-picker") return null;
  const roles = build as RolePickerResult;
  const matches = roles.picked.filter((r) => MOVEMENT_ROLES.has(r));
  if (matches.length === 0) return null;
  // Lead with any they starred as most alive.
  const starredFirst = uniq([
    ...matches.filter((r) => roles.starred.includes(r)),
    ...matches,
  ]);
  return `Roles they want that involve being active: ${starredFirst.join(", ")}.`;
}

function activityRestSliderPhrase(build: BuildResult | null): string | null {
  if (!build || build.type !== "sliders") return null;
  const sliders = build as SlidersResult;
  const spectrum = sliders.spectrums.find((s) =>
    s.left.toLowerCase().startsWith("full and busy")
  );
  if (!spectrum) return null;
  const p = spectrum.position;
  let lean: string;
  if (p < 35) lean = "a full and busy week";
  else if (p > 65) lean = "a slow and restful week";
  else lean = "a balance of busy and restful";
  return `For the rhythm of their week they leaned toward ${lean}.`;
}

// A light reading of the pace of the day they pictured — which parts look
// active vs restful, drawn from the movement/rest vocab. Approximate by nature;
// used to give 2.5 a feel for their natural rhythm (early-rise, slow morning,
// energetic afternoon, evening wind-down).
function dayRhythm(build: BuildResult | null): string | null {
  if (!build || build.type !== "day-builder") return null;
  const day = build as DayBuilderResult;
  const labelPart = (acts: string[]): string | null => {
    if (acts.length === 0) return null;
    const active = acts.filter((a) => MOVEMENT_ACTIVITIES.has(a)).length;
    const rest = acts.filter((a) => REST_ACTIVITIES.has(a)).length;
    if (active > rest) return "active";
    if (rest > active) return "restful";
    return "a mix of both";
  };
  const segs = day.parts.flatMap((p) => {
    const label = labelPart(day.assigned[p] ?? []);
    return label ? [`${p.toLowerCase()} looks ${label}`] : [];
  });
  if (segs.length === 0) return null;
  return `The pace of the day they pictured: ${segs.join(", ")}.`;
}

function letterSceneExcerpt(
  build: BuildResult | null,
  takeaway: Takeaway | null
): string | null {
  const body =
    build && build.type === "letter" ? (build as LetterResult).body.trim() : "";
  const source = body || takeaway?.text?.trim() || "";
  if (!source) return null;
  const excerpt = source.length > 180 ? `${source.slice(0, 180).trim()}…` : source;
  return `From the letter to their future self: "${excerpt}"`;
}

// ---- Generic extractor factories (shared by 2.2–2.6) ----

// Pull the day-builder activities that fall inside a vocab set, anywhere in the
// day they pictured. `lead` is the sentence stem the matches are appended to.
function dayActivitiesIn(set: Set<string>, lead: string): Extractor {
  return (build) => {
    if (!build || build.type !== "day-builder") return null;
    const all = Object.values((build as DayBuilderResult).assigned).flat();
    const matches = uniq(all.filter((a) => set.has(a)));
    if (matches.length === 0) return null;
    return `${lead}: ${matches.join(", ")}.`;
  };
}

// Pull the picked roles that fall inside a vocab set, starred ones first.
function rolesIn(set: Set<string>, lead: string): Extractor {
  return (build) => {
    if (!build || build.type !== "role-picker") return null;
    const roles = build as RolePickerResult;
    const matches = roles.picked.filter((r) => set.has(r));
    if (matches.length === 0) return null;
    const starredFirst = uniq([
      ...matches.filter((r) => roles.starred.includes(r)),
      ...matches,
    ]);
    return `${lead}: ${starredFirst.join(", ")}.`;
  };
}

// Pull one money-no-object spark entry by field id, trimmed to a short excerpt.
function sparkEntry(id: string, lead: string): Extractor {
  return (build) => {
    if (!build || build.type !== "spark-prompts") return null;
    const entry = (build as SparkPromptsResult).entries.find((e) => e.id === id);
    const text = entry?.text?.trim();
    if (!text) return null;
    const excerpt = text.length > 160 ? `${text.slice(0, 160).trim()}…` : text;
    return `${lead}: "${excerpt}"`;
  };
}

// Read where one ideal-week spectrum (matched by its left label) was set, and
// phrase the lean. `lead` is the stem; the lean word is appended.
function weekSliderLean(
  leftPrefix: string,
  leanLow: string,
  leanMid: string,
  leanHigh: string,
  lead: string
): Extractor {
  return (build) => {
    if (!build || build.type !== "sliders") return null;
    const spectrum = (build as SlidersResult).spectrums.find((s) =>
      s.left.toLowerCase().startsWith(leftPrefix.toLowerCase())
    );
    if (!spectrum) return null;
    const p = spectrum.position;
    const lean = p < 35 ? leanLow : p > 65 ? leanHigh : leanMid;
    return `${lead} ${lean}.`;
  };
}

// ---- Vocab sets for 2.2–2.6 ----

const MIND_ACTIVITIES = new Set<string>([
  "Read",
  "A course or class",
  "Learn a language",
  "Play music",
  "Write or journal",
  "Puzzles or games",
  "Look into something that interests you",
]);
const MIND_ROLES = new Set<string>(["Learner", "Creator or maker", "Storyteller"]);

const PEOPLE_ROLES = new Set<string>([
  "Partner",
  "Parent",
  "Grandparent",
  "Friend",
  "Sibling",
  "Neighbour",
  "Carer",
  "Host",
]);
const PEOPLE_ACTIVITIES = new Set<string>([
  "Time with your partner",
  "Family",
  "Grandkids",
  "See friends",
  "Have people over",
  "A call with someone far away",
  "A club or group",
]);

const CONTRIBUTION_ROLES = new Set<string>([
  "Mentor",
  "Volunteer",
  "Helper",
  "Leader",
  "Adviser",
  "Campaigner",
]);
const CONTRIBUTION_ACTIVITIES = new Set<string>([
  "Volunteer",
  "Mentor or advise",
  "A bit of paid work",
  "Help a cause you care about",
  "Help family practically",
]);

const REST_ACTIVITIES = new Set<string>([
  "A lie-in",
  "Slow breakfast",
  "Sit with a coffee",
  "A nap",
  "TV or a film",
  "Music or radio",
  "Potter about",
  "Time in the garden",
  "Do nothing much",
]);

// ---- The registry ----

const CARRY_FORWARD: Record<string, Stage1Source[]> = {
  "2.1": [
    { moduleId: "1.day", extract: movementActivitiesFromDay },
    { moduleId: "1.roles", extract: movementImplyingRoles },
    { moduleId: "1.week", extract: activityRestSliderPhrase },
    { moduleId: "1.letter", extract: letterSceneExcerpt },
  ],
  // 2.2 Keeping your mind alive — learning, curiosity, making.
  "2.2": [
    {
      moduleId: "1.day",
      extract: dayActivitiesIn(
        MIND_ACTIVITIES,
        "Mind-and-learning things already in the day they pictured"
      ),
    },
    {
      moduleId: "1.roles",
      extract: rolesIn(MIND_ROLES, "Roles they want that involve learning or making"),
    },
    {
      moduleId: "1.money",
      extract: sparkEntry("learn", "Something they'd learn, make, or master"),
    },
  ],
  // 2.3 The people in your life — relationships and connection.
  "2.3": [
    {
      moduleId: "1.roles",
      extract: rolesIn(PEOPLE_ROLES, "Relationship roles they want to carry forward"),
    },
    {
      moduleId: "1.day",
      extract: dayActivitiesIn(
        PEOPLE_ACTIVITIES,
        "People and connection already in the day they pictured"
      ),
    },
    {
      moduleId: "1.week",
      extract: weekSliderLean(
        "Mostly on my own",
        "plenty of quiet time on their own",
        "a balance of solitude and company",
        "lots of people around them",
        "For the rhythm of their week they leaned toward"
      ),
    },
  ],
  // 2.4 Purpose and contribution — helping, giving, making a difference.
  "2.4": [
    {
      moduleId: "1.roles",
      extract: rolesIn(
        CONTRIBUTION_ROLES,
        "Contribution roles they want to play"
      ),
    },
    {
      moduleId: "1.day",
      extract: dayActivitiesIn(
        CONTRIBUTION_ACTIVITIES,
        "Ways of helping already in the day they pictured"
      ),
    },
    {
      moduleId: "1.money",
      extract: sparkEntry("build", "Something they'd build, fund, or give"),
    },
  ],
  // 2.5 Energy, sleep and feeling well — vitality: rhythm, rest, structure.
  "2.5": [
    { moduleId: "1.day", extract: dayRhythm },
    { moduleId: "1.week", extract: activityRestSliderPhrase },
    {
      moduleId: "1.week",
      extract: weekSliderLean(
        "Lots of routine",
        "lots of routine and familiar structure",
        "a mix of routine and spontaneity",
        "lots of spontaneity and variety",
        "For how structured they want their week they leaned toward"
      ),
    },
  ],
  // 2.6 Your senses — closes the Explore stage. Minimal context: a single light
  // thread from Imagine so Vita can give a warm callback in the stage-close,
  // nothing heavier (the module's substance is the primer and screening check).
  "2.6": [{ moduleId: "1.letter", extract: letterSceneExcerpt }],
};

// Whether a Stage 2 module has a carry-forward entry at all.
export function hasCarryForward(stage2Id: string): boolean {
  return stage2Id in CARRY_FORWARD;
}

// Assemble the carry-forward block for a Stage 2 module, ready to drop into the
// existing {priorReflections} slot. Returns "" when the module has no entry or
// nothing relevant was captured in Stage 1.
export function buildCarryForward(
  stage2Id: string,
  source: CarrySource
): string {
  const sources = CARRY_FORWARD[stage2Id];
  if (!sources) return "";

  const lines = sources.flatMap((s) => {
    const line = s.extract(source.getBuild(s.moduleId), source.getTakeaway(s.moduleId));
    return line ? [`- ${line}`] : [];
  });
  if (lines.length === 0) return "";

  return [
    "Here's some of what you learned about them in the Imagine stage. Use it only if it's directly relevant to what this module is about — a warm, specific callback can be a good way in, but only when the connection to this module's topic is genuine and useful. If it doesn't fit naturally, don't force a reference; let it simply inform how you understand them:",
    ...lines,
  ].join("\n");
}
