import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";
import {
  FALLBACK_STAGE3_SYNTHESIS,
  type Stage3Synthesis,
} from "@/lib/stage3Reveal";

// The generation interface for the Stage 3 (Understand) stage-close reveal. The
// client reads the person's confirmed Stage 3 builds and passes the raw material:
// their signature strengths, their core values with the wording they chose, the
// protectors they set, the live fears they named, and their closing passage. This
// call writes ONLY the connective and characterising copy — the profiles, the
// through-line, the forward lines, and a tightened meaning statement. The
// person's own words (strength labels, the top value's wording, the other core
// values) are placed by THIS route, verbatim, never reworded by the model.
//
// Anything malformed falls back to a safe, generic reveal (never persisted by the
// client), so the screen always renders.

type Stage3RevealRequest = {
  name?: string | null;
  // 3.1 — the signature strengths (label + an optional grounding note), and the
  // wider set they kept (context only).
  signatureStrengths?: { label: string; note?: string }[];
  keptStrengths?: string[];
  // 3.2–3.4 — the core values, most important first, each with the description
  // the person wrote in their own words.
  coreValues?: { value: string; meaning?: string }[];
  // 3.4 — the protectors they committed to.
  protectors?: string[];
  // 3.5 — the live fears they named (the ones on their mind or newly recognised).
  liveFears?: string[];
  // 3.6 — their closing passage on what these years are for.
  meaningPassage?: string;
};

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

const SYSTEM_PROMPT = `You are Vita, an AI retirement coach, writing the closing reveal for the Understand stage — a short sequence of cards that shows someone the shape of what they confirmed about themselves: their strengths, their values, a thread that runs through it all, what they'll protect, the worries they named honestly, and what these years are for.

You write ONLY the connective and characterising copy listed below. The person's own words — their strength labels, the wording of their top value, and their other core values — are placed by the system, verbatim, exactly as they wrote them. Never restate, reword, or list those yourself.

Write these fields, all in the second person ("you"/"your"), warm, specific, plain, British English:

- opener: ONE sentence framing what follows — name in broad terms what they worked out across this stage (the strengths they will carry forward, the values they want to live by, and what matters most to them in this chapter) and lead into what they're about to see. Do NOT greet them and do NOT use their name: the system adds "That's the understanding done, [name]." in front of your sentence, so yours must read on naturally from that. End on an em dash. Do not list the cards or give away the findings.
- strengthsProfile: ONE short line naming the SHAPE their signature strengths make together (for example, energy + people + steady judgement becomes "Energy and people, with a steady head underneath"). Recognition of who they are, never a ranking, never a score. Do not simply list the strengths.
- strengthsCarry: one sentence on how those strengths carry into retirement, grounded in what they told you.
- valuesProfile: ONE short line naming the shape their core values make together (closeness, openness, and so on). Recognition, not ranking.
- valuesBreadth: one sentence on the breadth of the life those values are already shaping — about breadth, not specific commitments.
- throughLine: if ONE theme recurs across at least three of {their strengths, their values, their fears, what these years are for}, name it in one word or a short phrase (for example "Aliveness"). If no single thread is clear, return "".
- throughLineTrace: one sentence tracing that thread through their own material. Return "" if throughLine is "".
- protect: one forward-leaning sentence on what they've already named they'll guard, drawn from their protectors.
- clearEyed: name the harder parts they didn't look away from — briefly, honestly, and answered by their own agency (naming them is what lets the plan answer them; they already know which anchors hold them off). Two sentences at most. Never grim, never the last word.
- chapterTitle: if their material earns it, a short evocative name for this chapter, drawn from their own words and meaning (for example "Really living — right to the end"). Never a generic archetype, never glib. If it isn't clearly earned, return "".
- meaning: their closing passage, tightened into two or three sentences for the final card. Stay inside their wording — only condense; never add an idea they did not write. If they wrote nothing usable, return "".

Voice rules (absolute):
- Never use these words: reflect, explore, unpack, journey, growth, share, deep dive.
- Never say "that's wonderful", "great answer", "I hear you", "let's explore that together".
- Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".
- No scores, percentages, comparisons, or ranking of any kind.
- Keep the fears dignified and forward — never amplify a worry into a headline.

Respond with ONLY a JSON object, no markdown, no preamble, in exactly this shape:
{"opener":"...","strengthsProfile":"...","strengthsCarry":"...","valuesProfile":"...","valuesBreadth":"...","throughLine":"...","throughLineTrace":"...","protect":"...","clearEyed":"...","chapterTitle":"...","meaning":"..."}`;

function buildUserContent(body: Stage3RevealRequest): string {
  const sections: string[] = [];

  if (body.name) sections.push(`This person's name is ${body.name}.`);

  const strengths = body.signatureStrengths ?? [];
  if (strengths.length) {
    const lines = strengths
      .map((s) =>
        s.note ? `- ${s.label} (${s.note})` : `- ${s.label}`
      )
      .join("\n");
    sections.push(`Their signature strengths (their own labels):\n${lines}`);
  }
  if (body.keptStrengths?.length) {
    sections.push(`Other strengths they kept: ${body.keptStrengths.join(", ")}.`);
  }

  const values = body.coreValues ?? [];
  if (values.length) {
    const lines = values
      .map((v) =>
        v.meaning ? `- ${v.value}: "${v.meaning}"` : `- ${v.value}`
      )
      .join("\n");
    sections.push(
      `Their core values, most important first, with the wording they chose:\n${lines}`
    );
  }

  if (body.protectors?.length) {
    sections.push(
      `What they've decided to protect:\n${body.protectors
        .map((p) => `- ${p}`)
        .join("\n")}`
    );
  }

  if (body.liveFears?.length) {
    sections.push(
      `The worries they named honestly:\n${body.liveFears
        .map((f) => `- ${f}`)
        .join("\n")}`
    );
  }

  if (body.meaningPassage?.trim()) {
    sections.push(
      `What they wrote about what these years are for:\n"${body.meaningPassage.trim()}"`
    );
  }

  return sections.length
    ? `Here is what this person confirmed across the Understand stage:\n\n${sections.join(
        "\n\n"
      )}`
    : "This person did not leave much material — keep the copy gentle and generic.";
}

// Assemble the synthesis from the model's generated copy + the person's own words
// echoed verbatim from the request. The opener and meaning anchor it: if the model
// produced neither, treat the whole thing as failed.
function assembleSynthesis(
  raw: unknown,
  body: Stage3RevealRequest
): Stage3Synthesis | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const str = (k: string): string =>
    typeof obj[k] === "string" ? (obj[k] as string).trim() : "";

  const opener = str("opener");
  if (!opener) return null;

  const strengthsChips = (body.signatureStrengths ?? [])
    .map((s) => s.label.trim())
    .filter(Boolean);
  const values = body.coreValues ?? [];
  const valuesTop = values[0]?.meaning?.trim() ?? "";
  const valuesChips = values
    .slice(1)
    .map((v) => v.value.trim())
    .filter(Boolean);

  return {
    opener,
    strengthsProfile: str("strengthsProfile"),
    strengthsCarry: str("strengthsCarry"),
    strengthsChips,
    valuesProfile: str("valuesProfile"),
    valuesBreadth: str("valuesBreadth"),
    valuesTop,
    valuesChips,
    throughLine: str("throughLine"),
    throughLineTrace: str("throughLineTrace"),
    protect: str("protect"),
    clearEyed: str("clearEyed"),
    chapterTitle: str("chapterTitle"),
    meaning: str("meaning") || body.meaningPassage?.trim() || "",
  };
}

export async function POST(request: Request) {
  let body: Stage3RevealRequest;
  try {
    body = (await request.json()) as Stage3RevealRequest;
  } catch {
    return Response.json(FALLBACK_STAGE3_SYNTHESIS);
  }

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1100,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(body) }],
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

    const assembled = assembleSynthesis(JSON.parse(slice), body);
    return Response.json(assembled ?? FALLBACK_STAGE3_SYNTHESIS);
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[stage3-reveal] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[stage3-reveal] Unexpected error:", error);
    }
    return Response.json(FALLBACK_STAGE3_SYNTHESIS);
  }
}
