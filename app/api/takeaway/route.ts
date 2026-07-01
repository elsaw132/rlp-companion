import Anthropic from "@anthropic-ai/sdk";
import { buildTakeaway, type TakeawayRequest } from "@/lib/takeawayPrompt";

// The retry path can make two sequential model calls, so give the function more
// headroom than the default to avoid a mid-flight cut-off.
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Summarise one module's conversation AND extract the context-profile fact
// deltas. The generation + truncation-hardening lives in lib/takeawayPrompt.ts
// (shared, unit-tested); the route is just request/response plumbing.
export async function POST(request: Request) {
  const body = (await request.json()) as TakeawayRequest;
  const result = await buildTakeaway(anthropic, body);
  return Response.json(result);
}
