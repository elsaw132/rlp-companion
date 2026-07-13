import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";

type ReviewRequest = {
  // Who the letter is addressed to, in the words shown to the user.
  recipientLabel: string;
  // The letter the person wrote.
  body: string;
  // When true, the person has already taken one enrichment pass — Vita must
  // simply acknowledge warmly and never ask for more. Enforces the
  // at-most-one-pass rule from the module spec.
  final?: boolean;
};

// rich=true means the letter is full enough to leave as it is — `message` is a
// warm acknowledgement. rich=false means it's a little thin — `message` is one
// gentle, specific nudge to add descriptive texture.
type ReviewResult = { rich: boolean; message: string };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Used if the model call fails — never trap the person in the review step.
const FALLBACK_ACK =
  "That's a real picture of a life — thank you for writing it down. It'll sit right at the heart of everything you've imagined.";

const SYSTEM_PROMPT = `You are Vita, a warm AI coach in a retirement life-planning programme. The person has just written a short letter to someone in their life, set a good way into their retirement, describing what life looks like now. They've saved it, and you read it.

Decide one thing: is the letter rich enough to leave as it is, or is it a little thin — short or vague enough that one small, specific addition would bring it to life?

- If it's rich enough: acknowledge it warmly and specifically, naming something real from what they wrote. One or two sentences. Set "rich" to true.
- If it's thin: offer exactly ONE gentle nudge — reference something they actually wrote and ask for a little more descriptive texture about it (what an ordinary morning looks like, who's there, what the room or the view is like). One or two sentences, ending in a single light question. Set "rich" to false.

Hard rules:
- Everything stays descriptive — a picture of life as it is now. Never ask what they learned, what they'd tell the person, what they'd do differently, or anything that tips into advice, appraisal, lessons, or legacy. That's for a later stage.
- Don't ask how they feel about retirement; don't reference hopes or fears.
- Never flatter emptily ("that's wonderful", "great"). Be specific to what's actually on the page.
- Plain, warm language. Never imply you're human.
- Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"rich": true, "message": "..."}`;

const FINAL_SYSTEM_PROMPT = `You are Vita, a warm AI coach in a retirement life-planning programme. The person wrote a short letter to someone in their life, set a good way into their retirement, describing what life looks like now — and has just added a little more to it. This is the end of the session; do not ask for anything further.

Acknowledge the letter warmly and specifically, naming something real from what they wrote. One or two sentences. Stay descriptive — never advice, lessons, appraisal, or legacy, and never ask how they feel about retirement. Never flatter emptily; be specific to what's on the page. Never imply you're human. Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that") — speak directly, confidently, and entirely in the affirmative. Never use the word "genuinely".

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"rich": true, "message": "..."}`;

function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

export async function POST(request: Request) {
  const body = (await request.json()) as ReviewRequest;

  const letter = (body.body ?? "").trim();
  // No letter at all — nothing to review; acknowledge and move on.
  if (!letter) {
    return Response.json({ rich: true, message: FALLBACK_ACK } satisfies ReviewResult);
  }

  const userContent = `The letter is written to: ${body.recipientLabel}\n\nThe letter:\n${letter}`;

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      system: body.final ? FINAL_SYSTEM_PROMPT : SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed = JSON.parse(extractJsonObject(rawText)) as Partial<ReviewResult>;
    const message = (parsed.message ?? "").trim();
    // A final pass is always an acknowledgement, never a nudge.
    const rich = body.final ? true : parsed.rich !== false;

    if (!message) {
      return Response.json({ rich: true, message: FALLBACK_ACK } satisfies ReviewResult);
    }
    return Response.json({ rich, message } satisfies ReviewResult);
  } catch {
    return Response.json({ rich: true, message: FALLBACK_ACK } satisfies ReviewResult);
  }
}
