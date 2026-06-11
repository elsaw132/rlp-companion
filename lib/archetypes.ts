// Retirement "types" surfaced on the Imagine stage-close reveal. This is fixed
// product content (editable copy), deliberately kept out of the brand layer so
// white-label re-skinning never touches it. Each type is a confident read of
// how someone imagines this stage — never a ranking. `definition` describes the
// type generically; the per-user "why you" line is generated separately and
// merged in by the reveal. `company` is a belonging line (never a percentile).

export type Archetype = {
  id: string;
  name: string;
  // Generic — describes the type, not this user.
  definition: string;
  // Belonging, not ranking. No percentiles, no "more X than Y%".
  company: string;
};

export const ARCHETYPES: Record<string, Archetype> = {
  "unhurried-builder": {
    id: "unhurried-builder",
    name: "The Unhurried Builder",
    definition:
      "Unhurried Builders want a slower life that's still going somewhere: ease and space, but with purpose, people and work worth doing kept firmly in the picture.",
    company:
      "One of the more common types among people who aren't ready to simply wind down — you're in good company.",
  },
  adventurer: {
    id: "adventurer",
    name: "The Adventurer",
    definition:
      "Adventurers see retirement as an opening — the room they've waited for to do the long-deferred things.",
    company:
      "A familiar shape for people who've spent decades saying \u201cone day\u201d — you're in good company.",
  },
  "hearth-keeper": {
    id: "hearth-keeper",
    name: "The Hearth-Keeper",
    definition:
      "For Hearth-Keepers the richness is close to home — the people they love, a place that holds them, time to be properly present.",
    company:
      "Common among people who measure a good retirement by the company they keep — you're in good company.",
  },
  giver: {
    id: "giver",
    name: "The Giver",
    definition:
      "Givers want days that are good for something beyond themselves — passing on what they know, lending a hand.",
    company:
      "A recognisable way of thinking for people who measure a day by what they put in — you're in good company.",
  },
  restorer: {
    id: "restorer",
    name: "The Restorer",
    definition:
      "After a long stretch of being needed on demand, Restorers want permission to slow right down into real recovery.",
    company:
      "More common than people admit, and a healthy instinct after decades of obligation — you're in good company.",
  },
  reinventor: {
    id: "reinventor",
    name: "The Reinventor",
    definition:
      "Reinventors want to become someone a little new: a fresh chapter, a new skill, a venture there was never room for.",
    company:
      "A familiar pattern for people who see retirement as a doorway onto what's next — you're in good company.",
  },
};

export const DEFAULT_ARCHETYPE_ID = "unhurried-builder";

export function getArchetype(id: string): Archetype {
  return ARCHETYPES[id] ?? ARCHETYPES[DEFAULT_ARCHETYPE_ID];
}
