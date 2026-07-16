// Module 4.2 ("The chapters of retirement") de-duplication contract.
//
// The seasons board seeds its cards from the person's aspirations, activities and
// people, drawn from EVERY earlier session (seasonCardsFromFacts in
// lib/resolverInputs). Because the same wish is often captured more than once in
// slightly different words across the programme ("Master cooking" and "Moving
// towards mastery in cooking"), the board ends up showing near-duplicate cards.
// The exact-label de-duplication upstream can't catch these — the strings differ.
//
// One structured Claude call (/api/seasons-dedup) reads the raw cards and groups
// the ones that mean the same thing, so the board shows one clean card per intent.
// The model only ever GROUPS existing cards — it never rewrites a label or invents
// one — and anything that goes wrong falls back to the untouched card set, so the
// board always renders and no distinct wish is ever silently dropped.

import type { SeasonCard } from "@/lib/userModel";

// The cached result the board reads: the de-duplicated cards, in the same shape
// the board already consumes.
export type SeasonsCardsSeed = {
  cards: SeasonCard[];
};

// Call the de-duplication route. Returns the collapsed card set, or null on any
// failure so the caller keeps the raw cards.
export async function fetchSeasonsCardsDedup(
  cards: SeasonCard[]
): Promise<SeasonsCardsSeed | null> {
  try {
    const res = await fetch("/api/seasons-dedup", {
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

// Validate and apply whatever the model returned. The model hands back groups of
// cards it judges to be the SAME intent, clearest label first; everything else it
// leaves alone. We keep the first real card in each group and drop the rest, and
// preserve the input order and categories. Safety, in priority order:
//   - never invent: a grouped label that doesn't match a real input card is ignored;
//   - never drop a unique card: only cards the model explicitly grouped as a
//     duplicate of a KEPT card are removed — a card the model never mentions is kept;
//   - never fail open: if nothing maps cleanly, the untouched input is returned.
export function coerceDedupedCards(
  raw: unknown,
  input: SeasonCard[]
): SeasonsCardsSeed {
  // First occurrence of each label wins, mirroring the upstream card builder.
  const byLabel = new Map<string, SeasonCard>();
  for (const c of input) {
    const key = c.label.trim().toLowerCase();
    if (key && !byLabel.has(key)) byLabel.set(key, c);
  }

  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const groups = Array.isArray(obj.duplicateGroups) ? obj.duplicateGroups : [];

  // Labels (lowercased) to hide because they duplicate a card we're keeping.
  const drop = new Set<string>();
  for (const g of groups) {
    if (!Array.isArray(g)) continue;
    // Keep only the group members that map to a real input card, de-duplicated,
    // in the order the model listed them (clearest-first, per the prompt).
    const members: string[] = [];
    const seen = new Set<string>();
    for (const m of g) {
      const key = typeof m === "string" ? m.trim().toLowerCase() : "";
      if (!key || seen.has(key) || !byLabel.has(key)) continue;
      seen.add(key);
      members.push(key);
    }
    // A real duplicate group needs at least two members; keep the first, drop
    // the rest. A card can't be dropped by more than one group.
    if (members.length < 2) continue;
    for (const key of members.slice(1)) drop.add(key);
  }

  if (!drop.size) return { cards: input };

  const cards = input.filter((c) => !drop.has(c.label.trim().toLowerCase()));
  // Belt-and-braces: never return an empty board.
  return { cards: cards.length ? cards : input };
}
