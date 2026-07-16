import Anthropic from "@anthropic-ai/sdk";
import {
  coerceGoalPaths,
  fallbackGoalPaths,
  type GoalPathInput,
} from "@/lib/goalPathsSeed";

// Drafts the path for each goal in Module 4.4. The session sends the curated
// user model (the picture built up across Stages 1–4), the onboarding line, and
// the goals the person spotlighted in 4.3 — each with its track. One structured
// Claude call returns one path per goal, in the same order: for a do/achieve
// goal a short ladder of stepping stones (the earliest of which may already be
// behind them); for a way-of-being goal a light note on what already helps it
// and what would help it take root. The person curates on the surface. Anything
// that goes wrong falls back to a goal-specific generic path so the surface
// always renders with one path per goal.

type DraftRequest = {
  userModel: string;
  onboarding: string;
  hasPartner?: boolean;
  goals: GoalPathInput[];
};

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are drafting the PATH to each goal for someone working through the "Plan" stage of a guided retirement life-planning programme. You already know them well from the earlier stages. They spotlighted a handful of goals last session; now you sketch how each one could come true, and they curate your sketch — editing a step, reordering, adding or removing one, or marking the steps already behind them. Make that first draft so well-judged that most of it can stand without a single edit.

THE TONE THAT MATTERS MOST — ALREADY UNDERWAY
A big goal should feel MORE reachable by the end of this, not more daunting. So wherever it's honest, show how much is already behind them: mark the earliest stepping stone "done" when their earlier material says they're already doing it or already have it. Someone seeing their path should think "I'm further along than I realised", never "what a mountain".

TWO KINDS OF GOAL — TWO KINDS OF PATH
You are given each goal's track. Honour it exactly; never change a goal's track.
- A "do" goal (a thing to do or achieve) gets a MILESTONE LADDER: 3 to 5 stepping stones, in rough order, from where they are now to the goal. Each stone is one concrete, doable move that builds toward the next. A foundation that needs work becomes an EARLY stone, not a separate note (e.g. "build up to multi-day-trek fitness" is the first stone, not a side item). Example for "walk the full Annapurna Circuit with Harry in year two": build to multi-day-trek fitness → do a practice multi-day trek closer to home → get the kit sorted → book the trip → go. Give each stone a "label"; optionally a rough "when" (e.g. "first year", "once you're fit for it") and "done": true if it's already behind them. Do NOT give exact dates or a week-by-week schedule.
- A "be" goal (a way to live, e.g. "stay close to family") gets NO ladder. Instead a light note: "alreadyHelps" — the one or two things in their life that already support it; "wouldHelp" — the one or two things that would help it take root. Two or three short phrases each at most. Keep it warm and light, never a checklist.

THE BOUNDARY — ROUTE, NOT SCHEDULE
These are planning-level: the route to each goal, with at most a rough sense of when. The next stage (Act) turns the next stone into dated first actions. So stay at the level of the route. No dates, no "week one", no granular task lists. A stone is "do a practice trek", not "book the 14th–16th March practice trek".

MAKE IT PERSONAL
- Build only on what they actually told you — their real activities, people, places and dreams. A path must sound written for THIS person. Never invent facts about their life.
- Optionally add "lean": ONE strength or resource of theirs the early steps can lean on (e.g. "you've organised trips like this before"). Tie it to something real. Omit it if nothing fits.

ONE PATH PER GOAL, IN ORDER
Return exactly one path object per goal you are given, in the SAME ORDER, each carrying the goal's exact label in "goal" and its given track in "track".

JSON shape (a "do" goal carries "milestones"; a "be" goal carries "alreadyHelps" and "wouldHelp"; either may carry "lean"):
{"paths":[{"goal":"<exact label>","track":"do","milestones":[{"label":"...","when":"...","done":true},{"label":"..."},{"label":"..."},{"label":"..."}],"lean":"..."},{"goal":"<exact label>","track":"be","alreadyHelps":["...","..."],"wouldHelp":["..."],"lean":"..."}]}

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"). Speak directly and in the affirmative.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

export async function POST(request: Request) {
  let body: DraftRequest;
  try {
    body = (await request.json()) as DraftRequest;
  } catch {
    return Response.json({ seed: fallbackGoalPaths([]) });
  }

  const goals = Array.isArray(body.goals) ? body.goals : [];

  // No goals to draw a path for — return the generic fallback rather than
  // inventing goals from thin air.
  if (!goals.length) {
    return Response.json({ seed: fallbackGoalPaths([]) });
  }

  const goalBlock = goals
    .map((g, i) => {
      const kind = g.track === "be" ? "way to live (be)" : "thing to do/achieve (do)";
      const extras = [
        g.area && `area: ${g.area}`,
        g.season && `season: ${g.season}`,
        g.note && `what it means to them: ${g.note}`,
      ]
        .filter(Boolean)
        .join("; ");
      return `${i + 1}. [${kind}] ${g.goal}${extras ? `\n   (${extras})` : ""}`;
    })
    .join("\n");

  const context = [
    body.onboarding && body.onboarding.trim() && `ABOUT THEM:\n${body.onboarding.trim()}`,
    body.userModel && body.userModel.trim(),
    `THE GOALS THEY SPOTLIGHTED (draft one path per goal, in this order, honouring each track):\n${goalBlock}`,
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

    return Response.json({ seed: coerceGoalPaths(JSON.parse(slice), goals) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[goal-paths] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[goal-paths] Unexpected error:", error);
    }
    // Recoverable processing failure — signal it so the client retries rather than
    // settling on the generic fallback. (Genuinely-empty input is handled above.)
    return Response.json({ seed: null });
  }
}
