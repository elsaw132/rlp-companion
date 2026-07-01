import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";
import { ARCHETYPES, DEFAULT_ARCHETYPE_ID } from "@/lib/archetypes";
import { FALLBACK_SYNTHESIS, type RevealSynthesis } from "@/lib/stageReveal";

// The synthesis interface for the Imagine stage-close reveal:
//   imagineInputs (the five module takeaways) -> { threads, archetypeId, whyYou }
// It's a single structured Claude call returning JSON. Generation quality is
// iterative, so anything that goes wrong (network, bad JSON, unknown id) falls
// back to a safe generic synthesis — the reveal must always render.

type StageRevealRequest = {
  // Each Stage 1 module's takeaway, in programme order.
  takeaways: { moduleTitle: string; text: string }[];
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const archetypeList = Object.values(ARCHETYPES)
  .map((a) => `- ${a.id}: ${a.name} — ${a.definition}`)
  .join("\n");

const SYSTEM_PROMPT = `You are synthesising the Imagine stage-close reveal for someone who has just imagined their retirement across five short modules. Work ONLY from what this person actually shared — their words, their specifics.

Produce three things:

1. THREADS — exactly three. Each thread is the thing they kept coming back to: a short synthesised theme label (3–5 words, sentence case, no full stop) and a VERBATIM quote pulled from their inputs (their own words, lightly trimmed to a phrase or sentence — never invented or paraphrased). Choose three distinct, telling threads.

2. ARCHETYPE — classify them into exactly one of these retirement types by id:
${archetypeList}
Optionally name a lighter secondary type id if their imagining clearly blends two; otherwise omit it. Never rank one type above another.

3. WHY YOU — one sentence (no leading capitalised label) tying the chosen type to their own inputs, drawn from their words. Lower-case start is fine; it follows "Why you:".

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive.
- Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".

Respond with ONLY a JSON object, no markdown, no preamble, in exactly this shape:
{"threads":[{"themeLabel":"...","quote":"..."},{"themeLabel":"...","quote":"..."},{"themeLabel":"...","quote":"..."}],"archetypeId":"one-of-the-ids","secondaryId":"optional-id-or-omit","whyYou":"..."}`;

function coerceSynthesis(raw: unknown): RevealSynthesis {
  if (!raw || typeof raw !== "object") return FALLBACK_SYNTHESIS;
  const obj = raw as Record<string, unknown>;

  const threads = Array.isArray(obj.threads)
    ? obj.threads
        .filter(
          (t): t is { themeLabel: string; quote: string } =>
            !!t &&
            typeof t === "object" &&
            typeof (t as { themeLabel?: unknown }).themeLabel === "string" &&
            typeof (t as { quote?: unknown }).quote === "string"
        )
        .slice(0, 3)
        .map((t) => ({ themeLabel: t.themeLabel.trim(), quote: t.quote.trim() }))
    : [];

  if (threads.length !== 3) return FALLBACK_SYNTHESIS;

  const archetypeId =
    typeof obj.archetypeId === "string" && obj.archetypeId in ARCHETYPES
      ? obj.archetypeId
      : DEFAULT_ARCHETYPE_ID;

  const secondaryId =
    typeof obj.secondaryId === "string" &&
    obj.secondaryId in ARCHETYPES &&
    obj.secondaryId !== archetypeId
      ? obj.secondaryId
      : undefined;

  const whyYou =
    typeof obj.whyYou === "string" && obj.whyYou.trim()
      ? obj.whyYou.trim()
      : FALLBACK_SYNTHESIS.whyYou;

  return { threads, archetypeId, secondaryId, whyYou };
}

export async function POST(request: Request) {
  let body: StageRevealRequest;
  try {
    body = (await request.json()) as StageRevealRequest;
  } catch {
    return Response.json(FALLBACK_SYNTHESIS);
  }

  const reflections = (body.takeaways ?? [])
    .filter((t) => t && t.text && t.text.trim())
    .map((t) => `- ${t.moduleTitle}: ${t.text.trim()}`)
    .join("\n");

  // No inputs to work from — give the generic reveal rather than asking Claude
  // to invent one.
  if (!reflections) return Response.json(FALLBACK_SYNTHESIS);

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 700,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is everything this person shared across the five Imagine modules, in order:\n\n${reflections}`,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    // Be tolerant of stray prose around the JSON object.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

    return Response.json(coerceSynthesis(JSON.parse(slice)));
  } catch {
    return Response.json(FALLBACK_SYNTHESIS);
  }
}
