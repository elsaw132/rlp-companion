// Stage and module content for the RLP Companion.
// User-facing fields: title, description, primer (ordered text/video blocks), coachOpening.
// Private field (Vita only, never shown to the user): sessionInstructions.
// Readings/videos are placeholders for now — replace the primer blocks when the real content is ready.

import type { RetirementStage } from "@/lib/userData";
import { RETIREMENT_PATHS } from "@/lib/flags";

// An optional step between the reading and the conversation, where the person
// builds something Vita then opens from. Only "day-builder" exists so far; the
// union is ready to grow as new interaction types are added.
export type DayBuilderInteraction = {
  type: "day-builder";
  parts: string[];
  categories: { name: string; activities: string[] }[];
  // Heading for the read-only recap card. Defaults to "Your day".
  summaryLabel?: string;
};

// A role picker: choose meaningful options from grouped (or flat) lists, and —
// where starrable — mark a few as most alive.
export type RolePickerInteraction = {
  type: "role-picker";
  instruction: string;
  // Groups render with a heading each; a group with an empty name renders as a
  // flat, headingless list (used by Stage 2's single-list pickers).
  groups: { name: string; options: string[] }[];
  // Whether picks can be starred as "most alive". Defaults to true (the Stage 1
  // behaviour); Stage 2's flat pickers set it false.
  starrable?: boolean;
  // When set, finishing requires the number of picks to fall in [min, max].
  // Absent means the default gate of "at least one".
  selectRange?: { min: number; max: number };
  // Heading for the read-only recap card. Defaults to "Your roles"; Stage 2
  // modules whose picks aren't "roles" override it (e.g. 2.4's sources of purpose).
  summaryLabel?: string;
  // Whether the "add your own" free-text field shows. Defaults to true; fixed
  // single-choice pickers (e.g. 2.5's lever chooser) set it false.
  allowCustom?: boolean;
};

// Sliders: set positions on one or more left/right spectrums. Optionally with
// named waypoint labels under the track, and optionally a small single-select
// (e.g. about seasonal variation).
export type SlidersInteraction = {
  type: "sliders";
  instruction: string;
  spectrums: { left: string; right: string }[];
  // Waypoint labels rendered evenly under a single-spectrum track (e.g. an
  // activity-level scale). Purely descriptive; omitted for multi-spectrum use.
  anchors?: string[];
  // The small single-select shown under the sliders. Optional — modules with a
  // single bare slider (e.g. 2.1) omit it.
  seasonal?: { prompt: string; options: string[] };
  // Label leading the coach-facing summary. Defaults to "Ideal week".
  summaryLabel?: string;
};

// A letter from the future self. Unlike the other interactions this one
// replaces the turn-by-turn conversation entirely: the person picks who they're
// writing to, then writes a short letter on a dedicated surface. recipients are
// the warm preset options (always another person, never the present self);
// allowCustom adds a free-text "Someone else" choice.
export type LetterInteraction = {
  type: "letter";
  recipients: { id: string; label: string }[];
  allowCustom: boolean;
};

// Spark-prompts: a few open free-text fields, each a different angle on a
// money-no-object want. Deliberately not a preset picker — picking from a list
// would constrain desire. The person fills in as many as spark something.
export type SparkPromptsInteraction = {
  type: "spark-prompts";
  instruction: string;
  prompts: { id: string; label: string; placeholder: string }[];
  // Heading for the read-only recap card. Defaults to "What you'd do".
  summaryLabel?: string;
};

// A screening check: a short set of discrete-option questions, each answered by
// tapping exactly one option (e.g. "when did you last have an eye test?"). Not a
// picker or slider — it's the lightest possible form, used where the module's
// substance lives in the primer and the exercise is just a quick status check.
export type ScreeningCheckInteraction = {
  type: "screening-check";
  instruction: string;
  questions: { id: string; prompt: string; options: string[] }[];
  // Heading for the read-only recap card. Defaults to "Where you are with the basics".
  summaryLabel?: string;
};

// A composite interaction runs two or more sub-interactions together on one
// build screen, finished by a single shared button (e.g. a flat picker plus an
// activity-level slider). The letter is never a composite step.
export type CompositeInteraction = {
  type: "composite";
  steps: Interaction[];
  // Optional section heading shown above the step at the same index — used to
  // introduce a cluster of steps (e.g. a clear question before a run of
  // sliders). Entries may be null/absent for steps that need no heading.
  stepHeadings?: (string | null)[];
};

// ---- Stage 3 (Understand) interaction surfaces ----
// Every Stage 3 surface is pre-seeded by a one-off AI call (/api/stage3-seed)
// that reads the person's earlier answers and returns candidate content. The
// static config here (instructions, palettes, tag pools) is fixed; the seeded
// candidates arrive at runtime as a Stage3Seed (see lib/stage3Seed.ts) and are
// passed into the component alongside the interaction.

// 3.1 "Your strengths" — a mirror surface built on the fixed VIA character
// strengths (see VIA_CLUSTERS in lib/stage3Seed.ts), so the whole module is
// recognition against a known list, never open generation. Three movements on
// one surface: confirm the seeded ones that fit; scan the rest of the list and
// tap any that have been leaned on but haven't come up; then star a signature
// few and name how each might show up in retirement.
export type MirrorCardsInteraction = {
  type: "mirror-cards";
  // Movement 1 — the ones that fit. Heads the seeded candidate cards.
  instruction: string;
  // Movement 2 — the rest of the list. The remaining VIA strengths, shown as a
  // compact tappable set; tapping adds a card the person can note a line on.
  restLabel: string;
  restIntro: string;
  // Placeholder for the optional one-line "where it shows up" note on a card
  // the person added from the rest of the list.
  notePlaceholder: string;
  // Movement 3 — narrow. starLabel/starMax gate the signature few (no more than
  // five). Starring is the last action on the surface; where these strengths
  // might show up in retirement is drawn out later in the Vita conversation.
  starLabel: string;
  starMax: number;
  // Heading for the recap card and the coach summary (e.g. "Your strengths").
  summaryLabel: string;
  // Optional footnote shown at the top of the exercise — a short note with a
  // single outbound link (3.1 uses it to credit the VIA framework).
  footnote?: { text: string; linkLabel: string; linkUrl: string };
};

// 3.2 "Your values" — a triage surface built on the fixed value set, so the
// module is recognition against a known set (the same way 3.1 uses VIA). Seeded
// candidate value cards are sorted into three trays (that's me / not sure / not
// really); "not sure" is a first-class tray that carries forward. The rest of
// the set, grouped by cluster, is browsable beneath; a rare free-text escape
// hatch adds a value of the person's own.
export type ValueTriageInteraction = {
  type: "value-triage";
  instruction: string;
  // Heading and intro for "the rest of the set" — the values not surfaced,
  // shown grouped by cluster (the component owns the set itself).
  paletteLabel: string;
  paletteIntro: string;
  // Label for the de-emphasised free-text "add your own" row (meant to be rare).
  customLabel: string;
  // After sorting, the person marks the few values that feel most core — a
  // selection from the "that's me" tray (up to coreMax), never a ranking.
  // Fewer than coreMax is fine. These five become the module's output, and the
  // conversation draws out a description for each.
  coreLabel: string;
  coreMax: number;
  summaryLabel: string;
};

// 3.3 "What matters most" — quick-fire either/or choices built from the person's
// own picture, then an adjustable ranking of the values that pulled hardest.
export type PriorityChoicesInteraction = {
  type: "priority-choices";
  instruction: string;
  // Prompt shown above the ranking step.
  rankLabel: string;
  summaryLabel: string;
};

// 3.4 "Living your values" — one card per priority value. Each shows the
// description the person wrote for it in 3.2 (read-only), then a single two-beat
// flow: a seeded threat (one way the value quietly erodes in retirement) they
// confirm/swap, and a protector (what they'd protect to keep it alive) seeded as
// a candidate they accept or rewrite.
export type ValueDefinitionsInteraction = {
  type: "value-definitions";
  instruction: string;
  threatLabel: string;
  protectorLabel: string;
  protectorPlaceholder: string;
  summaryLabel: string;
};

// 3.5 "Hopes and fears" — a recognition surface for the quieter half of the
// picture. A short read-only hopes line opens it as a warm on-ramp; then the
// person reacts to candidate fear cards grouped into three time horizons (on my
// mind / not me / hadn't thought about it, but yes), with an optional note on the
// ones that land and a light "weighs heavily" flag. The rest of each horizon's
// bank is browsable, and there's an add-your-own escape hatch.
export type HopesFearsInteraction = {
  type: "hopes-fears";
  instruction: string;
  hopesLabel: string;
  // The three reaction-button labels, in fixed order: on-my-mind, not-me,
  // newly-recognised.
  reactionLabels: { onMyMind: string; notMe: string; newlyRecognised: string };
  noteLabel: string;
  notePlaceholder: string;
  weighsLabel: string;
  paletteLabel: string;
  paletteIntro: string;
  customLabel: string;
  summaryLabel: string;
};

// 3.6 "The bigger picture" — a reflective writing surface in the spirit of the
// Stage 1 letter, seeded with honest starting threads (and optionally a short
// editable draft). What these years stood for is drawn out through the writing
// itself and Vita's conversation, not a separate marking step.
export type BiggerPictureInteraction = {
  type: "bigger-picture";
  prompt: string;
  placeholder: string;
  threadsLabel: string;
  summaryLabel: string;
};

// 4.1 "When and how do you want to leave work?" — a readiness snapshot. Three
// parts: a transition spectrum (clean break ↔ gradual wind-down, with an
// optional shape/period follow-up that appears when the lean is toward
// gradual); a retirement window picked as a band, not a date; and a readiness
// profile rating a fixed set of factors at one of three levels. The finance
// factor is paired with a confidence-only follow-up (Consumer Duty: we ask how
// settled the timing feels, never give advice).
export type ReadinessSnapshotInteraction = {
  type: "readiness-snapshot";
  transitionInstruction: string;
  transition: { left: string; right: string };
  // Shown when the slider leans toward "gradual" (position >= 50).
  shapeLabel: string;
  shapeOptions: string[];
  periodLabel: string;
  periodOptions: string[];
  // The retirement window, chosen as a from–to band over these ordered marks.
  windowInstruction: string;
  windowMarks: string[];
  // The readiness factors to rate, and the three levels they're rated at. A
  // factor may override `levels` with its own scale when readiness isn't the
  // right axis for it (e.g. "things I still want to finish" → none/some/lots).
  factorsInstruction: string;
  factors: { id: string; label: string; levels?: string[] }[];
  levels: string[];
  // The id (within `factors`) that is the financial-readiness factor, plus the
  // confidence-only follow-up shown beneath it.
  financeFactorId: string;
  financeQuestion: { prompt: string; options: string[] };
  summaryLabel: string;
};

// The "seasons board" (Module 4.2). The person sorts cards — pre-populated from
// their earlier answers and passed in at render time — into broad retirement
// seasons (early / middle / later) or an enduring lane that runs across all of
// them. A card may sit in more than one season. The seasons and enduring lane
// are configured here; the cards themselves come from the user model.
export type SeasonsBoardInteraction = {
  type: "seasons-board";
  boardInstruction: string;
  seasons: { id: string; label: string; hint?: string }[];
  // The lane running across all seasons (e.g. "Throughout / enduring").
  enduringLane: { id: string; label: string; hint?: string };
  addOwnLabel: string;
  addOwnPlaceholder: string;
  summaryLabel: string;
};

// "Your balanced retirement" (Module 4.3). The module turns what the person has
// already said into specific goals, organised across the five areas of a
// balanced retirement: Restore, Move, Think, Connect, Contribute. The person
// works through the areas one at a time. Under each, springboards drawn from
// their earlier words (assembled from the user model and passed in at render
// time) prompt them to shape one or two real goals — using a gentle, SMART-
// informed framework with two tracks: a thing to do/achieve, or a way to live.
// Then, across all areas, they spotlight the handful whose absence would leave
// retirement incomplete, noting the season each belongs to. Balance is the
// point: a sparse area is a prompt, never a blank to fill anxiously.
export type BalancedAreaId =
  | "restore"
  | "move"
  | "think"
  | "connect"
  | "contribute";

export type BalancedGoalsInteraction = {
  type: "balanced-goals";
  // The five fixed areas, in order, each with a one-line sense of what it holds.
  areas: { id: BalancedAreaId; label: string; blurb: string }[];
  // Shown on the warm surface while Vita drafts the goals.
  draftingLabel: string;
  // One plain line at the top of the curation view.
  curationInstruction: string;
  // The balance picture shown across the five areas.
  balanceHint: string;
  // The two goal tracks. "Do" is a thing to do/achieve; "be" is a way to live.
  trackDoLabel: string;
  trackBeLabel: string;
  // do-goals: a rough "when / how often". be-goals: what an ordinary week holds.
  cadenceLabel: string;
  cadencePlaceholder: string;
  ordinaryWeekLabel: string;
  ordinaryWeekPlaceholder: string;
  // One-tap swap to a bolder or quieter phrasing of the same goal.
  bolderLabel: string;
  quieterLabel: string;
  // Set a suggestion aside.
  rejectLabel: string;
  // Start a fresh goal of your own in an area.
  addGoalLabel: string;
  addGoalPlaceholder: string;
  // Move from curating the draft to the focus pass.
  toFocusLabel: string;
  // The focus pass — spotlight the vital few (a spotlight, never a gate).
  focusInstruction: string;
  absencePrompt: string;
  maxFocus: number;
  noteLabel: string;
  notePlaceholder: string;
  seasonLabel: string;
  seasons: { id: string; label: string }[];
  // Naming an empty area as a deliberate choice rather than a gap.
  deliberateGapLabel: string;
  summaryLabel: string;
};

// "The path to your goals" (Module 4.4). For every goal the person spotlighted
// in 4.3, Vita drafts the route to it, and the person curates the draft —
// editing, reordering, adding, removing, or marking a step already done. Two
// shapes, by the goal's track: a do/achieve goal gets a short MILESTONE LADDER
// (3–5 stepping stones from where they are now to the goal, in rough order, a
// foundation-that-needs-work folded in as an early rung); a way-of-being goal
// gets no ladder, just a light note — what already supports it and the one or
// two things that would help it take root. Milestones are planning-level (the
// route, with at most a rough sense of when) — never dated tasks or a schedule,
// which belong to Stage 5 (Act). The draft comes from /api/goal-paths; the tone
// throughout shows how much of each path is already behind them.
export type GoalPathsInteraction = {
  type: "goal-paths";
  // Shown on the warm surface while Vita drafts the paths.
  draftingLabel: string;
  // One plain line at the top of the curation view.
  curationInstruction: string;
  // do-goals: the milestone ladder.
  ladderLabel: string;
  whenLabel: string;
  whenPlaceholder: string;
  doneLabel: string;
  addStepLabel: string;
  addStepPlaceholder: string;
  // be-goals: the light support note (no ladder).
  alreadyHelpsLabel: string;
  wouldHelpLabel: string;
  addSupportPlaceholder: string;
  // Both tracks: the one strength or resource to lean on.
  leanLabel: string;
  // A gentle reminder of the planning-level boundary (route, not schedule).
  boundaryHint: string;
  summaryLabel: string;
};

// 4.5 — "When you can't do it all". Vita drafts a few concrete trade-off
// scenarios from the person's emerging plan (their goals, their finance signal),
// plus a few candidate decision principles; the person curates all three parts:
// places a slider and writes what they'd protect / what would be too great a
// sacrifice on each scenario, sorts their core values into non-negotiable vs
// flexible, and shapes the decision principles.
export type TradeOffsInteraction = {
  type: "trade-offs";
  // Shown on the warm surface while Vita drafts the scenarios.
  draftingLabel: string;
  // One plain line at the top of the curation view.
  curationInstruction: string;
  // The trade-off scenarios block.
  scenariosLabel: string;
  protectLabel: string;
  protectPlaceholder: string;
  sacrificeLabel: string;
  sacrificePlaceholder: string;
  // The values sort block.
  valuesLabel: string;
  valuesInstruction: string;
  nonNegotiableLabel: string;
  flexibleLabel: string;
  // The decision-principles block.
  principlesLabel: string;
  principlesInstruction: string;
  addPrincipleLabel: string;
  principlePlaceholder: string;
  // A gentle reminder this explores priorities, never advises on finances.
  boundaryHint: string;
  summaryLabel: string;
};

// 4.6 — "The rhythm of your week". Vita reads back the person's real, recurring
// activities (drawn from everything heard across the programme, including the
// actual conversations); for each, the person sets a rough frequency, whether it's
// a regular anchor, and whether it gives energy. No day of the week, no time of
// day — false precision this far out. They also set the overall structure–freedom
// feel (pre-set to where they landed in Stage 1).
export type WeekShapeInteraction = {
  type: "week-shape";
  // Shown on the warm surface while Vita drafts the rhythm.
  draftingLabel: string;
  // One plain line at the top of the curation view.
  curationInstruction: string;
  // The structure–freedom slider block.
  structureLabel: string;
  structurePoleLeft: string;
  structurePoleRight: string;
  structureHint: string;
  // Shown under the slider when its starting point came from the person's
  // earlier "ideal week" answer (Stage 1), so they know where it's drawn from.
  structureFromEarlierHint: string;
  // The recurring-activities block.
  activitiesLabel: string;
  activitiesInstruction: string;
  // Per-activity controls.
  frequencyLabel: string;
  anchorLabel: string;
  energyLabel: string;
  addActivityLabel: string;
  activityPlaceholder: string;
  // The light read of the overall texture (full vs spacious, sociable vs quiet).
  textureLabel: string;
  // A gentle reminder this is the character of a sustainable week, not a timetable.
  boundaryHint: string;
  summaryLabel: string;
};

// 4.7 — "Your first year, as a journey". Vita assembles year one onto one visible
// timeline (four broad phases left to right, plus an across-the-year lane and a
// work band underneath) and writes a short first-person story of it. The person
// reshapes it mainly by telling Vita in natural language — the chat is the control
// surface, and both the timeline and the narrative update in front of them — with
// light direct moves (drag a piece between phases, star a headline, remove
// something) for precise single edits.
export type FirstYearInteraction = {
  type: "first-year";
  // Shown on the warm surface while Vita assembles the year.
  draftingLabel: string;
  // The four phases of the year, left to right, with their display labels. The
  // result stores the stable ids ("s1".."s4"); these supply what the person sees.
  seasons: { id: string; label: string }[];
  // The label for the across-the-year lane (the steady weekly rhythm).
  allYearLabel: string;
  // The work band beneath the timeline, and the line shown when it's a clean break.
  workLaneLabel: string;
  noWorkLabel: string;
  // The Vita-written narrative block heading.
  narrativeLabel: string;
  // Vita's first line in the editing chat, and the cues around the composer.
  introMessage: string;
  reshapeHint: string;
  chatPlaceholder: string;
  // The star control for a headline moment.
  topLabel: string;
  // The finish affordance and Vita's closing acknowledgement after it.
  finishLabel: string;
  closingAck: string;
  // A gentle reminder this sets the shape and order, never dated steps.
  boundaryHint: string;
  summaryLabel: string;
};

export type Interaction =
  | DayBuilderInteraction
  | RolePickerInteraction
  | SlidersInteraction
  | LetterInteraction
  | SparkPromptsInteraction
  | ScreeningCheckInteraction
  | CompositeInteraction
  | MirrorCardsInteraction
  | ValueTriageInteraction
  | PriorityChoicesInteraction
  | ValueDefinitionsInteraction
  | HopesFearsInteraction
  | BiggerPictureInteraction
  | ReadinessSnapshotInteraction
  | SeasonsBoardInteraction
  | BalancedGoalsInteraction
  | GoalPathsInteraction
  | TradeOffsInteraction
  | WeekShapeInteraction
  | FirstYearInteraction;

// What the person actually built in an interaction step. Stored (as JSON) so
// the conversation can show it back and a refresh keeps it. The union grows
// alongside Interaction as new types are added.
export type DayBuilderResult = {
  type: "day-builder";
  parts: string[];
  // Part name (e.g. "Morning") → the activities they put there, in order.
  assigned: Record<string, string[]>;
  // Heading for the recap card, carried from the interaction. Defaults to
  // "Your day" when absent.
  summaryLabel?: string;
};

export type RolePickerResult = {
  type: "role-picker";
  // Roles selected, in the order they were picked.
  picked: string[];
  // The subset starred as most alive (up to three).
  starred: string[];
  // Heading for the recap card, carried from the interaction. Defaults to
  // "Your roles" when absent.
  summaryLabel?: string;
};

export type SlidersResult = {
  type: "sliders";
  // Each spectrum carries its own labels and the 0–100 position set, so the
  // summary can be rendered from the result alone (no need for the interaction).
  spectrums: { left: string; right: string; position: number }[];
  // The seasonal question and the option chosen (null if left unanswered).
  // Absent entirely when the interaction had no seasonal block.
  seasonal?: { prompt: string; answer: string | null };
  // The summary label this result was built with, so the standalone summary text
  // can lead correctly ("Ideal week", "Activity level", …). Defaults to "Ideal week".
  summaryLabel?: string;
};

// A written letter and who it was addressed to. recipientId is the preset id
// (or "custom"); recipientLabel is what's shown ("an old friend you've lost
// touch with", or the free-text name they typed). body is the letter itself.
export type LetterResult = {
  type: "letter";
  recipientId: string;
  recipientLabel: string;
  body: string;
};

// The money-no-object wants the person captured, one entry per filled field.
// label is the field's prompt ("Somewhere you'd go"); text is what they wrote.
// Blank fields are dropped, so entries holds only the ones that sparked.
export type SparkPromptsResult = {
  type: "spark-prompts";
  entries: { id: string; label: string; text: string }[];
  // Heading for the recap card, carried from the interaction. Defaults to
  // "What you'd do" when absent.
  summaryLabel?: string;
};

// What the person answered in a screening check. Each entry carries its own
// prompt and chosen option, so the recap and coach summary render from the
// result alone (matching the self-contained pattern of the other results).
export type ScreeningCheckResult = {
  type: "screening-check";
  answers: { id: string; prompt: string; choice: string }[];
  // Heading for the recap card, carried from the interaction. Defaults to
  // "Where you are with the basics" when absent.
  summaryLabel?: string;
};

// The results of a composite interaction, one per sub-step, in the same order
// as the composite's `steps`.
export type CompositeResult = {
  type: "composite";
  results: BuildResult[];
};

// ---- Stage 3 result shapes (self-contained, like the others) ----

// 3.1 — the strengths the person kept (with their possibly-edited wording and
// the seed's evidence line), the ones they rejected, and the signature few.
export type MirrorCardsResult = {
  type: "mirror-cards";
  // evidence is the seed's grounding line; note is the person's own one-liner
  // on where a strength they added from the rest of the list shows up.
  kept: { label: string; evidence?: string; note?: string }[];
  rejected: string[];
  starred: string[];
  summaryLabel: string;
};

// 3.2 — every value the person placed, with its tray and any evidence. The
// "unsure" tray is kept deliberately, not dropped.
export type ValueTriageResult = {
  type: "value-triage";
  sorted: { label: string; tray: "me" | "unsure" | "not"; evidence?: string }[];
  // The values marked most core — a subset of the "me" tray, up to coreMax.
  core: string[];
  summaryLabel: string;
};

// 3.3 — each either/or choice (which side pulled, optional reason), and the
// resulting ranking of values, most-protected first.
export type PriorityChoicesResult = {
  type: "priority-choices";
  choices: { left: string; right: string; chose: string; why?: string }[];
  ranked: string[];
  summaryLabel: string;
};

// 3.4 — one entry per priority value: the description carried over from 3.2, the
// single threat the person confirmed, and the one or more protectors they chose
// or wrote — simple things they could commit to as part of their plan.
export type ValueDefinitionsResult = {
  type: "value-definitions";
  values: {
    value: string;
    description: string;
    threat: string;
    protectors: string[];
  }[];
  summaryLabel: string;
};

// 3.5 — the hopes line carried at the open, plus every fear card the person
// reacted to. reaction is which tray it landed in; "on-my-mind" and
// "newly-recognised" are the live ones the conversation works with. note is the
// optional specific worry; weighs marks the ones heavy enough to want the plan to
// take account of them.
export type HopesFearsResult = {
  type: "hopes-fears";
  hopes: string;
  fears: {
    label: string;
    horizon: string;
    reaction: "on-my-mind" | "not-me" | "newly-recognised";
    note?: string;
    weighs?: boolean;
  }[];
  summaryLabel: string;
};

// 3.6 — the reflective passage the person wrote, looking back.
export type BiggerPictureResult = {
  type: "bigger-picture";
  body: string;
  summaryLabel: string;
};

// 4.1 — the readiness snapshot. transition.position is the 0–100 slider value;
// lean is which side it settled on; shape/period are present only when the lean
// was gradual and the person answered them. window is the chosen from–to band
// (null until they set it). factors carries each factor's confirmed level. The
// finance follow-up records only how settled the timing feels (confidence, not
// advice).
export type ReadinessSnapshotResult = {
  type: "readiness-snapshot";
  transition: {
    position: number;
    lean: "clean-break" | "gradual";
    shape?: string;
    period?: string;
  };
  window: { fromLabel: string; toLabel: string } | null;
  factors: { id: string; label: string; level: string }[];
  // The finance factor's level (above) is the plan-confidence signal; this
  // records the separate "do you know when you'll be financially ready" answer.
  finance: { dateKnown?: string };
  summaryLabel: string;
};

export type SeasonsBoardResult = {
  type: "seasons-board";
  // Each card, with the season labels it sits in. A card may carry more than one
  // season, or the enduring lane's label. An empty `seasons` means it was left
  // unplaced. `own` marks cards the person added rather than pre-populated ones.
  placements: {
    label: string;
    category?: string;
    seasons: string[];
    own?: boolean;
  }[];
  // The season labels in display order (early → later → enduring), so the recap
  // and coach-facing text can group and order without the interaction config.
  seasonOrder: string[];
  summaryLabel: string;
};

export type BalancedGoalsResult = {
  type: "balanced-goals";
  // Every goal the person shaped, each sitting in one balanced area. `track`
  // says whether it's a thing to do/achieve or a way to live. The do/achieve
  // fields (looksLike/cadence/stretch) and the way-of-living field (ordinaryWeek)
  // are optional and only carry where the person gave them. `focus` marks the
  // spotlit handful; on those, `rank` (1-based) gives their order, `note` the
  // personal meaning, and `season` where it belongs.
  goals: {
    label: string;
    area: BalancedAreaId;
    track: "do" | "be";
    springboard?: string;
    looksLike?: string;
    cadence?: string;
    stretch?: string;
    ordinaryWeek?: string;
    focus?: boolean;
    rank?: number;
    note?: string;
    season?: string;
  }[];
  // The five areas in order, with labels, so the recap and the "balanced
  // retirement" overview render without the interaction config.
  areas: { id: BalancedAreaId; label: string }[];
  // Areas the person named as deliberately empty — a choice, not a gap to fill.
  deliberateGaps: BalancedAreaId[];
  summaryLabel: string;
};

// 4.4 — the curated path for each spotlighted goal. One entry per goal, carrying
// its track. A do/achieve goal carries an ordered `milestones` ladder (each rung
// with an optional rough `when` and a `done` flag for the rungs already behind
// them). A way-of-being goal carries no ladder — instead `alreadyHelps` (what
// already supports it) and `wouldHelp` (the one or two things that would help it
// take root). Both may carry `lean`: one strength or resource to lean on.
export type GoalPathsResult = {
  type: "goal-paths";
  paths: {
    goal: string;
    track: "do" | "be";
    milestones?: { label: string; when?: string; done?: boolean }[];
    alreadyHelps?: string[];
    wouldHelp?: string[];
    lean?: string;
  }[];
  summaryLabel: string;
};

// 4.5 — the curated trade-offs. `scenarios` holds each concrete dilemma Vita
// drafted, with where the person leaned (`lean`, 0–100, 50 = balanced) and what
// they'd most want to protect / what would feel like too great a sacrifice.
// `values` is each core value sorted into non-negotiable, flexible, or left
// unsorted. `principles` are the personal decision principles they shaped.
export type TradeOffsResult = {
  type: "trade-offs";
  scenarios: {
    title: string;
    situation: string;
    optionA: string;
    optionB: string;
    lean: number;
    protect?: string;
    sacrifice?: string;
  }[];
  values: { value: string; bucket: "non-negotiable" | "flexible" | "unsorted" }[];
  principles: string[];
  summaryLabel: string;
};

// 4.6 — the week's rhythm. `structure` (0–100) is the overall feel, from highly
// structured (0) to largely open (100). `activities` is the real, recurring things
// that fill the week. Each carries a rough `frequency` (one of "Most days", "A few
// times a week", "Weekly", "Now and then") — never a day or time. `anchor` marks
// the regular fixed points the week is built around; `energy` marks what gives
// them energy; `fixed` marks ongoing work they plan around; `own` marks ones they
// added.
export type WeekShapeResult = {
  type: "week-shape";
  structure: number;
  activities: {
    label: string;
    category?: string;
    frequency: string;
    anchor?: boolean;
    energy?: boolean;
    fixed?: boolean;
    own?: boolean;
  }[];
  summaryLabel: string;
};

// 4.7 — the sequenced first year. `items` is everything that makes up year one:
// goals and trips, threads of the weekly rhythm, and any ongoing-work footprint.
// Each carries a `kind` (trip / goal / project / rhythm / work), a `season` (one
// of "s1".."s4" for which phase it lands in, or "all-year" for things that run
// throughout), `top` for a headline moment, `fixed` for the ongoing-work
// footprint, and `own` for ones added during editing. `narrative` is Vita's short
// first-person story of the year, kept in sync with the timeline.
export type FirstYearResult = {
  type: "first-year";
  items: {
    label: string;
    kind: "trip" | "goal" | "project" | "rhythm" | "work";
    season: string;
    top?: boolean;
    note?: string;
    fixed?: boolean;
    own?: boolean;
  }[];
  narrative: string;
  summaryLabel: string;
};

export type BuildResult =
  | DayBuilderResult
  | RolePickerResult
  | SlidersResult
  | LetterResult
  | SparkPromptsResult
  | ScreeningCheckResult
  | CompositeResult
  | MirrorCardsResult
  | ValueTriageResult
  | PriorityChoicesResult
  | ValueDefinitionsResult
  | HopesFearsResult
  | BiggerPictureResult
  | ReadinessSnapshotResult
  | SeasonsBoardResult
  | BalancedGoalsResult
  | GoalPathsResult
  | TradeOffsResult
  | WeekShapeResult
  | FirstYearResult;

// A concrete plan entry captured after a module's conversation closes — distinct
// from reflection data: it's an actionable commitment the person sets for their
// Retirement Life Plan. Currently just the senses module's screening rhythm.
export type ScreeningCommitment = {
  // The cadence they chose (e.g. "Every year").
  frequency: string;
  // An optional specific next action they named ("" when they didn't).
  nextAction: string;
};

// A single block in a module's primer — the content shown before the
// conversation. Primers are an ordered list, so any mix is possible:
// text→video, video→text, text→video→text, and so on. A plain text-only or
// video-only primer is just a one-block list.
export type ContentBlock =
  | { type: "text"; value: string }
  | { type: "video"; url: string }
  | { type: "links"; links: { label: string; url: string }[] };

export type Module = {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  // The primer shown before the conversation, rendered in order.
  primer: ContentBlock[];
  // Vita's first line into the conversation. Omitted for modules that don't run
  // a turn-by-turn conversation (e.g. the letter module, where a writing surface
  // replaces the chat).
  coachOpening?: string;
  // Private guidance for the conversation (Vita only). Omitted for modules with
  // no conversation phase.
  sessionInstructions?: string;
  interaction?: Interaction;
  // An optional commitment captured after the conversation closes, shown as a
  // small Vita-voiced widget on the completion screen and saved as a concrete
  // plan entry. Only the senses module uses it so far.
  closingCommitment?: ClosingCommitment;
  // Closes in a single sign-off instead of the usual two-step "mirror back, then
  // confirm" wrap-up. Set this for short, practical modules with concrete, binary
  // answers (e.g. the senses screening) where there's nothing inferred to
  // validate — restating two plain answers is just noise. Leave unset for richer
  // modules (purpose, roles, people) where the mirror turn earns its place.
  closeInOneStep?: boolean;
  // When set, this module is shown ONLY to people in one of these retirement
  // stages (Phase 3, behind the RETIREMENT_PATHS flag). Undefined = everyone
  // (the default for every existing module). Filtered out of ordering, gating,
  // progress and the dashboard for anyone else, so with the flag off or for a
  // non-matching stage the programme is byte-identical to today. See
  // moduleVisibleFor / visibleModules below.
  audience?: RetirementStage[];
  // The inverse of audience (Phase 4): shown to everyone EXCEPT these stages
  // (when the flag is on). Undefined = shown to all. Used to drop module 4.1 from
  // Plan for the retired cohorts, who meet it as a reflection in the Review stage
  // instead. Unlike audience, a hideFrom module stays universal with the flag off,
  // so today's behaviour is unchanged.
  hideFrom?: RetirementStage[];
};

// The two already-retired cohorts. Stage 1 becomes "Review" for them, re-ordered
// and re-purposed to take stock of the retirement they're living.
export function isRetired(rs: RetirementStage | null): boolean {
  return rs === "recently_retired" || rs === "established";
}

// Whether a module is visible to someone in the given retirement stage. A module
// with no audience/hideFrom is universal. `audience` is an allow-list (shown only
// to those stages, flag on); `hideFrom` is a deny-list (shown to all except those
// stages, flag on). rs=null (the default everywhere that doesn't thread a stage)
// or the flag off keeps today's behaviour: audience modules hidden, hideFrom
// modules shown.
export function moduleVisibleFor(
  m: Module,
  rs: RetirementStage | null
): boolean {
  if (m.audience) {
    if (!RETIREMENT_PATHS) return false;
    return rs !== null && m.audience.includes(rs);
  }
  if (m.hideFrom && RETIREMENT_PATHS && rs !== null && m.hideFrom.includes(rs)) {
    return false;
  }
  return true;
}

// The order the retired cohorts meet the Review (Stage 1) modules in — different
// from the Imagine order (money moves later; the work-life reflection sits second).
// Ids not listed keep their array order after the listed ones.
const REVIEW_ORDER = [
  "1.day",
  "1.worklife",
  "1.roles",
  "1.week",
  "1.money",
  "1.letter",
];

// A stage's modules filtered to those visible for this retirement stage, in the
// order they should appear. This is the single lens all ordering/gating/progress
// goes through. For the retired cohorts, Stage 1 (Review) is re-ordered per
// REVIEW_ORDER; everyone else keeps array order.
export function visibleModules(stage: Stage, rs: RetirementStage | null): Module[] {
  const mods = stage.modules.filter((m) => moduleVisibleFor(m, rs));
  if (stage.number === 1 && RETIREMENT_PATHS && isRetired(rs)) {
    const rank = (id: string) => {
      const i = REVIEW_ORDER.indexOf(id);
      return i === -1 ? REVIEW_ORDER.length : i;
    };
    return [...mods].sort((a, b) => rank(a.id) - rank(b.id));
  }
  return mods;
}

// The stage's name for this person. Retired cohorts see Stage 1 as "Review" and
// Stage 4 as "Retirement Reset Plan" (naming only in Phase 4; the plan surfaces
// themselves come in Phase 5). Everyone else, and the flag off, keeps the base
// name.
export function stageNameFor(stage: Stage, rs: RetirementStage | null): string {
  if (RETIREMENT_PATHS && isRetired(rs)) {
    if (stage.number === 1) return "Review";
    if (stage.number === 4) return "Retirement Reset Plan";
  }
  return stage.name;
}

// A stage's one-line subtitle for this person. Stage 1's "Picture your future"
// reads wrong under "Review" for someone already retired (Phase 6). null /
// flag-off keeps the base subtitle.
export function stageSubtitleFor(stage: Stage, rs: RetirementStage | null): string {
  if (RETIREMENT_PATHS && isRetired(rs) && stage.number === 1) {
    return "Take stock of where you are";
  }
  return stage.subtitle;
}

// A module's title for this person. Most titles are universal; the few that read
// as future-tense for someone already retired are reframed here (Phase 6), so the
// card and session header match the reframed copy inside. Everyone else, and the
// flag off, keeps the base title.
export function titleFor(mod: Module, rs: RetirementStage | null): string {
  if (RETIREMENT_PATHS && isRetired(rs)) {
    if (mod.id === "1.letter") return "Your retirement, in a letter";
    if (mod.id === "1.roles") return "The roles you play";
    if (mod.id === "1.day") return "A day in your retirement now";
  }
  return mod.title;
}

// Copy for a module's post-conversation commitment widget: Vita's prompt, the
// tappable cadence options, and the optional one-line next-action field.
export type ClosingCommitment = {
  prompt: string;
  frequencyLabel: string;
  frequencyOptions: string[];
  actionLabel: string;
  actionPlaceholder: string;
  confirmLabel: string;
  skipLabel: string;
};

// A brief framing moment shown once, the first time a stage becomes the user's
// current stage — what this stage is for, in Vita's voice. Optional: only
// stages with real copy show one. body is rendered as separate paragraphs.
export type StageIntro = {
  heading: string;
  body: string[];
  buttonLabel: string;
};

export type Stage = {
  number: number;
  name: string;
  // One-line label shown under the stage name in the sidebar nav.
  subtitle: string;
  // Shown once on first forward entry into the stage; omit until copy exists.
  intro?: StageIntro;
  // Short fragments for the dashboard hero when crossing a stage line. lookBack
  // is a past-tense nod to what the person did in this stage (read after "That's
  // the whole of {name} behind you now — …"); lookAhead frames what this stage
  // is for (read after "Next comes {name}, where …"). Kept brief; omit either to
  // fall back gracefully.
  lookBack?: string;
  lookAhead?: string;
  modules: Module[];
};

// ---- Senses module (2.6): age-gated hearing-check recommendation -----------
// The "book a hearing check" recommendation is only meant for people aged 50 or
// over. We capture no birthdate — the only age signal is the onboarding
// retirement-horizon band — so we treat anyone within ~10 years of retirement
// (almost certainly 50+, since retirement isn't reachable much before the
// mid-50s), or unsure how far off it is, as in scope. People more than 10 years
// out are likely still in their forties, so the recommendation is withheld from
// them; and with no horizon recorded at all we also withhold it rather than push
// it on someone who may be well under 50.
export function hearingCheckRecommended(
  horizon: string | null | undefined,
  age?: number | null
): boolean {
  // Prefer a real age when we have one (from the onboarding date of birth): the
  // recommendation is for people 50 or over. With no DOB we fall back to the
  // coarse retirement-horizon signal exactly as before, so existing users and
  // anyone who skipped DOB keep today's behaviour.
  if (typeof age === "number") return age >= 50;
  return (
    horizon === "Less than 2 years" ||
    horizon === "2–5 years" ||
    horizon === "5–10 years" ||
    horizon === "Not sure"
  );
}

// The senses module's private guidance to Vita. The base is shown to everyone;
// one of the two hearing blocks below is appended at request time depending on
// whether the hearing-check recommendation is in scope for this person.
const SENSES_BASE_INSTRUCTIONS = `PURPOSE
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just marked when they last had an eye test and a hearing check (shown under WHAT THEY BUILT). This is a short, practical session about two senses only: sight and hearing. Help them see where they stand on a couple of simple, low-effort habits. This is the last Explore session — close the whole stage warmly.

TONE — IMPORTANT
Keep it warm, plain and practical. Inform, don't urge. Offer any check as a worthwhile option someone might choose, never as something they "really should" do, and never with urgency or alarm. One light mention is plenty. If they're not interested, accept it cleanly and move on — no persuasion.

HOW TO RUN IT
- The eye test: if theirs is recent, acknowledge it warmly — they're already on it. If it was a while ago or they can't remember, you can note lightly that a routine eye test is an easy thing to book whenever it suits them. No pressure.
- Keep it short — a few turns, one question at a time.
- Right after you close, a small step will appear where they can set a rhythm for keeping these checks up, so you do NOT need to pin down exact dates or frequencies yourself. Just leave the door open warmly in your wrap-up.

MUST NOT
- No catastrophising about loss. No dramatic framing. No "while you still can".
- No medical advice, diagnosis, or condition education beyond a simple, practical booking mention.
- If they mention an existing eye or hearing condition, handle it with real care — don't assume the general case, and don't imply they've done anything wrong.

CLOSING
Acknowledge warmly that this is the last Explore session and they've now finished the whole stage — grounded and real, not a fanfare. Frame what Explore did accurately: they've looked at what goes into a full, balanced retirement and picked out the elements they'd enjoy — not built a finished retirement, and not a plan. A brief, specific nod to the Imagine picture is welcome if it fits. Then bridge into the next stage, Understand, where you'll help them see what matters most across everything they've pictured.

WATCH FOR
- If fear of decline surfaces, stay calm and practical — bring it back to the simple, everyday habit they can act on whenever they choose.
- Welcome revisions — that's them building the picture.`;

// Appended when the hearing-check recommendation is in scope (likely 50+).
const SENSES_HEARING_REC_BLOCK = `THE HEARING CHECK — OFFER GENTLY, ONLY IF IT FITS
This person is at an age where an occasional hearing check is a sensible norm, so it's fine to mention it. If their hearing check is recent, just acknowledge it warmly. If it was a while ago, they've never had one, or they can't remember, you may note — once, lightly, as a worthwhile option rather than advice — that many people have a quick hearing check every few years from around 50, and it's easy to arrange. Offer it neutrally and let it rest. Do not press, do not ask them to commit to a date or when they could "realistically" book one, and never imply they've left it too long. If they're not interested, move on warmly.`;

// Appended instead when it is out of scope (likely under 50, or age unknown):
// Vita acknowledges the answer but never suggests booking a hearing check.
const SENSES_NO_HEARING_REC_BLOCK = `THE HEARING CHECK — DO NOT RAISE IT
This person is not yet at the age where a routine hearing check is the norm, so do NOT suggest booking one, and do not treat a "longer ago", "never", or "can't remember" answer about hearing as something to act on. If they raise it themselves, you can say plainly that a routine hearing check is something that becomes worthwhile from around 50. Otherwise, acknowledge their answer lightly and keep your focus on the eye test.`;

// The closing plan step. The default covers sight and hearing (for people the
// hearing recommendation is in scope for); the eye-only variant drops hearing
// for everyone else.
const SENSES_COMMITMENT: ClosingCommitment = {
  prompt: "Would you like to add regular eye and hearing checks to your plan?",
  frequencyLabel: "A rhythm that suits you",
  frequencyOptions: ["Every year", "Every 2 years"],
  actionLabel: "A first step, if one comes to mind (optional)",
  actionPlaceholder: "e.g. book an eye test this month",
  confirmLabel: "Add to my plan",
  skipLabel: "Maybe later",
};

const SENSES_COMMITMENT_EYE_ONLY: ClosingCommitment = {
  prompt: "Would you like to add regular eye tests to your plan?",
  frequencyLabel: "A rhythm that suits you",
  frequencyOptions: ["Every year", "Every 2 years"],
  actionLabel: "A first step, if one comes to mind (optional)",
  actionPlaceholder: "e.g. book an eye test this month",
  confirmLabel: "Add to my plan",
  skipLabel: "Maybe later",
};

// Request-time builders: the senses module's guidance and closing step, tailored
// to whether the hearing-check recommendation is in scope for this person's
// retirement horizon. Called from the session page, which has the horizon.
export function sensesSessionInstructions(
  horizon: string | null | undefined,
  age?: number | null
): string {
  const hearingBlock = hearingCheckRecommended(horizon, age)
    ? SENSES_HEARING_REC_BLOCK
    : SENSES_NO_HEARING_REC_BLOCK;
  return `${SENSES_BASE_INSTRUCTIONS}\n\n${hearingBlock}`;
}

export function sensesClosingCommitment(
  horizon: string | null | undefined,
  age?: number | null
): ClosingCommitment {
  return hearingCheckRecommended(horizon, age)
    ? SENSES_COMMITMENT
    : SENSES_COMMITMENT_EYE_ONLY;
}

// The full programme has five stages; only Stage 1 (Imagine) content exists so
// far. Stages 2–5 are listed here (name + subtitle) so the dashboard can render
// the full sidebar nav and the five-stage arc from one source; their modules
// arrays stay empty until that content is built.
export const TOTAL_STAGES = 5;

export const STAGES: Stage[] = [
  {
    number: 1,
    name: "Imagine",
    subtitle: "Picture your future",
    lookBack:
      "you pictured ordinary days and started to see the retirement you'd want",
    lookAhead:
      "you picture the retirement you want — starting with a single ordinary day",
    intro: {
      heading: "Let's start by imagining",
      body: [
        "Before you can plan a retirement, it helps to be able to picture one. These first few sessions are for exactly that — getting a vivid sense of what your retirement could actually look like.",
        "There's no right answer here, and nothing to get perfect. This is a first sketch — something you'll come back to, deepen, and reshape as you move through the later stages.",
        "We'd suggest taking about one a day, so each has time to settle.",
      ],
      buttonLabel: "Let's begin",
    },
    modules: [
      // Winding-down only (Phase 3): a brief context-setter shown FIRST in
      // Imagine, so the rest of the stage builds on where they already are.
      // audience hides it from everyone else, keeping Imagine at five modules.
      {
        id: "1.winddown",
        title: "Your wind-down so far",
        description:
          "A quick picture of where you are with winding down — the shape of it now, and how it's felt so far.",
        durationMin: 5,
        audience: ["winding_down"],
        primer: [
          {
            type: "text",
            value: `Winding down is its own stage: one foot in work, one stepping into what's next. You've already started the shift, which gives you a head start on picturing the rest. First, a quick picture of where you are.`,
          },
        ],
        interaction: {
          type: "screening-check",
          instruction:
            "A few quick taps to set the scene. There's no right answer — just what's true for you right now.",
          summaryLabel: "Where you are with winding down",
          questions: [
            {
              id: "shape",
              prompt: "How much are you still working?",
              options: [
                "Most of the week",
                "About half",
                "A day or two",
                "Very little",
              ],
            },
            {
              id: "duration",
              prompt: "How long have you been winding down?",
              options: [
                "Just started",
                "Under a year",
                "One to two years",
                "Longer than that",
              ],
            },
            {
              id: "decision",
              prompt:
                "Have you decided how and when you'll leave work altogether?",
              options: ["A set date or plan", "A rough window", "Not yet — still open"],
            },
          ],
        },
        coachOpening: `Thanks — that gives me a clear sense of where you are. On the whole, how have you found winding down so far — what's been good about it, and what's been more of an adjustment?`,
        sessionInstructions: `PURPOSE
This is the first session of the programme for someone who is already winding down — one foot in work, one stepping into what's next. It's brief and mostly about context: get a warm, real picture of where they are, so everything that follows builds on it. They've just tapped how much they're still working, how long they've been winding down, and whether they've decided how and when they'll leave work altogether (shown under WHAT THEY BUILT). Reflect that back and draw out one genuine thread — don't dwell or turn it into a full session.

HOW TO RUN IT
- Open by reflecting their situation back warmly and specifically, using what they tapped: how much they're still working and how long they've been at it. Then take their answer to how winding down has felt.
- Pick up ONE genuine thread from what they say — something good, or something they're finding an adjustment — and stay with it briefly. One or two exchanges, not a deep dive.
- Look at their answer to the decision question (under WHAT THEY BUILT):
  - If they have "A set date or plan": they've decided. Gently ask how they came to that decision — what settled it — and how they feel about it now the end is in view. Draw out both the reasoning and the emotion, lightly. Don't relitigate the decision or push on the date.
  - If "A rough window" or "Not yet — still open": they haven't fully decided, and that's completely fine. Note warmly that there's a session in the Plan stage that looks at the shape and timing of the rest properly, so they don't need to work it out now.
- Keep the whole thing short and warm — a few exchanges.

MUST NOT
- Don't treat winding down as a problem to fix or a loss to mourn. It's a stage with its own texture; meet it as that.
- Don't push toward a leaving date, and don't imply that leaving sooner (or staying longer) is the better choice.
- Don't pile on praise, and don't over-interpret. Keep it plain.

CLOSING
Briefly reflect what you've heard — where they are with winding down, and the one thread that stood out — and check it feels right. Note warmly that this sets the scene, and that the next sessions help them picture the retirement the wind-down is leading toward.`,
      },
      // Retired cohorts only (Phase 4): the "what work gave you" reflection that
      // used to sit in Plan (4.1) now lives in Review, second in the stage
      // (positioned by REVIEW_ORDER). audience hides it from everyone else.
      {
        id: "1.worklife",
        title: "What work gave you",
        description:
          "A look at what work quietly provided — and what you might want to bring into this chapter on purpose.",
        durationMin: 15,
        audience: ["recently_retired", "established"],
        primer: [
          {
            type: "text",
            value: `Work quietly gives us a lot — purpose, structure, people, a sense of who we are. When it ends, some of that can be missed, often more than people expect. Let's look at what work gave you, and what you might want to bring into this chapter on purpose.`,
          },
        ],
        interaction: {
          type: "composite",
          stepHeadings: ["What you miss from work", "How leaving came about"],
          steps: [
            {
              type: "role-picker",
              instruction:
                "Work gives us a lot without our noticing. Which of these did it give you that you now miss, or would like to find another source for?",
              starrable: false,
              allowCustom: true,
              summaryLabel: "What you miss from work",
              groups: [
                {
                  name: "",
                  options: [
                    "A sense of purpose",
                    "Structure to the day",
                    "A sense of who I am",
                    "Social contact and colleagues",
                    "A feeling of achievement",
                    "Routine and rhythm",
                  ],
                },
              ],
            },
            {
              type: "role-picker",
              instruction: "And how did leaving work come about for you?",
              starrable: false,
              allowCustom: false,
              selectRange: { min: 1, max: 1 },
              summaryLabel: "How leaving came about",
              groups: [
                {
                  name: "",
                  options: [
                    "Mostly my own choice",
                    "A mix of both",
                    "Mostly decided by circumstances",
                  ],
                },
              ],
            },
          ],
        },
        coachOpening: `Thanks for marking those. Let's start with what you miss — of the things you picked, which one do you feel the absence of most in an ordinary week now?`,
        sessionInstructions: `PURPOSE
This person has retired. This session looks at what work quietly gave them — purpose, structure, identity, social contact, achievement, routine — so anything they miss can be brought into this chapter on purpose rather than left as a quiet gap. They've marked what they miss and how leaving work came about (both under WHAT THEY BUILT). Handle it warmly and with care; this can touch identity and loss.

HOW TO RUN IT
- Open on what they miss most, from what they marked. Draw out the real texture — what specifically they miss about it, and where an ordinary week feels the absence.
- Move toward how that thing might find another home now — a source of the same purpose, contact, or structure — without rushing to fix it or turn it into a to-do list. Keep it reflective.
- Aim to reach your close within roughly five to seven exchanges.

HOW LEAVING CAME ABOUT — HANDLE WITH CARE
- NEVER presume leaving was chosen. Read what they marked.
- If they marked "Mostly my own choice": treat it lightly and move on — no need to dwell.
- If they marked "A mix" or "Mostly decided by circumstances": meet it with care. Acknowledge that leaving wasn't fully on their terms, without pressing on anything painful. Where it fits, gently ask — once — whether there's any part of their working life that feels unfinished, something they'd have liked to round off. If they name something, reflect it back plainly as a real thread (it becomes something the plan can help with later). If they'd rather not, let it go cleanly. Don't dwell, don't counsel, don't try to resolve it.

MUST NOT
- Don't imply that missing work is a problem, or that they should be "over it".
- Don't turn this into planning or first steps — that comes later. Keep it reflective.
- Don't pile on praise or over-interpret.

CLOSING
Mirror back, in their words: what they miss most, any sense of where it might find another home, and — if it came up — the unfinished thread. Note warmly that this adds to their Retirement Life Plan, and that the next session looks at the roles they play now.`,
      },
      {
        id: "1.day",
        title: "A day in your retirement",
        description:
          "A guided picture of one ordinary day in your future — a Tuesday in October, a few years from now.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — the short intro video and reading for this session are still to come.] Before you can plan a retirement, it helps to be able to picture one. Not the big milestones — just an ordinary day. In a moment, Vita will walk you through one: a Tuesday in October, a few years from now. There are no right answers, and nothing to work out.`,
          },
          { type: "video", url: "https://www.youtube.com/watch?v=SvEeJigbOwo" },
        ],
        coachOpening: `Here's the day you've put together. Let's talk it through — looking at the whole thing, which part are you most looking forward to?`,
        interaction: {
          type: "day-builder",
          // Stored explicitly so the recap heading never depends on the default.
          summaryLabel: "Your day",
          parts: ["Morning", "Afternoon", "Evening"],
          categories: [
            {
              name: "Body & movement",
              activities: [
                "Walk",
                "Run",
                "Gym",
                "Swim",
                "Cycle",
                "Yoga or stretch",
                "Golf",
                "A class",
                "Dance",
              ],
            },
            {
              name: "Home & making",
              activities: [
                "Cook a proper meal",
                "Bake",
                "Gardening",
                "DIY & repairs",
                "A project",
                "Crafts or sewing",
                "Decorating",
                "Sort & declutter",
              ],
            },
            {
              name: "People & connection",
              activities: [
                "Time with your partner",
                "Family",
                "Grandkids",
                "See friends",
                "Have people over",
                "A call with someone far away",
                "A club or group",
                "Time on your own",
              ],
            },
            {
              name: "Mind & learning",
              activities: [
                "Read",
                "A course or class",
                "Learn a language",
                "Play music",
                "Write or journal",
                "Puzzles or games",
                "Look into something that interests you",
              ],
            },
            {
              name: "Out & about",
              activities: [
                "Coffee out",
                "The market or shops",
                "A walk somewhere new",
                "Time in nature",
                "A museum or gallery",
                "A day trip",
                "Away somewhere",
              ],
            },
            {
              name: "Purpose & contribution",
              activities: [
                "Volunteer",
                "Mentor or advise",
                "A bit of paid work",
                "Help a cause you care about",
                "Help family practically",
              ],
            },
            {
              name: "Rest & quiet",
              activities: [
                "A lie-in",
                "Slow breakfast",
                "Sit with a coffee",
                "A nap",
                "TV or a film",
                "Music or radio",
                "Potter about",
                "Time in the garden",
                "Do nothing much",
              ],
            },
          ],
        },
        sessionInstructions: `PURPOSE
The person has just built an ordinary Tuesday in their retirement from a palette of activities. Bring the day to life and find what matters most in it, and why. This is an imaginative Imagine-stage session: draw out the texture of the day itself — the deeper angles and other topics come in later sessions.

HOW TO RUN IT
- Open from the day they built.
- Draw out the parts that carry weight: which part matters most and WHY, who's there, what a chosen activity actually looks and feels like, the feel of the pace. Go a layer deeper on one or two things that carry real weight rather than touching every activity — the build already captured the breadth, so this is about meaning and texture, not coverage.
- Notice the shape of the day, offer it back warmly and specifically, and invite them to confirm or adjust — asking, once, whether there's anything they'd change now they see it laid out.
- If it fits naturally, ask whether anything about the day surprised them.
- Stay on the day. Do NOT branch into the roles they want to play or the rhythm of their week — those are separate sessions. If they raise one, acknowledge it briefly and gently return to the day.
- Aim for around four to six exchanges — a target that follows the material, not a ceiling.

MUST NOT
- Ask how they feel about retirement or the transition, or invite hopes or fears.
- Reality-check, cost, or judge whether the picture is realistic or "right". (Gently naming an internal contradiction in the day itself — the base prompt's "noticing when something doesn't add up" — is a different thing, and still fine.)
- Steer toward reflection, lessons, or legacy — that material is held for later stages. Keep this generative and concrete: the texture of the day, not how they feel about it.

CLOSING
Name what seems to matter most about the day, in their words. Note warmly this is the first piece of the picture they're starting to build — they're imagining here, not planning yet — and that next you'll picture what you'd do if money were no object.

WATCH FOR
- If the day looks thin or they seem unsure, draw out just one part rather than pushing on all of it.
- If they pull toward money or worries, bring them gently back to the texture of the day.`,
      },
      {
        id: "1.money",
        title: "If money were no object",
        description:
          "Forget budgets for a moment. The places, the projects, the things you'd do if money simply weren't the question.",
        durationMin: 15,
        closeInOneStep: true,
        primer: [
          {
            type: "text",
            value: `Forget budgets and bank balances for a moment. If money simply weren't a factor — no ceiling, no trade-offs — what would you actually do? Not the sensible version. The real one. There's nothing to cost here and nothing to justify; this is just for picturing.`,
          },
        ],
        coachOpening: `Oh, now THIS is a good list — so this is what you'd do if money were no object! How fun does that sound. If you could only afford three of these dreams, which three would you pick?`,
        interaction: {
          type: "spark-prompts",
          // Stored explicitly so the recap heading never depends on the default.
          summaryLabel: "What you'd do",
          instruction:
            "No budgets, no second-guessing. Fill in as many as spark something — leave the rest blank.",
          prompts: [
            {
              id: "go",
              label: "Somewhere you'd go",
              placeholder:
                "anywhere at all — a city, a coastline, a place you've only read about…",
            },
            {
              id: "learn",
              label: "Something you'd learn, make, or master",
              placeholder:
                "a skill, a craft, an instrument, a whole second trade…",
            },
            {
              id: "build",
              label: "Something you'd build, fund, or give",
              placeholder:
                "a project, a cause, a gift, something you'd set in motion…",
            },
            {
              id: "indulge",
              label: "An everyday indulgence",
              placeholder: "a small luxury you'd fold into ordinary life…",
            },
          ],
        },
        sessionInstructions: `PURPOSE
The person has just captured a few money-no-object wants across different angles — somewhere to go, something to learn or make, something to build or give, an everyday indulgence. This is a quick, playful brainstorm, NOT a deep session. Enjoy their list with them, help them pick out the few that matter most, and end by spotting which dreams might actually be within reach. Keep it brief, keep it fun, and use short responses throughout.

HOW TO RUN IT
- Open with real, infectious excitement about what they pictured — the way a close friend lights up hearing a brilliant plan. React to the actual things on their list by name AND name the key themes you notice running through them (adventure, making things, time with people, say). Be truly delighted, a little playful; never a flat recap or a polite "lovely".
- Then invite the choice: if they could only afford three of these dreams, which three would they pick? Once they've chosen, ask in one short question what makes those three stand out for them.
- To wrap up, turn to whether any of these dreams could actually be within reach — even adapted or scaled down to make them affordable. Ask THEM which feel like they could happen; the assessment is theirs, not yours. Keep all three of their chosen dreams in view — don't single one out as "the realistic one" and let the others drop. If you have a thought on how something might work, offer it lightly and check it, never as a verdict. Where a dream could work in some form, have a short back-and-forth on how a version of it might be made real.
- Make clear the dreams that stay out of reach aren't being dropped — they're pipe-dreams worth holding onto, kept alongside the achievable ones.
- Keep every response short and the whole thing brief. Don't dig deep into any single dream, don't hunt for hidden meaning, and don't branch into the roles they want or the shape of their week — those are other sessions.

MUST NOT
- Reality-check or judge during the brainstorm itself — no "is that affordable?" or "is that realistic?" while they're still dreaming. Affordability only enters at the very end, and only as "how might we make a version of this real," never as "should you" or "be sensible".
- Treat it as a wish-list to fund or a budget to plan — the achievable beat is a light spark of possibility, not a costing exercise.
- Decide for them which dream is the realistic one, or narrow the three down to a single "best" one. Whether a dream feels within reach is their call; the ones that stay out of reach are kept as dreams, never discarded.
- Ask how they feel about retirement or the transition, or invite hopes or fears.
- Steer toward reflection, lessons, or legacy — that's held for later stages.

CLOSING
Warmly name the dreams that stood out — their chosen three and the themes underneath them — and reflect back, in their words, which ones they felt could be within reach. Keep all three in view: the ones that could actually happen and the bigger pipe-dreams worth holding onto, both kept, neither dropped. Don't add your own verdict on what's realistic. Note this adds to the day they pictured, and that next they'll look at the roles they want to play.

WATCH FOR
- An empty or sparse capture — react warmly to whatever is there rather than asking them to add more.
- The "I couldn't possibly" reflex — gently give permission; the whole point is that money isn't the question here.`,
      },
      {
        id: "1.roles",
        title: "The roles you want to play",
        description:
          "Beyond what you'll do — who you want to be. The roles that give your retirement shape and meaning.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — reading/video to come.] A day is made of activities, but a life is shaped by the roles we play — partner, friend, grandparent, mentor, maker, and more. This session is about which of those you want to carry into retirement, and which you'd like to grow into for the first time.`,
          },
        ],
        coachOpening: `Here are the roles you've picked out. Let's start with one that feels most alive to you right now — what draws you to it?`,
        interaction: {
          type: "role-picker",
          instruction:
            "Pick the roles that feel most alive to you — then star the two or three that matter most right now.",
          // Stored explicitly so the recap heading never depends on the default.
          summaryLabel: "Your roles",
          groups: [
            {
              name: "Relationships",
              options: [
                "Partner",
                "Parent",
                "Grandparent",
                "Friend",
                "Sibling",
                "Neighbour",
                "Carer",
                "Host",
              ],
            },
            {
              name: "Contribution",
              options: [
                "Mentor",
                "Volunteer",
                "Helper",
                "Leader",
                "Adviser",
                "Campaigner",
              ],
            },
            {
              name: "Growth & expression",
              options: [
                "Learner",
                "Creator or maker",
                "Traveller",
                "Sportsperson or team player",
                "Performer",
                "Storyteller",
                "Gardener",
              ],
            },
          ],
        },
        sessionInstructions: `PURPOSE
The person has chosen the roles that feel meaningful to them and starred a few as most alive. Help them understand who they want to be in retirement, not just how they'll spend time. This is an Imagine-stage session: draw out why a starred role feels alive, and any role they'd like to grow into for the first time — staying on the roles themselves.

HOW TO RUN IT
- Open by surfacing roles already implied by the day they built earlier — "the way you described your slow morning and the time with family, 'partner' and 'reader' sound quietly important." Offer this lightly and invite them to confirm or refine it; never assert it as fact.
- Then take their starred roles, one at a time, with ONE short question each — what it means to them, or how it might show up in an ordinary week. Just one question per role; don't interrogate each.
- Help them tell the difference between an activity and the role beneath it (wanting to travel may be the role of explorer; helping grandchildren may be mentor, guide, or carer) — surfaced with curiosity, never as a correction.
- Mirror and confirm a small handful of roles that feel most alive, and the thread connecting them — offered for them to confirm or adjust, not as your verdict.
- Draw out the couple of roles that carry the most weight rather than marching through all of them — why each feels alive, and any role they'd like to grow into. Don't map out specific plans or logistics, and don't branch into their ideal week — that's another session.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Ask how they feel about retirement or the transition, or invite hopes or fears.
- Reality-check or judge whether a role is realistic or "right".
- Steer toward reflection, lessons, or legacy — that material is held for later stages. This is about identity and what each role looks like in their life, not how they feel about it.

CLOSING
Name a small number of roles likely to give their retirement shape and meaning, in their words, and the thread connecting them. Note this builds on the day they pictured, and that next you'll look at the rhythm of their ideal week.

WATCH FOR
- Activities chosen as if they were roles — get underneath them gently, without correcting.
- Someone who can only see their professional identity — help them find other roles they've played across life, without implying work roles don't matter.
- Roles they lost the chance to play during working life and now want to reclaim — notice these warmly.`,
      },
      {
        id: "1.week",
        title: "Your ideal week",
        description:
          "A day is a snapshot; a week is a rhythm. The shape, balance, and pace you want across your time.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — reading/video to come.] A single day shows what appeals to you; a whole week shows what sustains you. This session is about the rhythm of your retirement — how much routine, variety, and rest feels right across the week, and how it might shift with the seasons.`,
          },
        ],
        coachOpening: `Here's the balance you've set for your ideal week. Which of these did you feel most strongly about?`,
        interaction: {
          type: "sliders",
          instruction:
            "Set where your ideal week sits on each of these — there's no right answer, just what feels like you.",
          // Stored explicitly so the recap heading never depends on the default.
          summaryLabel: "Ideal week",
          spectrums: [
            { left: "Lots of routine", right: "Lots of spontaneity" },
            { left: "Mostly on my own", right: "Mostly with others" },
            { left: "Full and busy", right: "Slow and restful" },
            { left: "Familiar and steady", right: "New and varied" },
            { left: "Planned ahead", right: "Decided on the day" },
          ],
          seasonal: {
            prompt: "Does your ideal week change much with the seasons?",
            options: ["A lot", "A little", "Not really"],
          },
        },
        sessionInstructions: `PURPOSE
The person has set where their ideal week sits on a few spectrums about time, structure, and balance. Help them find the rhythm and balance they want — their relationship with time, not a calendar. This is an Imagine-stage session: draw out what they feel strongly about in the week's shape and why they'd shift it — staying on the shape of the week, not a calendar.

HOW TO RUN IT
- Open by carrying forward from the day they built and the roles they chose — "you mentioned wanting to be a mentor and a reader; where in the week do those live?" Read the slider balance back briefly alongside it and check it feels right.
- Ask ONE question about the live balance the sliders point to most strongly — alone↔together, active↔rest, or familiar↔new — picked from wherever they leaned hardest. Just the one.
- Ask ONE question about how the week shifts across the seasons — winter, or when they're travelling.
- If they picture a week with no commitments at all, meet it with curiosity, not pushback — ask what might give it rhythm over time. (A wide-open week is a valid preference, not a contradiction to challenge.) If they re-create their old working week, gently invite a look at the open space instead.
- Stay on the shape, not the schedule: don't plan the week hour by hour, and don't branch into the roles they want — that's another session.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Ask how they feel about retirement or the transition, or invite hopes or fears.
- Reality-check or judge whether the rhythm is realistic or "right".
- Steer toward reflection, lessons, or legacy — that material is held for later stages. This is about the pattern of the week, not how they feel about it.

CLOSING
Name what gives their week its shape — the rhythms, the balance of busy and restful, time alone and with others — in their words. Note this builds on the day and the roles, and that next you'll write a letter from your future self.

WATCH FOR
- The "every day is Saturday" pull — meet it with curiosity, and help them consider what gives the week rhythm and purpose.
- Over-filling the week — gently check there's room for rest and spontaneity.
- Welcome revisions ("I thought I wanted… actually…") — that's them building understanding.`,
      },
      {
        id: "1.letter",
        title: "A letter from your future self",
        description:
          "A short letter to someone in your life, written from a good way into your retirement — catching them up on how it all looks now.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `Imagine yourself a good way into retirement — settled, comfortable, living a life you're truly happy with. In a moment you'll write a short letter to someone in your life, catching them up on how it all looks now: what fills your days, the people around you, an ordinary good week. It's a description of the life as it is now — just what's true for you. First, who are you writing to?`,
          },
        ],
        interaction: {
          type: "letter",
          recipients: [
            { id: "old-friend", label: "An old friend you've lost touch with" },
            { id: "younger-relative", label: "A grandchild or younger relative" },
            { id: "sibling", label: "A sibling, or someone you grew up with" },
          ],
          allowCustom: true,
        },
      },
    ],
  },
  {
    number: 2,
    name: "Explore",
    subtitle: "Go deeper, area by area",
    lookBack:
      "you went through your picture area by area, noticing what to keep, change, and add",
    lookAhead:
      "you go deeper area by area — movement, mind, people, purpose, energy, and the senses",
    intro: {
      // [Placeholder — SMW to replace.] Framed on the WHO's Intrinsic Capacity
      // model as an invitation, not an audit.
      heading: "Now let's look a little closer",
      body: [
        "[Placeholder — SMW to replace.] In Imagine, you sketched the shape of the retirement you want. Now we go a little deeper, area by area. Research on what makes retirement truly good for people points to a handful of evidence-based domains — movement, a curious mind, the people around you, a sense of purpose, your energy, and your senses.",
        "Most people's first picture of retirement is stronger in some of these than others, and that's completely normal. These sessions aren't an audit of what's missing — they're an invitation to look at each area in turn and notice what you'd like to keep, change, or add.",
        "We'll take the areas one at a time, in order — each builds on the last, and together they make the full picture. There's no rush: come to them whenever you have a little time, and your answers are always saved.",
      ],
      buttonLabel: "Let's carry on",
    },
    modules: [
      {
        id: "2.1",
        title: "Staying active",
        description:
          "The movement woven through your week — what keeps you up and about, and the part you'd like it to play.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Of all the things that shape a good retirement, staying active does more quiet work than almost anything else. It's what keeps you up and about, doing the things you pictured — the garden, the grandkids, the day trips — on your own terms, for longer. This session isn't about fitness goals or step counts. It's about the movement that already fits your life, and the part you'd like it to play.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment you'll pick the active things you'd most like in your week, and set roughly how physical you'd like your days to be. There's no right answer — just what feels like you.`,
          },
          {
            type: "links",
            links: [
              {
                label: "[Placeholder] Staying active in later life — NHS",
                url: "https://www.nhs.uk/live-well/exercise/",
              },
              {
                label: "[Placeholder] Gentle ways to move more every day",
                url: "https://www.nhs.uk/live-well/exercise/",
              },
            ],
          },
        ],
        coachOpening: `Here's what you'd like your active life to look like. Let's start with the one you're most drawn to — what is it about that one that appeals to you?`,
        interaction: {
          type: "composite",
          // The slider sits below a long grid of activity chips and is easy to
          // miss before Save — give it its own heading so it reads as a clear,
          // separate section the person still has to set.
          stepHeadings: [null, "Your activity level"],
          steps: [
            {
              type: "role-picker",
              instruction:
                "Pick the active things you'd most like to be part of your week — as many or as few as feel right. These don't have to be things you've done before — it's about how you'd like to keep moving and feel confident in your body through retirement.",
              starrable: false,
              summaryLabel: "Your selected activities",
              groups: [
                {
                  name: "On foot",
                  options: [
                    "Walking",
                    "Running or jogging",
                    "Hiking or rambling",
                    "Walking the dog",
                  ],
                },
                {
                  name: "Water & wheels",
                  options: [
                    "Cycling",
                    "Swimming",
                    "Rowing or kayaking",
                    "Sailing",
                  ],
                },
                {
                  name: "Studio, gym & dance",
                  options: [
                    "Gym or strength work",
                    "Yoga or stretching",
                    "Pilates",
                    "Tai chi or qigong",
                    "Dancing",
                    "Martial arts or boxing",
                  ],
                },
                {
                  name: "Sport & games",
                  options: [
                    "Football",
                    "Tennis",
                    "Badminton",
                    "Squash or racquetball",
                    "Padel or pickleball",
                    "Table tennis",
                    "Golf",
                    "Bowls",
                    "Cricket",
                    "Rugby or hockey",
                  ],
                },
                {
                  name: "Outdoors & adventure",
                  options: [
                    "Climbing",
                    "Horse riding",
                    "Skiing or snowsports",
                    "Time in nature",
                  ],
                },
                {
                  name: "Everyday movement",
                  options: [
                    "Gardening",
                    "DIY or practical projects",
                    "Cleaning and pottering about",
                    "Playing with grandchildren",
                    "A class or group",
                  ],
                },
              ],
            },
            {
              type: "sliders",
              instruction:
                "And roughly how physical would you like an ordinary day to feel?",
              spectrums: [
                { left: "Mostly still", right: "Very physically active" },
              ],
              anchors: [
                "Mostly still",
                "Gently moving",
                "Up and about a lot",
                "Very physically active",
              ],
              summaryLabel: "Activity level",
            },
          ],
        },
        sessionInstructions: `PURPOSE
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just picked the active things they'd like in their week and set roughly how physical they'd like their days to feel. Help them picture how movement fits the retirement they imagined, and what they'd like more of. This is an Explore-stage session: its job is to notice which active things appeal and, above all, WHY — draw that out a layer beneath their first answer, staying on staying active.

HOW TO RUN IT
- Open with a warm, specific callback to what you already learned about them in Imagine (it's provided to you) — then move to what they just picked here.
- Take their choices one or two at a time: what appeals, and how each might actually show up in an ordinary week.
- Bring in the activity level they set — read it back lightly and check it feels right against the things they chose.
- Where it fits, connect this to the day, roles, or week they pictured earlier (e.g. movement already in their day, or an active role they want).
- Offer back the shape of how movement fits their life, and invite them to confirm or adjust.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Do NOT slip into a fitness-coaching or personal-trainer tone. No targets, plans, step counts, intensity advice, or "you should".
- Do NOT assume anything about their current fitness, health, or ability, and do NOT imply movement is about staving off decline. This is about a full, active life they want — never about loss.
- Watch language around independence: hold it as something they're choosing and shaping, not something at risk.
- Don't reality-check or judge whether their choices are realistic, and don't steer toward reflection, lessons, or worries.

CLOSING
Name how staying active fits the life they've pictured, in their words — the things they want to keep doing and the rhythm that suits them. Note warmly that this adds to their Retirement Life Plan, and that there's more of the picture to fill in as they carry on through Explore.

WATCH FOR
- If their picks look thin or they seem unsure, draw out just one rather than pushing on all of them.
- If they raise a health worry or a limit, meet it warmly and matter-of-factly, stay on what they can and want to do, and don't turn it into a problem to solve.
- Welcome revisions — that's them building the picture.`,
      },
      {
        id: "2.2",
        title: "Keeping your mind alive",
        description:
          "The learning, curiosity and creativity that keep your mind engaged — what truly interests you, and what you'd love to get into.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Work quietly keeps the mind busy all day — decisions, new problems, fresh information, people to read. When that goes, the stimulation can go with it, and that matters more than most people expect: a mind that stays curious and challenged keeps its edge for longer. This isn't about courses you ought to take or improving yourself. It's about what genuinely interests you — and the difference between being merely occupied and being truly absorbed.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment, pick the things that catch your curiosity — anything that sparks something, with no level or expertise implied. Then we'll talk about what really absorbs you, and anything you've always meant to get to but never had the time for.`,
          },
          {
            type: "links",
            links: [
              {
                label: "[Placeholder] Learning later in life — courses, libraries, U3A",
                url: "https://www.u3a.org.uk/",
              },
            ],
          },
        ],
        coachOpening: `Here's what catches your curiosity. Let's start with the one you're most drawn to — what is it about that one that pulls you in?`,
        interaction: {
          type: "role-picker",
          instruction:
            "Pick anything here that sparks your curiosity — there's no level or expertise implied, just what interests you.",
          starrable: false,
          summaryLabel: "What catches your curiosity",
          groups: [
            {
              name: "Words, ideas & learning",
              options: [
                "Learning a language",
                "Reading & books",
                "Digging into history",
                "Science & the natural world",
                "Big questions & philosophy",
                "Writing — stories, memoir, poetry",
                "Puzzles, crosswords & brain games",
              ],
            },
            {
              name: "Making & hands-on",
              options: [
                "Playing or listening to music",
                "Painting, drawing & crafts",
                "Photography",
                "Cooking & baking",
                "Gardening & growing things",
                "Building, fixing & restoring",
                "Knitting, sewing & textiles",
                "Computers, coding & gadgets",
              ],
            },
            {
              name: "Discovering the world",
              options: [
                "Other places & cultures",
                "Tracing your family history",
                "The night sky & astronomy",
                "Art, museums & galleries",
                "Local history & heritage",
              ],
            },
          ],
        },
        sessionInstructions: `PURPOSE
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just picked the things that catch their curiosity. Help them understand what truly stimulates and interests them, and how they might keep challenging and engaging their mind in retirement. This is an Explore-stage session: its job is to notice what genuinely absorbs them and WHY — draw that out a layer beneath their first answer, staying on curiosity and engagement.

HOW TO RUN IT
- Open with a warm, specific callback to what you already learned about them in Imagine (it's provided to you), especially anything they wanted to learn or look into — then move to what they just picked.
- Moment capture: early on, ask once about a time they completely lost track of time, and what they were doing. This is the strongest signal of true engagement — use what it reveals.
- Help them notice the form of engagement they like: a structured course or exploring freely; going deep on one thing or sampling many; understanding something or making something; alone or with others. Draw this out in conversation, not as a quiz.
- Spark capture: surface a deferred want — something they've always meant to get to but never had time for. Help the language shift from duty to desire ("I suppose I could do a course" → "I've always wanted to learn Spanish"). Capture the genuine want, not the dutiful should.
- Offer back the thread of what truly absorbs them, and invite them to confirm or adjust.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Do NOT take an educational, self-improvement, or "keep your brain sharp" tone. Focus on enjoyment, curiosity, and meaningful engagement.
- Do NOT assume they want formal learning, or that anything needs a qualification or a goal.
- Don't reality-check whether an interest is worthwhile, and don't steer toward reflection or lessons.

CLOSING
Name the interests and the kind of engagement that truly absorb them, in their words — and any deferred want worth carrying forward. Note warmly that this adds to their Retirement Life Plan, and that there's more of the picture to fill in as they carry on through Explore.

WATCH FOR
- Watch for identity themes — concerns about losing the challenge, expertise or stimulation that work provided. Explore gently, without assuming work must be replaced with an equivalent.
- If they can only see interests as productive or improving, give permission to chase curiosity for its own sake.
- Welcome revisions — that's them building the picture.`,
      },
      {
        id: "2.3",
        title: "The people in your life",
        description:
          "The relationships and connections that support and enrich your retirement — who matters most, and the social world you'd like around you.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Work quietly supplies a lot of connection — the team, the chats, the colleagues who became friends. And our ties do four different jobs at once: someone to confide in, someone who'd help in a crisis, people who pull us toward better habits, and the casual contact of everyday life. That last one — the regulars at the café, the familiar faces — is the bit that often goes quietest when the commute and colleagues do, and it's the one most people don't see coming.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment, you'll note the people who matter, how social you feel at your best, and roughly how well-served each of those four jobs feels right now. None of it is a test — it's a quick way to see where you might like to invest a little more.`,
          },
          {
            type: "links",
            links: [
              {
                label: "[Placeholder] Why social ties help you live longer",
                url: "https://www.nhs.uk/mental-health/",
              },
            ],
          },
        ],
        coachOpening: `Here are the people and the shape of your social world. Let's begin with whoever matters most to you right now — tell me a little about them?`,
        interaction: {
          type: "composite",
          // A clear lead-in question sits above the four "do you have…" sliders
          // (step index 2) so they read as one set, not four stray questions.
          stepHeadings: [
            null,
            null,
            "Thinking about your life right now, how much do you have of each?",
          ],
          steps: [
            {
              type: "role-picker",
              instruction:
                "Your people — pick the ones who are part of your world. Naming individuals is up to you, never required.",
              starrable: false,
              // Not "roles" — give the recap its own heading so it doesn't fall
              // back to the generic "Your roles". [SMW may refine wording.]
              summaryLabel: "Your people",
              groups: [
                {
                  name: "",
                  options: [
                    "Partner",
                    "Children",
                    "Grandchildren",
                    "Close friends",
                    "A wider friend group",
                    "Neighbours",
                    "Colleagues who've become friends",
                    "A community or faith group",
                    "People around a hobby",
                  ],
                },
              ],
            },
            {
              type: "sliders",
              instruction: "I'm at my best with…",
              spectrums: [
                {
                  left: "Plenty of quiet time",
                  right: "Lots of people around me",
                },
              ],
              anchors: [
                "Plenty of quiet time",
                "A steady balance",
                "Lots of people around me",
              ],
              summaryLabel: "Social balance",
            },
            {
              type: "sliders",
              instruction:
                "Someone I can really talk to — to confide in and work things through with",
              spectrums: [{ left: "Not really", right: "Yes, plenty" }],
              anchors: ["Not really", "Some", "Yes, plenty"],
              summaryLabel: "Someone to talk to",
            },
            {
              type: "sliders",
              instruction:
                "Practical help if something went wrong — a lift, a meal, support in a crisis",
              spectrums: [{ left: "Not really", right: "Yes, plenty" }],
              anchors: ["Not really", "Some", "Yes, plenty"],
              summaryLabel: "Practical help",
            },
            {
              type: "sliders",
              instruction:
                "People who pull me toward healthier habits — a walking partner, family who'd notice",
              spectrums: [{ left: "Not really", right: "Yes, plenty" }],
              anchors: ["Not really", "Some", "Yes, plenty"],
              summaryLabel: "Healthy-habit company",
            },
            {
              type: "sliders",
              instruction:
                "Casual contact with the wider world — the chats at the shop, the class, familiar faces",
              spectrums: [{ left: "Not really", right: "Yes, plenty" }],
              anchors: ["Not really", "Some", "Yes, plenty"],
              summaryLabel: "Everyday casual contact",
            },
          ],
        },
        sessionInstructions: `PURPOSE
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just noted the people who matter, how social they feel at their best, and how well-served the four social "jobs" feel. Help them understand the people they value, the role connection plays in their wellbeing, and where they might like to strengthen their social world. This is an Explore-stage session: its job is to notice which people and connections matter and WHY, and where connection feels under-served — draw that out a layer beneath their first answer.

HOW TO RUN IT
- Open with a warm, specific callback to the people who appeared in their Imagine answers (provided to you).
- Ask which relationships they'd most love to give more time to — framed as investment, not as anything being at risk.
- The thin function: gently pick up whichever of the four jobs read thinnest in their check, and explore it briefly with ONE concrete opening, not problem-solving. If it's casual contact, the natural turn is the loose-ties insight: a lot of everyday stimulation quietly comes from people we don't know well — the café regulars, the passing colleagues — and that's the bit that goes quietest when commute and colleagues do. If it's practical help, turn to who'd be there in a crisis. If emotional support, to who they really confide in.
- Offer an opening for new connection if it fits — a club, a class, volunteering, a learning group, reconnecting with an old friend, something local — ideally targeted to the thin function.
- Mirror and confirm, reflecting both the people who matter and the function(s) worth investing in.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Never assume a bigger circle is better, and never frame retirement as socially risky or raise loneliness as a warning.
- The four-function check was a quick tap exercise — do NOT turn it into a per-person audit of who provides what.
- Don't counsel. Reflect, don't advise.

CLOSING
Name the relationships that matter most and the function(s) worth investing in, in their words. Note warmly that this adds to their Retirement Life Plan, and that there's more of the picture to fill in as they carry on through Explore.

WATCH FOR
- If a relationship transition surfaces (a relocation, a bereavement, a changing family role), acknowledge it sensitively — reflect, don't counsel.
- Welcome revisions — that's them building the picture.`,
      },
      {
        id: "2.4",
        title: "Purpose and contribution",
        description:
          "The activities and roles that make you feel useful, valued and fulfilled — the sources of meaning you'd like in your retirement.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] For many people, work is the main source of purpose and identity — and losing it is more destabilising than expected, with retirement satisfaction often dipping in the first year or two before new sources of meaning take hold. The good news is that meaning arrives plural and modest: through care, contribution, making things, and learning something deeply and passing it on. It comes down to the handful of things, big or small, that leave you feeling truly useful.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment, pick the forms of contribution that give you energy — the ones that feel meaningful rather than dutiful. Small and private counts every bit as much as big and public.`,
          },
          {
            type: "links",
            links: [
              {
                label: "[Placeholder] Finding purpose in retirement — a few examples",
                url: "https://www.nhs.uk/mental-health/",
              },
            ],
          },
        ],
        coachOpening: `Here are the things that give you a sense of purpose. Let's start with the one that feels most meaningful — what is it about that one that matters to you?`,
        interaction: {
          type: "role-picker",
          instruction:
            "Pick the forms of contribution that give you energy — the ones that feel meaningful and freely chosen. Small and private counts as much as big and public.",
          starrable: false,
          summaryLabel: "Your sources of purpose and contribution",
          groups: [
            {
              name: "Care & connection",
              options: [
                "Mentoring informally",
                "Helping raise grandchildren",
                "Caring for someone",
                "Supporting a neighbour",
              ],
            },
            {
              name: "Community & causes",
              options: [
                "Volunteering",
                "Leading a local group",
                "Organising community events",
                "Helping a cause you care about",
                "A bit of paid work",
              ],
            },
            {
              name: "Making & sharing",
              options: [
                "Creating art",
                "Writing family history",
                "Restoring or making things",
                "Learning something deeply and sharing it",
                "Going on a big adventure",
              ],
            },
          ],
        },
        sessionInstructions: `PURPOSE
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just picked the forms of contribution that give them energy. Help them understand the activities, roles and forms of contribution that make them feel useful, valued and fulfilled, and how these might feature in their retirement. This is an Explore-stage session: its job is to notice which forms of contribution matter and WHY — draw that out a layer beneath their first answer.

HOW TO RUN IT
- Open with a warm, specific callback to anything in their Imagine answers that hinted at contribution or helping (provided to you), then move to what they picked.
- Moment capture: early on, ask about a time they felt what they did truly mattered, and what was happening. This is the richest signal for meaning — use what it reveals.
- Draw out the impact they enjoy having on others, and notice the plural sources of meaning that emerge.
- Mirror and confirm — explicitly NOT pushing toward one tidy purpose. Reflect the several sources that came up.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Purpose need not be grand or public — apply no pressure toward a single answer or a life-purpose statement.
- Don't reality-check whether a form of contribution is worthwhile, and don't steer toward lessons or legacy.

CLOSING
Name the plural sources of meaning and the forms of contribution that energise them, in their words. Note warmly that this adds to their Retirement Life Plan, and that there's more of the picture to fill in as they carry on through Explore.

WATCH FOR
- Hold any concerns about identity, relevance or status gently, without trying to resolve them. Curiosity over conclusions.
- Welcome revisions — that's them building the picture.`,
      },
      {
        id: "2.5",
        title: "Energy, sleep and feeling well",
        description:
          "The vitality everything else rests on — what lifts you, what drains you, and the levers worth building on.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] This session is about vitality — feeling rested, energised and well, day to day. Almost everything in your retirement picture depends on it, and yet it's the area most people plan for least. Vitality has four levers that feed each other — sleep, nutrition, recovery, and the metabolic health that connects them (movement is the fifth, and we look at that on its own elsewhere). Eating shapes sleep, sleep shapes energy, energy shapes recovery, recovery shapes how you eat.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Sleep, recovery and the way your body uses energy all shift with age, and a working routine can hide the early signs — so small habits compound powerfully across a 20–30 year retirement, in both directions. The hopeful part, and one of the clearest findings in healthy-ageing research, is that vitality stays genuinely buildable at every age. The levers cluster in four places: sleep (consistency over duration), nutrition (regularity and quality over rules), recovery (rest as active, not lazy), and metabolic health (how eating, activity, sleep and stress all interact). This is the doorway, not the deep dive — the fuller content on each lever sits elsewhere in the programme. For now: what lifts you, what drains you, and which lever might be worth building on?`,
          },
          {
            type: "links",
            links: [
              {
                label: "[Placeholder] Small habits for sleep, energy and feeling well",
                url: "https://www.nhs.uk/live-well/sleep-and-tiredness/",
              },
            ],
          },
        ],
        coachOpening: `Here's what lifts your energy and what drains it. Let's start with what you said energises you — which of those makes the biggest difference to a good day?`,
        interaction: {
          type: "composite",
          // A light lead-in before the four awareness sliders frames them as
          // noticing, not grading.
          stepHeadings: [
            null,
            null,
            "Let's check in on how things have felt lately. There's no score here — just noticing.",
            null,
            null,
            null,
            null,
          ],
          steps: [
            // The "sort": both pickers offer the same shared pool, so the person
            // places ambiguous items (routine, time alone, music…) wherever they
            // sit for them — and an item can land in both.
            {
              type: "role-picker",
              instruction: "What tends to give you energy?",
              starrable: false,
              // Distinct recap heading so this and the "drains you" picker don't
              // both fall back to "Your roles". [SMW may refine wording.]
              summaryLabel: "What gives you energy",
              groups: [
                {
                  name: "",
                  options: [
                    "Good sleep",
                    "Coffee",
                    "Regular meals",
                    "A busy social calendar",
                    "Fresh food",
                    "Time alone",
                    "Plenty of water",
                    "A nap",
                    "Daylight in the morning",
                    "Routine",
                    "Time outdoors",
                    "A glass of wine",
                    "Movement",
                    "Time with family",
                    "Time with people",
                    "Having a project on",
                    "Proper rest days",
                    "Spontaneity",
                    "Time to digest",
                    "A day with nothing planned",
                    "Early nights",
                    "Screens late",
                    "Music",
                    "Caring for someone",
                    "Overcommitting",
                    "Rushing",
                    "Skipped meals",
                    "Ultra-processed convenience food",
                    "Alcohol",
                    "A full diary",
                  ],
                },
              ],
            },
            {
              type: "role-picker",
              instruction: "And what tends to drain you?",
              starrable: false,
              // Distinct recap heading (see the "gives you energy" picker above).
              // [SMW may refine wording.]
              summaryLabel: "What drains you",
              groups: [
                {
                  name: "",
                  options: [
                    "Good sleep",
                    "Coffee",
                    "Regular meals",
                    "A busy social calendar",
                    "Fresh food",
                    "Time alone",
                    "Plenty of water",
                    "A nap",
                    "Daylight in the morning",
                    "Routine",
                    "Time outdoors",
                    "A glass of wine",
                    "Movement",
                    "Time with family",
                    "Time with people",
                    "Having a project on",
                    "Proper rest days",
                    "Spontaneity",
                    "Time to digest",
                    "A day with nothing planned",
                    "Early nights",
                    "Screens late",
                    "Music",
                    "Caring for someone",
                    "Overcommitting",
                    "Rushing",
                    "Skipped meals",
                    "Ultra-processed convenience food",
                    "Alcohol",
                    "A full diary",
                  ],
                },
              ],
            },
            {
              type: "sliders",
              instruction: "Lately my sleep feels…",
              spectrums: [{ left: "Rarely restful", right: "Mostly good" }],
              summaryLabel: "Sleep",
            },
            {
              type: "sliders",
              instruction: "My energy through the day is…",
              spectrums: [{ left: "Patchy", right: "Steady" }],
              summaryLabel: "Daytime energy",
            },
            {
              type: "sliders",
              instruction: "My eating feels…",
              spectrums: [{ left: "Haphazard", right: "Looked-after" }],
              summaryLabel: "Eating",
            },
            {
              type: "sliders",
              instruction: "My recovery — rest, downtime, switching off — is…",
              spectrums: [{ left: "Rushed", right: "Spacious" }],
              summaryLabel: "Recovery",
            },
            // The actionable beat: one pick across the four levers. Locked to a
            // single choice, no free-text — the person names where to build.
            {
              type: "role-picker",
              instruction: "Which lever would you most like to build on?",
              starrable: false,
              allowCustom: false,
              selectRange: { min: 1, max: 1 },
              summaryLabel: "The lever you'd build on",
              groups: [
                {
                  name: "",
                  options: ["Sleep", "Eating", "Energy", "Recovery"],
                },
              ],
            },
          ],
        },
        sessionInstructions: `PURPOSE
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just sorted what gives them energy from what drains it, noticed how their sleep, daytime energy, eating and recovery feel lately, and picked one lever — sleep, eating, energy or recovery — they'd most like to build on. Help them see vitality as something they build, not a thing they either have or don't — and help them name where they'd like to put a little steady care. This is an Explore-stage session: draw out what makes the biggest difference to a good day and WHY — warm and non-prescriptive.

HOW TO RUN IT (3–4 turns, one question per turn)
- Open warmly from what they said energises them, then ask when in the day they tend to feel most alive.
- Carry-forward: connect to their Imagine answers (provided to you) — which parts of the retirement they pictured need them feeling well and energised to enjoy. Reflect this; don't quiz them on it.
- The chosen lever: reflect the lever they picked, and ask what a small, steady investment in that area might look like in the context of the life they're designing. THEY name it — you never recommend or prescribe.
- Mirror and confirm, framed as "levers worth building on" — active and hopeful, never "foundations worth protecting" or anything defensive, and never a regimen or a plan.
- Aim for around four to six exchanges — a target that follows the material, not a ceiling.

MUST NOT
- Make NO health recommendations of any kind — no "eat more vegetables", no "go to bed earlier", no diet, sleep, or exercise advice. The person names their own direction; you reflect it back.
- Don't repeat the primer's framing back at them or lecture on the science.
- Don't turn wellbeing into another chore or to-do list, and respect that people start from very different places with health and energy.
- The deep-dive content on nutrition, sleep, metabolic health and recovery lives elsewhere in the programme — it is not your territory here.

CLOSING
Name the levers worth building on, in their words — especially the one they chose, and what steady care it might invite. Note warmly that this adds to their Retirement Life Plan, and that there's more of the picture to fill in as they carry on through Explore.

WATCH FOR
- If loss or frustration about changing energy or body surfaces, acknowledge it warmly — don't try to fix it.
- Welcome revisions — that's them building the picture.`,
      },
      {
        id: "2.6",
        title: "Your sight and hearing",
        description:
          "Just two senses — sight and hearing. They shape how you take in everything around you, and they're easy to look after with a couple of small, regular habits.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] A quick word on what this covers. It's about two of your senses — your sight and your hearing. Not taste, smell or touch. These two shape how you take in almost everything around you, which is why they're worth a few minutes.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] The good news comes first. Most changes to sight and hearing are common, gradual, and straightforward to put right. Reading glasses in your forties are near-universal. Cataracts are very common and very treatable. Even the more serious conditions are very manageable when they're caught early. None of this is about decline.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] The simplest habit is just keeping an eye on the basics. A routine eye test every couple of years — yearly once you're past 60 — picks up most things early. Hearing tends to change slowly, so an occasional check becomes a sensible norm from around 50, roughly every three years.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] So this isn't about preparing for things to go wrong. It's some of the easiest, highest-return upkeep there is. Let's just see where you are with the basics.`,
          },
          {
            type: "links",
            links: [
              {
                label: "[Placeholder] How to book an NHS hearing test",
                url: "https://www.nhs.uk/conditions/hearing-loss/",
              },
              {
                label: "[Placeholder] Find a local optician",
                url: "https://www.nhs.uk/nhs-services/opticians/",
              },
            ],
          },
        ],
        coachOpening: `Thanks for marking those two down — quick to answer, and a useful place to round off Explore. Let's take a look at where you've landed.`,
        interaction: {
          type: "screening-check",
          // Stored explicitly so the recap heading never depends on the default.
          summaryLabel: "Where you are with the basics",
          instruction: "Two quick ones — just tap the closest answer for each.",
          questions: [
            {
              id: "eye",
              prompt: "When did you last have an eye test?",
              options: ["Within the last 2 years", "Longer ago", "Can't remember"],
            },
            {
              id: "hearing",
              prompt: "When did you last have a hearing check?",
              options: [
                "Within the last 2 years",
                "Longer ago",
                "Never",
                "Can't remember",
              ],
            },
          ],
        },
        // Both the closing plan step and the conversation guidance are tailored to
        // the person's age at request time (see sensesClosingCommitment /
        // sensesSessionInstructions). These statics are the safe defaults if the
        // builders are ever bypassed: the closing step covers sight + hearing, and
        // the instructions are the neutral base with no hearing nudge.
        closingCommitment: SENSES_COMMITMENT,
        closeInOneStep: true,
        sessionInstructions: SENSES_BASE_INSTRUCTIONS,
      },
    ],
  },
  {
    number: 3,
    name: "Understand",
    subtitle: "What matters most",
    lookBack:
      "you named your strengths, sorted your values, and put what matters most into your own words",
    lookAhead:
      "we step back to what's underneath it all — your strengths, your values, and what a truly good day looks like for you",
    intro: {
      // [Placeholder — SMW to replace.] Framed as stepping back to what's
      // underneath the picture, not a test of the person.
      heading: "Now let's understand what's underneath",
      body: [
        "[Placeholder — SMW to replace.] In Imagine you pictured the retirement you want, and in Explore you looked at it area by area. This stage steps back to ask what's underneath all of it — the strengths you bring, the values that matter most to you, and what a truly good day looks like for you.",
        "Nothing here is a test, and there are no right answers. Each session starts from what you've already told us, so you're never beginning with a blank page — you're confirming, adjusting, and putting things in your own words.",
        "What comes out of this stage becomes the compass for your plan: a clear sense of what matters most, to carry into the years ahead.",
      ],
      buttonLabel: "Let's carry on",
    },
    modules: [
      {
        id: "3.1",
        title: "Your strengths",
        description:
          "The things you're naturally good at and energised by — drawn from your own picture, for you to confirm and make your own.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Most people are clearer on what they're not good at than on what they are. But the retirement that suits you is one that leans on your real strengths — the things you're naturally good at, or that leave you more energised than drained. This session isn't a personality test, and there's no score. It draws on the VIA character strengths, a recognised set of 24, and works like a mirror: a few that already show up in what you've told us, for you to recognise or set aside.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment you'll see some character strengths drawn from your own answers. Keep the ones that fit and set aside the rest, then look through the remaining strengths for anything we've missed. Finally, mark the few that feel most like your signature.`,
          },
        ],
        coachOpening: `Here are the strengths you kept — and the few you marked as most you. Let's take one of those: where do you picture it actually living in the retirement you've been designing?`,
        interaction: {
          type: "mirror-cards",
          instruction:
            "These come from the VIA character strengths — a recognised set of 24. Here are the ones I think I can see in you, drawn from what you've told me. For each, Keep it if it feels like you, or Set aside if it doesn't.",
          restLabel: "Look through the rest",
          restIntro:
            "Here's the rest of the 24 character strengths. Is there anything here you've leaned on — in your working life, or at home — that hasn't come up yet? Tap any that fit to add them.",
          notePlaceholder: "Where does this one show up? (optional)",
          starLabel:
            "Which feel most like your signature — the ones most you? Pick up to five.",
          starMax: 5,
          summaryLabel: "Your strengths",
          footnote: {
            text: "These draw on the VIA character strengths, a research-backed framework for the qualities people use most naturally. Learn more at",
            linkLabel: "viacharacter.org",
            linkUrl: "https://www.viacharacter.org",
          },
        },
        sessionInstructions: `PURPOSE
You already know this person from the Imagine and Explore stages — open like a coach who remembers them. They have just worked through the VIA character strengths: kept the ones that fit, added any they'd leaned on that hadn't come up, and starred a signature few. They did NOT say where any of these might show up in retirement — that work is this conversation's, not theirs to arrive with. Help each signature strength find a real home in the retirement they're designing. This is recognition, not assessment.

MOST IMPORTANT
The bridge from a strength to where it shows up is the heart of this — and it's yours to draw out through dialogue, not theirs to supply. Don't expect them to arrive with an answer. For their signature strengths, keep returning to one question in different forms: where might this live in the retirement you've been picturing? Work from the days, roles, people, and interests they described in Imagine and Explore, so a strength becomes a concrete part of the picture rather than a label.

HOW TO RUN IT
- Open on one they starred and go straight to where it might live — not whether it's really theirs.
- Take one strength at a time. Offer a possible home for it drawn from their own earlier picture, tentatively, and let them place it.
- Aim to reach your close within roughly four to six exchanges.

DIG DEEPER WHERE
- A signature strength has no obvious home in the picture they've built — ask gently where it might go, or what would have to be there for it to show up.
- A strength has only ever lived in a work role they're leaving — help them find where it lives once the job no longer carries it.
- A strength stays abstract — bring it down to one concrete thing it could look like in an ordinary week.

HOLD BACK WHERE
- The set already feels right to them — don't relitigate it; move to where it lives.
- They set a card aside — one light check at most, then let it go; don't argue them back into it.
- You feel the urge to pile on praise — resist it. No "that's wonderful", no "what a great strength". Name things plainly and let them stand.

STOP AT THE THRESHOLD OF PLANNING
This session settles where a strength could live and what form it might take — not how or when to begin. When the conversation starts pulling toward first steps, sequencing, or the lowest-barrier way in, that's the edge of this stage. Name that there's something here for the planning stage to pick up, and let it rest there rather than working it out now.

HOW
- Always work through their own picture and their own words, never a generic strengths lecture.
- Stay tentative: offer, don't declare. One thread at a time, not a summary of all of them.
- Their signature strengths are an unranked set — they chose them together, in no particular order. Never call one the "top" strength, never say one "leads the list", and don't read any meaning into the order they appear in.

CLOSING
Name their signature strengths in their words, as things they already have and now have somewhere to live. Note warmly that this adds to their Retirement Life Plan, and that the next sessions look at what they value most.`,
      },
      {
        id: "3.2",
        title: "Your values",
        description:
          "The things that matter most to you, sorted in your own way — including the ones you're still not sure about.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Values are the things that quietly steer your choices — freedom, closeness to people, learning, security, making a difference. In working life they often go unspoken, carried along by the job and the routine. In retirement they matter even more: with more of your time your own to shape, what you value is what tells you how to spend it. This session helps you name yours.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment you'll see some values that seem to matter to you, drawn from your answers. Sort each one: that's me, not sure, or not really. There's no right answer, and leaving something in "not sure" is completely fine — some values take time to settle.`,
          },
        ],
        coachOpening: `Here are the values you marked as most core. A couple of these run right through everything you've told me — let's start there, and get underneath the word to what it actually means for you.`,
        interaction: {
          type: "value-triage",
          instruction:
            "These come from a recognised set of values. Here are the ones I think I can see mattering to you, drawn from what you've told me. Decide whether each one rings true for you, doesn't, or you're not sure — there's no right answer, and \"not sure\" is a fine place to leave one.",
          paletteLabel: "Look through the rest",
          paletteIntro:
            "Here's the rest of the set. Is there anything here that matters to you that hasn't come up yet? Tap any that fit to add them.",
          customLabel:
            "Missing something that isn't here? Add a value in your own words.",
          coreLabel:
            "Last step: mark the ones that feel most core to who you are — up to five. Fewer is fine. You're choosing what matters most, and the order is yours to leave open.",
          coreMax: 5,
          summaryLabel: "Your values",
        },
        sessionInstructions: `PURPOSE
They have just worked through a fixed set of values: sorted them into "that's me", "not sure", and "not really" (sorting was unconstrained), and then marked the few that feel most core to who they are. Your job is NOT to reword labels. It is to draw out a short, personal DESCRIPTION of what each core value actually comes down to for them — the gist of what it means in their life. The word is the set's; the description is theirs. Treat the "not sure" pile as legitimate, not a problem to solve.

MOST IMPORTANT
The goal for each core value is a short description in their own terms — not a swapped label. "Family" doesn't become a different word; it becomes something like "being reliably present for my grandchildren and daughter, there for the everyday, not just the big moments." Aim for that kind of specificity: a line that says what the value really is for this person, drawn from their own picture and language.

LEAD WITH WHAT CARRIES WEIGHT — DON'T MARCH THROUGH THE LIST
Do NOT go through their core values one by one in order. Open on the two or three that carry the most weight — the ones richest in their Imagine and Explore material, or that they reacted to most strongly — and draw out real descriptions for those. Batch the self-evident ones: name them together and agree a one-line gist rather than working each in turn. Depth goes where it earns its place.

SCAFFOLD BY HOW MUCH YOU ALREADY KNOW
- Richly evidenced (they've spoken about it a lot): propose the description from that material for them to confirm or sharpen — "You've spoken about this a lot; it seems to come down to [X] — does that fit?" Give them something specific to react to; don't make them start from blank.
- Thin (often a value they added from the list): ask a concrete question anchored in their life — "This isn't something we've touched on yet — where does it show up in your life today, and what specifically matters about it?" NEVER an abstract "what does this value mean to you?"

DIG DEEPER WHERE
- A value they set aside still has real evidence behind it — often it's the word that doesn't fit, not the thing. Check gently whether the thing still matters under a different word.
- The "not sure" pile — ask lightly what makes them uncertain, without pushing them to decide.
- A feeling surfaces — a value they react to strongly, warmly or otherwise. Follow the reaction; that's where the real description often lives.

HOLD BACK WHERE
- A core value is already self-evident to them — don't manufacture depth or make them justify it; agree a short gist and move on.
- They're uncertain — don't resolve it for them. Uncertainty is a valid place to leave a value.
- You're tempted to go into what supports or threatens a value, or what living it looks like in practice — STOP. That depth belongs to a later session (Living your values). Here you capture only what each value means — the gist, not the how.
- You feel the pull to weigh their core values against each other or rank them — resist it. They've already chosen what's most core; you're not ordering it. That weighing is the next session's work.

HOW
- Always work through their own picture and their own words, never a generic values lecture.
- Stay tentative: offer a description and check it, rather than asserting it.
- If a core value is one they added themselves, treat it as at least as real as the surfaced ones.

CLOSING
Read their core values back, each with the description you drew out in their own words. Reflect back warmly how much more specific those descriptions are than the bare labels they started with. Note this adds to their Retirement Life Plan, and that the next session weighs these values against each other.`,
      },
      {
        id: "3.3",
        title: "What matters most",
        description:
          "A few honest either/or choices, then your values in the order that feels true — to see what pulls hardest when you can't have everything.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] It's easy to say everything matters — and it does. But a real life means trade-offs: a free, open week or one full of people and plans; time to yourself or time given to others. You can't max out everything at once, and the choices you lean toward tell you something true about what matters most. This session isn't about ranking your life into a league table. It's a gentle pressure test, to see what pulls hardest when something has to give.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment you'll see a few either/or choices, built from your own picture. Just lean toward whichever pulls a little harder — there are no wrong answers, and you can say why if you like. Then put your values in the order that feels right.`,
          },
        ],
        coachOpening: `Here's where you landed when things had to give. Looking at what came out on top — does that order feel true to you, or is something not sitting quite right?`,
        interaction: {
          type: "priority-choices",
          instruction:
            "A few either/or choices, drawn from your own picture. There are no wrong answers — just lean toward whichever pulls a little harder. You can say why if you like.",
          rankLabel:
            "Now put these values in the order that feels true — most important at the top.",
          summaryLabel: "What matters most",
        },
        sessionInstructions: `PURPOSE
They have just made a series of either/or choices and put their values in order. Help them understand what the choices revealed about what matters most — and make room for the discomfort of trade-offs without forcing a tidy answer. This is a pressure test, not a verdict.

HOW TO RUN IT
- Open by reading back the order they landed on and checking it feels true.
- Look at one or two of the sharper choices: what pulled them that way, and whether it surprised them.
- Where they felt torn, name the tension as real and worth keeping — being pulled two ways is information, not indecision.
- Offer back what seems to matter most when something has to give, in their words, and invite them to adjust the order.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Do NOT treat the ranking as fixed or final. It's a snapshot they can keep reshaping.
- Do NOT push them to resolve a genuine tension — capture it rather than collapse it.
- Do NOT imply that valuing one thing means abandoning another.
- Don't judge their priorities or nudge them toward a "healthier" order.

CLOSING
Name what seems to matter most to them when they can't have everything, in their own words, and acknowledge any trade-off that felt hard. Note warmly that this adds to their Retirement Life Plan, and that the next session puts their top values into practice.

WATCH FOR
- If a choice clearly unsettled them, meet it warmly and matter-of-factly; don't turn it into a problem.
- If the ranking feels forced, let them leave some values level — order isn't the point, clarity is.
- Welcome reshuffles; that's them thinking it through.`,
      },
      {
        id: "3.4",
        title: "Living your values",
        description:
          "What would quietly get in the way of living each of your values — and what you'd protect to keep it.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] A value rarely disappears all at once. It slips away quietly — a regular commitment that crowds it out, a habit that fades, a good intention that keeps getting bumped. This session looks honestly at the specific thing most likely to get in the way of living each of your top values week to week, and at what you'd protect to keep it alive.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] You'll see each of your values with the words you gave it earlier. For each one there's a likely threat to react to — keep it, swap it, or write your own — and then a few simple things you might protect to hold the value in place. Choose any that fit, or write your own; the point is something simple enough to make a real part of your plan.`,
          },
        ],
        coachOpening: `Here's each of your values with what's most likely to get in the way of living it. Let's take the first — does that threat ring true, or is there a more real one?`,
        interaction: {
          type: "value-definitions",
          instruction:
            "For each of your values, here's the specific thing most likely to get in the way of living it week to week. Keep it, swap it, or write your own — then choose what you'd protect to keep the value alive.",
          threatLabel: "What would most likely get in the way",
          protectorLabel: "What you'd protect to keep it",
          protectorPlaceholder: "Something simple you'd protect…",
          summaryLabel: "Living your values",
        },
        sessionInstructions: `PURPOSE
For each of their top values, they're naming the specific thing most likely to get in the way of living it week to week, and what they'd protect to keep it alive — one or more simple things they could commit to as part of their plan. Help them see the threat honestly and land on protectors simple and concrete enough to actually hold to.

HOW TO RUN IT
- Take one value at a time. Name its threat plainly and honestly — a real, specific thing from their own life, not a vague drift. Ask whether that's really the most likely thing that would get in the way week to week, or whether theirs is different.
- If they swap the threat, take their version; it's more likely to be true than yours.
- Once the threat feels right, turn to what they'd protect. They can choose more than one. Steer toward things simple enough to commit to — if a protector is vague ("make time for it") or grand, bring it down to something they could actually hold to week to week.
- Stop at what they'd protect. Do NOT move to how, when, or a plan for doing it.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Do NOT soften or hedge the threat to make it comfortable; an honest, specific threat is more useful than a gentle, vague one.
- Do NOT turn the protectors into a plan, schedule, or to-do list — that's a later stage.
- Do NOT add values here; this session works with the ones they already chose.
- Don't moralise about how a value "should" be lived.

CLOSING
They can already see every value, threat and protector on the summary card, so do NOT read them back or list them — that's just noise. For your wrap-up, reflect in a sentence or two on the overall shape of what they're protecting (a thread or two that stands out), and check it feels right. Plain prose only: no headings, no bold, no dividers, no value-by-value list. Note warmly that this adds to their Retirement Life Plan, and that the next session turns to the quieter half of the picture — their hopes and the worries they carry alongside them.

WATCH FOR
- If a threat touches something tender (money, health, a relationship), meet it warmly and matter-of-factly; stay with what they can shape and don't probe.
- If a protector stays vague or sweeping, bring it down to one simple thing they could actually commit to.
- Welcome rewording at any point.`,
      },
      {
        id: "3.5",
        title: "Hopes and fears",
        description:
          "The quieter half of the picture — what you're hoping for, and what worries you, as you move into retirement and beyond.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] So far you've pictured what you're hoping for — the people, the time, the things you want to keep doing. But most people carry a quieter set of worries alongside the hopes, and they rarely get said out loud. Naming them is how a plan gets honest. The worries you can see are the ones a plan can take account of.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment you'll see a set of common worries, grouped by when they tend to show up — the change itself, the years that follow, and the longer view. Most won't be yours, and that's the point: just set those aside. For the few that land, you can say a little more, and mark any that weigh heavily enough that you'd want the plan to take account of them.`,
          },
        ],
        coachOpening: `Some of these you set aside, and a few you kept. Let's stay with the ones that landed. Take the one that sits heaviest — what's the worry underneath it for you?`,
        interaction: {
          type: "hopes-fears",
          instruction:
            "Most of these won't be yours — set those aside. For the few that land, say a little more if you want, and mark any that weigh heavily enough that you'd want the plan to take account of them.",
          hopesLabel: "What you've been hoping for",
          reactionLabels: {
            onMyMind: "On my mind",
            notMe: "Not me",
            newlyRecognised: "Hadn't thought of it — but yes",
          },
          noteLabel: "The specific worry, if you want to say more",
          notePlaceholder: "What's the worry underneath it…",
          weighsLabel: "This weighs heavily — I'd want the plan to take account of it",
          paletteLabel: "Other worries you might recognise",
          paletteIntro:
            "Browse the rest if you like — add any that ring true for you.",
          customLabel: "A worry in your own words",
          summaryLabel: "Hopes and fears",
        },
        sessionInstructions: `PURPOSE
This is the highest-safeguarding session in the stage. The person has just gone through a set of common worries about retirement and later life, set most aside, and kept a few. Your job is to stay with the ones that landed, register them plainly, and help separate what the plan can act on from what's about facing rather than fixing. Honest, steady company — not therapy, not reassurance.

HOW TO RUN IT
- Work ONLY with the fears that landed (the ones they kept or added) — never the whole list, and never the ones they set aside.
- Acknowledge a weighty one squarely and let them say more without probing. For a vague one, you may ask once, gently: "what's the specific worry underneath that?"
- Where a transition fear sits next to a strength or value they've already confirmed, note the connection gently — without dismissing the fear.
- Close forward: name what's within their control and what the plan can take account of. Fears the plan can act on become safeguards or contingencies for Stage 4; some later-life fears are about facing rather than fixing, and you can say that honestly.

MUST NOT
- Do NOT reassure or try to fix. No "I'm sure it'll be fine", no silver linings, no minimising.
- Do NOT probe the heaviest fears (declining health, losing a partner, mortality). Acknowledge them with steadiness and move on. You are a coach, not a therapist.
- Do NOT treat a fear as a symptom or push for more than the person offers.
- Do NOT end on the fear. Always close on what's in their control and what the plan can hold.

CLOSING
They can see every fear they kept on the summary card, so do NOT read the list back. In a sentence or two, name plainly what weighs most and draw the honest line: which worries the plan can take account of (safeguards and contingencies for later), and which are more about facing than fixing. Plain prose only — no headings, no bold, no dividers, no list. Note warmly that this adds to their Retirement Life Plan, and that the last session of this stage steps back to the bigger picture.

WATCH FOR
- If a fear points to isolation, low mood, or real distress, meet it with warmth and without alarm; stay with what they can shape and don't press.
- If they kept nothing, that's a fine outcome — don't manufacture worry; note lightly that the hopes carry the picture and move to close.
- Keep your own register steady: honest, not grim, never breezily reassuring.`,
      },
      {
        id: "3.6",
        title: "The bigger picture",
        description:
          "A short, honest piece of writing about how you'd want to have lived these years — and the lines you'd want them to stand for.",
        durationMin: 20,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] You've looked at your strengths, your values, your hopes and fears. This last session steps all the way back. Picture yourself near the end of these retirement years, looking back — how would you want to have lived them? Not the achievements or the box-ticking, but the texture of it: who you stayed close to, what you kept doing, how it felt. Writing it down, even roughly, has a way of making it real.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment you'll have a quiet space to write. There are a few starting threads drawn from everything you've told us — pick up any that speak to you, or start wherever you like. Write as much or as little as feels right.`,
          },
        ],
        coachOpening: `Thank you for writing that. There's a lot in what you wrote — let's take one part of it. What is it about that one that made you want to put it down?`,
        interaction: {
          type: "bigger-picture",
          prompt:
            "Imagine yourself near the end of these years, looking back — how did you live them? Write a few lines. Pick up a thread below, or start your own.",
          placeholder: "Write as much or as little as you like…",
          threadsLabel: "Threads you could pick up",
          summaryLabel: "The bigger picture",
        },
        sessionInstructions: `PURPOSE
This is the most reflective and tender session of the stage, written in the spirit of the Stage 1 letter. They have just written about how they'd want to have lived these years. Help them sit with what they wrote and draw out what it says about what they want — gently, on their terms. This holds; it does not grade.

HOW TO RUN IT
- Open by honouring what they wrote, then start with one line or thread from it.
- Move slowly, one thread at a time: what's behind a line, what it would mean to live it.
- Use their own words back to them; let the writing lead rather than steering it somewhere new.
- Offer back, warmly, what these years seem to be about for them — drawn straight from what they wrote.
- Aim to reach your close within roughly four to six exchanges; let them set the pace.

MUST NOT
- Do NOT analyse, interpret beyond their words, or hand them a neat summary of their "purpose".
- Do NOT rush, fill silences, or push for more than they want to give.
- Do NOT treat anything they wrote as a task or a goal to optimise.
- Don't grade the writing or praise it as "beautiful" — meet it plainly and warmly.

CLOSING
Name what these years seem to stand for in their own words, drawn from what they wrote. Acknowledge the weight of looking back like this. Note warmly that this completes the Understand stage and becomes the heart of their Retirement Life Plan.

WATCH FOR
- This is mortality-adjacent and can stir grief, regret, or fear. If strong feeling surfaces, slow right down, meet it humanely, and don't push the exercise on over it.
- If they wrote very little, that's fine; work gently with what's there rather than coaxing more.
- Let them leave things unresolved — not everything needs an answer here.`,
      },
    ],
  },
  {
    number: 4,
    name: "Plan",
    subtitle: "Shape the years ahead",
    modules: [
      {
        id: "4.1",
        title: "When and how do you want to leave work?",
        description:
          "The shape of your move out of work — your own timing, and what would make you feel ready by choice.",
        durationMin: 15,
        // Retired cohorts have already left work — for them this reflection lives
        // in the Review stage (1.worklife), not Plan (Phase 4). Hidden from them
        // here; unchanged for everyone else and with the flag off.
        hideFrom: ["recently_retired", "established"],
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Many people don't so much decide to retire as get tipped into it — by a health scare, their own or someone close, or a milestone birthday that suddenly makes retirement feel due. Those are common and understandable triggers, and they turn the decision into a reaction to circumstance rather than a considered choice. This session takes a different route: deciding on your own terms, by understanding the deeper factors sitting under the decision. The visible retirement date is only the surface; beneath it sit finances, confidence, identity, relationships, purpose, timing, health and the things you still want to do. The aim is to feel ready by choice, not pushed by events.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In a moment you'll build a readiness snapshot. First, place where you picture your move out of work — a clean break at one end, a gradual wind-down at the other. Then mark the rough window you have in mind, as a band rather than a single date. Last, rate how ready each part of the picture feels — finances, health, who you are beyond work, relationships, purpose, and the things you still want to finish. There are no right answers, and "not yet" is one of them.`,
          },
        ],
        coachOpening: `Here's the readiness snapshot you've just built. Before we look at where it feels strong and where it feels shaky, tell me — when you picture leaving work, does it feel like a single event, or more of a gradual process?`,
        interaction: {
          type: "readiness-snapshot",
          transitionInstruction:
            "When you picture leaving work, where do you imagine yourself? Slide the marker to wherever feels closest.",
          transition: { left: "A clean break", right: "A gradual wind-down" },
          shapeLabel:
            "If you're winding down gradually, what shape does that take?",
          shapeOptions: [
            "A steady taper — fewer working days over a few years",
            "A portfolio of smaller commitments",
            "One small ongoing gig — a few hours a week or month",
            "Not sure yet",
          ],
          periodLabel: "And roughly over what period?",
          periodOptions: [
            "Under a year",
            "One to two years",
            "Three to five years",
            "Longer, or open-ended",
          ],
          windowInstruction:
            "Roughly when do you picture this happening? Drag out a band rather than a single date — this is a window, not a deadline.",
          windowMarks: [
            "Now",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
          ],
          factorsInstruction:
            "How ready does each part of the picture feel right now? There's no right answer, and \"low\" simply marks where there's still work to do.",
          factors: [
            { id: "finances", label: "Finances" },
            { id: "health", label: "Health" },
            { id: "identity", label: "Who I am beyond work" },
            { id: "relationships", label: "Relationships" },
            { id: "purpose", label: "Sense of purpose" },
            {
              id: "unfinished",
              label: "Things I still want to finish",
              levels: ["None", "Some", "Lots"],
            },
          ],
          levels: ["Low", "Building", "Strong"],
          financeFactorId: "finances",
          financeQuestion: {
            prompt:
              "Do you have a sense of when you'll be financially ready to retire?",
            options: ["Yes, I have a clear sense", "Roughly", "Not yet"],
          },
          summaryLabel: "Your readiness snapshot",
        },
        sessionInstructions: `PURPOSE
You already know this person from the earlier stages — open like a coach who remembers them. They have just built a readiness snapshot: where they place themselves between a clean break and a gradual wind-down (and, if gradual, its shape and rough period); the rough window they have in mind; and how ready each part of the picture feels — finances, health, identity beyond work, relationships, purpose, and things they still want to finish. Your job is to help them feel ready BY CHOICE rather than pushed by circumstance. The aim is clarity about what would make them ready, not a committed retirement date. A thoughtful "not yet — and here's what would need to change" is a complete and valuable outcome.

MOST IMPORTANT
This session does not ask "what's your retirement date?". It asks "what would make you feel ready?" and "what would need to be true for you to feel comfortable leaving?". The visible date is the surface; underneath sit finances, confidence, identity, relationships, purpose, timing, health and unfinished ambitions. Work the snapshot they built — lead with where readiness feels strong and where it feels shaky — and draw out what sits underneath, in their own words.

HOW TO RUN IT
- Open by reflecting the relevant prior-stage material back first — what they're moving toward, and anything they value or draw identity from in work that might be hard to leave — then use the snapshot as the anchor.
- Lead with the contrast in the readiness profile: name one part that feels strong and one that feels shaky, and ask what's underneath each.
- Draw on these framing questions as they fit, not as a checklist: what appeals about stepping away; what, if anything, would be hard to leave; what would need to be true to feel comfortable; what would give confidence the time was right; anything they'd like to complete or resolve before retiring; what might delay the decision.
- If they leaned toward a gradual wind-down, take the shape seriously — it determines how full the early years really are, and later sessions build on it.
- Aim to reach your close within roughly five to seven exchanges.

FINANCIAL CONFIDENCE — HANDLE WITH CARE (CONSUMER DUTY)
The finance factor is paired with a confidence-only follow-up. You surface and signpost financial confidence; you must NEVER provide, imply, or substitute for regulated financial advice, never estimate figures, and never comment on whether their finances are adequate.
- If they rated finances strong and have a sense of when they'll be financially ready: acknowledge it warmly and move on.
- If finances feel low or building, or they don't yet know when they'll be financially ready: gently encourage them to build that clarity in the right place — their pension provider, their existing financial plan, or a financial adviser — and note it as an open area to return to. That's the whole of your role here.

HOLD BACK WHERE
- They're not ready to name a date — don't push for one. Many people are years away, and the goal is clarity, not commitment.
- Hesitation surfaces — treat it as information, not a problem to fix. Explore it with curiosity rather than nudging them toward a premature decision.
- Their relationship with work is their own — some are eager to leave, others draw real meaning from it. Neither is more valid; don't imply leaving sooner is healthier.
- You're tempted to plan first steps, sequencing, or how to begin — STOP. This stage settles direction and readiness; the concrete steps belong to Stage 5 (Act). Note there's something for the planning to pick up, and let it rest.

CLOSING
Mirror back, in their words: the window or timing they're picturing (however wide or provisional), the transition style they lean toward (and its shape and period if gradual), what supports their readiness, any conditions they'd want in place, and any concerns that remain. Reflect their financial-confidence signal plainly — including whether they know their financial readiness date, and that exploring it further is the natural next step if it's still open. Note warmly that this adds to their Retirement Life Plan, and that the next session looks at how retirement itself changes over time.`,
      },
      {
        id: "4.2",
        title: "The chapters of retirement",
        description:
          "Retirement isn't one long stretch — it unfolds in chapters. A map of how your priorities might shift over the years, and what you'd want to keep throughout.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Retirement is often spoken about as though it were one long, unchanging stage of life. In reality it tends to unfold through a series of chapters. Early years may bring greater freedom, energy and opportunity. Later years bring different priorities, relationships and ways of spending time. Many people carry an unspoken pressure that retirement must be fully designed before it begins. The truer, gentler picture: you are not planning a single fixed future, you are planning for a life that will keep evolving.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] In Stage 1 you pictured a single day. Now widen the lens to decades. Below is a board with three broad chapters — early, middle and later years — and a lane that runs across all of them for the things you'd want to hold onto throughout. You'll find some cards drawn from what you've already told us: hopes, activities, people, sources of purpose. Place each one where it feels most alive, in more than one chapter if it belongs there, or in the enduring lane if it runs through everything. Add your own where something's missing.`,
          },
        ],
        coachOpening: `Here's the board you've laid out — your retirement sketched as chapters rather than one long stretch. Let's start at the beginning: in those early years, while you've got the most energy and freedom, what matters most to you to do?`,
        interaction: {
          type: "seasons-board",
          boardInstruction:
            "Place each card in the chapter where it feels most alive. Something can sit in more than one chapter, or in the enduring lane if it runs across all of them. Add your own where a card is missing.",
          seasons: [
            {
              id: "early",
              label: "Early years",
              hint: "Most energy and freedom",
            },
            {
              id: "middle",
              label: "Middle years",
              hint: "Settling into the rhythm",
            },
            {
              id: "later",
              label: "Later years",
              hint: "What you'd want to continue",
            },
          ],
          enduringLane: {
            id: "enduring",
            label: "Throughout",
            hint: "Runs across every chapter",
          },
          addOwnLabel: "Add your own",
          addOwnPlaceholder: "Something else that matters…",
          summaryLabel: "Your chapters board",
        },
        sessionInstructions: `PURPOSE
You already know this person from the earlier stages — open like a coach who remembers them. They have just laid out a "chapters board": cards drawn from their earlier answers (hopes, activities, people, sources of purpose) sorted into early, middle and later years, or an enduring lane for what runs throughout. Your job is to widen their lens — from the single day they pictured in Stage 1 to a life that keeps evolving — and help them see how priorities may shift across the chapters while certain threads endure. The outcome is a broad sense of the shape of their retirement, not a fixed roadmap.

MOST IMPORTANT
The deeper purpose is how meaning, connection and fulfilment evolve over time — not simply how hobbies change. Two things to capture before closing: their priorities for early retirement (what they most want while energy and freedom are greatest), and the enduring threads (the values and relationships they want to hold throughout). Work the board they built — start with the early years, move through to later years, then name what runs across all of them.

HOW TO RUN IT
- Open by widening the lens explicitly: they imagined a Tuesday in Stage 1; now you're looking at decades. Reflect the relevant prior-stage material as you introduce the chapters.
- Early years: while energy and flexibility are greatest, what do they most want to do? Are there experiences or ambitions they would not want to postpone?
- Middle years: what feels important about that stretch?
- Later years: approach with continuity and adaptation, never decline. Which relationships do they hope grow more important over time? What sources of purpose or enjoyment feel sustainable across stages?
- Enduring lane: what would they want to remain constant, regardless of age or circumstance?
- Help them distinguish aspirations that belong to a particular chapter from those that are enduring priorities.
- Aim to reach your close within roughly five to seven exchanges.

HOLD BACK WHERE
- Do NOT frame later retirement as decline, loss or limitation — broaden the perspective without creating anxiety about ageing.
- Do NOT treat the chapters as a rigid prediction. They are a planning lens; retirement unfolds differently for everyone, and the board can change.
- Do NOT over-focus on activities and hobbies. Keep returning to meaning, connection and what gives a chapter its purpose.
- The person should leave with a sense of direction, not a locked-in roadmap. Encourage flexibility.

CLOSING
Reflect back the broad shape of the chapters they've sketched, in their own words: what stands out for the early years, anything they wouldn't want to postpone, how the middle and later years feel, and — most importantly — the enduring threads of value and relationship that run throughout. Note warmly that this adds to their Retirement Life Plan, and that the next session turns to the goals that matter most.`,
      },
      {
        id: "4.3",
        title: "Your most important goals",
        description:
          "The handful of goals whose absence would leave retirement feeling incomplete — ranked, with what each one means to you.",
        durationMin: 20,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] A full retirement tends to keep five things in some kind of balance: time to Restore (rest and recharge), to Move (an active body), to Think (a curious, engaged mind), to Connect (the people who matter), and to Contribute (giving something beyond yourself). You don't need a goal in every one, and a quiet area can be a deliberate choice. But seeing your plans laid across all five shows where life feels full and where a gap might be worth a goal.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] To save you starting from a blank page, Vita has drafted a handful of goals from everything you've told us — sorted into the five areas, already written as real, specific goals. They're a starting point, not a verdict: keep the ones that fit, edit any to your own words, swap one for a bolder or quieter version, set aside any that miss, and add your own. Then, across all five areas, mark the handful whose absence would leave retirement feeling incomplete. You can do the whole thing without typing a word.`,
          },
        ],
        coachOpening: `Here's your retirement laid across the five areas of a balanced life — Restore, Move, Think, Connect, Contribute — with the goals you've kept and the few you've put in the spotlight. We can leave them just as they are. If you'd like to make any bolder, or talk one through, I'm right here.`,
        interaction: {
          type: "balanced-goals",
          areas: [
            {
              id: "restore",
              label: "Restore",
              blurb: "Rest, recovery and the things that recharge you",
            },
            {
              id: "move",
              label: "Move",
              blurb: "Keeping an active, capable body",
            },
            {
              id: "think",
              label: "Think",
              blurb: "A curious, engaged mind — learning, making, creating",
            },
            {
              id: "connect",
              label: "Connect",
              blurb: "The people and relationships that matter most",
            },
            {
              id: "contribute",
              label: "Contribute",
              blurb: "Giving something beyond yourself",
            },
          ],
          draftingLabel: "Drawing a few goals from everything you've told us…",
          curationInstruction:
            "Vita drafted these from what you've told us. Keep the ones that fit, edit any to your own words, swap for a bolder or quieter version, set aside any that miss — or add your own. Nothing here is fixed.",
          balanceHint:
            "Balance is the point, not a full set. A quiet area can be a deliberate choice, or a gap worth one goal.",
          trackDoLabel: "A thing to do",
          trackBeLabel: "A way to live",
          cadenceLabel: "Roughly when, or how often?",
          cadencePlaceholder: "Once a year, a morning a week, the first summer…",
          ordinaryWeekLabel: "What it looks like in an ordinary week",
          ordinaryWeekPlaceholder: "How it would show up in everyday life…",
          bolderLabel: "Bolder",
          quieterLabel: "Quieter",
          rejectLabel: "Set aside",
          addGoalLabel: "Add your own",
          addGoalPlaceholder: "Name this goal…",
          toFocusLabel: "Next: choose your focus →",
          focusInstruction:
            "Across all five areas, mark the handful that matter most — the ones whose absence would leave retirement feeling incomplete. Order them, and say which season each belongs to. A line on what it means to you is welcome but optional.",
          absencePrompt: "If this were missing, would retirement feel incomplete?",
          maxFocus: 5,
          noteLabel: "What it means to you (optional)",
          notePlaceholder: "A line on why this one matters…",
          seasonLabel: "Which season does it belong to?",
          seasons: [
            { id: "early", label: "Early years" },
            { id: "middle", label: "Middle years" },
            { id: "later", label: "Later years" },
            { id: "throughout", label: "Throughout" },
          ],
          deliberateGapLabel: "We left this one deliberately quiet",
          summaryLabel: "Your balanced retirement",
        },
        sessionInstructions: `PURPOSE
You already know this person from the earlier stages — open like a coach who remembers them. You drafted a handful of goals for them across the five areas of a balanced life — Restore, Move, Think, Connect, Contribute — and they have just curated that draft: keeping, editing, swapping, setting aside, and adding their own, then spotlighting the handful that matter most (each with a season, sometimes a note on its meaning). The work is essentially done. Your job is light: reflect the balance back warmly, offer an OPTIONAL chance to refine, and let them close whenever they're ready. This handful, and the balance across the five areas, is the spine of the rest of the plan.

MOST IMPORTANT — DO NOT INTERROGATE, AND DO NOT READ THE GOALS BACK
You drafted these goals; you must NOT now drag them back out through a long question-and-answer, and you must NOT recite them. Their goals are already on the screen in front of them — listed area by area, with the spotlight marked. Repeating them in prose is noise, and it is the main thing that makes this session feel clunky. Your opening is a SHORT, warm note on the SHAPE they've struck — how the balance sits across the five areas, and perhaps one thing that genuinely stands out — never an inventory. Then ONE optional offer, and follow their lead. If they have nothing to add, that is a complete and good outcome: close. The person must be able to finish this session without sending a single message.

PLAIN TEXT, SHORT MESSAGES
- Write in plain sentences only. No markdown, no asterisks, no bold, no bullet points, no headings — any of those show up to the person as raw symbols and look broken.
- Two to four sentences per message. This is a warm word between two people, not a written report.

HOW TO RUN IT
- Opening: a brief, warm note on the balance and shape of what they've built — full where it's full, quiet where they chose to leave an area quiet, one standout only if something truly stands out. Do NOT enumerate the goals. End with one light, genuinely optional invitation ("If you'd like to make any of these bolder, or talk one through, I'm here — otherwise it's a lovely, balanced picture to build on") AND append the completion marker, so someone who's happy can simply move on.
- If they take up the offer, help with just that one goal — a bolder version of a "thing to do", or what a "way to live" goal looks like in an ordinary week. Stay with meaning; never tip into action planning. Then offer to close again.
- THE MOMENT they signal they're happy, done, or have nothing to change ("happy with that", "looks good", "no thanks", a thumbs-up): give ONE short, warm sign-off line and append the completion marker. Do NOT summarise, do NOT list anything, do NOT ask another question — just close cleanly.
- Two or three exchanges at most. This is light refinement, not a fresh exercise.

HOLD BACK WHERE
- Do NOT walk goal-by-goal asking what each means or why it matters — that turns a finished draft back into an interview.
- Do NOT push for a metric on "way to live" goals — relationships, contribution, restoration, staying curious. An ordinary-week picture is enough; a number would diminish them.
- Do NOT turn this into action planning, sequencing or first steps — that belongs to Stage 5 (Act).
- Do NOT widen the list back out, chase quantity, or push them to fill every area. Honour the few they chose and the balance they struck.

CLOSING
A short, warm sign-off — one or two sentences. Note that these goals are now the heart of their Retirement Life Plan, and that the next session looks at what would help them happen. Do NOT list the goals again. Always append the completion marker when you close.`,
      },
      {
        id: "4.4",
        title: "The path to your goals",
        description:
          "The route to each goal you spotlighted — a few stepping stones from where you are now to there, with much of the way already behind you.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] A goal rarely happens in one leap. Most come true as a handful of stepping stones — small, doable moves that build on each other until the thing you pictured is simply where you've arrived. Seeing those stones laid out makes a big goal feel a great deal more reachable.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Vita has sketched a path for each of the goals you put in the spotlight. For the things you want to do, that's a short ladder of stepping stones, roughly in order. For the ways you want to live, it's a light note on what already helps and what would help it take root. Nudge any of it into shape — edit a stone, reorder, add or remove one, or mark the ones you've already passed. No typing needed, and these are the route, not a diary; the precise first steps come later.`,
          },
        ],
        coachOpening: `Here's a path for each goal you spotlighted — a few stepping stones from where you are now to there. A good part of several of them is already behind you, which is worth noticing. Nudge any stone into shape, mark the ones you've passed, and if you'd like to talk one path through I'm right here.`,
        interaction: {
          type: "goal-paths",
          draftingLabel: "Vita is sketching a path for each of your goals…",
          curationInstruction:
            "Here's a path for each goal. Edit a stepping stone, reorder, add or remove one, or mark the ones you've already passed.",
          ladderLabel: "Stepping stones",
          whenLabel: "Roughly when",
          whenPlaceholder: "e.g. first year, somewhere down the line…",
          doneLabel: "Already done",
          addStepLabel: "Add a stepping stone",
          addStepPlaceholder: "Another step on the way…",
          alreadyHelpsLabel: "What already helps",
          wouldHelpLabel: "What would help it take root",
          addSupportPlaceholder: "Something that helps…",
          leanLabel: "A strength to lean on",
          boundaryHint:
            "These are the route, not a diary. The precise first steps come in the next stage.",
          summaryLabel: "The path to your goals",
        },
        sessionInstructions: `PURPOSE
You already know this person from the earlier stages — open like a coach who remembers them. For every goal they put in the spotlight last session, you sketched a path: for the things they want to do, a short ladder of stepping stones from where they are now to the goal; for the ways they want to live, a light note on what already helps and what would help it take root. They've nudged those drafts into shape — editing stones, reordering, adding or removing, marking the ones they've already passed. Your job is light and encouraging: show how much of each path is already behind them, so the goals feel more reachable, not more daunting. Then let them close whenever they're ready.

MOST IMPORTANT — HOW MUCH IS ALREADY BEHIND THEM; AND DO NOT READ THE PATHS BACK
The whole point is that a big goal becomes a handful of doable moves, and several of those moves are already done. Lead with that. Their paths are on the screen in front of them — do NOT recite them stone by stone. Your opening is a SHORT, warm note on the SHAPE of it: how much ground is already covered, how few stones really remain on the goals that matter most. Then ONE optional offer, and follow their lead. If they have nothing to add, that is a complete and good outcome: close. The person must be able to finish this session without sending a single message.

PLAIN TEXT, SHORT MESSAGES
- Write in plain sentences only. No markdown, no asterisks, no bold, no bullet points, no headings — any of those show up to the person as raw symbols and look broken.
- Two to four sentences per message. This is a warm word between two people, not a written report.

HOW TO RUN IT
- Opening: a brief, warm note that leads with how much is already behind them, then perhaps names the next stone on one goal — never an inventory of every path. End with one light, optional invitation ("If you'd like to talk a path through, I'm here — otherwise this is a clear route to build on") AND append the completion marker, so someone who's happy can simply move on.
- If they take up the offer, stay at the level of the route: which stone comes next, whether the order feels right, what already-existing strength they could lean on for the early steps. Keep it to the path, never the diary.
- THE MOMENT they signal they're happy, done, or have nothing to change ("happy with that", "looks good", "no thanks", a thumbs-up): give ONE short, warm sign-off line and append the completion marker. Do NOT summarise, do NOT list anything, do NOT ask another question — just close cleanly.
- Two or three exchanges at most. This is light shaping, not a fresh exercise.

THE STAGE 5 BOUNDARY — ROUTE, NOT SCHEDULE
These stepping stones are planning-level: the route to each goal, with at most a rough sense of when. Do NOT turn them into dated tasks, a week-by-week schedule, or a precise list of first actions — that granular layer is the next stage (Act). If they start reaching for exact dates or first steps, gently note that's exactly what the next stage is for, and keep this one about the shape of the route.

MEANS — HANDLE WITH CARE (CONSUMER DUTY)
A stepping stone may touch money — saving for something, covering a cost. You surface and signpost; you must NEVER provide, imply, or substitute for regulated financial advice, never estimate figures, and never comment on whether their finances are adequate. If a path leans on money, acknowledge it plainly and, if it's natural, gently encourage them to build that clarity in the right place — their pension provider, their existing financial plan, or a financial adviser. That's the whole of your role here.

HOLD BACK WHERE
- Do NOT turn this into dated tasks, scheduling or precise first steps — that belongs to the next stage (Act).
- Do NOT dwell on what's hard or far off. Spend your words on how much is already behind them and how doable the next stone is.
- Do NOT create pressure for immediate action.
- Do NOT walk path-by-path asking about each — that turns a finished draft back into an interview.

CLOSING
A short, warm sign-off — one or two sentences. Note that these paths now sit in their Retirement Life Plan, and that the next stage turns the next stones into first steps. Do NOT list the paths again. Always append the completion marker when you close.`,
      },
      {
        id: "4.5",
        title: "When you can't do it all",
        description:
          "The trade-offs retirement really asks of you — what you'd protect, where you'll flex, and a few principles for the close calls.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Having priorities that pull against each other is normal — it usually means several things matter to you deeply. Retirement draws on a finite supply of time, energy, attention and money, so choosing between good things is unavoidable. Making a choice is not the same as losing something. The work here is not to resolve every tension, but to know how you'd want to respond when one arrives.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Vita has drawn a few real trade-offs out of the plan you've been building. On each, place where you lean — the middle is a fine place to sit — and note what you'd most want to protect and what would feel like too great a sacrifice. Then sort the things you value into what you'd hold firm on and what you could flex, and shape a few decision principles for the close calls. These weigh what matters most to you; they're never advice about your money.`,
          },
        ],
        coachOpening: `Here are the trade-offs you've just weighed. Before we draw out a few principles from them, tell me — looking back over these, which one was hardest to call?`,
        interaction: {
          type: "trade-offs",
          draftingLabel: "Vita is drawing a few trade-offs out of your plan…",
          curationInstruction:
            "Here are a few real trade-offs your plan could bring. On each, place where you lean, and note what you'd most want to protect and what would feel like too great a sacrifice.",
          scenariosLabel: "Trade-offs to weigh",
          protectLabel: "What you'd most want to protect",
          protectPlaceholder: "The thing you'd hold onto…",
          sacrificeLabel: "What would feel like too great a sacrifice",
          sacrificePlaceholder: "The line you wouldn't want to cross…",
          valuesLabel: "Your values, sorted",
          valuesInstruction:
            "Sort the things you value into the ones you'd hold firm on and the ones you could flex when something has to give. Leave any you're unsure about unsorted.",
          nonNegotiableLabel: "Non-negotiable",
          flexibleLabel: "Important, but flexible",
          principlesLabel: "Your decision principles",
          principlesInstruction:
            "A few rules of thumb for the close calls. Vita has suggested some starting points from your plan — make them yours, add or remove any.",
          addPrincipleLabel: "Add a principle",
          principlePlaceholder: "A rule of thumb for when priorities pull apart…",
          boundaryHint:
            "These scenarios weigh what matters most to you — they're never advice on what to do with your money. That stays with your financial plan or adviser.",
          summaryLabel: "When you can't do it all",
        },
        sessionInstructions: `PURPOSE
You already know this person from the earlier stages — open like a coach who remembers them. They have just worked through a few concrete trade-offs drawn from their own emerging plan: on each they placed where they lean between two real options and noted what they'd most want to protect and what would feel like too great a sacrifice. They also sorted the things they value into "non-negotiable" and "important but flexible", and shaped a few decision principles. Your job is light: help them name a small, clear set of personal decision principles and fallback positions they can carry into real choices — drawn from the pattern in what they just did, in their own words.

MOST IMPORTANT — CONCRETE, NEVER ABSTRACT; AND NOT A RE-RUN OF STAGE 3
Stage 3 already named their values and the tensions between them in the abstract. Do NOT re-run that comparison. Stay with the real, consequential choices in front of them — the goals and trips, the money question, the rhythm of their week. It is by weighing choices like these that what matters most becomes clear. Their trade-offs are on the screen — do NOT recite them back one by one. Lead with the shape: where they held firm, where they were willing to flex, and what that says about how they decide.

HOW TO RUN IT
- Open by drawing on the trade-offs they made, then help them put words to a few decision principles — short rules of thumb for when priorities pull apart ("when money is tight I'd rather do fewer things properly", "time with the people I love comes before any opportunity"). They've drafted some already; sharpen and confirm rather than starting over.
- Where it helps, explore fallback positions: if their preferred outcome wasn't possible, what would still honour what matters most.
- Normalise tension — conflicting priorities are part of a thoughtful plan, not a sign of confusion. Don't push for perfect resolution; enough clarity to decide well is the goal.
- Two or three exchanges at most. This is light shaping on top of a finished exercise.

KEEP OWNERSHIP WITH THEM
Never tell them which value should win or which choice is right. Reflect the pattern in their own choices and help them articulate their own principles. Where they framed something as either/or, it's fine to wonder aloud whether a creative middle exists — but the call is always theirs.

MEANS — HANDLE WITH CARE (CONSUMER DUTY)
A scenario may touch money — stretching to several trips, freeing up cash, downsizing. Posing it explores their priorities and what they'd trade; it is NEVER a view on whether any financial course of action is wise. You must never provide, imply, or substitute for regulated financial advice, never estimate figures, and never comment on whether their finances are adequate. If a money trade-off is live, keep it about what they'd want to protect, and leave the financial judgement to their plan or adviser.

PLAIN TEXT, SHORT MESSAGES
- Write in plain sentences only. No markdown, no asterisks, no bold, no bullet points, no headings — any of those show up to the person as raw symbols and look broken.
- Two to four sentences per message. This is a warm word between two people, not a written report.

HOLD BACK WHERE
- Do NOT turn this into action planning or first steps — that belongs to the next stage (Act).
- Do NOT seek a tidy resolution to every tension; some are meant to be held, not solved.
- Do NOT re-open the abstract values comparison from Stage 3.

CLOSING
A short, warm sign-off — one or two sentences. Note that their non-negotiables, where they'll flex, and these decision principles now sit at the front of their Retirement Life Plan as a compass for the choices ahead. Do NOT list them back. Always append the completion marker when you close.`,
      },
      {
        id: "4.6",
        title: "The rhythm of your week",
        description:
          "The character of an ordinary week — how much structure you want, the real activities that recur, and the few anchors that give it rhythm.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] So much of planning looks at the big moments — the goals, the trips, the decisions. This is about something smaller and just as important: the ordinary weeks that make up most of retirement. A good retirement is built less from the highlights than from how an everyday week feels. The question underneath it: what kind of week could you happily live, not for a holiday, but for years?`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Vita has gathered the real, recurring things you've talked about — the activities you keep coming back to, the people you see, the movement and rest that run through your week. Set the overall feel from structured to open, then for each thing note roughly how often it happens, whether it's a regular anchor, and whether it gives you energy. Most things being loose is a fine answer — this is the character of a week, not a timetable.`,
          },
        ],
        coachOpening: `Here's the rhythm of your week, built from the real things you've talked about. Looking at it like this — the overall feel, the few anchors, what gives you energy — does it feel like a week you could live happily for years?`,
        interaction: {
          type: "week-shape",
          draftingLabel:
            "Vita is gathering the real things that run through your week…",
          curationInstruction:
            "Here are the recurring things in your week, gathered from what you've talked about. Set the overall feel, note roughly how often each happens and which are regular anchors, and mark the ones that give you energy.",
          structureLabel: "The overall feel",
          structurePoleLeft: "Highly structured",
          structurePoleRight: "Largely open",
          structureHint:
            "Slide to the balance of structure and freedom that fits you — the middle is fine",
          structureFromEarlierHint:
            "We've started this where you placed your ideal week earlier on. Move it if it feels different now.",
          activitiesLabel: "What recurs in your week",
          activitiesInstruction:
            "For each thing, set roughly how often it happens and whether it's a regular anchor or stays loose. Mark the ones that give you energy. Add anything that's missing, or remove what doesn't belong.",
          frequencyLabel: "How often",
          anchorLabel: "A regular anchor",
          energyLabel: "Gives me energy",
          addActivityLabel: "Add something",
          activityPlaceholder: "Something else that recurs in your week…",
          textureLabel: "The feel of it",
          boundaryHint:
            "This is the character of an ordinary week, lived for years — not a timetable to keep to. The few anchors and the overall feel matter; most things can stay loose.",
          summaryLabel: "The rhythm of your week",
        },
        sessionInstructions: `PURPOSE
You already know this person well from the earlier stages — open like a coach who remembers them. They have just shaped the rhythm of a week: they set an overall structure-to-freedom feel, and for the real recurring things in their life they set a rough frequency (most days / a few times a week / weekly / now and then), marked which are regular anchors, and tagged the ones that give them energy. There is no day-of-week or time-of-day here, by design — that precision is false this far out. Your job is light: help them put words to the rhythm that fits them — the balance of structure and freedom, the few anchors they want fixed, and what gives them energy.

MOST IMPORTANT — REFLECT THE RHYTHM BACK; PLANNING, NOT DREAMING
Reflect the overall rhythm back to them in a sentence or two, the way a friend would sum it up: how full or spacious it is, how sociable or quiet, the one or two real anchors, and what energises them. For example: "active most days, sociable, badminton a couple of times a week as a real anchor, and otherwise pretty open." Use THEIR actual activities, not generic ones. Then let them adjust. In Stage 1 they imagined a single representative day — do NOT re-open that or ask them to picture a nice day afresh. The shift here is from imagining to planning: does this rhythm hold up lived for years, not for a holiday?

HOW TO RUN IT
- Open by reading the rhythm back as above, then help them pressure-test it: does it feel sustainable for years, or more like a holiday week? Are the few anchors the right ones? Is anything quietly recreating the pressures of work, and is anything recurring missing that they'd regret leaving out?
- Most things being loose is a good answer, not a gap — never push them to add anchors or fill the week. The point is the few anchors plus the overall feel.
- If they are phasing out of work, their ongoing work sits in the rhythm as a fixed anchor. Check the rest of the week has room to breathe around it.
- Notice where they thrive — more routine, more flexibility, or a blend — and reflect back the rhythm that fits their values and energy. Some people flourish with structure, others with openness; neither is better.
- Two or three exchanges at most. This is light shaping on top of a finished exercise. They can finish without typing anything.

KEEP OWNERSHIP WITH THEM
Never imply that more structure is always better, or that a fuller week is a better week. The aim is meaningful rhythm, not filling every hour. Reflect their own preferences back rather than prescribing a shape.

PLAIN TEXT, SHORT MESSAGES
- Write in plain sentences only. No markdown, no asterisks, no bold, no bullet points, no headings — any of those show up to the person as raw symbols and look broken.
- Two to four sentences per message. This is a warm word between two people, not a written report.

HOLD BACK WHERE
- Do NOT turn this into action planning or a timetable — the concrete steps belong to the next stage (Act).
- Do NOT re-run the Stage 1 representative-day exercise or ask them to imagine a day from scratch.
- Do NOT idealise — an ordinary week has dull stretches too, and that is fine.

CLOSING
A short, warm sign-off — one or two sentences. Note that the rhythm they've shaped now sits in their Retirement Life Plan as how they want their week to feel. Do NOT list the activities back. Always append the completion marker when you close.`,
      },
      {
        id: "4.7",
        title: "Your first year",
        description:
          "Everything you've built, drawn together into a specific, sequenced picture of your first year of retirement — and how it fits around any ongoing work.",
        durationMin: 20,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Look at how much you've built. You've pictured your days, clarified what matters most, named the goals worth the years ahead, and shaped the rhythm of an ordinary week. This is where it comes together. The first year of retirement is unlike any other — the bridge between one chapter and the next. Where the rest of the programme has been about imagining and planning, this is about arriving.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] Vita has laid your first year out as a single journey — the goals and trips likely to begin, the rhythm running underneath, and how any ongoing work lands across the year — and written it up as a short story you can picture. The main way to reshape it is to tell Vita how you'd like the year to feel: "a gentle start, then the big trip mid-year", "put family at the centre of the autumn". The timeline and the story both shift in front of you. You can also nudge a single piece by hand.`,
          },
        ],
        coachOpening: `Here's your first year, laid out as one journey — and a short story of how it could unfold. Tell me how you'd like it to feel and I'll reshape it, or nudge anything yourself.`,
        interaction: {
          type: "first-year",
          draftingLabel:
            "Vita is laying your first year out as a journey…",
          seasons: [
            { id: "s1", label: "The opening months" },
            { id: "s2", label: "Settling in" },
            { id: "s3", label: "Well into the year" },
            { id: "s4", label: "Closing the year" },
          ],
          allYearLabel: "Across the whole year",
          workLaneLabel: "Work",
          noWorkLabel: "A clean break — your time is your own",
          narrativeLabel: "The story of your year",
          introMessage:
            "Here's your first year, laid out as one journey, with a short story of how it could unfold underneath. Have a look — then tell me how you'd like it to feel and I'll reshape it. You can also drag a single thing between phases, star a headline moment, or remove anything yourself.",
          reshapeHint:
            "Try: \"a gentle start, then the big adventure mid-year\" · \"the second half feels too packed\" · \"put family at the centre of the autumn\"",
          chatPlaceholder: "Tell me how you'd like the year to feel…",
          topLabel: "Headline moment",
          finishLabel: "This is my year",
          closingAck:
            "This is your first year — the shape of it, the story of it. It's the front of your plan now, the year you're stepping into.",
          boundaryHint:
            "This sets the shape and order of your year — what comes first, roughly when, and how it sits around any work. The detailed steps come next, in Act.",
          summaryLabel: "Your first year",
        },
        sessionInstructions: `PURPOSE
This is the assembly session — the moment everything comes together into a specific, sequenced first year. The person has just reacted to a draft you assembled from their own earlier work: the goals and trips they shaped (4.3), the rhythm of their week (4.6), what they wanted early in retirement (4.2), and how they're leaving work (4.1). They have placed each thing across a four-part arc of the year, marked what's top of the list, noted what can run alongside other things, and seen how much of the year is free. The emotional centre is ARRIVAL — stepping into the life they've designed.

ASSEMBLY, NOT RE-INTERVIEW
Build on what they have already said — do NOT re-ask it, and do NOT ask for another piece of reflective writing (they have done that earlier in the programme). Their first year is on the screen. Your job is to help them get it specific and sequenced, and to put words to the themes and intentions that define it, pulling their own earlier answers forward rather than asking them to dream again.

HOW TO RUN IT
- Open from what's on the screen. Help them get concrete and sequenced: of the things they want to travel to or start, what's top of the list and roughly when? Which goals come first, and which can run alongside each other? Looking at it all together, does year one feel realistic, or are they fitting too much in?
- Match the year to how they're leaving work. If they are phasing out gradually, year one may be far from empty — plan around the ongoing work rather than assuming a clean break, and be honest with them if there is less free time than they're imagining.
- Worth drawing out gently: what's the one thing they'd most regret not starting this year, and by the end of year one, what would tell them they'd begun well? These name the intentions that define the year.
- Sequence, don't schedule. The order and rough shape of the year is the work here; the granular, step-by-step task list belongs to the next stage (Act).
- Two to four exchanges. They can finish without typing anything.

KEEP OWNERSHIP WITH THEM
Don't idealise — the first year can hold excitement, uncertainty and adjustment all at once, and that is normal. A spacious year is as valid as a full one. Reflect their own plan back rather than prescribing what year one should hold.

PLAIN TEXT, SHORT MESSAGES
- Write in plain sentences only. No markdown, no asterisks, no bold, no bullet points, no headings — any of those show up to the person as raw symbols and look broken.
- Two to four sentences per message. This is a warm word between two people, not a written report.

HOLD BACK WHERE
- Do NOT turn this into a step-by-step action plan or a dated schedule — that belongs to Act.
- Do NOT re-run earlier exercises or ask for fresh reflective writing.
- Do NOT pretend a phase-out is a clean break — be honest about committed versus free time.

CLOSING
A short, warm sign-off — one or two sentences. Note that this first-year picture now sits at the front of their Retirement Life Plan as the year they're stepping into, and point gently toward turning it into first steps in the stage ahead. Do NOT list the year back. Always append the completion marker when you close.`,
      },
    ],
  },
  {
    number: 5,
    name: "Act",
    subtitle: "Turn it into next steps",
    modules: [],
  },
];

// Look up a module by its id (e.g. "1.day"), with the stage context the session
// screen needs. `rs` scopes visibility: an audience-restricted module is found
// only for a matching stage, and modulesInStage / stageModuleIds count only the
// modules that stage actually sees. rs omitted (=null) → today's universal set.
export function getModule(id: string, rs: RetirementStage | null = null) {
  for (const stage of STAGES) {
    const mods = visibleModules(stage, rs);
    const found = mods.find((m) => m.id === id);
    if (found) {
      return {
        module: found,
        stageNumber: stage.number,
        stageName: stageNameFor(stage, rs),
        totalStages: TOTAL_STAGES,
        modulesInStage: mods.length,
        stageModuleIds: mods.map((m) => m.id),
      };
    }
  }
  return null;
}

// Every module that comes before the given id in programme order (across all
// stages), as { id, title }, in order. Empty if it's the first module or the id
// isn't found. Used to gather earlier takeaways for the current module.
export function getModulesBefore(
  id: string,
  rs: RetirementStage | null = null
): { id: string; title: string }[] {
  const ordered: { id: string; title: string }[] = [];
  for (const stage of STAGES) {
    for (const m of visibleModules(stage, rs)) {
      if (m.id === id) return ordered;
      ordered.push({ id: m.id, title: m.title });
    }
  }
  return [];
}

// Every module in programme order, each with its stage context. Used by the
// admin feedback portal to lay modules out in the order testers meet them and to
// show titles alongside the raw module ids stored with each rating.
export function allModulesInOrder(): {
  id: string;
  title: string;
  stageNumber: number;
  stageName: string;
}[] {
  const ordered: {
    id: string;
    title: string;
    stageNumber: number;
    stageName: string;
  }[] = [];
  for (const stage of STAGES) {
    for (const m of stage.modules) {
      ordered.push({
        id: m.id,
        title: m.title,
        stageNumber: stage.number,
        stageName: stage.name,
      });
    }
  }
  return ordered;
}

// The id of the next module in the same stage, or null if this is the last one.
// rs scopes visibility so the chain skips modules this person doesn't see.
export function getNextModule(
  id: string,
  rs: RetirementStage | null = null
): string | null {
  for (const stage of STAGES) {
    const mods = visibleModules(stage, rs);
    const index = mods.findIndex((m) => m.id === id);
    if (index !== -1) {
      const next = mods[index + 1];
      return next ? next.id : null;
    }
  }
  return null;
}

// ---- Winding-down: module 1.winddown → 4.1 routing (Phase 3) ----------------

// Whether a winding-down person's wind-down module says they've settled how and
// when they'll leave work. Read from the 1.winddown build (a screening-check).
// "A set date or plan" is the only truly-decided answer; "A rough window" and
// "Not yet — still open" still need the readiness work, so they count as not
// decided here.
export function windDownDecided(build: BuildResult | null): boolean {
  if (!build || build.type !== "screening-check") return false;
  const answer = build.answers.find((a) => a.id === "decision");
  return answer?.choice === "A set date or plan";
}

// The 4.1 module content for a winding-down person, chosen by whether they've
// decided how/when they'll leave (see windDownDecided). Two shapes:
//   decided   → an anticipatory REFLECTION (no readiness widget): they've settled
//               the plan, so this draws out what they'll miss and what they want
//               to carry or replace as they approach leaving fully. The exit shape
//               itself is already captured as a wind_down_exit fact in 1.winddown.
//   undecided → the working readiness widget, RE-ANCHORED to completing an exit
//               they've already begun: the shape and timing of the rest of the
//               wind-down and their readiness for the final step, not a decision
//               made from scratch.
// baseInteraction is 4.1's own readiness-snapshot interaction, re-labelled for
// the undecided path and dropped entirely for the decided one.
export function windDownFourOne(
  decided: boolean,
  baseInteraction: Interaction | undefined
): {
  description: string;
  primer: ContentBlock[];
  coachOpening: string;
  sessionInstructions: string;
  interaction: Interaction | undefined;
} {
  if (decided) {
    return {
      description:
        "A short reflection as you approach leaving work fully — what you'll miss, and what you want to carry with you or replace.",
      primer: [
        {
          type: "text",
          value: `You've already settled how and when you'll leave work — that part's in hand. This is the other half of the same threshold: what it actually means to step away, now the end is in view. Not the logistics, but the quieter things — what you'll miss, what you want to carry into what comes next, and what you'll want to find another home for.`,
        },
      ],
      coachOpening: `You've got your plan for leaving work in place, which is a real thing to have settled. As you get closer to actually stepping away, I'm curious — when you picture that last stretch of work behind you, what do you think you'll miss most?`,
      sessionInstructions: `PURPOSE
This person is winding down and has already decided how and when they'll leave work — that's settled, and captured elsewhere. This session is NOT about the decision. It's an anticipatory reflection: as they approach leaving fully, help them look at what work has given them, what they'll miss, and what they want to carry into what's next or replace. The emotional centre is letting go well, on their own terms.

HOW TO RUN IT
- Open on what they'll miss, drawing on anything you already know about what they value or draw identity from in work. Take their answer seriously and stay with it.
- Move gently across three threads as they fit, not as a checklist: what they'll miss when the work is behind them; what they want to carry with them into what's next (a skill, a rhythm, a part of who they are); and what work gave them that they'll want to find another source for (structure, status, people, purpose).
- One thread at a time. Let feeling surface without rushing to reassure or fix.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Do NOT reopen the decision, push on the date, or turn this into readiness-planning — they've decided. If they raise a practical worry, acknowledge it and steer back to the reflection.
- Don't imply that leaving is a loss to be mourned, or that they should feel more (or less) than they do.
- Don't pile on praise or over-interpret.

CLOSING
Mirror back, in their words: what they'll miss, what they want to carry with them, and anything they'll want to replace. Note warmly that this becomes part of their Retirement Life Plan, and that the next session looks at how retirement itself changes over time.`,
      interaction: undefined,
    };
  }

  // Undecided: keep the readiness widget, re-anchored to completing the wind-down.
  const reAnchored: Interaction | undefined =
    baseInteraction && baseInteraction.type === "readiness-snapshot"
      ? {
          ...baseInteraction,
          transitionInstruction:
            "You're already winding down. For the rest of it, where do you picture yourself? Slide toward wrapping up before long, or easing out more gradually.",
          transition: {
            left: "Wrap it up before long",
            right: "Keep easing out gradually",
          },
          windowInstruction:
            "Roughly when do you picture taking the final step out of work? Drag out a band rather than a single date — this is a window, not a deadline.",
        }
      : baseInteraction;

  return {
    description:
      "The shape and timing of the rest of your wind-down — how you want it to go from here, and what would make you feel ready for the final step.",
    primer: [
      {
        type: "text",
        value: `You've already started winding down — the shift out of work is underway. What's still open is the rest of it: how you want the wind-down to go from here, and when and how you take the final step out. Deciding that on your own terms — rather than letting it drift or be decided for you — is what this session is for. The visible date is only the surface; beneath it sit finances, confidence, identity, relationships, purpose, and the things you still want to finish.`,
      },
      {
        type: "text",
        value: `In a moment you'll build a readiness snapshot. First, mark how you want the rest of the wind-down to go — wrapping up before long at one end, easing out more gradually at the other. Then mark the rough window you picture for the final step, as a band rather than a single date. Last, rate how ready each part of the picture feels — finances, health, who you are beyond work, relationships, purpose, and the things you still want to finish. There are no right answers, and "not yet" is one of them.`,
      },
    ],
    coachOpening: `Here's the readiness snapshot you've just built. You're already on your way out — so before we look at where it feels strong and where it feels shaky, tell me: when you picture the final step out of work, does it feel close, or still a good way off?`,
    sessionInstructions: `PURPOSE
This person is already winding down and has NOT yet settled how and when they'll leave work altogether. They've just built a readiness snapshot re-anchored to completing the exit they've already started: how they want the rest of the wind-down to go, the rough window for the final step, and how ready each part of the picture feels — finances, health, identity beyond work, relationships, purpose, and things they still want to finish. Your job is to help them complete the exit BY CHOICE rather than let it drift. The aim is clarity about what would make them ready for the final step, not a committed date. A thoughtful "not yet — and here's what would need to change" is a complete and valuable outcome.

MOST IMPORTANT
They've already begun — so this is about the rest of the road, not a decision from scratch. Don't ask "will you retire?"; they're on the way. Ask what would make them ready to take the final step, and what shape they want the remaining wind-down to have. Work the snapshot they built: lead with where readiness feels strong and where it feels shaky, and draw out what sits underneath, in their own words.

HOW TO RUN IT
- Open by reflecting where they already are — they're winding down, some of the shift is behind them — then use the snapshot as the anchor.
- Lead with the contrast in the readiness profile: name one part that feels strong and one that feels shaky, and ask what's underneath each.
- Draw on these as they fit, not as a checklist: how they want the rest of the wind-down to go; what would make the final step feel right; anything they'd like to complete or resolve before leaving fully; what might hold the last step up.
- Take the shape of the remaining wind-down seriously — it determines how full the early years really are, and later sessions build on it.
- Aim to reach your close within roughly five to seven exchanges.

FINANCIAL CONFIDENCE — HANDLE WITH CARE (CONSUMER DUTY)
The finance factor is paired with a confidence-only follow-up. You surface and signpost financial confidence; you must NEVER provide, imply, or substitute for regulated financial advice, never estimate figures, and never comment on whether their finances are adequate. If finances feel low or building, or they don't yet know when they'll be financially ready, gently encourage them to build that clarity in the right place — their pension provider, their existing financial plan, or a financial adviser — and note it as an open area. That's the whole of your role here.

HOLD BACK WHERE
- They're not ready to name a date for the final step — don't push for one. The goal is clarity, not commitment.
- Hesitation surfaces — treat it as information, not a problem to fix.
- You're tempted to plan first steps or sequencing — STOP. This stage settles direction and readiness; the concrete steps belong to Stage 5 (Act).

CLOSING
Mirror back, in their words: how they want the rest of the wind-down to go, the window they picture for the final step (however wide or provisional), what supports their readiness, any conditions they'd want in place, and any concerns that remain. Reflect their financial-confidence signal plainly. Note warmly that this adds to their Retirement Life Plan, and that the next session looks at how retirement itself changes over time.`,
    interaction: reAnchored,
  };
}

// The Stage 1 (Imagine) intro body for someone winding down — present-progressive
// framing that meets them mid-shift, rather than the "before you can plan a
// retirement" opening written for someone with it all still ahead. The stage
// label stays "STAGE 1 · IMAGINE"; only the body changes. Applied in the home
// dashboard behind the flag; everyone else keeps the default intro.
export const WINDING_STAGE1_INTRO_BODY: string[] = [
  "You've already started the shift out of work — one foot in, one stepping into what's next. That gives you a real head start: you're not imagining retirement from a standing start, you're picturing the rest of a change that's already underway.",
  "There's no right answer here, and nothing to get perfect. These first few sessions help you build a vivid picture of the retirement your wind-down is leading toward — something you'll come back to, deepen, and reshape as you go.",
  "We'd suggest taking about one a day, so each has time to settle.",
];

// The Stage 1 intro for the retired cohorts, where Stage 1 is "Review" rather
// than "Imagine": the heading, and body that meets someone already living
// retirement — taking stock of it as it is, and as they'd like it. RR and EST
// share this; the tense/depth difference lives in the per-module copy. Applied in
// the home dashboard behind the flag, which also swaps the stage name to "Review".
// The retired cohorts' version of the letter module (Phase 4): the letter is
// reframed from "a letter from your future self" to reflecting on the retirement
// they're already living, and — unlike the default letter, which has no chat — it
// leads into a Vita conversation that draws out what they'd keep, reshape, or
// leave behind (captured as keep_change_leave facts via the conversation). The
// letter-writing surface itself is unchanged; only the prompt/framing differs.
// Presence of sessionInstructions is what tells SessionContainer to run the
// follow-on conversation, so the default letter flow stays untouched.
export function retiredLetter(): {
  primer: ContentBlock[];
  writingPlaceholder: string;
  coachOpening: string;
  sessionInstructions: string;
} {
  return {
    primer: [
      {
        type: "text",
        value: `You've been living this a while now. A good way to take stock is to write about it — what an ordinary good stretch of your retirement actually looks like, what's been good, what's been harder than you expected, and what's surprised you. Write it to someone in your life, in your own words. Afterwards, Vita will read it back and talk it through with you.`,
      },
    ],
    writingPlaceholder:
      "Tell them how retirement has been — what an ordinary good week looks like now, what's been good, what's been harder than you expected, and anything that's surprised you…",
    coachOpening: `Thank you for that — it's a real picture of how things are. Reading it back, what stands out first: is it something that's been good, or something that's been harder than you expected?`,
    sessionInstructions: `PURPOSE
This person is already retired and has just written a short reflection on how their retirement has actually been — what's good, what's been harder than expected, what's surprised them (their letter is under WHAT THEY BUILT). Read it properly and talk it through. The real work of this conversation is helping them take stock: looking at the elements of their current retirement and sorting each into what they'd KEEP as it is, what they'd CHANGE or reshape, and what they'd LEAVE BEHIND. Stay warm and reflective — this is a stock-take, not a fix-it session.

HOW TO RUN IT
- Open on what stood out in their letter — something good or something harder — and take it seriously before moving on.
- Draw on the whole picture they've built in the earlier Review sessions (their days, their week, the roles they play, what they miss from work) as well as the letter, and reflect specific elements back to them.
- For the elements that carry weight, help them place each one: is this something to keep as it is, to reshape, or to let go of? Ask it plainly and in their own terms — never as a checklist, and one thread at a time.
- Let them lead on what matters most. Some things they'll be settled on; others they'll want to change. Both are useful. Don't rush to solutions or first steps — naming what to keep, change, or leave is the whole job here.
- Aim to reach your close within roughly five to seven exchanges.

MUST NOT
- Don't turn this into planning, goals, or first steps — that comes later. Keep it reflective.
- Don't imply their retirement should look any particular way, or that wanting to change something means it's going wrong.
- Don't pile on praise or over-interpret.

CLOSING
Mirror back, in their words: what they'd keep as it is, what they'd like to reshape, and anything they'd happily leave behind. Note warmly that this becomes part of their Retirement Life Plan, and that it points to what the planning stages can help them act on.`,
  };
}

export const REVIEW_STAGE1_INTRO_HEADING = "Let's take stock";
export const REVIEW_STAGE1_INTRO_BODY: string[] = [
  "You're living your retirement already, so we'll start where you are. This first stage is about seeing it clearly — the shape of your days, the roles you play, what work gave you, and how it all feels — as it is now, and as you'd like it to be.",
  "There's no right answer here, and nothing to get perfect. It's a chance to take stock: what's working and worth keeping, what you'd like to reshape, and what you'd happily leave behind.",
  "We'd suggest taking about one a day, so each has time to settle.",
];
