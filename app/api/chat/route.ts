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
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(body: ChatRequest): string {
  const filled = COACH_BASE_PROMPT.replace(
    "{onboardingContext}",
    body.onboardingContext
  )
    .replace("{priorReflections}", body.priorReflections)
    .replace("{sessionContent}", body.sessionContent);

  return [
    filled,
    "",
    "THIS MODULE'S INSTRUCTIONS",
    body.sessionInstructions,
    "",
    "You have already opened this conversation by saying, word for word:",
    `"${body.coachOpening}"`,
  ].join("\n");
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
