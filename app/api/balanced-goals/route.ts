import Anthropic from "@anthropic-ai/sdk";
import {
  coerceBalancedGoals,
  FALLBACK_BALANCED_GOALS,
} from "@/lib/balancedGoalsSeed";

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

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are drafting AMBITIOUS goals for someone working through the "Plan" stage of a guided retirement life-planning programme. You already know them well from the earlier stages. This screen is called "Your most important goals". It is NOT about covering every part of their life or keeping some balance — it is about finding the FEW areas, from everything they've told you, where they could set themselves a real, concrete, stretching goal for their retirement, and drafting one strong goal for each.

HOW MANY — A FEW, STRONG
- Pick the 3 or 4 areas of THEIR life most alive with possibility — the things they lit up about, kept returning to, or clearly care most about — and draft ONE goal for each. Never more than 4. Fewer, bolder goals beat a long list.

EVERY GOAL IS SOMETHING THEY CAN ACHIEVE
- Each goal is a concrete thing to DO or accomplish — something they could one day say they have done. NEVER a way of living, a habit, or a vague intention. "Be more present", "stay connected", "keep learning", "stay active" are NOT goals here — those are covered elsewhere in the programme; leave them out entirely.
- Give each goal a real shape with a stretch built in. GOOD: "Walk the full Annapurna Circuit with Harry, training together over the year before". TOO VAGUE / NOT A GOAL: "travel more", "stay fit", "cook".

BUILD ONLY ON WHAT THEY TOLD YOU
- Use their actual activities, people, places and ambitions, named specifically ("the Croatian island-hopping trip you keep coming back to", not "a holiday"). Never invent an ambition, hobby or person they didn't mention.

LEAD WITH AMBITION, THEN LET THEM DIAL IT
- Retirement is the time to aim high, and this screen exists to encourage a few BOLD goals. The main ("original") version of each goal should already be a proper, exciting stretch. Then draft a "bolder" version (even more ambitious — a bigger milestone, further, sooner) and a "quieter" version (a gentler on-ramp to the same thing). All three are the SAME goal at different sizes, and all three are concrete things to DO.
- Each version is COMPLETE and reads fully on its own — never a fragment or a "…but smaller". Someone seeing only the quieter version must understand the whole goal.

EACH GOAL CARRIES
- "area": the area of THEIR life this goal is about, in a few natural words in their own terms — e.g. "Travel & adventure", "Our home", "Cooking", "Time with the grandchildren", "Mentoring". This is a free label, NOT a fixed category. One short phrase.
- "why": ONE short, warm line on why this one, tied to something they actually said (e.g. "you kept coming back to the longer trips"). Never a verdict.
- "original", "bolder", "quieter": each an object {"label": the goal as a short, vivid phrase with a stretch built in; "cadence": a rough when or how-often — "over the first summer", "a course this year, then every week", "one big trip a year"}.

JSON shape:
{"suggestions":[{"area":"Travel & adventure","why":"you kept coming back to the longer, immersive trips","original":{"label":"Spend a full month island-hopping across Croatia with Harry","cadence":"a big trip in year one"},"bolder":{"label":"Take three months to travel the length of the Mediterranean coast by train and boat","cadence":"a long trip in the first two years"},"quieter":{"label":"Take one two-week island-hopping trip to Croatia with Harry","cadence":"once in the first year"}}]}

Draft 3 or 4 goals — never more. Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"). Speak directly and in the affirmative.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

export async function POST(request: Request) {
  let body: DraftRequest;
  try {
    body = (await request.json()) as DraftRequest;
  } catch {
    return Response.json({ seed: FALLBACK_BALANCED_GOALS });
  }

  const context = [
    body.onboarding && body.onboarding.trim() && `ABOUT THEM:\n${body.onboarding.trim()}`,
    body.userModel && body.userModel.trim(),
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
