// Module 4.2 ("The chapters of retirement") card-curation contract.
//
// The seasons board's cards are the person's own priorities across the whole
// programme. The naive builder (seasonCardsFromFacts) read only a few categories,
// aspiration-first, and hard-capped at 12 — so anyone with a full aspiration list
// had their most central, most-repeated themes (the people they love, the things
// they actually do) crowded out entirely. seasonCandidatesFromFacts instead gathers
// the FULL picture — aspirations, the activities they do, hopes, goals, what they
// want to keep, and the people in their life — plus their roles and values as signal.
//
// One structured Claude call (/api/seasons-cards) selects and phrases a balanced set
// of ~8–12 board cards from that pool: one consistent voice, the aspiration not the
// tactic, the central people and recurring themes always represented, one card per
// priority (merged across wording, category and altitude), trivial daily routines
// dropped. It rewrites and selects, but only ever from what the person actually said —
// it never invents a priority. On any failure it returns nothing, and the board falls
// back to the (narrow) seasonCardsFromFacts set so it always renders.

import type { SeasonCard } from "@/lib/userModel";
import type { SeasonCandidate } from "@/lib/resolverInputs";

// The cached result the board reads: the curated cards, in the shape the board
// already consumes.
export type SeasonsCardsSeed = {
  cards: SeasonCard[];
};

// The full input the curation call chooses from: the priority pool plus the role and
// value signals that keep the central people and values on the board.
export type SeasonsCardsInput = {
  candidates: SeasonCandidate[];
  roles: string[];
  values: string[];
};

// Call the curation route. Returns the curated card set, or null on any failure so
// the caller falls back to the raw cards.
export async function fetchSeasonsCards(
  input: SeasonsCardsInput
): Promise<SeasonsCardsSeed | null> {
  try {
    const res = await fetch("/api/seasons-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { seed: SeasonsCardsSeed | null };
    return data.seed && data.seed.cards.length > 0 ? data.seed : null;
  } catch {
    return null;
  }
}

// Maximum cards on the board — a sortable, uncluttered set.
const MAX_CARDS = 12;

// Validate and clean whatever the model returned into the seed shape, or null when it
// gave us nothing usable (the caller then falls back to the raw cards). The model
// SELECTS and rewrites from a large candidate pool, so unlike the old dedup pass we
// can't check labels against an input set — faithfulness ("never invent") is enforced
// by the prompt. Here we only keep the result well-formed: non-empty labels, de-duped,
// and capped at MAX_CARDS. Each card carries a category the model assigned (kept in the
// data model; the board no longer renders it as a tag).
export function coerceCuratedCards(raw: unknown): SeasonsCardsSeed | null {
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
    if (out.length >= MAX_CARDS) break;
  }

  return out.length ? { cards: out } : null;
}
