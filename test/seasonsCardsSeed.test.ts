import { describe, it, expect } from "vitest";
import { coerceDedupedCards } from "@/lib/seasonsCardsSeed";
import type { SeasonCard } from "@/lib/userModel";

// The cards from the reported 4.2 board — three genuine near-duplicate pairs plus
// several distinct cards that must survive untouched.
const CARDS: SeasonCard[] = [
  { label: "Learner", category: "Aspiration" },
  { label: "Master cooking", category: "Aspiration" },
  {
    label: "Travel as much as possible, including the longer trips",
    category: "Aspiration",
  },
  {
    label: "Renovate our home to truly make it a dream home",
    category: "Aspiration",
  },
  {
    label: "As much travel as possible, including longer immersive trips",
    category: "Aspiration",
  },
  {
    label: "Home renovation done bit by bit, making it a dream home",
    category: "Aspiration",
  },
  { label: "Moving towards mastery in cooking", category: "Aspiration" },
  { label: "learn a language through a class", category: "Aspiration" },
  {
    label: "start a regular class to build casual social contact",
    category: "Aspiration",
  },
  {
    label: "intentional quiet time with a cup of tea in the morning",
    category: "Activity",
  },
];

describe("coerceDedupedCards", () => {
  it("collapses each duplicate group to its first (clearest) member, in input order, preserving categories", () => {
    const raw = {
      duplicateGroups: [
        ["Master cooking", "Moving towards mastery in cooking"],
        [
          "Travel as much as possible, including the longer trips",
          "As much travel as possible, including longer immersive trips",
        ],
        [
          "Renovate our home to truly make it a dream home",
          "Home renovation done bit by bit, making it a dream home",
        ],
      ],
    };
    const { cards } = coerceDedupedCards(raw, CARDS);
    expect(cards.map((c) => c.label)).toEqual([
      "Learner",
      "Master cooking",
      "Travel as much as possible, including the longer trips",
      "Renovate our home to truly make it a dream home",
      "learn a language through a class",
      "start a regular class to build casual social contact",
      "intentional quiet time with a cup of tea in the morning",
    ]);
    // Category rides along with the kept card.
    expect(cards.find((c) => c.label === "Master cooking")?.category).toBe(
      "Aspiration"
    );
  });

  it("keeps the label the model lists FIRST in a group, whatever the input order", () => {
    const raw = {
      // The reworded one listed first — it is the one kept, not the input-first one.
      duplicateGroups: [
        [
          "As much travel as possible, including longer immersive trips",
          "Travel as much as possible, including the longer trips",
        ],
      ],
    };
    const { cards } = coerceDedupedCards(raw, CARDS);
    const travel = cards.filter((c) => c.label.toLowerCase().includes("travel"));
    expect(travel).toHaveLength(1);
    expect(travel[0].label).toBe(
      "As much travel as possible, including longer immersive trips"
    );
  });

  it("never invents: a grouped label not present in the input is ignored", () => {
    const raw = {
      duplicateGroups: [
        ["Master cooking", "Become a Michelin chef"], // second isn't a real card
      ],
    };
    const { cards } = coerceDedupedCards(raw, CARDS);
    // The group collapses to a single real member, so nothing is dropped.
    expect(cards).toHaveLength(CARDS.length);
    expect(cards.some((c) => c.label === "Become a Michelin chef")).toBe(false);
  });

  it("never drops a distinct card the model didn't group", () => {
    const raw = { duplicateGroups: [] };
    const { cards } = coerceDedupedCards(raw, CARDS);
    expect(cards).toEqual(CARDS);
  });

  it("falls back to the untouched input on a malformed response", () => {
    expect(coerceDedupedCards(null, CARDS).cards).toEqual(CARDS);
    expect(coerceDedupedCards({}, CARDS).cards).toEqual(CARDS);
    expect(coerceDedupedCards("nonsense", CARDS).cards).toEqual(CARDS);
    expect(
      coerceDedupedCards({ duplicateGroups: "not an array" }, CARDS).cards
    ).toEqual(CARDS);
  });

  it("de-duplicates within a group and ignores single-member groups", () => {
    const raw = {
      duplicateGroups: [
        ["Master cooking", "Master cooking"], // same label twice → not a real pair
        ["Learner"], // singleton → ignored
      ],
    };
    const { cards } = coerceDedupedCards(raw, CARDS);
    expect(cards).toEqual(CARDS);
  });

  it("never returns an empty board even if a group would drop everything", () => {
    const two: SeasonCard[] = [
      { label: "A", category: "Aspiration" },
      { label: "B", category: "Aspiration" },
    ];
    // A malformed group listing both as duplicates keeps the first, drops the second.
    const { cards } = coerceDedupedCards(
      { duplicateGroups: [["A", "B"]] },
      two
    );
    expect(cards).toEqual([{ label: "A", category: "Aspiration" }]);
  });
});
