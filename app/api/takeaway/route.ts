import Anthropic from "@anthropic-ai/sdk";
import { buildTakeaway, type TakeawayRequest } from "@/lib/takeawayPrompt";
import { reconcileMemory } from "@/lib/reconcilePrompt";

// The retry path can make two sequential model calls, so give the function more
// headroom than the default to avoid a mid-flight cut-off.
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Summarise one module's conversation AND extract the context-profile fact deltas.
// Two model calls run in parallel: buildTakeaway (summary + new material) and the
// dedicated reconcileMemory pass (corrections to EXISTING memory: revisions +
// removals), which the combined call reliably missed. The route merges them.
export async function POST(request: Request) {
  const body = (await request.json()) as TakeawayRequest;
  const [result, reconcile] = await Promise.all([
    buildTakeaway(anthropic, body),
    reconcileMemory(anthropic, { messages: body.messages, knownFacts: body.knownFacts ?? [] }),
  ]);

  // Corrections to existing memory come from the dedicated pass; new material
  // (additions + reasons) from the takeaway. Removals from both paths are merged
  // and de-duped by label so a fact is never dropped twice.
  const seen = new Set<string>();
  const removals = [...reconcile.removals, ...result.facts.removals].filter((r) => {
    const key = String((r as { label?: string }).label ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return Response.json({
    ...result,
    facts: {
      additions: result.facts.additions,
      reasons: result.facts.reasons,
      removals,
      revisions: reconcile.revisions,
    },
  });
}
