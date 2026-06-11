import Anthropic from "@anthropic-ai/sdk";

type IncomingMessage = {
  role: "coach" | "user";
  text: string;
};

type TakeawayRequest = {
  // The module's full conversation, in order.
  messages: IncomingMessage[];
  // The module's title, for context in the summary instruction.
  moduleTitle: string;
  // A readable summary of whatever they built in the interaction step, if any.
  interactionSummary?: string;
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are summarising one module of a guided retirement life-planning programme. The transcript below is a conversation between a coach (Vita) and a person. The summary is used in two ways: it is carried into later modules so the coach can draw on the whole picture, and a version of it is read back to the person on their home screen. It also seeds the person's Retirement Life Plan.

Write 2 to 4 sentences capturing what matters to this person and what emerged in this module — the substance, not the coaching. Plain, warm, and specific to what they actually said. No preamble, no headings, no quotation marks, no advice — just the summary sentences. Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that") — write directly, confidently, and entirely in the affirmative. Never use the word "genuinely".

Produce the summary in two grammatical persons. The content and tone must be identical — only the person differs:
- "thirdPerson": written in the third person ("they"/"their").
- "secondPerson": written in the second person, addressing the person directly ("you"/"your").

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"thirdPerson": "...", "secondPerson": "..."}

Example:
{"thirdPerson": "They pictured a family-centred day built around a morning run, time with grandkids, and an evening with their partner. What matters most is being a steady, everyday presence for family, at an unhurried pace.", "secondPerson": "You pictured a family-centred day built around a morning run, time with grandkids, and an evening with your partner. What matters most is being a steady, everyday presence for family, at an unhurried pace."}`;

// Pull the first {...} object out of the model's reply, in case it wraps the
// JSON in prose or a code fence.
function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

// Mechanical third-to-second person swap, used only as a fallback when the model
// doesn't return clean JSON. "They" and "you" share verb forms in English, so a
// pronoun-only swap stays grammatical for these short summaries.
function toSecondPerson(text: string): string {
  const map: Record<string, string> = {
    "they've": "you've",
    "they're": "you're",
    "they'd": "you'd",
    "they'll": "you'll",
    they: "you",
    their: "your",
    theirs: "yours",
    themselves: "yourself",
    them: "you",
  };
  return text.replace(
    /\b(They've|They're|They'd|They'll|They|Their|Theirs|Themselves|Them|they've|they're|they'd|they'll|they|their|theirs|themselves|them)\b/g,
    (m) => {
      const repl = map[m.toLowerCase()] ?? m;
      return /^[A-Z]/.test(m) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
    }
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as TakeawayRequest;

  const transcript = body.messages
    .map((m) => `${m.role === "coach" ? "Vita" : "Them"}: ${m.text}`)
    .join("\n");

  const built =
    body.interactionSummary && body.interactionSummary.trim()
      ? `What they built in this module:\n${body.interactionSummary.trim()}\n\n`
      : "";

  const userContent = `Module: ${body.moduleTitle}\n\n${built}Conversation transcript:\n${transcript}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  let takeaway = "";
  let takeawayDirect = "";
  try {
    const parsed = JSON.parse(extractJsonObject(rawText)) as {
      thirdPerson?: string;
      secondPerson?: string;
    };
    takeaway = (parsed.thirdPerson ?? "").trim();
    takeawayDirect = (parsed.secondPerson ?? "").trim();
  } catch {
    // Model didn't return clean JSON — treat the whole reply as the third-person
    // summary and derive the direct version mechanically.
    takeaway = rawText;
    takeawayDirect = toSecondPerson(rawText);
  }
  if (!takeaway) takeaway = rawText;
  if (!takeawayDirect) takeawayDirect = toSecondPerson(takeaway);

  return Response.json({ takeaway, takeawayDirect });
}
