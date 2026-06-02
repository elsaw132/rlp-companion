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

export type Interaction = DayBuilderInteraction;

// What the person actually built in an interaction step. Stored (as JSON) so
// the conversation can show it back and a refresh keeps it. The union grows
// alongside Interaction as new types are added.
export type DayBuilderResult = {
  type: "day-builder";
  parts: string[];
  // Part name (e.g. "Morning") → the activities they put there, in order.
  assigned: Record<string, string[]>;
};

export type BuildResult = DayBuilderResult;

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
        coachOpening: `Last time you pictured a day; now let's think about who you want to be in it. A retirement life is shaped as much by the roles we play as by what we do — partner, grandparent, mentor, maker, traveller, and plenty more. Which role feels most alive to you when you imagine your retirement?`,
        sessionInstructions: `PURPOSE OF THIS MODULE
Help the person identify the roles and identities they want to carry into retirement or take up for the first time. By the end they should have a clearer sense of who they want to be in retirement, not just how they want to spend their time.

HOW TO RUN IT
- Open by briefly connecting to the day they pictured last time, then introduce that a retirement day is made of activities but a retirement life is shaped by roles — and that retirement is a chance to choose which parts of themselves to express more fully.
- Offer a range of possible roles as examples, not a checklist: partner, friend, grandparent, mentor, learner, volunteer, sports or team player, creator, host, traveller, carer, community member. Invite them to add roles of their own.
- Invite them to name the roles that feel most attractive, meaningful, or energising. Take each chosen role one at a time, asking what appeals about it and how it might show up in everyday life.
- Help them tell the difference between an activity and the role underneath it — a wish to travel may be the role of explorer; helping grandchildren may be the role of mentor, guide, or carer.
- Once you've been through several, offer back the patterns you notice and invite them to say which roles feel most important, most established, or newly emerging.

CLOSING
Name a small number of roles that seem likely to give their retirement shape and meaning, in their words, and note the thread that connects them.

WATCH FOR
- Activities described as roles — stay curious and gently get underneath them without correcting or challenging.
- Some people struggle to see past their professional identity — help them find other roles they've played across life, without implying that work roles are unimportant or should be abandoned.`,
      },
      {
        id: "1.3",
        title: "Your ideal week",
        description:
          "A day is a snapshot; a week is a rhythm. The shape, balance, and pace you want across your time.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] A single day shows what appeals to you; a whole week shows what sustains you. This module is about the rhythm of your retirement — how much routine, variety, and rest feels right across the week, and how it might shift with the seasons.`,
        coachOpening: `A single day shows what appeals to you; a week shows what sustains you. Picture a good week in your retirement, across all seven days. To start broadly — are some days quite different from others, or do they tend to share a shape?`,
        sessionInstructions: `PURPOSE OF THIS MODULE
Help the person move beyond a single imagined day to the rhythm, balance, and structure they want their retirement to have. By the end they should have a clearer sense of how their time is spread across a typical week and how much routine, variety, and flexibility feels right.

HOW TO RUN IT
- Connect to the day they imagined and the roles they named. Introduce the idea that a single day reveals what appeals to us, but a week reveals what sustains us. You are not building a timetable — you are finding the shape of the week through conversation.
- Open broadly on their imagined week: are some days very different from others? do certain things happen regularly? what gives the week structure? what brings variety or spontaneity? is there time for joy, and for rest?
- Help them weigh the balances: time alone versus with others, activity versus rest, planned commitments versus open space, familiar routines versus new experiences.
- Once a broad rhythm has emerged, introduce that retirement may look different across the year, and invite them to consider seasonal variation — more time outdoors in summer, travel at certain times, different routines in winter.
- As patterns emerge, offer them back and help them notice what seems most important.

Note: you are not helping them design a calendar. You are helping them discover their relationship with time and with structure.

CLOSING
Name the rhythms, commitments, and freedoms that give their week its distinctive shape, and reiterate that each module builds on the last and their plan is growing in detail.

WATCH FOR
- The "every day is Saturday" assumption — some imagine retirement as complete freedom with no commitments. Meet this with curiosity rather than challenge, and help them consider what might provide rhythm, purpose, or connection over time.
- Over-scheduling — some recreate a working week in disguise, filling every day. Gently invite them to consider whether there's enough space for flexibility, rest, and spontaneity.
- Welcome moments where they revise a first answer ("I thought I wanted… actually…"). That's a sign they're building new understanding, not just answering — encourage it.`,
      },
      {
        id: "1.4",
        title: "What you want to keep, and what to leave behind",
        description:
          "Retirement as continuation and change — what you'll carry forward, and what you're ready to set down.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] Retirement is a change, but it's also a continuation. This module is about what you'd like to carry forward from your working life, what you're ready to leave behind, and what's been missing that you'd like to make room for.`,
        coachOpening: `Retirement isn't only what you're moving toward — it's also what you're leaving, and what you carry with you. Thinking about your life now, not just your job: what would you be most reluctant to lose?`,
        sessionInstructions: `PURPOSE OF THIS MODULE
Help the person see retirement as both a continuation and a change — identifying what they want to carry forward, what they're ready to let go of, and what's been missing that retirement might create room for. By the end they should understand more clearly what work and their current life provide, and what they want more or less of next.

HOW TO RUN IT
- Connect to the picture they've built so far. Start by looking at their current life broadly — the wider patterns, commitments, and experiences that shape daily life, not only the job.
- Move through three parts, one question at a time:
  1) What they would be reluctant to lose — relationships, routines, opportunities, skills, responsibilities, sources of enjoyment, parts of their identity.
  2) What they would be pleased to leave behind — pressure, commuting, workplace politics, time constraints, expectations that no longer serve them.
  3) What feels missing now, and what retirement might create space for — new interests, deeper relationships, more freedom, creativity, learning, contribution.
- As themes emerge, help them notice that much of what they value isn't tied only to work. Close by considering how the things they want to keep might continue, in a different form, in retirement.

CLOSING
Summarise what they want to carry into retirement, what they're ready to leave, and what they hope to make room for, in their own words.

WATCH FOR
- Don't frame work as a problem — many people have mixed feelings about leaving. Leave room for appreciation as well as relief; don't assume retirement is an escape from something negative.
- Watch for identity themes — usefulness, status, belonging, purpose — surfacing beneath the practical points. Notice and name these gently, without over-interpreting.`,
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
