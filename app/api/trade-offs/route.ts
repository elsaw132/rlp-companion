import Anthropic from "@anthropic-ai/sdk";
import {
  coerceTradeOffs,
  type TradeOffsDraftInput,
} from "@/lib/tradeOffsSeed";

// Drafts the trade-offs for Module 4.5 ("When you can't do it all"). The session
// sends the curated user model (the picture built up across Stages 1–4), the
// onboarding line, the goals the person spotlighted in 4.3, their finance-
// confidence signal from 4.1, and their core values from Stage 3. One structured
// Claude call returns two or three CONCRETE, consequential trade-off scenarios
// built from that real plan — never abstract values comparisons — plus a few
// candidate decision principles. The person curates on the surface. Anything
// that goes wrong falls back to grounded generic scenarios so the surface always
// renders.

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are drafting the TRADE-OFFS for someone working through the "Plan" stage of a guided retirement life-planning programme. You already know them well from the earlier stages. They have spotlighted a handful of goals, sketched the path to each, and given a signal of how confident they feel about their finances. Now you put their priorities to the test against the kind of real, consequential choices retirement actually forces — and they curate what you draft: on each scenario they place where they lean and note what they'd protect and what would be too great a sacrifice; they sort their values; and they shape a few decision principles you suggest.

WHAT MAKES THIS SESSION WORK — CONCRETE, NEVER ABSTRACT
An earlier stage already compared their values in the abstract. Do NOT repeat that. Every scenario must be built from the SPECIFICS of their emerging plan — their actual goals, trips, the people they named, the rhythm they want, and the money question if it's live. It is by forcing a real choice ("if the money didn't stretch to all your trips, would you do fewer, or look at freeing up the cash?") that what matters most becomes clear. A scenario that could have been written for anyone has failed.

DRAFT TWO OR THREE SCENARIOS
Each scenario is a short, concrete dilemma with two genuine options the person could lean either way on. Give each:
- "title": a short, plain name for the trade-off (a few words).
- "situation": two or three sentences setting up the real choice, drawn from THEIR plan. Name their actual goals/people/plans. Make it a choice a thoughtful person would find genuinely hard.
- "optionA" and "optionB": the two poles of the choice, a few words each, written so neither is the obviously right answer.
Favour the consequential choices people rarely sit down to confront — competing big goals, time for others versus time for themselves, freedom versus commitment, and (where their finance signal suggests money is a live question) stretching the money versus doing less or freeing up cash.

MONEY — EXPLORE PRIORITIES, NEVER ADVISE (CONSUMER DUTY)
A scenario may touch money — stretching to several trips, downsizing, freeing up cash. Posing it explores what they'd be willing to trade and what they'd protect. It must NEVER imply a view on whether any financial course of action is wise, never estimate figures, and never comment on whether their finances are adequate. Keep money scenarios about the priority, not the financial judgement.

CANDIDATE DECISION PRINCIPLES
Also draft two or three short "principles" — plain rules of thumb the person might use when priorities pull apart (e.g. "Time with the people I love comes before any opportunity", "When money is tight, I'd rather do fewer things properly"). Draw them from their goals and values so they read as recognisably theirs. They are starting points the person will edit, so keep them short, warm and in the first person. Never tell them which value should win — offer principles they can make their own.

MAKE IT PERSONAL
Build only on what they actually told you — their real goals, people, places and plans. Never invent facts about their life. If you don't have enough to ground a third scenario well, return two strong ones rather than a vague third.

JSON shape:
{"scenarios":[{"title":"...","situation":"...","optionA":"...","optionB":"..."},{"title":"...","situation":"...","optionA":"...","optionB":"..."}],"principles":["...","..."]}

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"). Speak directly and in the affirmative.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

export async function POST(request: Request) {
  let body: TradeOffsDraftInput;
  try {
    body = (await request.json()) as TradeOffsDraftInput;
  } catch {
    return Response.json({ seed: null });
  }

  const input: TradeOffsDraftInput = {
    userModel: typeof body.userModel === "string" ? body.userModel : "",
    onboarding: typeof body.onboarding === "string" ? body.onboarding : "",
    hasPartner: body.hasPartner === true,
    retirementStage: body.retirementStage ?? null,
    goals: Array.isArray(body.goals) ? body.goals : [],
    finance: body.finance ?? null,
    values: Array.isArray(body.values) ? body.values : [],
  };

  const goalBlock = input.goals.length
    ? input.goals
        .map((g, i) => {
          const kind =
            g.track === "be" ? "way to live" : "thing to do/achieve";
          const extras = [
            g.season && `season: ${g.season}`,
            g.note && `what it means to them: ${g.note}`,
          ]
            .filter(Boolean)
            .join("; ");
          return `${i + 1}. [${kind}] ${g.goal}${extras ? `\n   (${extras})` : ""}`;
        })
        .join("\n")
    : "(none spotlighted yet)";

  const valueBlock = input.values.length
    ? input.values
        .map((v) => `- ${v.value}${v.meaning ? ` — ${v.meaning}` : ""}`)
        .join("\n")
    : "(none captured)";

  const financeBlock = input.finance
    ? [
        input.finance.financesLevel &&
          `financial confidence: ${input.finance.financesLevel}`,
        input.finance.dateKnown &&
          `knows when financially ready: ${input.finance.dateKnown}`,
      ]
        .filter(Boolean)
        .join("; ")
    : "(no finance signal)";

  const context = [
    input.onboarding && input.onboarding.trim() && `ABOUT THEM:\n${input.onboarding.trim()}`,
    input.userModel && input.userModel.trim(),
    `THE GOALS THEY SPOTLIGHTED (ground the scenarios in these):\n${goalBlock}`,
    `THEIR FINANCE SIGNAL (only to judge whether a money trade-off is live — never to advise):\n${financeBlock}`,
    `THEIR CORE VALUES (the raw material for the decision principles):\n${valueBlock}`,
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

    return Response.json({ seed: coerceTradeOffs(JSON.parse(slice), input) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[trade-offs] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[trade-offs] Unexpected error:", error);
    }
    // Recoverable processing failure — signal it so the client retries rather than
    // settling on the generic fallback.
    return Response.json({ seed: null });
  }
}
