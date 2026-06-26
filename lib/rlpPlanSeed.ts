// One realistic example member, for developing the Retirement Life Plan reveal.
//
// This is a `ModelSource` (the same read surface buildUserModel / buildRlpPlan
// consume), so the seed flows through the exact same assembler the live data
// does — nothing here is bespoke to the plan render. It captures one coherent
// person whose values, goals, seasons, week and first year genuinely connect, so
// the cross-module synthesis has something true to find. Used only when the
// signed-in member has no Stage 4 data yet, so the screen is never empty in dev.

import type { BuildResult } from "@/lib/modules";
import type { ModelSource } from "@/lib/userModel";
import type { Stage3ValuesSummary } from "@/lib/stage3Seed";
import type { Dreams } from "@/lib/dreams";
import type { Takeaway } from "@/lib/takeaways";
import type { StoredFact } from "@/lib/contextFacts";
import { synthesizeActiveFacts } from "@/lib/resolverInputs";

export const SEED_MEMBER_NAME = "Margaret";

// ---- Prior-stage builds the user model reads (Stage 1–3) ----

const builds: Record<string, BuildResult> = {
  // Stage 1 — roles / identity.
  "1.roles": {
    type: "role-picker",
    picked: ["Grandmother", "Partner", "Teacher", "Friend", "Gardener", "Neighbour"],
    starred: ["Grandmother", "Gardener"],
    summaryLabel: "Your roles",
  },
  // Stage 3 — character strengths.
  "3.1": {
    type: "mirror-cards",
    kept: [
      { label: "Curiosity", evidence: "You keep reaching for the next thing to learn" },
      { label: "Kindness", evidence: "The people around you come up again and again" },
      { label: "Perseverance", evidence: "You finish what you start" },
      { label: "Love of learning" },
      { label: "Humour" },
    ],
    rejected: [],
    starred: ["Curiosity", "Kindness", "Perseverance"],
    summaryLabel: "Your strengths",
  },
  // Stage 3 — the priority ranking (orders the core values).
  "3.3": {
    type: "priority-choices",
    choices: [
      { left: "Family", right: "Making a difference", chose: "Family" },
      { left: "Health", right: "Learning", chose: "Health" },
    ],
    ranked: ["Family", "Health", "Making a difference", "Learning", "Independence"],
    summaryLabel: "Your priorities",
  },
  // Stage 2 — staying active (energy sources).
  "2.1": {
    type: "role-picker",
    picked: ["Swimming", "Walking", "Gardening"],
    starred: ["Swimming", "Walking"],
    summaryLabel: "Staying active",
  },
  // Stage 2 — purpose & contribution (energy sources).
  "2.4": {
    type: "role-picker",
    picked: ["Mentoring young people", "Volunteering locally"],
    starred: ["Mentoring young people"],
    summaryLabel: "Sources of purpose",
  },
  // Stage 2 — the people who feature (relationships).
  "2.3": {
    type: "role-picker",
    picked: ["Tom (my partner)", "The grandchildren", "Old colleagues", "Neighbours"],
    starred: ["Tom (my partner)", "The grandchildren"],
    summaryLabel: "The people in your life",
  },

  // ---- Stage 4 — the seven module outputs ----

  // 4.1 — leaving work.
  "4.1": {
    type: "readiness-snapshot",
    transition: {
      position: 70,
      lean: "gradual",
      shape: "A steady taper — fewer working days over a few years",
      period: "One to two years",
    },
    window: { fromLabel: "2", toLabel: "4" },
    factors: [
      { id: "finances", label: "Finances", level: "Building" },
      { id: "health", label: "Health", level: "Strong" },
      { id: "identity", label: "Who I am beyond work", level: "Strong" },
      { id: "relationships", label: "Relationships", level: "Strong" },
      { id: "purpose", label: "Sense of purpose", level: "Building" },
      { id: "unfinished", label: "Things I still want to finish", level: "Some" },
    ],
    finance: { dateKnown: "Roughly" },
    summaryLabel: "Your readiness snapshot",
  },

  // 4.2 — the seasons board.
  "4.2": {
    type: "seasons-board",
    placements: [
      { label: "Walk the South West Coast Path", category: "Aspiration", seasons: ["Early years"] },
      { label: "A long trip to Italy", category: "Aspiration", seasons: ["Early years"] },
      { label: "Learn watercolour painting", category: "Aspiration", seasons: ["Early years", "Middle years"] },
      { label: "Mentoring young people", category: "Purpose", seasons: ["Middle years", "Later years"] },
      { label: "Volunteering locally", category: "Purpose", seasons: ["Later years"] },
      { label: "Time with the grandchildren", category: "People", seasons: ["Throughout"] },
      { label: "Tom", category: "People", seasons: ["Throughout"] },
      { label: "Swimming", category: "Activity", seasons: ["Throughout"] },
      { label: "The garden", category: "Activity", seasons: ["Throughout"] },
    ],
    seasonOrder: ["Early years", "Middle years", "Later years", "Throughout"],
    summaryLabel: "Your seasons board",
  },

  // 4.3 — the balanced retirement: goals across the five areas, the spotlit few ranked.
  "4.3": {
    type: "balanced-goals",
    goals: [
      {
        label: "Be the grandmother who's really there",
        area: "connect",
        track: "be",
        ordinaryWeek: "A standing Friday with the grandchildren, and the school run whenever it's needed",
        focus: true,
        rank: 1,
        note: "This is the one I'd never trade.",
        season: "throughout",
      },
      {
        label: "A long, slow trip to Italy with Tom",
        area: "connect",
        track: "do",
        looksLike: "Three or four weeks, off-season, no rush",
        cadence: "the first or second year",
        focus: true,
        rank: 5,
        note: "We've talked about it for years. It's time.",
        season: "early",
      },
      {
        label: "Walk the South West Coast Path in stages",
        area: "move",
        track: "do",
        looksLike: "The whole path over two or three years, a stretch at a time",
        cadence: "a few stretches a year",
        stretch: "Walk it end to end in one long season",
        focus: true,
        rank: 2,
        note: "I've wanted this for twenty years.",
        season: "early",
      },
      {
        label: "Stay strong enough to keep up with the grandchildren",
        area: "move",
        track: "be",
        ordinaryWeek: "A daily walk and the swim — keeping the body willing",
        focus: false,
      },
      {
        label: "Keep my Sunday swim as a standing ritual",
        area: "restore",
        track: "be",
        ordinaryWeek: "An early swim and a slow coffee after, week in week out",
        focus: true,
        rank: 3,
        note: "It clears my head like nothing else.",
        season: "throughout",
      },
      {
        label: "Learn watercolour painting properly",
        area: "think",
        track: "do",
        looksLike: "Take a real course and fill a sketchbook from our travels",
        cadence: "a class a week",
        focus: true,
        rank: 4,
        note: "Something that's just mine, with no marking at the end of it.",
        season: "early",
      },
      {
        label: "Mentor a few young people leaving school",
        area: "contribute",
        track: "do",
        looksLike: "Tutor or mentor through a local programme",
        cadence: "a few hours a week in term time",
        focus: false,
      },
    ],
    areas: [
      { id: "restore", label: "Restore" },
      { id: "move", label: "Move" },
      { id: "think", label: "Think" },
      { id: "connect", label: "Connect" },
      { id: "contribute", label: "Contribute" },
    ],
    deliberateGaps: [],
    summaryLabel: "Your balanced retirement",
  },

  // 4.4 — the path to each spotlit goal.
  "4.4": {
    type: "goal-paths",
    paths: [
      {
        goal: "Be the grandmother who's really there",
        track: "be",
        alreadyHelps: ["We live twenty minutes away", "The Friday rhythm is already half-formed"],
        wouldHelp: ["Block Fridays out before anything else can claim them"],
        lean: "Kindness",
      },
      {
        goal: "Walk the South West Coast Path in stages",
        track: "do",
        milestones: [
          { label: "Walk our local cliff stretch most weekends", when: "now", done: true },
          { label: "Build up to a full day's walk", when: "first year" },
          { label: "Do the first official section together", when: "first year" },
          { label: "Book a guided week for a harder stretch", when: "year two" },
          { label: "Reach the final headland", when: "down the line" },
        ],
        lean: "Perseverance",
      },
      {
        goal: "Keep my Sunday swim as a standing ritual",
        track: "be",
        alreadyHelps: ["I already swim most weeks"],
        wouldHelp: ["Find an indoor pool for the cold months"],
      },
      {
        goal: "Learn watercolour painting properly",
        track: "do",
        milestones: [
          { label: "Buy a starter set and just play", when: "now", done: true },
          { label: "Join a beginners' class", when: "first year" },
          { label: "Paint from our own photographs", when: "first year" },
          { label: "Fill a sketchbook on the Italy trip", when: "year one or two" },
        ],
        lean: "Love of learning",
      },
      {
        goal: "A long, slow trip to Italy with Tom",
        track: "do",
        milestones: [
          { label: "Settle the rough region and time of year", when: "first year" },
          { label: "Sort the practicalities at home", when: "before we go" },
          { label: "Go", when: "first or second year" },
        ],
        lean: "Curiosity",
      },
    ],
    summaryLabel: "The path to your goals",
  },

  // 4.5 — trade-offs, values sorted, decision principles.
  "4.5": {
    type: "trade-offs",
    scenarios: [
      {
        title: "The big trip vs the steady months",
        situation: "A long Italy trip in year one would take up much of the year's freedom.",
        optionA: "Go big and early, while the energy's there",
        optionB: "Keep year one gentle and spread the trips out",
        lean: 38,
        protect: "Time at home with the grandchildren",
        sacrifice: "Rushing the trip just to tick it off",
      },
      {
        title: "Mentoring vs an open week",
        situation: "Mentoring could easily grow into a near-job again.",
        optionA: "Commit to a regular, fixed role",
        optionB: "Keep it to a few hours, on my own terms",
        lean: 72,
        protect: "A week that still breathes",
        sacrifice: "Quietly recreating the pressure of work",
      },
    ],
    values: [
      { value: "Family", bucket: "non-negotiable" },
      { value: "Health", bucket: "non-negotiable" },
      { value: "Independence", bucket: "non-negotiable" },
      { value: "Making a difference", bucket: "flexible" },
      { value: "Learning", bucket: "flexible" },
    ],
    principles: [
      "When two good things pull apart, the people come first.",
      "Do fewer things, and do them properly.",
      "Never let anything quietly turn back into work.",
    ],
    summaryLabel: "When you can't do it all",
  },

  // 4.6 — the rhythm of the week.
  "4.6": {
    type: "week-shape",
    structure: 62,
    activities: [
      { label: "A morning swim", category: "Restore", frequency: "A few times a week", anchor: true, energy: true },
      { label: "A walk", frequency: "Most days", energy: true },
      { label: "Fridays with the grandchildren", frequency: "Weekly", anchor: true, energy: true },
      { label: "Time in the garden", frequency: "Most days", energy: true },
      { label: "A watercolour class", frequency: "Weekly", anchor: true },
      { label: "A few days' consulting", frequency: "Now and then", fixed: true },
    ],
    summaryLabel: "The rhythm of your week",
  },

  // 4.7 — the first year, sequenced, with its narrative.
  "4.7": {
    type: "first-year",
    items: [
      { label: "Wind down to three days a week", kind: "work", season: "s1", fixed: true },
      { label: "First proper coast-path stretch", kind: "goal", season: "s1", top: true },
      { label: "Buy the watercolours, just play", kind: "goal", season: "s1" },
      { label: "Settle into the Friday rhythm", kind: "rhythm", season: "s1" },
      { label: "Join a beginners' watercolour class", kind: "goal", season: "s2" },
      { label: "Plan Italy properly", kind: "project", season: "s2" },
      { label: "Italy with Tom", kind: "trip", season: "s3", top: true, note: "Three weeks, off-season, no rush" },
      { label: "A harder section of the coast path", kind: "goal", season: "s4" },
      { label: "Look at mentoring for the new year", kind: "project", season: "s4" },
      { label: "The Sunday swim", kind: "rhythm", season: "all-year" },
      { label: "Time in the garden", kind: "rhythm", season: "all-year" },
      { label: "Two days' consulting a week", kind: "work", season: "all-year", fixed: true },
    ],
    narrative:
      "The first year starts gently, not with a clean break but a loosening — down to three days a week, with the long weekends suddenly my own. I want the early months to feel like coming up for air: the first real stretch of the coast path with Tom, the watercolours out on the kitchen table with no one marking them, and Fridays kept clear for the grandchildren so the rhythm sets before anything else fills the space. By the middle of the year I'd like a proper class under way and Italy taking shape — somewhere off-season, three slow weeks, the sketchbook coming with us. The back half of the year is for a harder section of the path and a first look at mentoring, only once the week has proved it can breathe. Underneath all of it: the Sunday swim, the garden, two steady days of work I'm choosing to keep for now. If by the end of the year the swim is a habit, the path is begun and Italy is behind us or booked, I'll know I started this well.",
    summaryLabel: "Your first year",
  },
};

const stage3Values: Stage3ValuesSummary = {
  values: [
    { value: "Family", meaning: "The people I love, close and well", confidence: "certain" },
    { value: "Health", meaning: "A willing body for as long as I can keep it", confidence: "certain" },
    { value: "Making a difference", meaning: "Leaving things, and people, a little better", confidence: "certain" },
    { value: "Learning", meaning: "Always something new on the go", confidence: "still forming" },
    { value: "Independence", meaning: "My time being mine to shape", confidence: "still forming" },
  ],
  savedAt: "2026-06-01T09:00:00.000Z",
};

const dreams: Dreams = {
  moduleId: "1.money",
  allDreams: [
    { id: "go", label: "Somewhere you'd go", text: "A long, slow trip to Italy" },
    { id: "learn", label: "Something you'd learn", text: "Watercolour painting" },
    { id: "build", label: "Something you'd take on", text: "Walk the South West Coast Path" },
  ],
  top3: [
    { dream: "A long, slow trip to Italy", reason: "Tom and I have promised ourselves it for years" },
    { dream: "Walk the South West Coast Path", reason: "I've wanted it for twenty years" },
    { dream: "Learn watercolour painting", reason: "Something that's just mine" },
  ],
  achievable: [],
  pipeDreams: ["A season ticket to the local theatre"],
  savedAt: "2026-06-01T09:00:00.000Z",
};

const dayNote: Takeaway = {
  moduleId: "1.day",
  moduleTitle: "A day in your retirement",
  text: "A swim to start, the garden, a long walk, and the grandchildren in and out.",
  savedAt: "2026-06-01T09:00:00.000Z",
};

// The ModelSource the assembler reads. Everything the live data layer would
// provide, for one coherent member.
export const SEED_SOURCE: ModelSource = {
  getBuild: (id) => builds[id] ?? null,
  getTakeaway: (id) => (id === "1.day" ? dayNote : null),
  getDreams: (id) => (id === "1.money" ? dreams : null),
  getStage3Values: () => stage3Values,
  getOnboarding: () => ({
    partner: "Me and my partner",
    horizon: "3 to 5 years",
    motivation: "A milestone birthday on the horizon",
  }),
};

// Phase 2: the assembler reads values from the canonical profile, so the seed
// member needs one too. Synthesized from the same structured builds above (the
// phase-1 backfill mapping), memoised. Assigned after the literal to avoid the
// self-reference. This is what makes the demo RLP show verbatim value
// descriptions and the 3.4 threat/protector through the new read path.
let seedFactsCache: StoredFact[] | null = null;
SEED_SOURCE.getActiveFacts = () =>
  (seedFactsCache ??= synthesizeActiveFacts(SEED_SOURCE));
