// The Stage 2 (Explore) discovery-layer stat library, transcribed from
// stage2-stat-library-v0.3.md, then tightened by the v0.4 selection & framing
// spec. Each stat is a fixed, pre-sourced research finding; the personalisation
// is the connective line Vita writes around it (generated in
// app/api/stage2-reveal/route.ts). The `claim` and `sourceDisplay` are LOCKED —
// never reworded and never recalculated except by a spec change.
//
// The no-mortality rule (v0.4 rule A): the reveal — card AND "Where's this
// from?" tap — carries only gain figures, lever findings, or curiosities. It
// never carries a hazard ratio, mortality figure, or disease-incidence number;
// those belong in the primer, which is licensed to state stakes calmly. Burying
// a scare in the tap doesn't help — a curious user just taps into it. This rule,
// not a head-count of alarming-vs-encouraging stats, is what keeps the reveal
// warm, and it replaces the old Balance rule. test/stage2Stats.test.ts enforces
// it, so a scare cannot re-enter the pool quietly.
//
// The causation guardrail (rule B): a stat must never imply that changing a
// marker changes the outcome. Marker stats may state only that the marker
// reflects or indicates something; any actionable message must rest on a stat
// where the action itself is what was studied.
//
// Retired from the reveal by rule A (each may still live in the primer):
//   A1 grip      — 67% mortality figure, and unusable without implying causation
//   S1 cigarettes — inherently a scare comparison; covered by S2/S4/S6
//   S3 isolation  — stroke/heart incidence figures; covered by S2
//   V5 napping    — threat-framed mortality, and a marker rather than a cause
//   P5 purpose/heart — collapsed into P1 once its mortality wording went
// Where rule A cost a stat its number, the figure is dropped rather than
// inverted: a mortality hazard ratio cannot be validly restated as a survival
// figure (that depends on the baseline rate). So A3, P1 and V1 now run
// numberless. Figures survive only where the source stat is already gain-framed.
//
// Senses (spec N1–N5) is REVEAL-EXCLUDED, primer-only, by decision — not by
// oversight, and not a silent fallback: every senses stat is dementia-framed, and
// the reveal carries gain/lever/curiosity only (see rule A). None of N1–N5 is
// transcribed below, so there is nothing in the pool to mark; this comment is the
// record. The v0.4 trigger table lists N1/N2/N4/N5 as eligible, which would
// reverse the decision, so it is not applied. The senses area renders as
// breathing room, and no senses stat is to be invented to fill it.
//
// Open product question, deliberately not solved here: hearing and vision still
// need a home — the primer, or Stage 5 (Act).
//
// So this pool is 24 stats across five domains, not the spec's 34.
//
// `// VERIFY` marks the contested set (evidence_strength solid-but-contested or
// directional) — every headline number is checked against the primary paper
// before first ship, per the spec's Governance note.

export type Stage2Area =
  | "active"
  | "cognitive"
  | "social"
  | "purpose"
  | "vitality"
  | "senses";

// Register, mapped from the spec's 🟢/🟠/🟡 key: encouraging / alarming / mixed.
// Rule A retired or reframed every alarming stat, so nothing in the pool carries
// that register any more. It survives as a description of tone, not as an input
// to selection — the old balance machinery that read it is gone.
export type StatRegister = "encouraging" | "alarming" | "mixed";

export type StatEvidence =
  | "robust"
  | "solid"
  | "solid-but-contested"
  | "directional";

// The facts a trigger tests and an anchor names. Built once per user from their
// six Stage 2 module outputs (see buildStatContext in lib/stage2Selection.ts).
//
// These are LISTS OF THE USER'S ACTUAL PICKS, not booleans, because rule E's
// personal bridge has to name a real item in recognisable language — "the
// photography and language-learning you picked", never "your curiosities". A
// boolean can gate a stat but it can't anchor one.
//
// Every item here comes from a fixed picker, so the most specific an anchor can
// ever be is the option label ("Learning a language", never "Spanish"). Genuine
// free text — the letter body, the dreams behind an aspiration — lives in the
// canonical profile from Stage 1, and enriching anchors from there is a later
// job: it would raise subject-mismatch risk (rule F check 2), because the anchor
// would no longer come from the same picker that made the stat eligible.
export type StatContext = {
  // active (2.1)
  activities: string[];
  walkingPicks: string[];
  balancePicks: string[];
  capabilityPicks: string[];
  // cognitive (2.2)
  curiosities: string[];
  languagePicks: string[];
  puzzlePicks: string[];
  newSkillPicks: string[];
  // social (2.3)
  people: string[];
  closeTiePicks: string[];
  groupPicks: string[];
  closeTiesStrong: boolean;
  thinCasualContact: boolean;
  // purpose (2.4). `caringPicks` is the Care & connection group — which is also
  // exactly what the spec means by meaning that "reads daily/relational", so P4
  // reads it too rather than duplicating the same set under a second name.
  meanings: string[];
  caringPicks: string[];
  contributionPicks: string[];
  // vitality (2.5)
  energisers: string[];
  drains: string[];
  lever: string | null;
  outdoorPicks: string[];
  sedentaryDrainPicks: string[];
  sleepPicks: string[];
  sleepRaised: boolean;
  energyFlagged: boolean;
};

export type Stat = {
  id: string;
  area: Stage2Area;
  // LOCKED — verbatim from the spec. Vita places this; she never rewrites it.
  claim: string;
  // LOCKED — the user-facing "Where's this from?" tap text, verbatim.
  sourceDisplay: string;
  register: StatRegister;
  evidence: StatEvidence;
  // What this finding is ABOUT, in plain words — handed to Vita so the lead-in
  // links the person's pick to a subject we chose rather than one she inferred.
  //
  // This exists because inference went wrong in a live run: A3 (walking) produced
  // "walking the dog builds the strength and stamina retirement needs", inventing
  // strength — A5's subject, and a different finding. Told the subject is
  // "walking", that sentence is unwritable.
  //
  // Keep these NEUTRAL — the topic, never the conclusion. "your sleep pattern",
  // not "why regular sleep beats long sleep"; "strength", not "that strength
  // comes back". A subject carrying the finding's answer invites the preview it's
  // meant to prevent, which is the trap V1 sits closest to.
  subject: string;
  // Rule D — eligibility. The stat can only fire when the user's Stage 2 model
  // actually contains its subject. There is no "effectively always" any more.
  trigger: (ctx: StatContext) => boolean;
  // Rule E mode 1 — the items this stat could bridge to, in the user's own picked
  // words, best first. Empty means there's nothing specific to name, which is not
  // a failure: it drops the stat to a did-you-know, or to nothing.
  //
  // This is a POOL, not a choice. Selection removes items already named elsewhere
  // in the same reveal and takes what's left, so an area whose first-choice item
  // is spoken for reaches for the next real one instead of repeating it.
  //
  // The pool always comes from the same picks that satisfy the trigger, so the
  // stat's subject and the anchor's subject cannot drift apart.
  anchor: (ctx: StatContext) => string[];
  // Picks that collide with an illustrative example inside this stat's locked
  // claim. When the stat fires, the area's forward line stops naming them, so the
  // card doesn't offer something back as a new idea that the person already told
  // us they do. C6 is the case: its claim cites "digital photography" as an
  // example of a NEW skill, which reads oddly beside a forward line about the
  // photography they already enjoy.
  //
  // The collision is fixed by suppressing the item, never by swapping the claim's
  // example: those examples are the interventions the study actually ran, the tap
  // cites the paper directly beneath, and a per-user claim variant would break
  // both the LOCKED contract and the static rule-A test.
  exampleCollisions?: string[];
  // Rule E mode 2 — may this stat fire as a standalone "Did you know…" when it's
  // eligible but no anchor resolves? A did-you-know asserts nothing about the
  // user, so it cannot mismatch. False means the stat is bridge-or-nothing.
  didYouKnow: boolean;
  // Selection step 2 — the per-area preference order (lower wins). This is the
  // deliberate replacement for the spec's "aspiration verb": no Stage 2 picker is
  // starrable, so there is no stated-preference signal anywhere in the stage to
  // read. An explicit, reviewable order delivers the same intent ("this is what
  // makes A5 beat a generic pick") without inventing a field.
  priority: number;
  // What Vita connects the stat to — an instruction for the connective line, not
  // a sentence. Used for mode 1 only: a did-you-know still gets copy, but it's a
  // general framing of the fact written from a fixed instruction in the route,
  // since there's no item here to connect it to.
  //
  // Keep these to "name the item and stop". An instruction that asks Vita to
  // explain how the finding relates to the pick makes her preview the claim, and
  // since she may neither restate it nor imply cause, what comes out is vague
  // mechanism-guessing. See purpose-habits for the worked example.
  hookInstruction: string;
};

// ---- picked-option vocabularies ---------------------------------------------
// Every string below is a real option from the Stage 2 pickers in lib/modules.ts.
// If an option is renamed there, it must be renamed here or the stat silently
// stops firing.

const WALKING = ["Walking", "Walking the dog", "Hiking or rambling"];

// Movement that depends on, and builds, steadiness.
const BALANCE_ACTIVITIES = [
  "Dancing",
  "Yoga or stretching",
  "Tai chi or qigong",
  "Pilates",
  "Hiking or rambling",
  "Climbing",
  "Horse riding",
  "Skiing or snowsports",
];

// The spec's A5 predicate wants "activities they want to stay physically able to
// enjoy". No such field exists — 2.1 captures an activity picker and a level
// slider, and its instruction already frames the picks as "how you'd like to keep
// moving and feel confident in your body through retirement". These are the picks
// where that capability reading is most literal, and they double as the spec's
// own examples (gardening, carrying grandchildren, DIY).
const CAPABILITY_ACTIVITIES = [
  "Gardening",
  "DIY or practical projects",
  "Playing with grandchildren",
  "Cleaning and pottering about",
];

const LANGUAGES = ["Learning a language"];
const PUZZLES = ["Puzzles, crosswords & brain games"];

// The Park study is about learning something NEW and demanding — its own examples
// are digital photography and quilting. These are the 2.2 picks that plausibly
// take real practice. The spec's C6 predicate says "a *deferred* want to learn
// something new"; nothing captures whether an ambition is deferred, and the
// finding holds either way, so the qualifier is dropped rather than faked.
const NEW_SKILLS = [
  "Learning a language",
  "Playing or listening to music",
  "Photography",
  "Painting, drawing & crafts",
  "Knitting, sewing & textiles",
  "Computers, coding & gadgets",
  "Building, fixing & restoring",
];

const CLOSE_TIES = ["Partner", "Close friends", "Children", "Grandchildren"];
const GROUPS = ["A community or faith group", "People around a hobby"];

const CARING = [
  "Caring for someone",
  "Helping raise grandchildren",
  "Supporting a neighbour",
  "Mentoring informally",
];
const CONTRIBUTION = [
  "Volunteering",
  "Leading a local group",
  "Organising community events",
  "Helping a cause you care about",
  "A bit of paid work",
];

const OUTDOORS = ["Time outdoors", "Daylight in the morning"];
const SEDENTARY_DRAINS = ["A full diary", "Overcommitting", "Rushing"];
const SLEEP_ITEMS = [
  "Good sleep",
  "Early nights",
  "Routine",
  "Screens late",
  "A nap",
  "Daylight in the morning",
];

export const STAGE2_VOCAB = {
  WALKING,
  BALANCE_ACTIVITIES,
  CAPABILITY_ACTIVITIES,
  LANGUAGES,
  PUZZLES,
  NEW_SKILLS,
  CLOSE_TIES,
  GROUPS,
  CARING,
  CONTRIBUTION,
  OUTDOORS,
  SEDENTARY_DRAINS,
  SLEEP_ITEMS,
};

// ---- anchor helpers ---------------------------------------------------------
// Picks arrive in the order the person chose them, so the pool is already in a
// sensible preference order — the first is what they reached for first.

// A stat that can never bridge: a designated did-you-know carrier.
const never = (): string[] => [];

export const STATS: Stat[] = [
  // ---- active — Staying active ----
  // A1 grip is retired from the reveal (rule A + rule B): its finding is a
  // mortality figure, and grip can't carry a health outcome without implying
  // that squeezing a gripper buys the longevity — which the association does not
  // support. The actionable strength message is carried entirely by A5.
  {
    id: "active-strength-reversible",
    area: "active",
    subject: "strength",
    claim:
      "Strength is one of the few things you can truly rebuild at any age — trials have had people in their seventies, eighties and nineties get measurably stronger. Left alone it fades by around 15% a decade after fifty, but that decline is reversible.",
    // Rebuild first, decline demoted to a subordinate clause. The old wording
    // opened on the fade, which is the "warned, not equipped" shape this whole
    // workstream exists to remove — the reader met the loss before the lever.
    // ("truly", not "genuinely": CLAUDE.md bans that word in user-facing copy.)
    sourceDisplay:
      "Sarcopenia reviews + resistance-training trials in older adults (to 2025).",
    register: "encouraging",
    evidence: "robust",
    // Rule B's model citizen: the action studied (resistance training) is the
    // action recommended, so this one may carry an actionable message.
    priority: 1,
    // Broad eligibility, strict anchor — the shape rule E is built around, and
    // worth reading before loosening either half.
    //
    // Anyone thinking about staying active deserves this message, so the trigger
    // is wide. But it may only BRIDGE to a capability pick — the thing the
    // strength is for. Anchoring it to "Walking the dog" reads as a bridge and
    // isn't one: walking is not what the resistance-training studies measured, and
    // that's the same subject mismatch as grip-on-"keep-using-my-hands".
    //
    // Narrowing the trigger instead would be the wrong fix: it removes the
    // mismatch by removing the message, and a walker hears nothing about strength
    // at all. Mode 2 is what carries it to them instead — as a general fact, with
    // no false bridge. (A walker with no capability pick still gets A3 first if
    // it's fresh, since a real bridge beats a did-you-know.)
    trigger: (ctx) => ctx.activities.length > 0,
    anchor: (ctx) => ctx.capabilityPicks,
    didYouKnow: true,
    hookInstruction:
      "Name the activity they picked and say it's the kind of thing that depends on strength. Nothing about what strength training achieves — the finding says that.",
  },
  {
    id: "active-steps-plateau",
    area: "active",
    subject: "walking",
    claim:
      "Good news if 10,000 felt daunting: for people over sixty, the longevity benefit of walking levels off around six to eight thousand steps a day. Most of the gain is already there by eight thousand — and well before ten.",
    // Reworded by rule A: the "half the death risk of four thousand" figure is
    // dropped rather than inverted into a survival number, which the source's
    // hazard ratio doesn't license. The lever and the relief both survive.
    sourceDisplay:
      "Paluch et al., Lancet Public Health, 2022 (meta-analysis, 15 cohorts).",
    register: "encouraging",
    evidence: "robust",
    priority: 2,
    trigger: (ctx) => ctx.walkingPicks.length > 0,
    anchor: (ctx) => ctx.walkingPicks,
    didYouKnow: false,
    // A3 may anchor only to movement, stamina, routine or getting outdoors —
    // NEVER strength. A live run produced "walking the dog builds the strength and
    // stamina retirement needs", which is both untrue (walking is not resistance
    // training) and corrosive: the A3/A5 split is the whole reason a walker gets a
    // walking finding instead of a strength one.
    hookInstruction:
      "Name their walking and frame it as already enough, not a shortfall. Speak only of movement, stamina, routine or getting outdoors — never strength, which is a different finding.",
  },
  {
    id: "active-balance-test",
    area: "active",
    subject: "balance",
    claim:
      "One you can try now: holding one leg for ten seconds is a quick read on your steadiness, and balance is very trainable at any age. A little practice keeps you sure-footed for the things you love doing.",
    // Reframed by rule A: the decade-mortality figure is gone. A number returns
    // here only if a clean falls-reduction-from-balance-training figure is
    // sourced — never the mortality one.
    sourceDisplay:
      "Araújo et al., British Journal of Sports Medicine, 2022 (the ten-second test); balance-training trials in older adults. Worth knowing: the test is a quick read on overall steadiness rather than a verdict on it.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY — the test and the trainability claim come from different evidence bases
    priority: 3,
    trigger: (ctx) => ctx.balancePicks.length > 0,
    anchor: (ctx) => ctx.balancePicks,
    didYouKnow: false,
    hookInstruction:
      "Invite them to try it now; tie to staying steady for the activities they love.",
  },
  {
    id: "active-10k-myth",
    area: "active",
    subject: "step targets",
    claim:
      "The famous 10,000-steps goal didn't come from research — it traces back to a 1960s marketing slogan. The actual evidence points lower for older adults.",
    sourceDisplay:
      "Origin widely documented; evidence base: Paluch et al., 2022. (Verify the 1960s-pedometer origin before ship.)",
    register: "encouraging",
    evidence: "directional", // VERIFY — origin claim needs confirming
    priority: 4,
    trigger: (ctx) => ctx.walkingPicks.length > 0,
    // A designated did-you-know carrier. The spec's predicate wants "step/target
    // anxiety", which nothing captures — and its job is to relieve a target, which
    // lands better as a general fact than as a claim about this person's worry.
    anchor: never,
    didYouKnow: true,
    hookInstruction:
      "Permission-giving — relieve any sense they're failing a target.",
  },

  // ---- cognitive — Keeping your mind alive ----
  {
    id: "cognitive-learn-new-skill",
    area: "cognitive",
    subject: "new, demanding skills",
    claim:
      "Here's the active version: when adults aged 60–90 spent three months learning a truly new, demanding skill — digital photography, quilting — their memory measurably improved. The people who just socialised or did easy puzzles saw far less. It's the new and hard that does it.",
    sourceDisplay: "Park et al. ('Synapse Project'), Psychological Science, 2014.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    // Ranked first in the area: the action studied is the action recommended, so
    // it's the one cognitive stat that can carry a lever without straining rule B.
    priority: 1,
    trigger: (ctx) => ctx.newSkillPicks.length > 0,
    anchor: (ctx) => ctx.newSkillPicks,
    // "digital photography" is the claim's example of a NEW skill.
    exampleCollisions: ["Photography"],
    didYouKnow: false,
    hookInstruction:
      "Name their specific new ambition (Spanish, an instrument, a craft) as exactly this kind of productive stretch.",
  },
  {
    id: "cognitive-bilingual",
    area: "cognitive",
    subject: "speaking a second language",
    claim:
      "People who become fully bilingual tend to show dementia symptoms about four and a half years later than people who stay monolingual.",
    sourceDisplay:
      "Alladi et al., Neurology, 2013; meta-analysis 2020. Worth knowing: strongest for lifelong bilinguals; it delays, doesn't prevent.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    priority: 2,
    // Fires on a language want and nothing else, per the spec.
    trigger: (ctx) => ctx.languagePicks.length > 0,
    anchor: (ctx) => ctx.languagePicks,
    didYouKnow: false,
    hookInstruction:
      "Tie to the language they want to learn. Do not promise the delay follows from learning it.",
  },
  {
    id: "cognitive-puzzles",
    area: "cognitive",
    subject: "puzzles and brain games",
    claim:
      "Regularly doing puzzles, crosswords and number games like sudoku is linked to roughly 9–11% lower dementia risk, with sharper processing speed into the eighties and beyond.",
    sourceDisplay: "Australian cohort studies (10,000+ adults), to 2023.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    priority: 3,
    trigger: (ctx) => ctx.puzzlePicks.length > 0,
    anchor: (ctx) => ctx.puzzlePicks,
    didYouKnow: false,
    hookInstruction:
      "Tie to their existing puzzle habit, then gently nudge toward novelty/variety.",
  },
  {
    id: "cognitive-activity-delay",
    area: "cognitive",
    subject: "keeping mentally active",
    claim:
      "Among people in their eighties, those most engaged in mentally active things — reading, games, puzzles, writing — developed Alzheimer's symptoms about five years later than the least engaged.",
    sourceDisplay:
      "Wilson et al., Neurology, 2021 (Rush Memory and Aging Project). Worth knowing: partly reflects that early decline reduces activity.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    priority: 4,
    trigger: (ctx) => ctx.curiosities.length > 0,
    anchor: (ctx) => ctx.curiosities,
    didYouKnow: false,
    // Rule B: the spec flags this one for reverse causation — early decline
    // reduces activity, so the connective must not sell the delay as the payoff.
    hookInstruction:
      "Tie to the specific curiosities they chose (history, making, music). Do not promise the delay follows from them.",
  },
  {
    id: "cognitive-engaged-not-occupied",
    area: "cognitive",
    subject: "challenging your mind",
    claim:
      "Here's the distinction that matters: people who challenged their minds daily had around 29% lower odds of dementia — but passive things like watching TV showed no such benefit. Engaged beats merely occupied.",
    sourceDisplay:
      "Lee et al., JAMA Psychiatry, 2018 (15,000+ adults in their 70s).",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    priority: 5,
    // The spec's predicate is "2.2 picks lean active (making, learning) rather
    // than passive". Honestly, none of 2.2's options are passive — the picker has
    // no "watching TV" — so any pick satisfies it. Said plainly rather than dressed
    // up as a finer distinction than the data supports.
    trigger: (ctx) => ctx.curiosities.length > 0,
    anchor: (ctx) => ctx.curiosities,
    didYouKnow: false,
    hookInstruction:
      "Affirm the truly engaging things they chose; the contrast does the rest.",
  },
  {
    id: "cognitive-enrichment-40",
    area: "cognitive",
    subject: "a mentally rich life",
    claim:
      "Consistently keeping a mentally rich life appears to cut Alzheimer's risk by close to 40%, and to delay decline by around six years.",
    sourceDisplay: "Zammit et al., Rush, 2026.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY — confirm exact figure before ship
    priority: 6,
    trigger: (ctx) => ctx.curiosities.length > 0,
    // A designated did-you-know carrier: "adding to a lifelong account" is a frame
    // about a whole life, and pinning it to one pick undersells it.
    anchor: never,
    didYouKnow: true,
    hookInstruction:
      "Frame their new ambitions as adding to a lifelong account, not starting from zero.",
  },

  // ---- social — The people in your life ----
  // S1 loneliness-as-cigarettes is retired from the reveal (rule A): it is
  // inherently a scare comparison, and the ground it covers is fully held by
  // S2/S4/S6. It may still stay in the primer.
  {
    id: "social-groups-retirement",
    area: "social",
    subject: "group memberships",
    claim:
      "One of the clearest retirement findings there is: keeping two group memberships through retirement did as much for people's health, on the numbers, as regular exercise. The groups are yours to choose and keep.",
    // Reframed by rule A: the 2%/5%/12% death percentages are dropped. The
    // agency and the exercise equivalence carry it as a clean gain stat.
    sourceDisplay:
      "Steffens et al., BMJ Open, 2016 (English Longitudinal Study of Ageing).",
    register: "encouraging",
    evidence: "solid",
    priority: 1,
    // Eligible on a group they have, or on any social picture at all — in which
    // case it drops to a did-you-know rather than inventing a group.
    trigger: (ctx) => ctx.groupPicks.length > 0 || ctx.people.length > 0,
    anchor: (ctx) => ctx.groupPicks,
    didYouKnow: true,
    hookInstruction:
      "Name the groups they already have (allotment, a club) and frame keeping/adding them as a deliberate retirement move.",
  },
  {
    id: "social-helping-others",
    area: "social",
    subject: "helping other people",
    claim:
      "The good you do for other people loops back: across 120 of 136 countries, people who spent on or helped others were happier for it — strongest when they freely chose it and could see the difference they made. Among older adults, helping others is even linked to better health.",
    sourceDisplay:
      "Aknin et al., 2013 (136-country study); Brown et al., 2003 (older-adult health). Worth knowing: the lift is biggest when giving is freely chosen.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    priority: 2,
    trigger: (ctx) =>
      ctx.caringPicks.length > 0 || ctx.contributionPicks.length > 0,
    anchor: (ctx) => [...ctx.caringPicks, ...ctx.contributionPicks],
    didYouKnow: false,
    hookInstruction:
      "Tie to the specific people or causes they said they want to help; frame the lift to themselves as a bonus, not the reason.",
  },
  {
    id: "social-volunteering",
    area: "social",
    subject: "volunteering",
    claim:
      "Older people who volunteer tend to report fewer cognitive problems and lower loneliness — giving time turns out to be one of the cleaner ways to rebuild both connection and purpose at once.",
    sourceDisplay: "Griep et al., 2017 (5-year study of retired seniors).",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    priority: 3,
    trigger: (ctx) => ctx.contributionPicks.length > 0 || ctx.thinCasualContact,
    anchor: (ctx) => ctx.contributionPicks,
    didYouKnow: false,
    hookInstruction: "Tie to a contribution form they sorted as energising.",
  },
  {
    id: "social-strong-ties-survival",
    area: "social",
    subject: "close relationships",
    claim:
      "People with strong social relationships are around 50% more likely to still be here over a given period than those with weaker ones — connection is one of the strongest survival signals we have.",
    sourceDisplay: "Holt-Lunstad et al., meta-analysis, 2010.",
    register: "encouraging",
    evidence: "robust",
    priority: 4,
    trigger: (ctx) => ctx.people.length > 0 && ctx.closeTiesStrong,
    anchor: (ctx) => (ctx.closeTiePicks.length ? ctx.closeTiePicks : ctx.people),
    didYouKnow: false,
    hookInstruction:
      "Tie to the relationships they said they'd most love to invest in.",
  },
  // S3 isolation→stroke/heart is retired from the reveal (rule A): disease-
  // incidence figures. S2 covers the same ground as a gain. It may still stay in
  // the primer.
  {
    id: "social-weak-ties",
    area: "social",
    subject: "casual, everyday contact",
    claim:
      "Most people are happier on days they have more small, casual interactions — the barista, the regular, the passing chat. These 'weak ties' make up around 60% of daily contact, and they're the bit that quietly disappears when work and commute do.",
    sourceDisplay: "Sandstrom & Dunn, 2014 (Univ. British Columbia).",
    register: "mixed",
    evidence: "solid",
    priority: 5,
    trigger: (ctx) => ctx.thinCasualContact,
    // Bridge-free by design. The spec wants this anchored to "their casual-contact
    // rebuild route (a class, a group, a local thing)", which nothing captures —
    // and the nearest available picks are groups and close ties, which are the
    // opposite of a weak tie. Anchoring there would fail rule F's subject check,
    // so it fires as a did-you-know for people whose casual contact reads thin.
    anchor: never,
    didYouKnow: true,
    hookInstruction:
      "Tie to the everyday-contact rebuild route they chose (a class, a group, a local thing).",
  },

  // ---- purpose — Purpose and contribution ----
  {
    id: "purpose-habits",
    area: "purpose",
    subject: "purpose",
    claim:
      "A strong sense of purpose seems to pull the rest of life along with it: purposeful older adults were 24% less likely to slide into inactivity and 33% less likely to develop sleep problems as they aged — the meaning was there first, and the good habits tended to follow it.",
    // The tail restores the upstream-lever reframe, so this doesn't land as bare
    // loss-avoidance. It stops short of the causal version ("the meaning does
    // upstream work the good habits then follow"), which rule B forbids: purpose
    // was measured first and the habits followed, which is what a prospective
    // cohort can show — not that the meaning produced them. P1's own tap says the
    // cause-vs-effect question is still open.
    sourceDisplay:
      "Kim/Shiba et al., Health and Retirement Study (13,000+ adults).",
    register: "encouraging",
    evidence: "solid",
    priority: 1,
    // Needs meaning AND something to link it to, per the spec.
    trigger: (ctx) =>
      ctx.meanings.length > 0 &&
      (ctx.activities.length > 0 || ctx.energisers.length > 0),
    anchor: (ctx) => ctx.meanings,
    didYouKnow: false,
    // Rule B: associational — purposeful people were less likely to become
    // inactive, which is not the same as purpose making them active.
    //
    // This hook used to ask Vita to "connect their meaning sources to the
    // energy/movement they care about" — which is the connection the claim itself
    // makes. Asked to assert it without stating it and without implying cause, she
    // could only gesture: "purpose seems to reach into the rest of how your body
    // works". Naming the item and handing over is the job.
    hookInstruction:
      "Name the source of meaning they chose, and stop. The finding says what purpose pulls along with it.",
  },
  {
    id: "purpose-ikigai",
    area: "purpose",
    subject: "a daily reason to get up",
    claim:
      "In a large Japanese study, people with a clear sense of ikigai — a reason to get up in the morning — had a 31% lower risk of developing disability and a 36% lower risk of dementia over three years.",
    sourceDisplay:
      "Okuzono et al., Lancet Regional Health – Western Pacific, 2022.",
    register: "encouraging",
    evidence: "solid",
    priority: 2,
    // The spec wants meaning that "reads daily/relational" — the Care & connection
    // picks are exactly that.
    trigger: (ctx) => ctx.caringPicks.length > 0,
    anchor: (ctx) => ctx.caringPicks,
    didYouKnow: false,
    hookInstruction:
      "Frame their close-to-home meaning as exactly this — a daily reason, not a grand mission.",
  },
  {
    id: "purpose-mortality",
    area: "purpose",
    subject: "purpose",
    claim:
      "People with the strongest sense of purpose tend to outlive those with the least — and it holds whether or not you've retired.",
    // Reworded by rule A: the 15% mortality figure is dropped rather than
    // inverted. "Outlive" is gain-direction and carries no threat number.
    sourceDisplay:
      "Shiba et al., 2022; Hill & Turiano, 2014. Worth knowing: researchers still debate how much is cause vs. effect.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    priority: 3,
    trigger: (ctx) => ctx.meanings.length > 0,
    anchor: (ctx) => ctx.meanings,
    didYouKnow: false,
    // Rule B: this is a reverse-causation risk — the connective must not promise
    // that finding purpose is what buys the years.
    hookInstruction:
      "Dignify the plural, modest, close-to-home sources of meaning they chose. Do not promise the longevity follows from them.",
  },
  {
    id: "purpose-dementia",
    area: "purpose",
    subject: "purpose",
    claim:
      "A strong sense of purpose has been linked to keeping a sharp mind for longer, right into later life.",
    // Softened per the v0.4 spec: the reveal leads only on "sharp mind longer".
    // The clinical detail — later dementia onset, and the link holding even for
    // people carrying genetic risk — lives in the tap, stated without a figure.
    sourceDisplay:
      "Boyle et al. and later analyses, to 2025. The studies measured later onset and lower likelihood of dementia, and the link held even for people carrying genetic risk.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    priority: 4,
    trigger: (ctx) => ctx.meanings.length > 0,
    anchor: (ctx) => ctx.meanings,
    didYouKnow: false,
    // Rule B: reverse causation is live here too.
    hookInstruction:
      "Tie to the everyday usefulness they described. Do not promise the sharpness follows from it.",
  },
  // P5 purpose→cardiovascular is retired from the reveal. Rule A strips its
  // all-cause and heart-disease death wording, and what remains ("purpose went
  // with living longer") is P1 almost word for word — so the pair the spec wanted
  // to rotate collapses into one. P1 carries purpose-longevity alone.
  {
    id: "purpose-optimism",
    area: "purpose",
    subject: "optimism",
    claim:
      "Optimists tend to live longer: the most optimistic people lived 11–15% longer on average and were 50–70% more likely to reach 85. And optimism is a habit of outlook you can practise, open to anyone at any age.",
    sourceDisplay:
      "Lee et al., PNAS, 2019 (70,000+ people). Worth knowing: it's a strong association, with cause still an open question.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    priority: 5,
    trigger: (ctx) => ctx.meanings.length > 0,
    // A designated did-you-know carrier. Optimism isn't something they picked, so
    // there's no honest item to bridge to — the spec calls this one general-purpose.
    anchor: never,
    didYouKnow: true,
    hookInstruction:
      "Tie to the forward-looking, hopeful things they pictured; frame outlook as something they're already building here.",
  },

  // ---- vitality — Energy and wellbeing ----
  {
    id: "vitality-sleep-regularity",
    area: "vitality",
    subject: "your sleep pattern",
    claim:
      "With sleep, consistency beats quantity. In a study of sixty thousand people, the most regular sleepers had notably better odds of a long life than the most irregular — and timing predicted that better than how many hours they slept.",
    // Reworded by rule A: the 20–48% figure is a mortality hazard ratio, dropped
    // rather than inverted. The lever — regular timing — is what carries it.
    sourceDisplay: "Windred et al., Sleep, 2024 (UK Biobank, 60,000+).",
    register: "encouraging",
    evidence: "robust",
    priority: 1,
    trigger: (ctx) =>
      ctx.sleepPicks.length > 0 || ctx.sleepRaised || ctx.energyFlagged,
    anchor: (ctx) => ctx.sleepPicks,
    didYouKnow: true,
    hookInstruction:
      "Tie to their rhythm (mornings) and their named drains (rushing, overfull diary).",
  },
  {
    id: "vitality-nature",
    area: "vitality",
    subject: "time in nature",
    claim:
      "Two hours a week in nature seems to be a real threshold: people hitting it were 59% more likely to report good health and 23% higher wellbeing — and it didn't matter whether that was one long visit or several short ones.",
    sourceDisplay: "White et al., Scientific Reports, 2019 (~20,000 people).",
    register: "encouraging",
    evidence: "solid",
    priority: 2,
    trigger: (ctx) => ctx.outdoorPicks.length > 0,
    anchor: (ctx) => ctx.outdoorPicks,
    didYouKnow: false,
    hookInstruction:
      "Tie to the outdoor things that energise them; frame as already most of the way there.",
  },
  {
    id: "vitality-sedentary",
    area: "vitality",
    subject: "long stretches of sitting",
    claim:
      "A useful one: breaking up long sitting through the day does more than a single workout can — the win is movement scattered across the day, not one big effort.",
    // Reframed by rule A: the mortality figure is dropped and the lever kept as a
    // curiosity. The spec's replacement text ended "The active retirement you
    // pictured is the natural antidote" — that sentence asserts something about
    // the user's data, so it belongs in the connective, not in locked text that
    // has to hold for someone who pictured no such thing. It lives in the hook
    // instruction below.
    sourceDisplay:
      "Meta-analyses of sitting time, to 2019; UC San Diego women's study.",
    register: "encouraging",
    evidence: "robust",
    priority: 3,
    trigger: (ctx) => ctx.sedentaryDrainPicks.length > 0,
    anchor: (ctx) => ctx.sedentaryDrainPicks,
    didYouKnow: true,
    hookInstruction:
      "Frame the active retirement they pictured as the natural antidote.",
  },
  {
    id: "vitality-sleep-ushape",
    area: "vitality",
    subject: "how much sleep you get",
    claim:
      "With sleep, the right amount wins out: risk rises below about seven hours and above it too. The target is the right amount, regularly.",
    sourceDisplay:
      "Dose-response meta-analysis, J. American Heart Association, 2017.",
    register: "mixed",
    evidence: "robust",
    priority: 4,
    trigger: (ctx) => ctx.sleepRaised,
    anchor: (ctx) => (ctx.lever === "Sleep" ? ["Sleep", ...ctx.sleepPicks] : ctx.sleepPicks),
    didYouKnow: false,
    hookInstruction: "Reframe the goal from quantity to right-amount-regularly.",
  },
  // V5 napping is retired from the reveal (rule A + rule B): "linked to higher
  // mortality" is threat-framed, and naps are a marker of disrupted sleep rather
  // than a cause, so the stat can't carry an actionable message either. The v0.4
  // trigger table kept V5, but rule A is the stronger rule. It may still stay in
  // the primer, which is licensed to state stakes calmly.
];

// Quick lookup by id — the API route resolves selected ids back to locked claims.
export const STATS_BY_ID: Record<string, Stat> = Object.fromEntries(
  STATS.map((s) => [s.id, s])
);
