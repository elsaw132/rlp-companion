// Module 4.3 goal-drafting types + client fetches (the rework).
//
// Goals are drafted from a deterministic thread pool (lib/goalThreads.ts) — one goal
// per stated want plus the real commitments in the pool. The initial draft returns
// originals only; the gentler/bolder sizes fetch per goal, on demand. There is NO
// generic fallback: on failure the fetch returns null and the surface shows an honest
// "something went wrong" state.

import type { GoalThread } from "@/lib/goalThreads";
import { fetchSeedWithRetry } from "@/lib/seedRetry";

// One intensity of a goal — a complete, standalone phrasing that reads clearly
// on its own. Each carries its own track and its own timing, so swapping to a
// bolder or quieter version changes the whole card, not just the wording.
export type GoalVariant = {
  // "do" is a thing to do or achieve; "be" is a way to live. A version may
  // switch track if that's the honest way to make it gentler or bolder.
  track: "do" | "be";
  // The goal itself at this intensity — specific, personal, plain language.
  label: string;
  // do-version: a rough "when / how often". Absent on a be-version.
  cadence?: string;
  // be-version: what it looks like in an ordinary week. Absent on a do-version.
  ordinaryWeek?: string;
};

// One drafted goal, sorted into a balanced area, carried at up to three
// intensities. "original" is the default the person sees; "bolder" and
// "quieter" are the same goal one notch more or less ambitious, for the one-tap
// swap. The person can step between them without losing the original.
export type GoalSuggestion = {
  // The area of the person's life this goal is about, in their own words — a free
  // label ("Travel & adventure", "Our home"), not one of a fixed set. Kept for
  // downstream grouping; not shown on the card in the rework.
  area: string;
  // The thing the person actually said that this goal was drawn from, phrased to
  // read after "You mentioned " — e.g. "rowing", "wanting to be a Winchester guide".
  // The provenance line on the card, and the anchor coverage is checked against.
  // Optional so the generic fallback (which has no real source) still type-checks;
  // every freshly-drafted goal sets it.
  source?: string;
  // One short line on why it was suggested. Optional now the card shows `source`
  // instead; retained for back-compat with earlier saved seeds.
  why?: string;
  original: GoalVariant;
  bolder?: GoalVariant;
  quieter?: GoalVariant;
};

export type BalancedGoalsSeed = { suggestions: GoalSuggestion[] };

// ---- The rework's fetches (thread-based drafting) ----

// Post the assembled thread pool; get back the drafted goals (originals only), or
// null on failure so the surface shows an honest state — never a generic set.
export async function fetchGoalDraft(
  threads: GoalThread[],
  onboarding: string
): Promise<BalancedGoalsSeed | null> {
  return fetchSeedWithRetry<BalancedGoalsSeed>(
    "/api/goal-draft",
    { threads, onboarding },
    (s) => s.suggestions.length > 0
  );
}

// The gentler/bolder sizes for one committed goal, generated on demand when dialled.
export async function fetchGoalVariants(goal: {
  label: string;
  cadence?: string;
  source?: string;
}): Promise<{ bolder?: GoalVariant; quieter?: GoalVariant }> {
  try {
    const res = await fetch("/api/goal-variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(goal),
    });
    if (!res.ok) return {};
    return (await res.json()) as { bolder?: GoalVariant; quieter?: GoalVariant };
  } catch {
    return {};
  }
}
