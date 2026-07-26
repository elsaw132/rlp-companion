import Anthropic from "@anthropic-ai/sdk";
import { draftGoalsFromThreads, coverageGaps } from "@/lib/goalDraft";
import { mustCoverThreads, type GoalThread } from "@/lib/goalThreads";
import type { FactCategory } from "@/lib/contextFacts";

// Module 4.3 goal drafting (the rework). The client assembles the person's
// de-duplicated thread pool (lib/goalThreads.ts) and posts it here; one Claude call
// drafts one goal per stated want plus the real commitments in the pool — originals
// only, gentler/bolder generated later per goal (see /api/goal-variants). Coverage is
// checked here as a runtime gate: if the first draft drops a stated want, we retry
// once. Anything that goes wrong returns a null seed — never a generic set — so the
// surface shows an honest "something went wrong" state.

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function sanitizeThreads(raw: unknown): GoalThread[] {
  if (!Array.isArray(raw)) return [];
  const out: GoalThread[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    out.push({
      label,
      category: (typeof o.category === "string" ? o.category : "aspiration") as FactCategory,
      provenanceModule: typeof o.provenanceModule === "string" ? o.provenanceModule : "",
      mustCover: o.mustCover === true,
    });
  }
  return out;
}

export async function POST(request: Request) {
  let threads: GoalThread[] = [];
  let onboarding = "";
  try {
    const body = (await request.json()) as { threads?: unknown; onboarding?: unknown };
    threads = sanitizeThreads(body.threads);
    onboarding = typeof body.onboarding === "string" ? body.onboarding : "";
  } catch {
    return Response.json({ seed: null });
  }

  // Goals must be grounded in real threads — never draft from nothing.
  if (threads.length === 0) return Response.json({ seed: null });

  const must = mustCoverThreads(threads);
  let goals = await draftGoalsFromThreads(anthropic, threads, { onboarding });

  // Runtime coverage gate: if the first draft dropped a stated want, retry once and
  // keep whichever covers more. (Live-tested at 0 gaps, so this rarely fires.)
  if (goals && coverageGaps(must, goals).length > 0) {
    const retry = await draftGoalsFromThreads(anthropic, threads, { onboarding });
    if (retry && coverageGaps(must, retry).length < coverageGaps(must, goals).length) {
      goals = retry;
    }
  }

  if (!goals) return Response.json({ seed: null });
  return Response.json({ seed: { suggestions: goals } });
}
