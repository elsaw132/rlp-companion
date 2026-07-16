import Anthropic from "@anthropic-ai/sdk";
import {
  coerceBalancedGoals,
  FALLBACK_BALANCED_GOALS,
} from "@/lib/balancedGoalsSeed";
import { BALANCED_AREAS, type BalancedArea } from "@/lib/userModel";

// Drafts the goals for Module 4.3. The session sends the curated user model (the
// picture built up across Stages 1–3), the onboarding line, and the per-area
// material the person placed in each balanced-retirement area back in Stage 2.
// One structured Claude call returns a small, curated set of concrete, personal
// goals already sorted into the five areas — the person curates them on the
// surface. Anything that goes wrong falls back to a safe generic set so the
// surface always renders with something on it.

type DraftRequest = {
  // The rendered user-model block (renderUserModel) — the rich specifics.
  userModel: string;
  // The short onboarding sentence (partner, horizon, what prompted them).
  onboarding: string;
  hasPartner?: boolean;
  // What the person placed in each balanced area back in Stage 2, in their own
  // words — the anchor for which area a goal belongs to (no re-classifying).
  springboards: { area: string; labels: string[] }[];
};

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

const AREA_GUIDE: Record<BalancedArea, string> = {
  restore: "Restore — rest, recovery and the things that recharge them",
  move: "Move — keeping an active, capable body",
  think: "Think — a curious, engaged mind: learning, making, creating",
  connect: "Connect — the people and relationships that matter most",
  contribute: "Contribute — giving something beyond themselves",
};

function systemPrompt(): string {
  return `You are drafting goals for someone working through the "Plan" stage of a guided retirement life-planning programme. You already know them well from the earlier stages. They are about to see a small set of goals you've drafted FOR them, which they will then curate — keep, edit, swap for a bolder or quieter version, reject, or add their own. Your job is to make that first draft so well-judged and personal that most of it can stand.

A full retirement keeps five areas in some balance. Draft goals across these five:
${BALANCED_AREAS.map((a) => `- ${AREA_GUIDE[a]} (id: "${a}")`).join("\n")}

HOW MANY
- A small, strong set: roughly 5 to 8 goals total, about one or two per area WHERE there's real signal for that area.
- If an area has nothing to draw on, leave it empty. An empty area is fine — a thin, generic goal is worse than none.

WHICH AREA A GOAL SITS IN
- Each goal sits in exactly one area. Use the per-area material supplied below to decide: a goal built from someone's Move material is a Move goal, a goal built from their Connect material is a Connect goal. Do not re-sort or invent the mapping.

MAKE EACH GOAL SPECIFIC AND PERSONAL
- Use their real material — the actual activities, people, places, dreams and values they named. A goal must sound like it was written for THIS person, not anyone.
- GOOD (specific, personal): "Walk the full Annapurna Circuit with Harry in year two, training together in the lead-up". TOO VAGUE (never do this): "Travel more", "Stay active", "See friends".
- Never invent facts about their life. Build only on what they actually told you.

TWO KINDS OF GOAL
- A "do" goal is a thing to do or achieve: phrase it specifically, with a gentle stretch built into the wording, and give a rough "when / how often" in "cadence" (e.g. "most weeks", "once a year", "the first summer").
- A "be" goal is a way to live: phrase it as what it looks like in an ordinary week in "ordinaryWeek". Never force it into a number or metric.

THREE INTENSITIES — DRAFT ALL THREE FOR EVERY GOAL
- For each goal, draft "original" (the version they'll see first), plus "bolder" (one notch more ambitious) and "quieter" (one notch gentler). The person can step between them with a single tap, so give all three on every goal.
- Each version is a COMPLETE, standalone goal that reads clearly on its own. Someone seeing ONLY the quieter version must understand the whole goal — never write a fragment, a trailing "...but less often", or a tweak that only makes sense beside the others.
- Each version is its own little object: it carries its own "track", and its own timing — a "do" version gives "cadence", a "be" version gives "ordinaryWeek". The bolder version usually asks more (more often, further, a real milestone); the quieter version asks less.
- A version may switch track if that's the honest way to make it gentler or bolder (e.g. a quieter "do" goal might become a "be" goal). Keep all three recognisably the same goal.

EACH GOAL ALSO CARRIES
- "why": ONE short line on why you suggested it, tied to something they actually said (e.g. "you kept coming back to the grandchildren"). Plain, warm, never a verdict. This sits on the goal, not on a version.

JSON shape (every goal has area, why, original, bolder, quieter; each version is {track,label,+cadence or ordinaryWeek}):
{"suggestions":[{"area":"move","why":"...","original":{"track":"do","label":"...","cadence":"..."},"bolder":{"track":"do","label":"...","cadence":"..."},"quieter":{"track":"be","label":"...","ordinaryWeek":"..."}},{"area":"connect","why":"...","original":{"track":"be","label":"...","ordinaryWeek":"..."},"bolder":{"track":"be","label":"...","ordinaryWeek":"..."},"quieter":{"track":"be","label":"...","ordinaryWeek":"..."}}]}

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"). Speak directly and in the affirmative.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

export async function POST(request: Request) {
  let body: DraftRequest;
  try {
    body = (await request.json()) as DraftRequest;
  } catch {
    return Response.json({ seed: FALLBACK_BALANCED_GOALS });
  }

  const springboardBlock = (body.springboards ?? [])
    .filter((s) => s.labels && s.labels.length > 0)
    .map((s) => {
      const area = s.area as BalancedArea;
      const heading = AREA_GUIDE[area] ?? s.area;
      return `${heading}:\n${s.labels.map((l) => `  - ${l}`).join("\n")}`;
    })
    .join("\n\n");

  const context = [
    body.onboarding && body.onboarding.trim() && `ABOUT THEM:\n${body.onboarding.trim()}`,
    body.userModel && body.userModel.trim(),
    springboardBlock &&
      `WHAT THEY PLACED IN EACH AREA EARLIER (use this to decide which area a goal belongs to):\n${springboardBlock}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Nothing to work from — return the generic fallback rather than inventing a
  // life from thin air.
  if (!context.trim()) {
    return Response.json({ seed: FALLBACK_BALANCED_GOALS });
  }

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

    const coerced = coerceBalancedGoals(JSON.parse(slice));
    // A coerced result that fell back to the generic set means the model returned
    // nothing usable (garbage or all off-area). That's a transient failure, not a
    // real draft — signal it with a null seed so the client retries rather than
    // caching the generic list. (Genuinely-empty input is handled above, before the
    // model call, and still returns the fallback directly.)
    if (coerced === FALLBACK_BALANCED_GOALS) {
      return Response.json({ seed: null });
    }
    return Response.json({ seed: coerced });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[balanced-goals] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[balanced-goals] Unexpected error:", error);
    }
    // A processing failure (model error after retries, or unparseable output) is
    // recoverable — signal it so the client retries instead of settling on generic.
    return Response.json({ seed: null });
  }
}
