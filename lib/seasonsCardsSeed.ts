// Module 4.2 ("The chapters of retirement") card-curation contract.
//
// The seasons board seeds its cards from the person's aspirations, activities and
// people across every earlier session (seasonCardsFromFacts in lib/resolverInputs).
// Those facts are captured VERBATIM, in the person's own words (see takeawayPrompt),
// which is right for Vita's memory but wrong as tidy board cards: the labels come
// out inconsistent — some lowercase, some "-ing" fragments, some naming the tactic
// ("learn a language THROUGH A CLASS") rather than the aspiration, some too thin
// ("Learner"), and some a different register entirely (a daily tea ritual on a board
// about how PRIORITIES shift across the decades).
//
// One structured Claude call (/api/seasons-cards) curates the raw facts into a clean,
// consistent set of cards for the board: one voice (capitalised, verb-led), the
// aspiration not the tactic, vague cards made real WITHOUT inventing new wishes,
// trivial/wrong-register cards dropped, and same-intent cards merged. It rewrites
// wording (unlike the old dedup-only pass), but only ever cleans up and sharpens what
// the person actually said — it never adds an aspiration they didn't express, never
// returns more cards than it was given, and falls back to the untouched raw cards on
// any failure, so the board always renders.

import type { SeasonCard } from "@/lib/userModel";

// The cached result the board reads: the curated cards, in the shape the board
// already consumes.
export type SeasonsCardsSeed = {
  cards: SeasonCard[];
};

// Call the curation route. Returns the curated card set, or null on any failure so
// the caller keeps the raw cards.
export async function fetchSeasonsCards(
  cards: SeasonCard[]
): Promise<SeasonsCardsSeed | null> {
  try {
    const res = await fetch("/api/seasons-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { seed: SeasonsCardsSeed | null };
    return data.seed && data.seed.cards.length > 0 ? data.seed : null;
  } catch {
    return null;
  }
}

// Validate and clean whatever the model returned into the seed shape. The model
// returns a curated list of cards (rewritten labels), each with a category. Safety,
// in priority order:
//   - well-formed only: a card with no usable label is dropped;
//   - no runaway invention: the curated set can only be smaller than or equal to the
//     input (curation merges/drops/rewrites, never adds) — a larger set means the
//     model went off-script, so we fall back to the untouched input;
//   - never fail open: an empty or malformed result returns the raw input unchanged.
export function coerceCuratedCards(
  raw: unknown,
  input: SeasonCard[]
): SeasonsCardsSeed {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const arr = Array.isArray(obj.cards) ? obj.cards : [];

  const out: SeasonCard[] = [];
  const seen = new Set<string>();
  for (const c of arr) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const category =
      typeof o.category === "string" && o.category.trim()
        ? o.category.trim()
        : "Aspiration";
    out.push({ label, category });
    if (out.length >= 12) break;
  }

  // Empty, or more cards than we fed in → the model went off-script; keep the raw set.
  if (!out.length || out.length > input.length) return { cards: input };
  return { cards: out };
}
