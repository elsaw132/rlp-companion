import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  toApiMessages,
  COACH_MODEL,
  COACH_MAX_TOKENS,
  type ChatRequest,
} from "@/lib/chatPrompt";

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

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;

  const apiMessages = toApiMessages(body.messages);

  try {
    const response = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: COACH_MAX_TOKENS,
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
