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
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const apiMessages = toApiMessages(body.messages);
  const encoder = new TextEncoder();

  // Stream the reply as plain-text deltas so the client can render Vita's words
  // as they arrive (~1s to first token) rather than waiting for the whole
  // completion. The system prompt is large and identical across every turn of one
  // conversation, so we mark it cacheable — Anthropic reuses the cached copy on
  // later turns instead of re-reading the whole prompt (cheaper and faster). If
  // the model call fails (bad key, rate limit, overload after retries), we error
  // the stream so the client falls back exactly as it did before.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = anthropic.messages.stream({
          model: COACH_MODEL,
          max_tokens: COACH_MAX_TOKENS,
          system: [
            {
              type: "text",
              text: buildSystemPrompt(body),
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: apiMessages,
        });

        run.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        const final = await run.finalMessage();
        console.log(
          `[chat] ok — cache_read=${final.usage.cache_read_input_tokens ?? 0} ` +
            `cache_write=${final.usage.cache_creation_input_tokens ?? 0} ` +
            `input=${final.usage.input_tokens} output=${final.usage.output_tokens}`
        );
        controller.close();
      } catch (error) {
        // Surface the real reason in the server logs so we can diagnose failures
        // instead of a silent break.
        if (error instanceof Anthropic.APIError) {
          console.error(
            `[chat] Anthropic API error — status=${error.status} ` +
              `name=${error.name} message=${error.message}`
          );
        } else {
          console.error("[chat] Unexpected error:", error);
        }
        // Errors the stream: the client's reader rejects, and the caller rolls
        // back (send) or falls back to the fixed opening line.
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
