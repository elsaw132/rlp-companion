import Anthropic from "@anthropic-ai/sdk";
import {
  coerceGoalPaths,
  type GoalPath,
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
  strengths?: string[];
};

export const maxDuration = 60;

// One goal is drafted per model call, in parallel, so each call is small and fast.
// A hard per-call timeout keeps any single stuck call from eating the whole 60s
// function budget; every goal finishes (or gives up) in roughly the time of the
// slowest single goal. maxRetries is kept low so a transient overload doesn't stack
// extra internal attempts on top of that budget — a still-missing goal is re-drafted
// once explicitly below, and the surface offers a manual "Try again" beyond that.
const SINGLE_CALL_TIMEOUT_MS = 28_000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 1,
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

STRENGTHS TO LEAN ON — FROM THEIR OWN LIST
- Add "strengths": TWO or THREE of the person's OWN named strengths that would most help them with THIS goal. You are given their named strengths under "THEIR NAMED STRENGTHS". Choose ONLY from that list, copied VERBATIM (exact wording). Never invent a strength, never paraphrase one, and never write a sentence here — these are short strength names (e.g. "Perseverance", "Creativity", "Leadership"), shown as tags. Pick the ones that genuinely fit the goal; if the list is short, two is fine.

ONE PATH PER GOAL, IN ORDER
Return exactly one path object per goal you are given, in the SAME ORDER, each carrying the goal's exact label in "goal" and its given track in "track".

JSON shape (a "do" goal carries "milestones"; a "be" goal carries "alreadyHelps" and "wouldHelp"; every path carries "strengths" — 2–3 of their named strengths, verbatim):
{"paths":[{"goal":"<exact label>","track":"do","milestones":[{"label":"...","when":"...","done":true},{"label":"..."},{"label":"..."},{"label":"..."}],"strengths":["Perseverance","Creativity"]},{"goal":"<exact label>","track":"be","alreadyHelps":["...","..."],"wouldHelp":["..."],"strengths":["Kindness","Teamwork"]}]}

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"). Speak directly and in the affirmative.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

// The context that's the same for every goal (about-them, the user model, and their
// named strengths). Built once and reused across the per-goal calls.
type SharedContext = {
  onboarding: string;
  userModel: string;
  strengthsBlock: string;
};

// Draft the path for ONE goal. Returns a real, personalized path or null. Never
// substitutes generic content: a single-goal input means coerceGoalPaths returns
// either the real drafted path or null (its per-goal generic filler is discarded
// when nothing real was produced), so a failure here surfaces honestly upstream.
async function draftOnePath(
  g: GoalPathInput,
  shared: SharedContext,
  strengths: string[]
): Promise<GoalPath | null> {
  const kind = g.track === "be" ? "way to live (be)" : "thing to do/achieve (do)";
  const extras = [
    g.area && `area: ${g.area}`,
    g.season && `season: ${g.season}`,
    g.note && `what it means to them: ${g.note}`,
  ]
    .filter(Boolean)
    .join("; ");
  const goalBlock = `THE GOAL THEY SPOTLIGHTED (draft its path, honouring its track):\n1. [${kind}] ${g.goal}${extras ? `\n   (${extras})` : ""}`;

  const context = [shared.onboarding, shared.userModel, goalBlock, shared.strengthsBlock]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        system: systemPrompt(),
        messages: [
          {
            role: "user",
            content: `Here is everything this person has shared so far:\n\n${context}`,
          },
        ],
      },
      { signal: AbortSignal.timeout(SINGLE_CALL_TIMEOUT_MS) }
    );

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

    const seed = coerceGoalPaths(JSON.parse(slice), [g], strengths);
    return seed?.paths[0] ?? null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[goal-paths] Anthropic API error for goal "${g.goal}" — status=${error.status} message=${error.message}`
      );
    } else {
      console.error(`[goal-paths] Error drafting goal "${g.goal}":`, error);
    }
    return null;
  }
}

export async function POST(request: Request) {
  let body: DraftRequest;
  try {
    body = (await request.json()) as DraftRequest;
  } catch {
    return Response.json({ seed: null });
  }

  const goals = Array.isArray(body.goals) ? body.goals : [];
  const strengths = Array.isArray(body.strengths)
    ? body.strengths.filter((s): s is string => typeof s === "string" && s.trim() !== "")
    : [];

  // No goals to draw a path for — nothing to draft. Fail honestly rather than
  // inventing goals from thin air.
  if (!goals.length) {
    return Response.json({ seed: null });
  }

  const strengthsBlock = strengths.length
    ? `THEIR NAMED STRENGTHS (their own words, from earlier — pick from THESE for each goal's "strengths", verbatim; never invent one):\n${strengths.map((s) => `- ${s}`).join("\n")}`
    : "";
  const shared: SharedContext = {
    onboarding:
      body.onboarding && body.onboarding.trim() ? `ABOUT THEM:\n${body.onboarding.trim()}` : "",
    userModel: body.userModel && body.userModel.trim() ? body.userModel.trim() : "",
    strengthsBlock,
  };

  // First pass: draft every goal in parallel. Each is a small, fast call with its own
  // timeout, so one slow goal can't sink the rest and the whole set finishes in about
  // the time of the slowest single goal — well inside the function budget.
  let paths = await Promise.all(goals.map((g) => draftOnePath(g, shared, strengths)));

  // Second pass: re-draft only the goals that came back empty (a transient overload or
  // a bad JSON parse), again in parallel. We NEVER substitute generic content for a
  // goal we couldn't draft — a still-missing goal fails the whole set honestly below.
  if (paths.some((p) => p === null)) {
    paths = await Promise.all(
      paths.map((p, i) => (p ? p : draftOnePath(goals[i], shared, strengths)))
    );
  }

  // Only render when EVERY spotlighted goal has a real, personalized path. If any is
  // still missing, signal failure (null) so the surface shows an honest "Try again"
  // rather than a generic path masquerading as theirs.
  if (paths.some((p) => p === null)) {
    return Response.json({ seed: null });
  }

  return Response.json({ seed: { paths: paths as GoalPath[] } });
}
