// Stage and module content for the RLP Companion.
// User-facing fields: title, description, primer (ordered text/video blocks), coachOpening.
// Private field (Vita only, never shown to the user): sessionInstructions.
// Readings/videos are placeholders for now — replace the primer blocks when the real content is ready.

// An optional step between the reading and the conversation, where the person
// builds something Vita then opens from. Only "day-builder" exists so far; the
// union is ready to grow as new interaction types are added.
export type DayBuilderInteraction = {
  type: "day-builder";
  parts: string[];
  categories: { name: string; activities: string[] }[];
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
};

// A screening check: a short set of discrete-option questions, each answered by
// tapping exactly one option (e.g. "when did you last have an eye test?"). Not a
// picker or slider — it's the lightest possible form, used where the module's
// substance lives in the primer and the exercise is just a quick status check.
export type ScreeningCheckInteraction = {
  type: "screening-check";
  instruction: string;
  questions: { id: string; prompt: string; options: string[] }[];
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

export type Interaction =
  | DayBuilderInteraction
  | RolePickerInteraction
  | SlidersInteraction
  | LetterInteraction
  | SparkPromptsInteraction
  | ScreeningCheckInteraction
  | CompositeInteraction;

// What the person actually built in an interaction step. Stored (as JSON) so
// the conversation can show it back and a refresh keeps it. The union grows
// alongside Interaction as new types are added.
export type DayBuilderResult = {
  type: "day-builder";
  parts: string[];
  // Part name (e.g. "Morning") → the activities they put there, in order.
  assigned: Record<string, string[]>;
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
};

// What the person answered in a screening check. Each entry carries its own
// prompt and chosen option, so the recap and coach summary render from the
// result alone (matching the self-contained pattern of the other results).
export type ScreeningCheckResult = {
  type: "screening-check";
  answers: { id: string; prompt: string; choice: string }[];
};

// The results of a composite interaction, one per sub-step, in the same order
// as the composite's `steps`.
export type CompositeResult = {
  type: "composite";
  results: BuildResult[];
};

export type BuildResult =
  | DayBuilderResult
  | RolePickerResult
  | SlidersResult
  | LetterResult
  | SparkPromptsResult
  | ScreeningCheckResult
  | CompositeResult;

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
};

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
  modules: Module[];
};

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
    intro: {
      heading: "Let's start by imagining",
      body: [
        "Before you can plan a retirement, it helps to be able to picture one. These first few modules are for exactly that — getting a vivid sense of what your retirement could actually look like.",
        "There's no right answer here, and nothing to get perfect. This is a first sketch — something you'll come back to, deepen, and reshape as you move through the later stages.",
        "Take the modules in any order, at whatever pace suits you.",
      ],
      buttonLabel: "Let's begin",
    },
    modules: [
      {
        id: "1.day",
        title: "A day in your retirement",
        description:
          "A guided picture of one ordinary day in your future — a Tuesday in October, a few years from now.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — the short intro video and reading for this module are still to come.] Before you can plan a retirement, it helps to be able to picture one. Not the big milestones — just an ordinary day. In a moment, Vita will walk you through one: a Tuesday in October, a few years from now. There are no right answers, and nothing to work out.`,
          },
          { type: "video", url: "https://www.youtube.com/watch?v=SvEeJigbOwo" },
        ],
        coachOpening: `Here's the day you've put together. Let's talk it through — looking at the whole thing, which part are you most looking forward to?`,
        interaction: {
          type: "day-builder",
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
The person has just built an ordinary Tuesday in their retirement from a palette of activities. Bring the day to life a little and find what matters most in it. This is a light, imaginative module — depth and other angles come in later modules, so keep it short and stay on the day itself.

HOW TO RUN IT
- Open from the day they built.
- After they answer, offer back the shape of their day and what seems to matter — warmly and specifically — and invite them to confirm or adjust. You don't need to ask about every activity.
- At most one light follow-up, and only if something clearly invites it. Don't chase the specifics of individual activities, and don't go deep.
- If it fits naturally, ask once whether anything about the day surprised them.
- Stay on the day. Do NOT branch into the roles they want to play or the rhythm of their week — those are separate modules. If they raise one, acknowledge it briefly and gently return to the day.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Ask how they feel about retirement or the transition, or invite hopes or fears.
- Reality-check, cost, or judge whether the picture is realistic or "right".
- Steer toward reflection, lessons, or legacy — that material is held for later stages. Keep this generative and concrete: the texture of the day, not how they feel about it.

CLOSING
Name what seems to matter most about the day, in their words. Note warmly this is the first piece of their Retirement Life Plan, and that next you'll picture what you'd do if money were no object.

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
- Open with real, infectious excitement about what they pictured — the way a close friend lights up hearing a brilliant plan. React to the actual things on their list by name AND name the key themes you notice running through them (adventure, making things, time with people, say). Be genuinely delighted, a little playful; never a flat recap or a polite "lovely".
- Then invite the choice: if they could only afford three of these dreams, which three would they pick? Once they've chosen, ask in one short question what makes those three stand out for them.
- To wrap up, turn to whether any of these dreams could actually be within reach — even adapted or scaled down to make them affordable. Ask THEM which feel like they could happen; the assessment is theirs, not yours. Keep all three of their chosen dreams in view — don't single one out as "the realistic one" and let the others drop. If you have a thought on how something might work, offer it lightly and check it, never as a verdict. Where a dream could work in some form, have a short back-and-forth on how a version of it might be made real.
- Make clear the dreams that stay out of reach aren't being dropped — they're pipe-dreams worth holding onto, kept alongside the achievable ones.
- Keep every response short and the whole thing brief. Don't dig deep into any single dream, don't hunt for hidden meaning, and don't branch into the roles they want or the shape of their week — those are other modules.

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
            value: `[Placeholder — reading/video to come.] A day is made of activities, but a life is shaped by the roles we play — partner, friend, grandparent, mentor, maker, and more. This module is about which of those you want to carry into retirement, and which you'd like to grow into for the first time.`,
          },
        ],
        coachOpening: `Here are the roles you've picked out. Let's start with one that feels most alive to you right now — what draws you to it?`,
        interaction: {
          type: "role-picker",
          instruction:
            "Pick the roles that feel most alive to you — then star the two or three that matter most right now.",
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
The person has chosen the roles that feel meaningful to them and starred a few as most alive. Help them understand who they want to be in retirement, not just how they'll spend time. This is a light Imagine-stage module — keep it short and stay on the roles.

HOW TO RUN IT
- Open by surfacing roles already implied by the day they built earlier — "the way you described your slow morning and the time with family, 'partner' and 'reader' sound quietly important." Offer this lightly and invite them to confirm or refine it; never assert it as fact.
- Then take their starred roles, one at a time, with ONE short question each — what it means to them, or how it might show up in an ordinary week. Just one question per role; don't interrogate each.
- Help them tell the difference between an activity and the role beneath it (wanting to travel may be the role of explorer; helping grandchildren may be mentor, guide, or carer) — surfaced with curiosity, never as a correction.
- Mirror and confirm a small handful of roles that feel most alive, and the thread connecting them — offered for them to confirm or adjust, not as your verdict.
- Keep it light: a couple of roles drawn out, not all of them. Don't go deep into specific plans, and don't branch into their ideal week — that's another module.
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
            value: `[Placeholder — reading/video to come.] A single day shows what appeals to you; a whole week shows what sustains you. This module is about the rhythm of your retirement — how much routine, variety, and rest feels right across the week, and how it might shift with the seasons.`,
          },
        ],
        coachOpening: `Here's the balance you've set for your ideal week. Which of these did you feel most strongly about?`,
        interaction: {
          type: "sliders",
          instruction:
            "Set where your ideal week sits on each of these — there's no right answer, just what feels like you.",
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
The person has set where their ideal week sits on a few spectrums about time, structure, and balance. Help them find the rhythm and balance they want — their relationship with time, not a calendar. This is a light Imagine-stage module — keep it short and stay on the shape of the week.

HOW TO RUN IT
- Open by carrying forward from the day they built and the roles they chose — "you mentioned wanting to be a mentor and a reader; where in the week do those live?" Read the slider balance back briefly alongside it and check it feels right.
- Ask ONE question about the live balance the sliders point to most strongly — alone↔together, active↔rest, or familiar↔new — picked from wherever they leaned hardest. Just the one.
- Ask ONE question about how the week shifts across the seasons — winter, or when they're travelling.
- If they picture a week with no commitments at all, meet it with curiosity rather than challenge — ask what might give it rhythm over time. If they re-create their old working week, gently invite a look at the open space instead.
- Keep it light: don't plan the week hour by hour, and don't branch into the roles they want — that's another module.
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
            value: `Imagine yourself a good way into retirement — settled, comfortable, living a life you're genuinely happy with. In a moment you'll write a short letter to someone in your life, catching them up on how it all looks now: what fills your days, the people around you, an ordinary good week. It's a description of the life, not advice — just what's true for you now. First, who are you writing to?`,
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
    intro: {
      // [Placeholder — SMW to replace.] Framed on the WHO's Intrinsic Capacity
      // model as an invitation, not an audit.
      heading: "Now let's look a little closer",
      body: [
        "[Placeholder — SMW to replace.] In Imagine, you sketched the shape of the retirement you want. Now we go a little deeper, area by area. Research on what makes retirement genuinely good for people points to a handful of evidence-based domains — movement, a curious mind, the people around you, a sense of purpose, your energy, and your senses.",
        "Most people's first picture of retirement is stronger in some of these than others, and that's completely normal. These modules aren't an audit of what's missing — they're an invitation to look at each area in turn and notice what you'd like to keep, change, or add.",
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
            value: `[Placeholder — SMW to replace.] Of all the things that shape a good retirement, staying active does more quiet work than almost anything else. It's what keeps you up and about, doing the things you pictured — the garden, the grandkids, the day trips — on your own terms, for longer. This module isn't about fitness goals or step counts. It's about the movement that already fits your life, and the part you'd like it to play.`,
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
          steps: [
            {
              type: "role-picker",
              instruction:
                "Pick the active things you'd most like to be part of your week — as many or as few as feel right.",
              starrable: false,
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
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just picked the active things they'd like in their week and set roughly how physical they'd like their days to feel. Help them picture how movement fits the retirement they imagined, and what they'd like more of. This is a light Explore-stage module — keep it short and stay on staying active.

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
          "The learning, curiosity and creativity that keep your mind engaged — what genuinely interests you, and what you'd love to get into.",
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
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just picked the things that catch their curiosity. Help them understand what genuinely stimulates and interests them, and how they might keep challenging and engaging their mind in retirement. This is a light Explore-stage module — keep it short and stay on curiosity and engagement.

HOW TO RUN IT
- Open with a warm, specific callback to what you already learned about them in Imagine (it's provided to you), especially anything they wanted to learn or look into — then move to what they just picked.
- Moment capture: early on, ask once about a time they completely lost track of time, and what they were doing. This is the strongest signal of true engagement — use what it reveals.
- Help them notice the form of engagement they like: a structured course or exploring freely; going deep on one thing or sampling many; understanding something or making something; alone or with others. Draw this out in conversation, not as a quiz.
- Spark capture: surface a deferred want — something they've always meant to get to but never had time for. Help the language shift from duty to desire ("I suppose I could do a course" → "I've always wanted to learn Spanish"). Capture the genuine want, not the dutiful should.
- Offer back the thread of what genuinely absorbs them, and invite them to confirm or adjust.
- Aim to reach your close within roughly four to six exchanges.

MUST NOT
- Do NOT take an educational, self-improvement, or "keep your brain sharp" tone. Focus on enjoyment, curiosity, and meaningful engagement.
- Do NOT assume they want formal learning, or that anything needs a qualification or a goal.
- Don't reality-check whether an interest is worthwhile, and don't steer toward reflection or lessons.

CLOSING
Name the interests and the kind of engagement that genuinely absorb them, in their words — and any deferred want worth carrying forward. Note warmly that this adds to their Retirement Life Plan, and that there's more of the picture to fill in as they carry on through Explore.

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
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just noted the people who matter, how social they feel at their best, and how well-served the four social "jobs" feel. Help them understand the people they value, the role connection plays in their wellbeing, and where they might like to strengthen their social world. This is a light Explore-stage module — keep it short.

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
            value: `[Placeholder — SMW to replace.] For many people, work is the main source of purpose and identity — and losing it is more destabilising than expected, with retirement satisfaction often dipping in the first year or two before new sources of meaning take hold. The good news is that meaning arrives plural and modest: through care, contribution, making things, and learning something deeply and passing it on. This isn't about finding one grand life purpose. It's about the handful of things, big or small, that leave you feeling genuinely useful.`,
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
            "Pick the forms of contribution that give you energy — the ones that feel meaningful, not dutiful. Small and private counts as much as big and public.",
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
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just picked the forms of contribution that give them energy. Help them understand the activities, roles and forms of contribution that make them feel useful, valued and fulfilled, and how these might feature in their retirement. This is a light Explore-stage module — keep it short.

HOW TO RUN IT
- Open with a warm, specific callback to anything in their Imagine answers that hinted at contribution or helping (provided to you), then move to what they picked.
- Moment capture: early on, ask about a time they felt what they did genuinely mattered, and what was happening. This is the richest signal for meaning — use what it reveals.
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
            value: `[Placeholder — SMW to replace.] This module is about vitality — feeling rested, energised and well, day to day. Almost everything in your retirement picture depends on it, and yet it's the area most people plan for least. Vitality has four levers that feed each other — sleep, nutrition, recovery, and the metabolic health that connects them (movement is the fifth, and we look at that on its own elsewhere). Eating shapes sleep, sleep shapes energy, energy shapes recovery, recovery shapes how you eat.`,
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
            "Now, just noticing how things feel lately — there's no score here.",
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
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just sorted what gives them energy from what drains it, noticed how their sleep, daytime energy, eating and recovery feel lately, and picked one lever — sleep, eating, energy or recovery — they'd most like to build on. Help them see vitality as something they build, not a thing they either have or don't — and help them name where they'd like to put a little steady care. This is a light Explore-stage module — keep it short, warm and non-prescriptive.

HOW TO RUN IT (3–4 turns, one question per turn)
- Open warmly from what they said energises them, then ask when in the day they tend to feel most alive.
- Carry-forward: connect to their Imagine answers (provided to you) — which parts of the retirement they pictured need them feeling well and energised to enjoy. Reflect this; don't quiz them on it.
- The chosen lever: reflect the lever they picked, and ask what a small, steady investment in that area might look like in the context of the life they're designing. THEY name it — you never recommend or prescribe.
- Mirror and confirm, framed as "levers worth building on" — active and hopeful, never "foundations worth protecting" or anything defensive, and never a regimen or a plan.
- Aim to reach your close within roughly three to four exchanges.

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
        title: "Your senses",
        description:
          "Vision and hearing shape how you experience everything else — and they're surprisingly easy to look after with a couple of small, regular habits.",
        durationMin: 15,
        primer: [
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] This module is about two senses that quietly shape your whole experience of retirement: vision and hearing. The good news first — most changes here are common, gradual and correctable. Needing reading glasses in your forties is near-universal; cataracts are very common and very treatable; even the more serious conditions are highly manageable when they're caught early. None of this is about decline. The single most striking finding is about hearing: the Lancet Commission identifies untreated hearing loss as the largest modifiable risk factor for dementia — partly through less mental stimulation, partly through people slowly withdrawing from company. And the real cost isn't dramatic loss. It's the quiet gap: hearing aid uptake is under a third of those who'd benefit, and people wait around ten years on average between first noticing a change and getting it checked.`,
          },
          {
            type: "text",
            value: `[Placeholder — SMW to replace.] What makes this worth ten minutes is how simple the upkeep is. Routine eye tests (every couple of years, yearly from 60). A hearing check from around 50. Early correction when it's needed — modern hearing aids are nothing like the ones you might picture. And everyday protection from loud noise and strong sun. Small, regular maintenance that compounds quietly over years. So this isn't a module about preparing for things to go wrong — it's the simplest, highest-return habit in retirement health. Let's just check where you are with the basics.`,
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
        coachOpening: `Thanks for marking those two down — quick to answer, but they matter more than almost anything else in this area. Let's take a look at where you've landed.`,
        interaction: {
          type: "screening-check",
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
              options: ["Within the last 2 years", "Longer ago", "Can't remember"],
            },
          ],
        },
        closingCommitment: {
          prompt:
            "Would you like to make regular eye and hearing checks part of your plan?",
          frequencyLabel: "A sensible rhythm",
          frequencyOptions: ["Every year", "Every 2 years"],
          actionLabel: "A first step, if one comes to mind (optional)",
          actionPlaceholder: "e.g. book an eye test this month",
          confirmLabel: "Add to my plan",
          skipLabel: "Maybe later",
        },
        closeInOneStep: true,
        sessionInstructions: `PURPOSE
You already know this person from the Imagine stage — open like a coach who remembers them, not a fresh chatbot. They have just marked when they last had an eye test and a hearing check (shown under WHAT THEY BUILT). This is a short, practical module: help them see where they stand on two simple, high-return habits. This is the last Explore module — close the whole stage warmly.

TONE — IMPORTANT
This is the one module where you may be mildly directive. The evidence here is the strongest in the programme and the actions are simple and binary, so a gentle, concrete nudge is more useful than an open-ended conversation. Stay warm and practical — never urgent, never alarming. If they push back or aren't interested, accept it cleanly and move on. No persuasion.

HOW TO RUN IT
- If both checks are recent: acknowledge it warmly — they're already on it, which is the single best thing they can do in this area.
- If either is overdue, or they can't remember: name it directly but kindly — worth booking in. Single out the hearing check especially: the evidence on what early correction does for long-term brain health is strong. Ask when booking it would feel realistic for them.
- Keep it short — a few turns, one question at a time.
- Right after you close, a small step will appear where they can set a rhythm for keeping these checks up — so you do NOT need to pin down exact dates or frequencies yourself. Just open the door to it warmly in your wrap-up.

MUST NOT
- No catastrophising about loss. No dramatic framing. No "while you still can".
- No medical advice, diagnosis, or condition education beyond the simple, practical booking nudge.
- If they mention an existing eye or hearing condition, handle it with real care — don't assume the general case, and don't imply they've done anything wrong.

CLOSING
Acknowledge warmly that this is the last Explore module and they've now completed the whole stage — genuine and grounded, not a fanfare. A brief, specific nod to the Imagine picture is welcome if it fits. Then bridge into the next stage, Understand, where you'll help them see what matters most across everything they've pictured.

WATCH FOR
- If fear of decline surfaces, stay calm and practical — bring it back to the simple, high-return habit they can act on now.
- Welcome revisions — that's them building the picture.`,
      },
    ],
  },
  {
    number: 3,
    name: "Understand",
    subtitle: "What matters most",
    modules: [],
  },
  {
    number: 4,
    name: "Plan",
    subtitle: "Shape the years ahead",
    modules: [],
  },
  {
    number: 5,
    name: "Act",
    subtitle: "Turn it into next steps",
    modules: [],
  },
];

// Look up a module by its id (e.g. "1.day"), with the stage context the session screen needs.
export function getModule(id: string) {
  for (const stage of STAGES) {
    const found = stage.modules.find((m) => m.id === id);
    if (found) {
      return {
        module: found,
        stageNumber: stage.number,
        stageName: stage.name,
        totalStages: TOTAL_STAGES,
        modulesInStage: stage.modules.length,
        stageModuleIds: stage.modules.map((m) => m.id),
      };
    }
  }
  return null;
}

// Every module that comes before the given id in programme order (across all
// stages), as { id, title }, in order. Empty if it's the first module or the id
// isn't found. Used to gather earlier takeaways for the current module.
export function getModulesBefore(id: string): { id: string; title: string }[] {
  const ordered: { id: string; title: string }[] = [];
  for (const stage of STAGES) {
    for (const m of stage.modules) {
      if (m.id === id) return ordered;
      ordered.push({ id: m.id, title: m.title });
    }
  }
  return [];
}

// The id of the next module in the same stage, or null if this is the last one.
export function getNextModule(id: string): string | null {
  for (const stage of STAGES) {
    const index = stage.modules.findIndex((m) => m.id === id);
    if (index !== -1) {
      const next = stage.modules[index + 1];
      return next ? next.id : null;
    }
  }
  return null;
}
