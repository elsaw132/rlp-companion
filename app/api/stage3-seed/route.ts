import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";
import {
  coerceSeed,
  isSeededType,
  FALLBACK_SEEDS,
  valueDefinitionsFallback,
  VIA_STRENGTHS,
  VALUE_SET,
  fearHorizonsFor,
  type Stage3Seed,
  type Stage3SeedType,
} from "@/lib/stage3Seed";
import type { RetirementStage } from "@/lib/userData";

// Pre-seeds a Stage 3 surface. The session container sends the module's seed
// type and the assembled context (onboarding + earlier reflections + a Stage 3
// carry-forward block + a terse summary of any earlier Stage 3 builds). One
// structured Claude call returns candidate content in the exact shape the
// surface needs. Anything that goes wrong falls back to a safe generic seed so
// the surface always renders with something on it.

type SeedRequest = {
  seedType: Stage3SeedType;
  onboardingContext: string;
  priorReflections: string;
  carryForward: string;
  // A terse, readable summary of what the person built in earlier Stage 3
  // modules (e.g. the values they confirmed in 3.2), so 3.3/3.4 seed from the
  // real picks rather than re-inferring them.
  priorBuilds: string;
  // The values the person actually chose in earlier Stage 3 work (ranking +
  // triage), sent so a failed AI seed can fall back to THEIR values on the
  // value-definitions surface rather than a generic stand-in they never picked.
  carryValues?: string[];
  // Whether the person flagged a partner at onboarding. Used by the hopes-fears
  // seed to keep partner-only worries out of the bank for someone planning alone.
  hasPartner?: boolean;
  // Where they are with work and retirement. Threaded on the same rail as
  // hasPartner for later phases (which reframe the "transition" fear horizon per
  // cohort); nothing branches on it yet.
  retirementStage?: RetirementStage | null;
};

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

// Per-type instructions: what to produce and the exact JSON shape to return.
const SEED_SPECS: Record<Stage3SeedType, string> = {
  "mirror-cards": `Choose the 4–6 STRENGTHS from the fixed list below that this person most clearly shows, based on what they shared. This is recognition against a known set — you must NOT invent strengths or reword the labels. Use each label EXACTLY as written here:
${VIA_STRENGTHS.map((s) => `- ${s}`).join("\n")}

For each strength you choose, give:
- "label": the strength, copied verbatim from the list above.
- "evidence": ONE short clause in plain language pointing to where it showed up in their own answers (e.g. "showed up when you talked about astronomy in Keeping Your Mind Alive"). Ground it in something they actually said; never invent specifics.
Pick only the ones with real grounding in their answers — a smaller honest set beats a padded one. JSON shape: {"cards":[{"label":"...","evidence":"..."}, ...]}`,
  "value-triage": `Choose up to 5 VALUES from the fixed list below that seem to matter most to this person, based on what they shared. This is recognition against a known set — you must NOT invent values or reword the labels, and you must NOT create a card for a domain or activity (e.g. never a "Home", "Garden", "Painting" or "Grandchildren" card). Map what they described to the value beneath it: a dream home with a vegetable patch points to Beauty or Creativity; painting or pottery points to Creativity or Achievement; being there for grandchildren points to Family or Connection. Use each label EXACTLY as written here:
${VALUE_SET.map((v) => `- ${v}`).join("\n")}

For each value you choose, give:
- "label": the value, copied verbatim from the list above.
- "evidence": ONE short clause in the person's own terms pointing to where it showed up in their answers — name the domain or activity it sits beneath (e.g. "the vegetable patch in your dream home", "the hours you pictured with the grandchildren"). Ground it in something they actually said; never invent specifics.
Choose distinct values with real grounding — a smaller honest set beats a padded one. JSON shape: {"cards":[{"label":"...","evidence":"..."}, ...]}`,
  "priority-choices": `Produce real either/or trade-offs built from THIS person's picture, plus the pool of values they're weighing. Each pair sets two truly appealing directions against each other in their own terms (e.g. "A free, unstructured week" vs "A week with people and plans in it"). Give:
- "pairs": 6–10 objects, each {"left":"...","right":"..."} — short, concrete, drawn from their answers, never abstract value names.
- "values": 3–6 short value labels these trade-offs are really about (e.g. Freedom, Connection, Growth).
JSON shape: {"pairs":[{"left":"...","right":"..."}, ...],"values":["...", ...]}`,
  "value-definitions": `For each of this person's CORE values — use the values they marked as most core in their earlier Stage 3 work (named in what they built); if none are clear, pick 3–5 that fit them — draft:
- "value": the value label.
- "description": the short personal description they already gave this value in the values session, copied in THEIR terms, lower case, no full stop (e.g. "choosing your own pace, not over-committing"). If they didn't describe it, write a brief one grounded in their picture — never invent specifics about their life.
- "threat": the SINGLE most likely SPECIFIC thing that would get in the way of living this value on a regular basis — a real, recognisable situation from THEIR own picture (a named commitment, person, habit, place, or pull on their time), not a vague drift or abstract erosion. ONE complete sentence beginning with a capital letter, honest not softened, naming the actual thing that would crowd it out. GOOD (specific, real): "Saying yes to every babysitting request until your own week has nothing left in it." TOO VAGUE (avoid): "The reliable presence you pictured quietly becomes occasional visits."
- "protectors": an array of exactly 3 DISTINCT candidate protectors — each a SIMPLE, concrete thing they could commit to as a regular part of their plan to keep the value alive (e.g. "Keeping one weekday morning free for the grandchildren"). Small enough to actually hold to week to week, drawn from their picture, and clearly different from each other so they're real choices. Do NOT make them grand resolutions, schedules, or multi-step plans.
Ground everything in their own picture. JSON shape: {"values":[{"value":"...","description":"...","threat":"...","protectors":["...","...","..."]}, ...]}`,
  "hopes-fears": `This surface has two parts: a short hopes line at the top, then candidate fear cards the person reacts to. Produce BOTH.

1. "hopes": ONE warm, plain sentence reflecting back what this person has been reaching for across the stage — drawn from THEIR own picture, values and strengths, confirmed not invented. It opens the surface as a gentle on-ramp before turning to worries. No list, no value names — their own terms (e.g. "More unhurried time with the people you love, and room to keep learning"). If their picture is too thin to do this honestly, return "".

2. "horizons": for EACH of the three horizons below, choose a MODERATE HANDFUL (3–4) of the worries most likely to be on THIS person's mind, drawn from the fixed bank for that horizon. This is recognition against a known set — copy the labels EXACTLY as written. The one exception: where their own picture gives a clear, specific hook, you may lightly personalise a single card to their situation (e.g. for a very physically active person, a specific version of "Declining health or energy" about not being able to keep that pace). Most cards will be set aside by the person — that's expected; choose the ones with the best chance of landing, not a padded set.

The three horizons and their banks:
__FEAR_BANK__

Return each horizon with its EXACT name from above and its chosen fears. JSON shape: {"hopes":"...","horizons":[{"horizon":"The transition","fears":["...","..."]},{"horizon":"Life in retirement","fears":["...","..."]},{"horizon":"The longer view","fears":["...","..."]}]}`,
  "bigger-picture": `Produce honest starting threads for a reflective passage about how this person lived these retirement years — written as opening lines they could pick up and continue, drawn from their strengths, values and relationships. Give:
- "threads": 3–5 short lines, each a true thread from their answers. Write every thread in the FIRST PERSON — "I"/"my" — as the start of a line the person could carry on in their own voice, looking back (e.g. "The grandchildren I showed up for, every Tuesday and Thursday", "The trips I kept booking", "The curiosity I never lost"). NEVER use the second person ("you"/"your"): the whole written piece is in their own "I", so a "you" thread would break the voice. Their own picture, never generic platitudes.
- "draft": leave as an empty string "" (they write their own).
JSON shape: {"threads":["..."],"draft":""}`,
};

// Output budget per surface. Most seeds are small, but value-definitions returns
// the largest payload by far — a description, a full-sentence threat, and three
// protectors for EACH of the person's values — so it needs a much bigger budget.
// At the old shared 900 cap it truncated mid-JSON every time (the response failed
// to parse and the surface silently fell back to generic content).
const MAX_TOKENS_BY_TYPE: Record<Stage3SeedType, number> = {
  "mirror-cards": 900,
  "value-triage": 900,
  "priority-choices": 1200,
  "value-definitions": 2000,
  "hopes-fears": 1200,
  "bigger-picture": 900,
};

function systemPrompt(
  seedType: Stage3SeedType,
  hasPartner: boolean,
  retirementStage: RetirementStage | null
): string {
  let spec = SEED_SPECS[seedType];
  if (seedType === "hopes-fears") {
    // Inject the fear bank, filtered to this person — a solo person never sees
    // the partner-only worries, so the model can't pick or personalise them.
    const bank = fearHorizonsFor(hasPartner, retirementStage)
      .map((h) => `${h.name}:\n${h.fears.map((f) => `  - ${f}`).join("\n")}`)
      .join("\n\n");
    spec = spec.replace("__FEAR_BANK__", bank);
  }
  return `You are preparing a pre-filled exercise surface for someone working through the "Understand" stage of a guided retirement life-planning programme. They have already imagined their retirement and explored it area by area. Work ONLY from what this person actually shared — their words, their specifics. Never invent facts about their life.

${spec}

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Evidence clauses are tentative observations, not verdicts.
- Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

export async function POST(request: Request) {
  let body: SeedRequest;
  try {
    body = (await request.json()) as SeedRequest;
  } catch {
    return Response.json({ seed: null });
  }

  const seedType = body.seedType;
  if (!seedType || !isSeededType(seedType)) {
    return Response.json({ seed: null });
  }

  const context = [
    body.onboardingContext && `ABOUT THEM:\n${body.onboardingContext}`,
    body.carryForward && body.carryForward.trim(),
    body.priorReflections &&
      body.priorReflections.trim() &&
      `WHAT THEY'VE WORKED THROUGH:\n${body.priorReflections.trim()}`,
    body.priorBuilds &&
      body.priorBuilds.trim() &&
      `WHAT THEY BUILT IN EARLIER UNDERSTAND SESSIONS:\n${body.priorBuilds.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // The safety-net seed for when the AI seed can't be used. For value-definitions
  // this is built from the person's OWN values (passed in carryValues) so a
  // failure shows their real values to fill in — never a stand-in they never
  // chose. Every other surface keeps its generic fallback.
  const fallbackSeed: Stage3Seed =
    seedType === "value-definitions"
      ? valueDefinitionsFallback(body.carryValues ?? [])
      : FALLBACK_SEEDS[seedType];

  // Nothing to work from — return the fallback rather than asking the model to
  // invent a life. Flagged so the client knows this isn't a real AI seed.
  if (!context.trim()) {
    return Response.json({ seed: fallbackSeed, fromFallback: true });
  }

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS_BY_TYPE[seedType],
      system: systemPrompt(
        seedType,
        body.hasPartner ?? false,
        body.retirementStage ?? null
      ),
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

    // coerceSeed returns the generic FALLBACK_SEEDS reference when the model's
    // output was unusable (empty/malformed). Detect that by identity so we can
    // swap in the person's-own-values fallback and flag it for the client.
    const coerced = coerceSeed(
      seedType,
      JSON.parse(slice),
      body.retirementStage ?? null
    );
    if (coerced === FALLBACK_SEEDS[seedType]) {
      return Response.json({ seed: fallbackSeed, fromFallback: true });
    }
    return Response.json({ seed: coerced, fromFallback: false });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[stage3-seed] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[stage3-seed] Unexpected error:", error);
    }
    return Response.json({ seed: fallbackSeed, fromFallback: true });
  }
}
