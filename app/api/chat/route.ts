import Anthropic from "@anthropic-ai/sdk";
import { COACH_BASE_PROMPT } from "@/lib/coachBasePrompt";

type IncomingMessage = {
  role: "coach" | "user";
  text: string;
};

type ChatRequest = {
  messages: IncomingMessage[];
  coachOpening: string;
  sessionInstructions: string;
  onboardingContext: string;
  priorReflections: string;
  sessionContent: string;
  // A readable summary of whatever the person built in this module's
  // interaction step (e.g. the day builder). Empty/omitted when the module
  // has no interaction.
  interactionSummary?: string;
  // True only for the one call that generates Vita's first message, where she
  // opens by reacting to what they built rather than using a fixed line.
  isOpening?: boolean;
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(body: ChatRequest): string {
  const filled = COACH_BASE_PROMPT.replace(
    "{onboardingContext}",
    body.onboardingContext
  )
    .replace("{priorReflections}", body.priorReflections)
    .replace("{sessionContent}", body.sessionContent);

  const sections = [
    filled,
    "",
    "THIS MODULE'S INSTRUCTIONS",
    body.sessionInstructions,
  ];

  if (body.interactionSummary && body.interactionSummary.trim()) {
    sections.push("", "WHAT THEY BUILT IN THIS MODULE:", body.interactionSummary);
  }

  if (body.isOpening) {
    sections.push(
      "",
      "This is the very start of the conversation, and you are speaking first. Open with a short, warm first message and ask one question — no greeting, no preamble, no welcome. If this module had a build step, react to something specific in what they made (under WHAT THEY BUILT above). Otherwise, open by gently drawing on the picture they've built in earlier modules where it's relevant — following this module's own brief and tone. Engage directly; don't recap everything back to them."
    );
    return sections.join("\n");
  }

  sections.push(
    "",
    "CLOSING THIS MODULE — TWO STEPS. When you're ready to close, first offer your wrap-up: name what matters in their words and check it feels right to them. This message asks a question (does this land? anything to add?), so it must NOT contain the marker. Then, only after they respond, send a brief final sign-off that points to the next module, asks nothing at all, and ends with [[MODULE_COMPLETE]] on its own line with nothing after it. Never put [[MODULE_COMPLETE]] on any message that asks a question. Only ever include the marker in that one final sign-off."
  );

  sections.push(
    "",
    "You have already opened this conversation by saying, word for word:",
    `"${body.coachOpening}"`
  );

  return sections.join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;

  // The Messages API requires the list to start with a user turn. Vita's
  // opening already lives in the system prompt, so drop everything up to the
  // user's first real reply, then map our bubble roles onto API roles.
  const firstUserIndex = body.messages.findIndex((m) => m.role === "user");
  const exchanges =
    firstUserIndex === -1 ? [] : body.messages.slice(firstUserIndex);

  const apiMessages = exchanges.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: buildSystemPrompt(body),
    messages: apiMessages,
  });

  const reply = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return Response.json({ reply });
}
