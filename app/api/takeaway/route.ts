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

const SYSTEM_PROMPT = `You are summarising one module of a guided retirement life-planning programme. The transcript below is a conversation between a coach (Vita) and a person. Your summary is carried into later modules so the coach can draw on the whole picture, and it seeds the person's Retirement Life Plan.

Write 2 to 4 sentences, in the third person ("they"), capturing what matters to this person and what emerged in this module — the substance, not the coaching. Plain, warm, and specific to what they actually said. No preamble, no headings, no quotation marks, no advice — just the summary sentences.

Example of the shape: "They pictured a family-centred day built around a morning run, time with grandkids, and an evening with their partner. What matters most is being a steady, everyday presence for family, at an unhurried pace."`;

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

  const takeaway = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return Response.json({ takeaway });
}
