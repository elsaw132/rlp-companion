import Anthropic from "@anthropic-ai/sdk";
import { draftGoalVariants } from "@/lib/goalDraft";

// On-demand gentler/bolder sizes for a single committed 4.3 goal. Called when a
// person dials a goal they've kept, so the up-front draft can stay originals-only.
// Best-effort: an empty response just means the dial shows fewer sizes.

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      label?: unknown;
      cadence?: unknown;
      source?: unknown;
    };
    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return Response.json({});
    const variants = await draftGoalVariants(anthropic, {
      label,
      cadence: typeof body.cadence === "string" ? body.cadence : undefined,
      source: typeof body.source === "string" ? body.source : undefined,
    });
    return Response.json(variants);
  } catch {
    return Response.json({});
  }
}
