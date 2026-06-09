// The Stage 2 (Explore) discovery-layer stat library, transcribed from
// stage2-stat-library-v0.3.md. Each stat is a fixed, pre-sourced research
// finding; the personalisation is the connective line Vita writes around it
// (generated in app/api/stage2-reveal/route.ts). The `claim` and `sourceDisplay`
// are LOCKED — verbatim from the spec, never reworded, never recalculated.
//
// The senses domain (spec N1–N5) is deliberately absent: by product decision the
// senses area is stat-free, its forward line built from the screening commitment
// instead. So this pool is 29 stats across five domains, not the spec's 34.
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
export type StatRegister = "encouraging" | "alarming" | "mixed";

export type StatEvidence =
  | "robust"
  | "solid"
  | "solid-but-contested"
  | "directional";

// The derived facts a trigger tests against. Built once per user from their six
// Stage 2 module outputs (see buildStatContext in lib/stage2Selection.ts). A
// trigger never touches raw build shapes — only these plain booleans/values — so
// the pool stays readable and the build-reading lives in one place.
export type StatContext = {
  // active (2.1)
  walking: boolean;
  // cognitive (2.2)
  languages: boolean;
  puzzles: boolean;
  newSkillAmbition: boolean;
  // social (2.3)
  hasGroup: boolean;
  thinOverall: boolean;
  thinPracticalHelp: boolean;
  thinCasualContact: boolean;
  closeTiesStrong: boolean;
  // purpose (2.4)
  caring: boolean;
  contribution: boolean;
  // vitality (2.5)
  outdoors: boolean;
  fullDiary: boolean;
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
  // Eligibility: the stat can only fire when this returns true for the user.
  trigger: (ctx: StatContext) => boolean;
  // What Vita connects the stat to — an instruction for the connective line,
  // not a sentence. Passed to the generation call.
  hookInstruction: string;
};

export const STATS: Stat[] = [
  // ---- active — Staying active ----
  {
    id: "active-grip-strength",
    area: "active",
    claim:
      "Grip strength is one of the best simple predictors of longevity there is — a review of 42 studies found people with low grip strength had a 67% higher risk of dying early than those with strong grips.",
    sourceDisplay:
      "Meta-analysis of 42 studies (Bohannon, reviews to 2024). Worth knowing: it's a marker of overall strength and health, not a cause on its own.",
    register: "mixed",
    evidence: "robust",
    trigger: () => true,
    hookInstruction:
      "Tie to the hands-on activities they chose (gardening, DIY, carrying grandchildren) — the everyday things grip underpins.",
  },
  {
    id: "active-balance-test",
    area: "active",
    claim:
      "A quick one: people who couldn't stand on one leg for ten seconds had an 84% higher risk of dying in the next decade than those who could — and balance is very trainable.",
    sourceDisplay:
      "Araújo et al., British Journal of Sports Medicine, 2022. Worth knowing: observational, so it reflects overall fitness, not just balance.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction:
      "Invite them to try it now; tie to staying steady for the activities they love.",
  },
  {
    id: "active-steps-plateau",
    area: "active",
    claim:
      "Good news if 10,000 felt daunting: for people over sixty, the longevity benefit of walking levels off around six to eight thousand steps a day. Eight thousand was linked to roughly half the death risk of four thousand.",
    sourceDisplay:
      "Paluch et al., Lancet Public Health, 2022 (meta-analysis, 15 cohorts).",
    register: "encouraging",
    evidence: "robust",
    trigger: (ctx) => ctx.walking,
    hookInstruction:
      "Tie to their walking (dog walks, pottering) — reframe it as already enough, not a shortfall.",
  },
  {
    id: "active-10k-myth",
    area: "active",
    claim:
      "The famous 10,000-steps goal didn't come from research — it traces back to a 1960s marketing slogan. The actual evidence points lower for older adults.",
    sourceDisplay:
      "Origin widely documented; evidence base: Paluch et al., 2022. (Verify the 1960s-pedometer origin before ship.)",
    register: "encouraging",
    evidence: "directional", // VERIFY — origin claim needs confirming
    trigger: (ctx) => ctx.walking,
    hookInstruction:
      "Permission-giving — relieve any sense they're failing a target.",
  },
  {
    id: "active-strength-reversible",
    area: "active",
    claim:
      "Left alone, strength fades by around 15% a decade after fifty. But it's one of the few things you can genuinely rebuild at any age — studies have had people in their seventies, eighties and nineties get measurably stronger.",
    sourceDisplay:
      "Sarcopenia reviews + resistance-training trials in older adults (to 2025).",
    register: "encouraging",
    evidence: "robust",
    trigger: () => true,
    hookInstruction:
      "Tie to the 'stay able to do X in ten years' item — the thing the strength is for.",
  },

  // ---- cognitive — Keeping your mind alive ----
  {
    id: "cognitive-bilingual",
    area: "cognitive",
    claim:
      "People who become genuinely bilingual tend to show dementia symptoms about four and a half years later than people who stay monolingual.",
    sourceDisplay:
      "Alladi et al., Neurology, 2013; meta-analysis 2020. Worth knowing: strongest for lifelong bilinguals; it delays, doesn't prevent.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: (ctx) => ctx.languages,
    hookInstruction: "Tie to their named language + any travel/place thread.",
  },
  {
    id: "cognitive-activity-delay",
    area: "cognitive",
    claim:
      "Among people in their eighties, those most engaged in mentally active things — reading, games, puzzles, writing — developed Alzheimer's symptoms about five years later than the least engaged.",
    sourceDisplay:
      "Wilson et al., Neurology, 2021 (Rush Memory and Aging Project). Worth knowing: partly reflects that early decline reduces activity.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction:
      "Tie to the specific curiosities they chose (history, making, music).",
  },
  {
    id: "cognitive-engaged-not-occupied",
    area: "cognitive",
    claim:
      "Here's the distinction that matters: people who challenged their minds daily had around 29% lower odds of dementia — but passive things like watching TV showed no such benefit. Engaged beats merely occupied.",
    sourceDisplay:
      "Lee et al., JAMA Psychiatry, 2018 (15,000+ adults in their 70s).",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction:
      "Affirm the genuinely engaging things they chose; the contrast does the rest.",
  },
  {
    id: "cognitive-enrichment-40",
    area: "cognitive",
    claim:
      "Consistently keeping a mentally rich life appears to cut Alzheimer's risk by close to 40%, and to delay decline by around six years.",
    sourceDisplay: "Zammit et al., Rush, 2026.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY — confirm exact figure before ship
    trigger: () => true,
    hookInstruction:
      "Frame their new ambitions as adding to a lifelong account, not starting from zero.",
  },
  {
    id: "cognitive-puzzles",
    area: "cognitive",
    claim:
      "Regularly doing puzzles, crosswords and number games like sudoku is linked to roughly 9–11% lower dementia risk, with sharper processing speed into the eighties and beyond.",
    sourceDisplay: "Australian cohort studies (10,000+ adults), to 2023.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: (ctx) => ctx.puzzles,
    hookInstruction:
      "Tie to their existing puzzle habit, then gently nudge toward novelty/variety.",
  },
  {
    id: "cognitive-learn-new-skill",
    area: "cognitive",
    claim:
      "Here's the active version: when adults aged 60–90 spent three months learning a genuinely new, demanding skill — digital photography, quilting — their memory measurably improved. The people who just socialised or did easy puzzles didn't see the same gain. It's the new and hard that does it.",
    sourceDisplay: "Park et al. ('Synapse Project'), Psychological Science, 2014.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    trigger: (ctx) => ctx.newSkillAmbition,
    hookInstruction:
      "Name their specific new ambition (Spanish, an instrument, a craft) as exactly this kind of productive stretch.",
  },

  // ---- social — The people in your life ----
  {
    id: "social-loneliness-cigarettes",
    area: "social",
    claim:
      "Serious researchers have put the mortality risk of weak social connection on a par with smoking up to fifteen cigarettes a day — ahead of obesity, inactivity and air pollution.",
    sourceDisplay:
      "Holt-Lunstad et al., meta-analysis, 2010/2015. Worth knowing: the author has since said the cigarette comparison is a bit too neat — but the importance of connection isn't in doubt.",
    register: "alarming",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction:
      "Affirm close ties as covered; point the stat at their thin function and the rebuild route they chose.",
  },
  {
    id: "social-strong-ties-survival",
    area: "social",
    claim:
      "People with strong social relationships are around 50% more likely to still be here over a given period than those with weaker ones — connection is one of the strongest survival signals we have.",
    sourceDisplay: "Holt-Lunstad et al., meta-analysis, 2010.",
    register: "encouraging",
    evidence: "robust",
    trigger: () => true,
    hookInstruction:
      "Tie to the relationships they said they'd most love to invest in.",
  },
  {
    id: "social-isolation-stroke-heart",
    area: "social",
    claim:
      "Social isolation has been linked to about a 32% higher risk of stroke and 29% higher risk of heart disease — the body treats connection as physical infrastructure.",
    sourceDisplay:
      "Meta-analyses summarised by the US Surgeon General's advisory, 2023.",
    register: "alarming",
    evidence: "robust",
    trigger: (ctx) => ctx.thinOverall || ctx.thinPracticalHelp,
    hookInstruction: "Tie to whichever crisis-support function read thin.",
  },
  {
    id: "social-weak-ties",
    area: "social",
    claim:
      "Most people are happier on days they have more small, casual interactions — the barista, the regular, the passing chat. These 'weak ties' make up around 60% of daily contact, and they're the bit that quietly disappears when work and commute do.",
    sourceDisplay: "Sandstrom & Dunn, 2014 (Univ. British Columbia).",
    register: "mixed",
    evidence: "solid",
    trigger: (ctx) => ctx.thinCasualContact,
    hookInstruction:
      "Tie to the everyday-contact rebuild route they chose (a class, a group, a local thing).",
  },
  {
    id: "social-volunteering",
    area: "social",
    claim:
      "Older people who volunteer tend to report fewer cognitive problems and lower loneliness — giving time turns out to be one of the cleaner ways to rebuild both connection and purpose at once.",
    sourceDisplay: "Griep et al., 2017 (5-year study of retired seniors).",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    trigger: (ctx) => ctx.contribution || ctx.thinCasualContact,
    hookInstruction:
      "Tie to a contribution form they sorted as energising.",
  },
  {
    id: "social-groups-retirement",
    area: "social",
    claim:
      "One of the clearest retirement findings there is: of people who belonged to two groups while working, those who kept both had about a 2% risk of dying in the next six years — 5% if they lost one, 12% if they lost both. The effect on health rivalled regular exercise. The groups are yours to choose and keep.",
    sourceDisplay:
      "Steffens et al., BMJ Open, 2016 (English Longitudinal Study of Ageing).",
    register: "encouraging",
    evidence: "solid",
    trigger: () => true,
    hookInstruction:
      "Name the groups they already have (allotment, a club) and frame keeping/adding them as a deliberate retirement move.",
  },
  {
    id: "social-helping-others",
    area: "social",
    claim:
      "The good you do for other people loops back: across 120 of 136 countries, people who spent on or helped others were happier for it — strongest when they freely chose it and could see the difference they made. Among older adults, helping others is even linked to better health.",
    sourceDisplay:
      "Aknin et al., 2013 (136-country study); Brown et al., 2003 (older-adult health). Worth knowing: the lift is biggest when giving is chosen, not dutiful.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    trigger: (ctx) => ctx.caring || ctx.contribution,
    hookInstruction:
      "Tie to the specific people or causes they said they want to help; frame the lift to themselves as a bonus, not the reason.",
  },

  // ---- purpose — Purpose and contribution ----
  {
    id: "purpose-mortality",
    area: "purpose",
    claim:
      "People with the strongest sense of purpose tend to outlive those with the least — one large study put it at around 15% lower risk of dying over the follow-up — and it holds whether or not you've retired.",
    sourceDisplay:
      "Shiba et al., 2022; Hill & Turiano, 2014. Worth knowing: researchers still debate how much is cause vs. effect.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction:
      "Dignify the plural, modest, close-to-home sources of meaning they chose.",
  },
  {
    id: "purpose-habits",
    area: "purpose",
    claim:
      "A strong sense of purpose seems to pull the rest of life along with it: purposeful older adults were 24% less likely to become physically inactive and 33% less likely to develop sleep problems.",
    sourceDisplay:
      "Kim/Shiba et al., Health and Retirement Study (13,000+ adults).",
    register: "encouraging",
    evidence: "solid",
    trigger: () => true,
    hookInstruction:
      "Connect their meaning sources to the energy/movement they care about elsewhere.",
  },
  {
    id: "purpose-dementia",
    area: "purpose",
    claim:
      "A strong sense of purpose has been linked to a later onset and lower likelihood of dementia — and the link held even for people carrying genetic risk.",
    sourceDisplay: "Boyle et al. and later analyses, to 2025.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction: "Tie to the everyday usefulness they described.",
  },
  {
    id: "purpose-ikigai",
    area: "purpose",
    claim:
      "In a large Japanese study, people with a clear sense of ikigai — a reason to get up in the morning — had a 31% lower risk of developing disability and a 36% lower risk of dementia over three years.",
    sourceDisplay:
      "Okuzono et al., Lancet Regional Health – Western Pacific, 2022.",
    register: "encouraging",
    evidence: "solid",
    trigger: () => true,
    hookInstruction:
      "Frame their close-to-home meaning as exactly this — a daily reason, not a grand mission.",
  },
  {
    id: "purpose-cardiovascular",
    area: "purpose",
    claim:
      "A study of nearly 7,000 over-50s found a strong sense of purpose linked to lower death from all causes — and from heart disease specifically.",
    sourceDisplay: "Alimujiang et al., JAMA Network Open, 2019.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction:
      "Dignify the plural, modest, close-to-home sources of meaning they chose.",
  },
  {
    id: "purpose-optimism",
    area: "purpose",
    claim:
      "Optimists don't just feel better — the most optimistic people lived 11–15% longer on average and were 50–70% more likely to reach 85. And optimism isn't fixed at birth; it's a habit of outlook you can practise.",
    sourceDisplay:
      "Lee et al., PNAS, 2019 (70,000+ people). Worth knowing: it's a strong association, not proof of cause.",
    register: "encouraging",
    evidence: "solid-but-contested", // VERIFY
    trigger: () => true,
    hookInstruction:
      "Tie to the forward-looking, hopeful things they pictured; frame outlook as something they're already building here.",
  },

  // ---- vitality — Energy and wellbeing ----
  {
    id: "vitality-sleep-regularity",
    area: "vitality",
    claim:
      "With sleep, consistency beats quantity. In a study of sixty thousand people, the most regular sleepers had a 20–48% lower risk of dying early than the most irregular — and timing predicted that better than how many hours they slept.",
    sourceDisplay: "Windred et al., Sleep, 2024 (UK Biobank, 60,000+).",
    register: "encouraging",
    evidence: "robust",
    trigger: () => true,
    hookInstruction:
      "Tie to their rhythm (mornings) and their named drains (rushing, overfull diary).",
  },
  {
    id: "vitality-nature",
    area: "vitality",
    claim:
      "Two hours a week in nature seems to be a real threshold: people hitting it were 59% more likely to report good health and 23% higher wellbeing — and it didn't matter whether that was one long visit or several short ones.",
    sourceDisplay: "White et al., Scientific Reports, 2019 (~20,000 people).",
    register: "encouraging",
    evidence: "solid",
    trigger: (ctx) => ctx.outdoors,
    hookInstruction:
      "Tie to the outdoor things that energise them; frame as already most of the way there.",
  },
  {
    id: "vitality-sedentary",
    area: "vitality",
    claim:
      "Long sitting is its own risk: around 10 hours a day was linked to 34–52% higher mortality than an hour — and a single workout doesn't fully cancel a day in the chair. The fix is breaking it up, not one big effort.",
    sourceDisplay:
      "Meta-analyses of sitting time, to 2019; UC San Diego women's study.",
    register: "alarming",
    evidence: "robust",
    trigger: (ctx) => ctx.fullDiary,
    hookInstruction:
      "Frame the active retirement they pictured as the natural antidote.",
  },
  {
    id: "vitality-sleep-ushape",
    area: "vitality",
    claim:
      "More isn't better with sleep: risk rises below about seven hours and above it too. The target is the right amount, regularly — not simply more.",
    sourceDisplay:
      "Dose-response meta-analysis, J. American Heart Association, 2017.",
    register: "mixed",
    evidence: "robust",
    trigger: (ctx) => ctx.sleepRaised,
    hookInstruction: "Reframe the goal from quantity to right-amount-regularly.",
  },
  {
    id: "vitality-napping",
    area: "vitality",
    claim:
      "A surprising one: long or frequent daytime naps in later life are linked to higher mortality — but mostly as a signal of disrupted sleep or underlying strain, not the cause. A short nap is fine; a creeping need for long ones is worth noticing.",
    sourceDisplay:
      "British Regional Heart Study (2023); JAMA Network Open (2026). Worth knowing: naps are likely a marker of poor night sleep, not the problem themselves.",
    register: "mixed",
    evidence: "solid-but-contested", // VERIFY
    trigger: (ctx) => ctx.energyFlagged,
    hookInstruction:
      "Tie to their energy-awareness slider; gentle 'something to notice,' not advice.",
  },
];

// Quick lookup by id — the API route resolves selected ids back to locked claims.
export const STATS_BY_ID: Record<string, Stat> = Object.fromEntries(
  STATS.map((s) => [s.id, s])
);
