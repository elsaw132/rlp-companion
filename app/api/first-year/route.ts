import Anthropic from "@anthropic-ai/sdk";
import {
  coerceFirstYear,
  type FirstYearDraftInput,
} from "@/lib/firstYearSeed";

// Assembles the first year for Module 4.7 ("Your first year"). This is the
// assembly module — it draws everything Stage 4 has gathered into one sequenced
// picture: the goals and trips (4.3), the weekly rhythm (4.6), the early-
// retirement priorities (4.2), and the shape of the work transition (4.1). One
// structured Claude call returns the items placed onto a four-part arc of the
// year, with trips flagged, a top-of-the-list marker, goals that can run in
// parallel noted, and a work lane that shows how any phase-out lands across the
// year. The person reacts to the draft. Anything that goes wrong falls back to a
// grounded assembly so the surface always renders.

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are assembling the FIRST YEAR of retirement for someone finishing the "Plan" stage of a guided retirement life-planning programme. You already know them well. This is an ASSEMBLY: draw together what they have already decided into one specific, sequenced picture of year one — what happens, in roughly what order, and how it fits around any ongoing work. You are not interviewing them again and not inventing new plans. The person then reacts to your draft: keep, reorder, mark, remove, add.

THE SHAPE OF THE YEAR
Lay year one out across a four-part arc plus an "all year" lane:
- "s1" = the opening months, "s2" = settling in, "s3" = well into the year, "s4" = closing the first year.
- "all-year" = things that run throughout (the threads of their weekly rhythm; an ongoing-work footprint that spans the year).
Sequence, do NOT schedule. Decide what comes first and the rough order — never specific dates or a step-by-step task list (that belongs to the next stage).

BUILD THE ITEMS FROM WHAT THEY ALREADY DECIDED
Return the things that make up their first year. Each item:
- "label": the specific thing, in their own terms and in full (a short phrase). Use their real goals and trips, not generic placeholders.
- "kind": one of "trip" (travel), "goal" (a thing to do/achieve), "project" (a way of living or an undertaking), "rhythm" (a thread of their weekly rhythm that runs all year), "work" (the ongoing-work footprint of a phase-out).
- "season": one of "s1", "s2", "s3", "s4" for when it begins or happens, or "all-year" for things that run throughout (always "all-year" for rhythm threads).
- "top": true for the ONE standout trip or goal — the thing top of the list for year one. Use it once, at most twice.
- "parallel": true for a goal or project that can run alongside others rather than needing the year to itself. Leave false for things that need to come first or stand alone.
- "note": a short phrase only where it genuinely adds (why it's first, what it depends on). Usually omit.

DECIDE THE ORDER FROM THEIR OWN SIGNALS
Use the season a goal was tagged with (4.3) and the early-retirement priorities (4.2) to decide what lands early. Put the things they most wanted to do early, and the things their energy is highest for, nearer the front. Spread the year so it reads as ambitious but achievable — not everything crammed into the opening months.

THE WEEKLY RHYTHM
Include two or three threads of their weekly rhythm as "rhythm" items on "all-year", so the year has a texture running underneath the milestones. Do not list every activity — just the anchors and the things that give them energy.

THE WORK TRANSITION — BE HONEST ABOUT FREE TIME
If they are phasing out of work gradually, include the ongoing work as one "work" item (occasionally two if it changes partway through the year), with "fixed": true, placed on "all-year" or the season(s) it falls in. Make its share of the year honest — if a real chunk of year one is still committed to work, the plan should show that, not pretend they are fully retired. If they are making a clean break, include NO work item.

MAKE IT THEIRS, NEVER INVENT
Build only from what they actually told you. Better eight real, recognisable items than fifteen padded with invented filler.

ALSO WRITE THE STORY OF THE YEAR
Return a "narrative": a short, warm, FIRST-PERSON story of the year as it unfolds across the four phases — written as if the person is picturing it ("In the opening months I… by the summer… as the year closes…"). Three to five sentences. Move through the arc in order, naming their real activities and the one or two headline moments, and be honest about how work sits in it. This is for them to read and picture, so it must read like a person's year, not a list. Plain, warm, grounded in their specifics. Never address it to "you" — it is their own voice, "I".

JSON shape:
{"narrative":"In the opening months I find my feet again, with the mornings finally my own…","items":[{"label":"Three weeks in Japan","kind":"trip","season":"s2","top":true},{"label":"Get the allotment going","kind":"project","season":"s1"},{"label":"Badminton at the club","kind":"rhythm","season":"all-year"},{"label":"Two days a week at the firm, dropping to one by the autumn","kind":"work","season":"all-year","fixed":true}]}

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"). Speak directly and in the affirmative.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

export async function POST(request: Request) {
  let body: FirstYearDraftInput;
  try {
    body = (await request.json()) as FirstYearDraftInput;
  } catch {
    return Response.json({ seed: null });
  }

  const input: FirstYearDraftInput = {
    userModel: typeof body.userModel === "string" ? body.userModel : "",
    onboarding: typeof body.onboarding === "string" ? body.onboarding : "",
    hasPartner: body.hasPartner === true,
    retirementStage: body.retirementStage ?? null,
    goals: Array.isArray(body.goals) ? body.goals : [],
    rhythm: Array.isArray(body.rhythm) ? body.rhythm : [],
    seasonPriorities: Array.isArray(body.seasonPriorities)
      ? body.seasonPriorities
      : [],
    seasonOrder: Array.isArray(body.seasonOrder) ? body.seasonOrder : [],
    transition: body.transition ?? null,
  };

  const goalBlock = input.goals.length
    ? input.goals
        .map((g, i) => {
          const kind = g.track === "be" ? "way to live" : "thing to do/achieve";
          const tags = [
            g.area && `area: ${g.area}`,
            g.focus && "spotlighted",
            g.season && `they tagged it: ${g.season}`,
          ]
            .filter(Boolean)
            .join(", ");
          const note = g.note ? `\n   (why it matters: ${g.note})` : "";
          return `${i + 1}. [${kind}${tags ? `; ${tags}` : ""}] ${g.goal}${note}`;
        })
        .join("\n")
    : "(none shaped yet)";

  const rhythmBlock = input.rhythm.length
    ? input.rhythm
        .map((r) => {
          const tags = [r.anchor && "anchor", r.energy && "gives energy"]
            .filter(Boolean)
            .join(", ");
          return `- ${r.label} (${r.frequency}${tags ? `; ${tags}` : ""})`;
        })
        .join("\n")
    : "(no weekly rhythm captured)";

  const seasonBlock = input.seasonPriorities.length
    ? [
        input.seasonOrder.length
          ? `Their season order, early to later: ${input.seasonOrder.join(" → ")}.`
          : "",
        ...input.seasonPriorities.map(
          (p) => `- ${p.label} (they placed it in: ${p.seasons.join(", ")})`
        ),
      ]
        .filter(Boolean)
        .join("\n")
    : "(no early-retirement priorities captured)";

  const transitionBlock = input.transition
    ? input.transition.lean === "gradual"
      ? [
          "phasing out of work gradually — include the ongoing work as a fixed item the year is built around, and be honest about how much of year one is still committed to work",
          input.transition.shape && `shape: ${input.transition.shape}`,
          input.transition.period && `over roughly: ${input.transition.period}`,
        ]
          .filter(Boolean)
          .join("; ")
      : "a clean break from work — year one is fully their own; include no work item"
    : "(no transition signal — assume a clean break and include no work item)";

  const context = [
    input.onboarding &&
      input.onboarding.trim() &&
      `ABOUT THEM:\n${input.onboarding.trim()}`,
    input.userModel && input.userModel.trim(),
    `THE GOALS THEY SHAPED (4.3 — the heart of year one):\n${goalBlock}`,
    `THEIR WEEKLY RHYTHM (4.6 — threads that run all year):\n${rhythmBlock}`,
    `WHAT THEY WANTED EARLY IN RETIREMENT (4.2):\n${seasonBlock}`,
    `THEIR WORK TRANSITION (4.1 — how the year fits around any ongoing work):\n${transitionBlock}`,
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
          content: `Here is everything this person has decided so far:\n\n${context}`,
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

    return Response.json({ seed: coerceFirstYear(JSON.parse(slice), input) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[first-year] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[first-year] Unexpected error:", error);
    }
    // Recoverable processing failure — signal it so the client retries rather than
    // settling on the generic fallback.
    return Response.json({ seed: null });
  }
}
