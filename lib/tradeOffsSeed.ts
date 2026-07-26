// Module 4.5 ("When you can't do it all") drafting contract.
//
// Vita drafts a few CONCRETE trade-off scenarios out of the person's emerging
// plan — their spotlighted goals (from 4.3) and their finance-confidence signal
// (from 4.1) — plus a few candidate decision principles. The person then curates
// all of it: on each scenario they place where they lean and note what they'd
// protect / what would be too great a sacrifice; they sort their core values
// (from Stage 3) into non-negotiable vs flexible; and they shape the principles.
// One structured Claude call (/api/trade-offs) returns the scenarios and the
// candidate principles. The core values are never invented — they pass straight
// through from Stage 3. Anything that goes wrong falls back to grounded generic
// scenarios so the surface always renders.

import type {
  BalancedGoalsResult,
  ReadinessSnapshotResult,
} from "@/lib/modules";
import type { Stage3ValuesSummary } from "@/lib/stage3Seed";
import type { RetirementStage } from "@/lib/userData";
import type { StoredFact } from "@/lib/contextFacts";
import { coreValuesFromFacts } from "@/lib/resolverInputs";
import { fetchSeedWithRetry } from "@/lib/seedRetry";

// One drafted trade-off — the framing only. The person supplies where they lean
// and the two free-text answers on the surface.
export type TradeOffScenario = {
  title: string;
  situation: string;
  optionA: string;
  optionB: string;
};

export type TradeOffsSeed = {
  scenarios: TradeOffScenario[];
  // The person's core values, passed through from Stage 3 for the sort.
  values: string[];
  // Candidate decision principles for the person to shape.
  principles: string[];
};

// One spotlighted goal, as the draft sees it — context for grounding scenarios.
export type TradeOffGoal = {
  goal: string;
  track: "do" | "be";
  note?: string;
  season?: string;
};

// The finance-confidence signal from 4.1: how ready finances feel, and whether
// they know their financial-readiness date. Used only to decide whether a money
// trade-off is live — never to advise.
export type FinanceSignal = {
  financesLevel?: string;
  dateKnown?: string;
};

// One core value, as the draft sees it.
export type ValueInput = {
  value: string;
  meaning?: string;
  confidence?: string;
};

// The picture the draft is built from. Assembled by the caller.
export type TradeOffsDraftInput = {
  userModel: string;
  onboarding: string;
  hasPartner: boolean;
  // Where they are with work and retirement, or null when uncaptured. Carried on
  // the same rail as hasPartner for later phases; nothing branches on it yet.
  retirementStage: RetirementStage | null;
  goals: TradeOffGoal[];
  finance: FinanceSignal | null;
  values: ValueInput[];
};

// ---- Pull the inputs out of the earlier modules' saved results ----

// The goals the person spotlighted in 4.3, in rank order. These ground the
// concrete scenarios so the dilemmas are about their real plan.
export function tradeOffGoalInputs(
  prior: BalancedGoalsResult | null
): TradeOffGoal[] {
  if (!prior || !Array.isArray(prior.goals)) return [];
  return prior.goals
    .filter((g) => g.focus && typeof g.label === "string" && g.label.trim())
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((g) => ({
      goal: g.label.trim(),
      track: g.track === "be" ? "be" : "do",
      ...(g.note ? { note: g.note } : {}),
      ...(g.season ? { season: g.season } : {}),
    }));
}

// The finance-confidence signal from 4.1's readiness snapshot, or null.
export function financeSignal(
  prior: ReadinessSnapshotResult | null
): FinanceSignal | null {
  if (!prior) return null;
  const finances = Array.isArray(prior.factors)
    ? prior.factors.find((f) => f.id === "finances")
    : undefined;
  const financesLevel = finances?.level;
  const dateKnown = prior.finance?.dateKnown;
  if (!financesLevel && !dateKnown) return null;
  return {
    ...(financesLevel ? { financesLevel } : {}),
    ...(dateKnown ? { dateKnown } : {}),
  };
}

// The person's confirmed Stage 3 values, for the sort.
export function valueInputs(
  summary: Stage3ValuesSummary | null
): ValueInput[] {
  if (!summary || !Array.isArray(summary.values)) return [];
  return summary.values
    .filter((v) => typeof v.value === "string" && v.value.trim())
    .map((v) => ({
      value: v.value.trim(),
      ...(v.meaning ? { meaning: v.meaning } : {}),
      ...(v.confidence ? { confidence: v.confidence } : {}),
    }));
}

// The person's core values, sourced from the CANONICAL value facts — their marked
// core-five (or all value facts if none flagged), ordered by their Stage-3 ranking,
// each in their VERBATIM own words. This is the source of truth for the sort: the
// old path read the `stage3-values` summary, which is an AI re-distillation that can
// drop marked-core values (e.g. Family) in favour of AI-picked ones (e.g. Reliability).
export function coreValueInputs(facts: StoredFact[]): ValueInput[] {
  return coreValuesFromFacts(facts).map((v) => ({
    value: v.value,
    ...(v.meaning ? { meaning: v.meaning } : {}),
    ...(v.confidence ? { confidence: v.confidence } : {}),
  }));
}

// Call the drafting route. Returns the drafted seed, or null on any failure so
// the caller can fall back. Shared so the surface and an earlier prefetch use
// exactly the same request.
export async function fetchTradeOffsDraft(
  input: TradeOffsDraftInput
): Promise<TradeOffsSeed | null> {
  return fetchSeedWithRetry<TradeOffsSeed>(
    "/api/trade-offs",
    input,
    (s) => s.scenarios.length > 0
  );
}

// ---- Coercion ----
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function coerceScenario(raw: unknown): TradeOffScenario | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const situation = str(o.situation);
  const optionA = str(o.optionA);
  const optionB = str(o.optionB);
  if (!situation || !optionA || !optionB) return null;
  return {
    title: str(o.title) || "A trade-off to weigh",
    situation,
    optionA,
    optionB,
  };
}

// Clean a list of short strings into a capped, trimmed array.
function coerceStrings(raw: unknown, cap: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = str(item);
    if (s) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

// Validate and clean whatever the model returned into the seed shape. The model
// supplies the scenarios and the candidate principles; the core values always come
// straight from Stage 3 (never invented), so they're taken from the input. Returns
// null when the model produced no usable scenario — an empty/failed draft — so the
// caller fails honestly rather than showing a generic set of trade-offs as theirs.
export function coerceTradeOffs(
  raw: unknown,
  input: TradeOffsDraftInput
): TradeOffsSeed | null {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const scenarios: TradeOffScenario[] = [];
  if (Array.isArray(obj.scenarios)) {
    for (const s of obj.scenarios) {
      const cleaned = coerceScenario(s);
      if (cleaned) scenarios.push(cleaned);
      if (scenarios.length >= 3) break;
    }
  }
  if (scenarios.length === 0) return null;

  const principles = coerceStrings(obj.principles, 4);

  return {
    scenarios,
    // The core values come straight from Stage 3 (real, verbatim), never invented.
    values: (input.values ?? []).map((v) => v.value).filter(Boolean),
    // Never fabricate the person's principles ("When something has to give, I
    // protect the people I love…"). If the model gave none, leave them blank for
    // the person to write rather than inventing them.
    principles,
  };
}
