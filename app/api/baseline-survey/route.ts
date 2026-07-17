import { auth } from "@clerk/nextjs/server";
import { upsertBaselineSurvey } from "@/lib/db";

// Receives the one-time pilot baseline captured at the end of onboarding. The
// user id always comes from the authenticated Clerk session, never from client
// input. Like /api/module-feedback this sends NO email — it is research data
// read only through the admin portal. Every field is optional (each question
// can be skipped, and the flag-gated status/horizon steps may never be asked),
// so unusable values become null rather than rejecting the whole submission.

// The fixed feelings list ("select up to three"). Anything outside it is
// dropped, and the result is capped at three to match the survey's limit. Must
// stay in step with FEELINGS_OPTIONS in the onboarding form — an option missing
// here is silently discarded rather than stored.
const FEELINGS = new Set([
  "Excited",
  "Curious",
  "Hopeful",
  "Confident",
  "Relieved",
  "Settled",
  "Neutral",
  "Uncertain",
  "At a loose end",
  "Lonely",
  "Overwhelmed",
  "Anxious",
  "Avoiding thinking about it",
]);

function toFeelings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item === "string" && FEELINGS.has(item)) seen.add(item);
  }
  return Array.from(seen).slice(0, 3);
}

// How much non-financial retirement planning they've already done. Stored as the
// chosen label; anything outside the list (including a skip) becomes null.
const PRIOR_PLANNING = new Set([
  "Extensive",
  "Some",
  "A small amount",
  "Very little",
  "None at all",
]);

function toPriorPlanning(v: unknown): string | null {
  return typeof v === "string" && PRIOR_PLANNING.has(v) ? v : null;
}

// Planning confidence is the 1–5 scale, stored as an int. Anything else
// (including a skip) becomes null.
function toConfidence(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5
    ? v
    : null;
}

// A trimmed string capped at `max`, or null when empty/absent. Used for the
// free-text expectations and the (possibly self-described) gender value.
function toText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    gender?: unknown;
    feelings?: unknown;
    priorPlanning?: unknown;
    planningConfidence?: unknown;
    expectations?: unknown;
    dob?: unknown;
    partner?: unknown;
    retirementStage?: unknown;
    horizon?: unknown;
  };

  await upsertBaselineSurvey({
    userId,
    gender: toText(body.gender, 80),
    feelings: toFeelings(body.feelings),
    priorPlanning: toPriorPlanning(body.priorPlanning),
    planningConfidence: toConfidence(body.planningConfidence),
    expectations: toText(body.expectations, 2000),
    // Demographic snapshot — passed through from onboarding state, capped for
    // safety. Empty answers (skipped steps, flag off) arrive as "" → null.
    dob: toText(body.dob, 20),
    partner: toText(body.partner, 40),
    retirementStage: toText(body.retirementStage, 40),
    horizon: toText(body.horizon, 40),
  });

  return Response.json({ ok: true });
}
