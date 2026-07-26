import Anthropic from "@anthropic-ai/sdk";
import {
  coerceWeekShape,
  type WeekShapeDraftInput,
} from "@/lib/weekShapeSeed";

// Drafts the rhythm for Module 4.6 ("The rhythm of your week"). The session sends
// the curated user model, the onboarding line, the goals from 4.3, the work-
// transition shape from 4.1, and — most importantly — the person's own words from
// earlier conversations with Vita, where the real, specific recurring activities
// live. One structured Claude call returns those activities, each with a rough
// frequency (most days / a few times a week / weekly / now and then), whether it's
// a regular anchor, and whether it gives energy — no day of the week, no time of
// day. Anything that goes wrong falls back to a grounded generic rhythm so the
// surface always renders.

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are reading back the RHYTHM of an ordinary WEEK for someone working through the "Plan" stage of a guided retirement life-planning programme. You already know them well from the earlier stages and conversations. Your job now is to turn the real, recurring things in their life into the rhythm of a week they can adjust and pressure-test — and they curate it: they set the overall feel, fix the frequency and anchors, mark what gives them energy, and add or remove anything.

WHAT MAKES THIS WORK — THEIR REAL ACTIVITIES, AT A GRAIN THEY CAN ANSWER
This far out from retirement, no one can honestly say "tennis on Tuesday at 3pm". The honest grain is rougher: how often a thing happens, whether it's a fixed anchor or stays loose. So you capture rhythm, NOT a timetable. Two rules above all:

1. USE THEIR ACTUAL, SPECIFIC ACTIVITIES. Build the week from the real recurring things they have actually named — listed below under THEIR REAL RECURRING ACTIVITIES (their regular badminton, the Tuesday swim, the choir, Sunday lunch with the family, the dog walk, the book group, the volunteering shift). Name each thing specifically and in full, in their terms ("Badminton at the club", not "something active"; "Sunday dinner with the kids", not "time with family"). NEVER use generic template activities like "morning walk", "something social", "a project or interest", "time to relax". A week of generic placeholders has failed. Nothing on that list should be missing.

2. NEVER INVENT. Only include activities they actually told you about. If they named few specifics, return few — better six real, recognisable activities than twelve padded with invented filler. Do not make up hobbies, clubs or commitments.

DRAFT THE ACTIVITIES
Return the recurring activities that make up their ordinary week (typically six to twelve, but only as many as are real). Give each:
- "label": the real, specific activity in their own terms, in full (a short phrase).
- "category": one plain word for the kind of thing — e.g. movement, people, rest, interest, learning, contribution, everyday, goal, work.
- "frequency": exactly one of "Most days", "A few times a week", "Weekly", "Now and then" — your best read of how often it happens.
- "anchor": true if this is a regular fixed point the week is built around (a set class, a standing date, a commitment they keep), false or omitted if it stays loose and movable.
- "energy": true if this is a clear source of energy or enjoyment for them, otherwise omit.

Cover the real texture of their week across the areas that matter to them — movement, mind and learning, rest, people, contribution — wherever they named things there. It is completely fine for most things to be loose (not anchors); the point is the few real anchors plus the overall feel, not a full schedule.

THE WORK TRANSITION
If the person is phasing out of work gradually, include their ongoing work as one activity with "fixed": true and "anchor": true, so the rest of the week is read around it. If they are making a clean break, include no work activity.

THE OVERALL FEEL
Also return "structure": a number from 0 (highly structured, lots of fixed anchors) to 100 (largely open, mostly unplanned), your best read of the rhythm that suits them. This is only a starting position they will adjust.

JSON shape:
{"structure":45,"activities":[{"label":"Badminton at the club","category":"movement","frequency":"A few times a week","anchor":true,"energy":true},{"label":"Sunday lunch with the family","category":"people","frequency":"Weekly","anchor":true,"energy":true},{"label":"Reading","category":"rest","frequency":"Most days"}]}

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"). Speak directly and in the affirmative.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

export async function POST(request: Request) {
  let body: WeekShapeDraftInput;
  try {
    body = (await request.json()) as WeekShapeDraftInput;
  } catch {
    return Response.json({ seed: null });
  }

  const input: WeekShapeDraftInput = {
    userModel: typeof body.userModel === "string" ? body.userModel : "",
    onboarding: typeof body.onboarding === "string" ? body.onboarding : "",
    hasPartner: body.hasPartner === true,
    retirementStage: body.retirementStage ?? null,
    goals: Array.isArray(body.goals) ? body.goals : [],
    transition: body.transition ?? null,
    recurring: Array.isArray(body.recurring)
      ? body.recurring.filter(
          (r): r is { label: string; domain: string | null } =>
            !!r && typeof r.label === "string" && r.label.trim() !== ""
        )
      : [],
  };

  const goalBlock = input.goals.length
    ? input.goals
        .map((g, i) => {
          const kind = g.track === "be" ? "way to live" : "thing to do/achieve";
          const tags = [g.area && `area: ${g.area}`, g.focus && "spotlighted"]
            .filter(Boolean)
            .join(", ");
          const extras = [
            g.season && `season: ${g.season}`,
            g.note && `what it means to them: ${g.note}`,
          ]
            .filter(Boolean)
            .join("; ");
          return `${i + 1}. [${kind}${tags ? `; ${tags}` : ""}] ${g.goal}${extras ? `\n   (${extras})` : ""}`;
        })
        .join("\n")
    : "(none named yet)";

  const transitionBlock = input.transition
    ? input.transition.lean === "gradual"
      ? [
          "phasing out of work gradually — include their ongoing work as a fixed anchor the week is read around",
          input.transition.shape && `shape: ${input.transition.shape}`,
          input.transition.period && `over roughly: ${input.transition.period}`,
        ]
          .filter(Boolean)
          .join("; ")
      : "a clean break from work — no ongoing work activity"
    : "(no transition signal — assume no ongoing work activity)";

  const recurringBlock = input.recurring.length
    ? input.recurring
        .map((r) => `- ${r.label}${r.domain ? ` (${r.domain})` : ""}`)
        .join("\n")
    : "(none recorded yet)";

  const context = [
    input.onboarding &&
      input.onboarding.trim() &&
      `ABOUT THEM:\n${input.onboarding.trim()}`,
    input.userModel && input.userModel.trim(),
    `THEIR REAL RECURRING ACTIVITIES (the source for the week — the actual hobbies, clubs and commitments they named across the programme; build the week from these and don't drop any):\n${recurringBlock}`,
    `THE GOALS THEY NAMED ACROSS THE BALANCED AREAS (extra grounding; each tagged with its area):\n${goalBlock}`,
    `THEIR WORK TRANSITION (only to decide whether ongoing work belongs in the week):\n${transitionBlock}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2600,
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: `Here is everything this person has shared so far:\n\n${context}`,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

    return Response.json({ seed: coerceWeekShape(JSON.parse(slice), input) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[week-shape] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[week-shape] Unexpected error:", error);
    }
    // Recoverable processing failure — signal it so the client retries rather than
    // settling on the generic fallback.
    return Response.json({ seed: null });
  }
}
