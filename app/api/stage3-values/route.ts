import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";
import type { Stage3Value } from "@/lib/stage3Seed";

// Synthesises the person's confirmed values at the close of the Understand
// stage into the small set that becomes the heart of their plan. Reads the
// structured Stage 3 builds (their value triage, ranking, and definitions) plus
// the closing conversation, and returns up to five values — each with a short
// personal meaning in their own words and how settled it feels. On any failure
// it returns an empty list; the client falls back to assembling from the builds.

type IncomingMessage = {
  role: "coach" | "user";
  text: string;
};

type ValuesRequest = {
  // The final Understand-stage conversation, in order.
  messages: IncomingMessage[];
  // A terse readable summary of what they built across Stage 3 (triage trays,
  // ranking, and value definitions), so the model maps the conversation back
  // onto their real picks rather than inventing values.
  valuesContext: string;
};

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

const SYSTEM_PROMPT = `You are closing out the "Understand" stage of a guided retirement life-planning programme. The person has worked through their strengths, sorted their values, weighed them against each other, and put their top values into their own words. Your job is to produce the small set of values that matters most to them — the ones to carry into the rest of their plan.

Work ONLY from what this person actually told you — their picks and their words. Never invent a value they didn't name.

Return up to FIVE values (fewer is fine — most people live by a handful). For each:
- "value": the value label, sentence case, one or two words.
- "meaning": a short personal definition in THEIR terms, lower case, no full stop. Drawn from how they defined or described it; never a textbook line.
- "confidence": "certain" if they clearly claimed it as theirs, or "still forming" if they were unsure or still weighing it. Keep still-forming values in — they belong in the picture.

Order them most important first, following the ranking they gave where there is one.

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive.
- Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"values":[{"value":"...","meaning":"...","confidence":"certain"}, ...]}`;

function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

export async function POST(request: Request) {
  let body: ValuesRequest;
  try {
    body = (await request.json()) as ValuesRequest;
  } catch {
    return Response.json({ values: [] });
  }

  const transcript = (body.messages ?? [])
    .map((m) => `${m.role === "coach" ? "Vita" : "Them"}: ${m.text}`)
    .join("\n");

  const userContent = `What they built in the Understand stage:\n${
    body.valuesContext?.trim() || "(nothing captured)"
  }\n\nClosing conversation:\n${transcript || "(no conversation)"}`;

  let values: Stage3Value[] = [];
  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed = JSON.parse(extractJsonObject(rawText)) as {
      values?: { value?: string; meaning?: string; confidence?: string }[];
    };
    values = (parsed.values ?? [])
      .filter((v) => v && typeof v.value === "string" && v.value.trim())
      .slice(0, 5)
      .map((v) => ({
        value: v.value!.trim(),
        meaning: (v.meaning ?? "").trim(),
        confidence:
          v.confidence === "still forming" ? "still forming" : "certain",
      }));
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[stage3-values] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[stage3-values] Unexpected error:", error);
    }
  }

  return Response.json({ values });
}
