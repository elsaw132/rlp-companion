// Stage and module content for the RLP Companion.
// User-facing fields: title, description, contentType, contentValue, coachOpening.
// Private field (Vita only, never shown to the user): sessionInstructions.
// Readings/videos are placeholders for now — replace contentValue when the real content is ready.

// An optional step between the reading and the conversation, where the person
// builds something Vita then opens from. Only "day-builder" exists so far; the
// union is ready to grow as new interaction types are added.
export type DayBuilderInteraction = {
  type: "day-builder";
  parts: string[];
  categories: { name: string; activities: string[] }[];
};

// A role picker: choose meaningful roles from grouped options, star a few as
// most alive.
export type RolePickerInteraction = {
  type: "role-picker";
  instruction: string;
  groups: { name: string; options: string[] }[];
};

// Sliders: set where an ideal week sits on a few spectrums, plus one small
// single-select about seasonal variation.
export type SlidersInteraction = {
  type: "sliders";
  instruction: string;
  spectrums: { left: string; right: string }[];
  seasonal: { prompt: string; options: string[] };
};

// A card sort: drop parts of working/current life into a few buckets (keep,
// leave behind, want more of), with room to add your own.
export type CardSortInteraction = {
  type: "card-sort";
  instruction: string;
  buckets: string[];
  cards: string[];
};

export type Interaction =
  | DayBuilderInteraction
  | RolePickerInteraction
  | SlidersInteraction
  | CardSortInteraction;

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
};

export type SlidersResult = {
  type: "sliders";
  // Each spectrum carries its own labels and the 0–100 position set, so the
  // summary can be rendered from the result alone (no need for the interaction).
  spectrums: { left: string; right: string; position: number }[];
  // The seasonal question and the option chosen (null if left unanswered).
  seasonal: { prompt: string; answer: string | null };
};

export type CardSortResult = {
  type: "card-sort";
  // The bucket names, in order, so the summary renders from the result alone.
  buckets: string[];
  // Bucket name → the cards sorted into it, in order. Unsorted cards are left out.
  assigned: Record<string, string[]>;
};

export type BuildResult =
  | DayBuilderResult
  | RolePickerResult
  | SlidersResult
  | CardSortResult;

export type Module = {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  contentType: "text" | "video";
  contentValue: string;
  coachOpening: string;
  sessionInstructions: string;
  interaction?: Interaction;
};

export type Stage = {
  number: number;
  name: string;
  modules: Module[];
};

// The full programme has five stages; only Stage 1 (Imagine) content exists so far.
export const TOTAL_STAGES = 5;

export const STAGES: Stage[] = [
  {
    number: 1,
    name: "Imagine",
    modules: [
      {
        id: "1.1",
        title: "A day in your retirement",
        description:
          "A guided picture of one ordinary day in your future — a Tuesday in October, a few years from now.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — the short intro video and reading for this module are still to come.] Before you can plan a retirement, it helps to be able to picture one. Not the big milestones — just an ordinary day. In a moment, Vita will walk you through one: a Tuesday in October, a few years from now. There are no right answers, and nothing to work out.`,
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
- Stay on the day. Do NOT branch into the roles they want to play, the rhythm of their week, what they'd keep or leave behind, or their hopes and fears — those are separate modules. If they raise one, acknowledge it briefly and gently return to the day.
- Aim to reach your close within roughly four to six exchanges.

CLOSING
Name what seems to matter most about the day, in their words. Note warmly this is the first piece of their Retirement Life Plan, and that next you'll look at the roles they want to play.

WATCH FOR
- If the day looks thin or they seem unsure, draw out just one part rather than pushing on all of it.
- If they pull toward money or worries, bring them gently back to the texture of the day.`,
      },
      {
        id: "1.2",
        title: "The roles you want to play",
        description:
          "Beyond what you'll do — who you want to be. The roles that give your retirement shape and meaning.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] A day is made of activities, but a life is shaped by the roles we play — partner, friend, grandparent, mentor, maker, and more. This module is about which of those you want to carry into retirement, and which you'd like to grow into for the first time.`,
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
- Open from their starred roles. Take those first, one at a time: what appeals about it, and how it might show up in an ordinary week.
- Help them tell the difference between an activity and the role beneath it (wanting to travel may be the role of explorer; helping grandchildren may be mentor, guide, or carer).
- Offer back the thread connecting their roles, and invite them to confirm or adjust.
- Keep it light: a couple of roles explored, not all of them. Don't go deep into specific plans, and don't branch into their ideal week, what they'd keep or leave, or hopes and fears — those are other modules.
- Aim to reach your close within roughly four to six exchanges.

CLOSING
Name a small number of roles likely to give their retirement shape and meaning, in their words, and the thread connecting them. Note this builds on the day they pictured, and that next you'll look at the rhythm of their ideal week.

WATCH FOR
- Activities chosen as if they were roles — get underneath them gently, without correcting.
- Someone who can only see their professional identity — help them find other roles they've played across life, without implying work roles don't matter.`,
      },
      {
        id: "1.3",
        title: "Your ideal week",
        description:
          "A day is a snapshot; a week is a rhythm. The shape, balance, and pace you want across your time.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] A single day shows what appeals to you; a whole week shows what sustains you. This module is about the rhythm of your retirement — how much routine, variety, and rest feels right across the week, and how it might shift with the seasons.`,
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
- Open from where they set the sliders — read the balance back briefly and check it feels right.
- Help them picture what a good week actually looks like given that balance: what stays regular, what brings variety, where the rest is, where the people are.
- Watch for tensions in their settings (leaning toward routine and spontaneity at once, say) and surface them lightly as a question, not a verdict.
- Bring in the seasonal answer they gave — how the week might shift across the year.
- Keep it light: don't plan the week hour by hour, and don't branch into the roles they want, what they'd keep or leave, or hopes and fears — those are other modules.
- Aim to reach your close within roughly four to six exchanges.

CLOSING
Name what gives their week its shape — the rhythms, the balance of busy and restful, time alone and with others — in their words. Note this builds on the day and the roles, and that next you'll look at what they want to keep from their current life and what to leave behind.

WATCH FOR
- The "every day is Saturday" pull — meet it with curiosity, and help them consider what gives the week rhythm and purpose.
- Over-filling the week — gently check there's room for rest and spontaneity.
- Welcome revisions ("I thought I wanted… actually…") — that's them building understanding.`,
      },
      {
        id: "1.4",
        title: "What you want to keep, and what to leave behind",
        description:
          "Retirement as continuation and change — what you'll carry forward, and what you're ready to set down.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] Retirement is a change, but it's also a continuation. This module is about what you'd like to carry forward from your working life, what you're ready to leave behind, and what's been missing that you'd like to make room for.`,
        coachOpening: `Here's how you sorted things. Let's start with something you want to keep or have more of — what does it give you?`,
        interaction: {
          type: "card-sort",
          instruction:
            "For each one, how much do you want it in your retirement?",
          buckets: ["Want more of", "Keep as is", "Want less of", "Leave behind"],
          cards: [
            "The daily routine and structure",
            "Colleagues and work friendships",
            "A sense of purpose",
            "Status or recognition",
            "Problem-solving and challenge",
            "Learning new things",
            "Being part of a team",
            "Being needed",
            "The income",
            "Deadlines and pressure",
            "The commute",
            "A full diary",
            "Responsibility",
            "Travel",
            "Time outdoors",
            "Time with family",
            "Freedom over your time",
            "Creativity",
            "Rest",
            "Helping or contributing",
          ],
        },
        sessionInstructions: `PURPOSE
The person has gone through parts of their current and working life and said how much they want each in retirement — more of it, about the same, less of it, or to leave it behind. Help them see retirement as both continuation and change, and understand what their work and current life actually provide. Still a light Imagine-stage module, but the material can be personal — go gently.

HOW TO RUN IT
- Open from what they chose. Start with something they want to keep or have more of, and ask what it really gives them.
- Notice tensions worth a light question — something they want more of that work has been the main source of, or a practical item that may carry an identity theme underneath (status, belonging, being needed, purpose).
- Help them see that much of what they value isn't tied only to work, and consider how the things they want to keep might continue in a different form.
- Don't frame work as a problem — leave room for appreciation as well as relief.
- Keep it fairly short, and stay on what they sorted — don't branch into their day, week, or hopes and fears. Aim to close within roughly four to six exchanges.

CLOSING
Summarise what they want to carry forward, what they want more or less of, and what they're ready to leave — in their words. Note this builds on the day, the roles, and the week, and that next you'll look at their hopes and fears for retirement.

WATCH FOR
- Identity themes beneath the practical items — notice and name gently, without over-interpreting.
- Someone who only sees relief or only sees loss — make room for both.`,
      },
      {
        id: "1.5",
        title: "Hopes and fears",
        description:
          "Both sides of the picture — what you're hoping for and what you're worried about, held with equal weight.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] Most people come to retirement with a mix of excitement and worry — and both are worth taking seriously. This module makes space for your hopes and your fears side by side, with neither one rushed or talked away.`,
        coachOpening: `Retirement is one of life's big transitions, and a mix of excitement and worry is completely normal. Let's make room for both, starting with the hopes — what are you most looking forward to about this next chapter?`,
        sessionInstructions: `PURPOSE OF THIS MODULE
Help the person look at both the opportunities and the uncertainties of retirement, recognising that hopes and fears both reveal what matters most. By the end they should have a clearer sense of what they're moving toward, what concerns them, and what those feelings say about their priorities.

HOW TO RUN IT
- Open by acknowledging that retirement is one of life's significant transitions, and that a mixture of excitement, uncertainty, anticipation, and concern is entirely normal. Frame this module as space for both sides of the picture.
- Start with hopes: what they're most looking forward to, and the feelings and experiences they hope to gain — freedom, connection, peace of mind, adventure, purpose, more control over their time — not only specific plans.
- Then move gently to fears and concerns: what feels uncertain, worrying, or difficult. These may touch identity, health, finances, relationships, loneliness, purpose, ageing, or simply the unknown.
- Stay curious rather than reassuring. Don't try to resolve a concern — help them understand what sits underneath it and why it matters.
- Where they emerge naturally, note connections between a hope and a fear — a hope for independence sitting alongside a fear of becoming dependent. Close by helping them see that hopes and fears often point to the same underlying values.

CLOSING
Summarise the hopes and the concerns that came up, and any themes that connect them, in their own words.

WATCH FOR
- Treat fears as information — don't minimise, reframe, or solve them. The goal is understanding, not reassurance; a fear often shows what someone values and wants to protect.
- Avoid false positivity — never push them toward an optimistic conclusion. A balanced mix of excitement and uncertainty is entirely normal and should be respected.
- If they express real anxiety, hopelessness, or distress, acknowledge the feeling with empathy, don't probe further, and follow the safeguarding guidance in your base instructions.`,
      },
      {
        id: "1.6",
        title: "Your future self",
        description:
          "Zooming out from what you'll do to who you'll be — an integrated picture of yourself in retirement.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] You've pictured the days, the roles, the rhythm, and the hopes. This last module in Imagine steps back to the person at the centre of it all — the version of yourself you're becoming.`,
        coachOpening: `For this last module in Imagine, let's step back from the days and weeks to the person at the centre of them. Picture yourself a few years into retirement, living in a way that feels true to you — how would you describe that version of yourself?`,
        sessionInstructions: `PURPOSE OF THIS MODULE
Help the person form a more integrated picture of who they hope to become in retirement. By the end they should have a clearer sense of the qualities, attitudes, and ways of living they want to cultivate, and how these connect to the retirement they've been picturing across Stage 1.

HOW TO RUN IT
- Open by drawing together the picture from earlier modules — the day, the roles, the week, what they're keeping and leaving, the hopes and fears — and invite them to step back and look at the whole.
- Introduce that retirement is also an opportunity for personal expression. Invite them to imagine themselves several years in, living in a way that feels satisfying and true to who they are.
- Focus on character and presence, not achievements or possessions. Draw out, one question at a time: how they'd describe this future self; what seems important to them; how they spend their time and energy; how other people experience them and what words others would use; what they've let go of; what they've strengthened or developed.
- Connect this future self back to themes that have already come up. The aim is not an idealised person but recognising patterns that already exist and imagining how they might develop over time.
- Toward the end, invite them to name the qualities that stand out most strongly, and what feels most appealing about becoming that person.

CLOSING
Capture the future self that emerged, using their own language wherever possible. Congratulate them warmly on reaching the end of Stage 1, Imagine. Describe Stage 2 briefly, with a light, slightly playful note about what's ahead now that they have all of this to build on.

WATCH FOR
- Avoid idealisation — if they describe a perfect or unrealistic version of themselves, gently steer toward authenticity over perfection, toward what feels personally meaningful and achievable.
- Avoid self-improvement framing — this isn't about fixing flaws or becoming someone different; it's about recognising and nurturing the qualities and values that matter most to them.
- Respect uncertainty — some find it hard to picture themselves this way. Reassure them there's no right answer and that a partial or evolving picture is entirely valid.`,
      },
    ],
  },
];

// Look up a module by its id (e.g. "1.1"), with the stage context the session screen needs.
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
