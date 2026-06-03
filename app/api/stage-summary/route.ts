import Anthropic from "@anthropic-ai/sdk";

type StageSummaryRequest = {
  // Each Stage 1 module's takeaway, in programme order.
  takeaways: { moduleTitle: string; text: string }[];
  // Optional note from the person about what didn't feel right in the first
  // version, used to regenerate. Empty/omitted on the first generation.
  whatIsOff?: string;
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are writing the Stage 1 picture for someone who has just imagined their retirement across six sessions. Using ONLY what this person has actually shared — their words, their specific details — write a warm, personal picture of the retirement they've begun to imagine. Cover the day they pictured, the roles they want to play, the rhythm of their week, what they're keeping and leaving behind, their hopes and fears, and the future self they described.

This is a STARTING picture, not a finished plan — vivid but provisional. Write it as a beginning they'll return to and adapt in later stages, not a conclusion. Do not imply it is complete, correct, or settled, and don't tie it up neatly; there is no pressure for it to be perfect.

Second person. 300–400 words. No headings. Plain language — their language, not generic retirement copy. A letter only this person could receive.

Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. No preamble, no greeting, no sign-off, no quotation marks — just the picture itself.`;

export async function POST(request: Request) {
  const body = (await request.json()) as StageSummaryRequest;

  const reflections = body.takeaways
    .filter((t) => t.text && t.text.trim())
    .map((t) => `- ${t.moduleTitle}: ${t.text.trim()}`)
    .join("\n");

  let userContent = `Here is everything this person shared across the six Imagine modules, in order:\n\n${reflections}`;

  if (body.whatIsOff && body.whatIsOff.trim()) {
    userContent += `\n\nThey read a first version of this picture and felt something wasn't quite right. In their words: "${body.whatIsOff.trim()}"\n\nWrite the picture again, taking this in so it feels more like them.`;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const summary = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return Response.json({ summary });
}
