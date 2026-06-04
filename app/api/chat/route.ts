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
  // Set for the single turn right after the person re-opened the interaction
  // and saved changed picks: a one-off instruction telling Vita to acknowledge
  // the change once and carry on. Empty/omitted otherwise.
  editAcknowledgement?: string;
};

// Give the serverless function more headroom than the default so a slow model
// response doesn't get cut off mid-flight.
export const maxDuration = 30;

// maxRetries (default is 2) makes the SDK automatically retry transient
// failures — rate limits (429) and Anthropic-side overload (529/5xx) — with
// exponential backoff, before giving up and throwing.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

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

  if (body.editAcknowledgement && body.editAcknowledgement.trim()) {
    sections.push("", body.editAcknowledgement);
  }

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

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      // The system prompt is large and identical across every turn of one
      // conversation, so we mark it cacheable. Anthropic reuses the cached
      // copy on later turns instead of re-reading the whole prompt — cheaper
      // and faster. Check usage.cache_read_input_tokens to confirm it's hitting.
      system: [
        {
          type: "text",
          text: buildSystemPrompt(body),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: apiMessages,
    });

    console.log(
      `[chat] ok — cache_read=${response.usage.cache_read_input_tokens ?? 0} ` +
        `cache_write=${response.usage.cache_creation_input_tokens ?? 0} ` +
        `input=${response.usage.input_tokens} output=${response.usage.output_tokens}`
    );

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return Response.json({ reply });
  } catch (error) {
    // Surface the real reason in the server logs so we can diagnose failures
    // (bad/missing API key, rate limit, overload, etc.) instead of a silent 500.
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[chat] Anthropic API error — status=${error.status} ` +
          `name=${error.name} message=${error.message}`
      );
    } else {
      console.error("[chat] Unexpected error:", error);
    }

    return Response.json(
      { error: "Failed to reach the coach. Please try again in a moment." },
      { status: 500 }
    );
  }
}
