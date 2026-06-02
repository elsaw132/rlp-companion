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

// Keep / leave / gain: three lists about the move from working life to
// retirement — what to carry forward, what to let go, what to make space for.
// Each section is its own multi-select with room to add your own.
export type KeepLeaveGainInteraction = {
  type: "keep-leave-gain";
  sections: {
    key: string;
    title: string;
    prompt: string;
    options: string[];
  }[];
};

// Qualities picker: a single flat palette of character qualities to multi-select
// (plus room to add your own), naming the person they want to grow into. No
// grouping or starring — kept deliberately light for the final Imagine module.
export type QualitiesPickerInteraction = {
  type: "qualities-picker";
  instruction: string;
  options: string[];
};

export type Interaction =
  | DayBuilderInteraction
  | RolePickerInteraction
  | SlidersInteraction
  | KeepLeaveGainInteraction
  | QualitiesPickerInteraction;

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

export type KeepLeaveGainResult = {
  type: "keep-leave-gain";
  // Each section with its title and the options picked, so the summary renders
  // from the result alone. Sections with no picks are still included (empty).
  sections: { key: string; title: string; picked: string[] }[];
};

export type QualitiesPickerResult = {
  type: "qualities-picker";
  // The qualities picked, in the order they were chosen.
  picked: string[];
};

export type BuildResult =
  | DayBuilderResult
  | RolePickerResult
  | SlidersResult
  | KeepLeaveGainResult
  | QualitiesPickerResult;

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
- If it fits naturally, ask once whether anything about the day surprised them.
- Lightly notice the pace and any emotional warmth or hesitation — you don't need to interrogate it.
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
- Invite them to notice which of their roles feel most established and which are newly emerging.
- Offer back the thread connecting their roles, and invite them to confirm or adjust.
- Keep it light: a couple of roles explored, not all of them. Don't go deep into specific plans, and don't branch into their ideal week, what they'd keep or leave, or hopes and fears — those are other modules.
- Aim to reach your close within roughly four to six exchanges.

CLOSING
Name a small number of roles likely to give their retirement shape and meaning, in their words, and the thread connecting them. Note this builds on the day they pictured, and that next you'll look at the rhythm of their ideal week.

WATCH FOR
- Activities chosen as if they were roles — get underneath them gently, without correcting.
- Someone who can only see their professional identity — help them find other roles they've played across life, without implying work roles don't matter.
- Roles they lost the chance to play during working life and now want to reclaim — notice these warmly.`,
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
        coachOpening: `Here's what you'd keep, leave, and make space for. Let's start with what you'd be most reluctant to lose — what does one of those give you?`,
        interaction: {
          type: "keep-leave-gain",
          sections: [
            {
              key: "keep",
              title: "Reluctant to lose",
              prompt:
                "What about life now would you be most reluctant to lose?",
              options: [
                "Close relationships",
                "A sense of purpose",
                "Daily routine and structure",
                "Being part of a team",
                "Being needed",
                "Financial security",
                "Status or recognition",
                "Problem-solving and challenge",
                "Learning new things",
                "Sources of enjoyment",
              ],
            },
            {
              key: "leave",
              title: "Glad to leave behind",
              prompt: "What would you be glad to leave behind?",
              options: [
                "The commute",
                "Deadlines and pressure",
                "Office politics",
                "A packed diary",
                "Always being available",
                "Certain responsibilities",
                "Early starts",
                "Expectations that no longer fit",
              ],
            },
            {
              key: "gain",
              title: "Want to make space for",
              prompt: "What's been missing that you'd love to make room for?",
              options: [
                "Travel",
                "Creativity",
                "More time outdoors",
                "Deeper friendships",
                "More rest",
                "Learning something new",
                "Time with family",
                "A sense of contribution",
                "Freedom over your time",
                "Looking after my health",
              ],
            },
          ],
        },
        sessionInstructions: `PURPOSE
Help the person explore retirement as both continuation and change — what they want to carry forward from their current life, what they're ready to let go of, and what they want the next chapter to make room for. By the end they should understand what work and their current lifestyle provide, and what they want more or less of.

HOW TO RUN IT
The person has just picked across three lists: what they'd be reluctant to lose, what they'd be glad to leave behind, and what they want to make space for. Open from those.
- Start with what they'd be reluctant to lose, and draw out what those things actually give them — helping them see that much of what they value isn't tied only to work, even where work has been the main place it lives.
- Touch on what they're glad to leave behind, but don't frame work as a problem — leave room for appreciation as well as relief.
- For things they want to keep, explore how they might continue or take a new form in retirement — the same need met a different way.
- Notice themes that appear in more than one list, and identity themes beneath practical items (usefulness, status, belonging, purpose). Reflect them gently, without over-interpreting.
- Keep it fairly short and stay on this; aim to close within roughly four to six exchanges.

CLOSING
Summarise what they want to carry into retirement, what they're ready to leave, and the opportunities they hope to make space for — in their words. Note two more modules remain in Imagine, and that this is building towards their Retirement Life Plan.

WATCH FOR
- Hidden benefits of work they may not have consciously recognised.
- Expressions of loss, relief, anticipation, or unfinished ambition.
- Identity themes beneath practical items — name gently, don't over-interpret.`,
      },
      {
        id: "1.5",
        title: "Hopes and fears",
        description:
          "Both sides of the picture — what you're hoping for and what you're worried about, held with equal weight.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] Most people come to retirement with a mix of excitement and worry — and both are worth taking seriously. This module makes space for your hopes and your fears side by side, with neither one rushed or talked away.`,
        coachOpening: `Retirement is one of life's big shifts, and it's completely normal to feel a mix of excitement and worry about it — we'll make room for both here. Let's start with the hopes: when you picture your retirement, what are you most looking forward to?`,
        sessionInstructions: `PURPOSE
Help the person explore both the opportunities and the uncertainties they associate with retirement, recognising that hopes and fears often reveal what matters most. By the end they should have a clearer sense of what they're moving towards, what concerns them, and what these feelings point to about their priorities.

HOW TO RUN IT
This module is a conversation — no activity beforehand. It's more emotional than the earlier Imagine modules, so give it room and don't rush; move through hopes, then fears, then any connections. Do not force a short exchange count here.
- Open by acknowledging that retirement is one of life's significant transitions, and that a mixture of excitement, anticipation, uncertainty and concern is entirely normal. Frame it as space for both sides.
- Start with hopes: what they're most looking forward to, and what they hope this chapter might bring — not only specific plans but the feelings and experiences they hope to gain (freedom, connection, peace of mind, adventure, purpose, more control over their time).
- Once hopes are explored, gently shift to fears and concerns: what feels uncertain, worrying or difficult (identity, health, finances, relationships, loneliness, purpose, ageing, or simply the unknown).
- Stay curious, not reassuring. Don't resolve a concern — help them understand what sits underneath it and why it matters.
- Where they emerge, reflect connections between a hope and a fear (a strong hope for independence may sit alongside a fear of becoming dependent). Help them see that hopes and fears often point to the same underlying values.

CLOSING
Summarise the hopes and the concerns that emerged, and reflect back any themes that connect them — in their words. Note one more module remains in Imagine, and that this is building towards their Retirement Life Plan.

WATCH FOR
- Treat fears as information — don't minimise, reframe, or solve them. The goal is understanding, not reassurance; a concern often reveals what they value and want to protect.
- Avoid false positivity — never push toward an optimistic conclusion. A balanced mix of excitement and uncertainty is normal and should be reflected respectfully.
- Significant distress — if they express real anxiety, hopelessness, or emotional distress, acknowledge the feeling with empathy, don't probe deeper, and follow the safeguarding guidance in your base instructions.`,
      },
      {
        id: "1.6",
        title: "Your future self",
        description:
          "Zooming out from what you'll do to who you'll be — an integrated picture of yourself in retirement.",
        durationMin: 15,
        contentType: "text",
        contentValue: `[Placeholder — reading/video to come.] You've pictured the days, the roles, the rhythm, and the hopes. This last module in Imagine steps back to the person at the centre of it all — the version of yourself you're becoming.`,
        coachOpening: `You've picked out a few qualities that feel like the person you want to grow into. Picture yourself a few years from now, living as that person — where do you notice one of those showing up?`,
        interaction: {
          type: "qualities-picker",
          instruction:
            "Pick the qualities that feel like the person you want to grow into — the few that feel most like you are enough.",
          options: [
            "Calm",
            "Active",
            "Curious",
            "Generous",
            "Patient",
            "Adventurous",
            "Grounded",
            "Creative",
            "Warm",
            "Independent",
            "Content",
            "Engaged",
            "Playful",
            "Kind",
            "Resilient",
            "Present",
            "Open",
            "Confident",
            "Thoughtful",
            "Useful",
            "Free",
          ],
        },
        sessionInstructions: `PURPOSE
The final module in Imagine. Help the person form an integrated picture of who they hope to become — the qualities and ways of living they want to grow into — and connect it to everything they've imagined across the stage. By the end they should recognise a coherent sense of their future self, built from patterns that already run through their earlier modules.

HOW TO RUN IT
The person has chosen a few qualities that feel like the self they want to grow into. You also have what they explored in every earlier module. Open by drawing both together.
- Invite them to picture themselves a few years into retirement, living as the person those qualities describe, and notice where each one shows up in the life they've already imagined — their day, roles, week, what they're keeping, their hopes.
- Focus on character and presence — who they are — not achievements or possessions.
- Draw out: what matters to this future self, how they spend their energy, how others would describe them, what they've grown into and what they've let go of.
- Connect back to themes from earlier modules — name the patterns that already exist and how they might develop. The aim is recognition, not invention.
- This one can carry a little more warmth and breadth than the lighter modules, but stay curious and don't over-extend.

CLOSING
Draw together the future self that emerged, in their own words, and reflect the throughline running across the whole of Imagine. Congratulate them warmly on finishing Stage 1, Imagine. Then describe the next stage, Explore, briefly and at a high level — a light, slightly playful note about moving from imagining the life they want to exploring it further, now they have all of this to build on. Keep it general; don't invent specific Stage 2 contents.

WATCH FOR
- Avoid idealisation — steer toward authenticity over perfection.
- Avoid a self-improvement framing — this isn't about fixing flaws but nurturing what already matters.
- Respect uncertainty — a partial or evolving picture of the future self is entirely valid.`,
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
