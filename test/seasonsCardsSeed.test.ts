import { describe, it, expect } from "vitest";
import { coerceCuratedCards } from "@/lib/seasonsCardsSeed";
import type { SeasonCard } from "@/lib/userModel";

// The raw cards from the reported 4.2 board — verbatim fact labels, inconsistent in
// voice, altitude and register (what the curation call is handed).
const RAW: SeasonCard[] = [
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
  { label: "learn a language through a class", category: "Aspiration" },
  {
    label: "start a regular class to build casual social contact",
    category: "Aspiration",
  },
  { label: "joining a community team to create things", category: "Aspiration" },
  {
    label: "mentoring mid-career women navigating having children",
    category: "Aspiration",
  },
  {
    label: "intentional quiet time with a cup of tea in the morning",
    category: "Activity",
  },
];

describe("coerceCuratedCards", () => {
  it("passes through a well-formed curated set (rewritten labels), preserving order and category", () => {
    const raw = {
      cards: [
        { label: "Keep learning new things", category: "Aspiration" },
        { label: "Master cooking", category: "Aspiration" },
        {
          label: "Travel as much as possible, including the longer trips",
          category: "Aspiration",
        },
        { label: "Renovate our home into a dream home", category: "Aspiration" },
        { label: "Learn a language", category: "Aspiration" },
        { label: "Build regular, casual social contact", category: "Aspiration" },
        { label: "Join a community team to create things", category: "Aspiration" },
        { label: "Mentor mid-career women", category: "People" },
        // the tea ritual has been dropped by the model
      ],
    };
    const { cards } = coerceCuratedCards(raw, RAW);
    expect(cards.map((c) => c.label)).toEqual([
      "Keep learning new things",
      "Master cooking",
      "Travel as much as possible, including the longer trips",
      "Renovate our home into a dream home",
      "Learn a language",
      "Build regular, casual social contact",
      "Join a community team to create things",
      "Mentor mid-career women",
    ]);
    expect(cards.find((c) => c.label === "Mentor mid-career women")?.category).toBe(
      "People"
    );
  });

  it("defaults a missing/blank category to Aspiration and drops blank-label cards", () => {
    const raw = {
      cards: [
        { label: "Learn a language" }, // no category
        { label: "   ", category: "Aspiration" }, // blank label → dropped
        { label: "Master cooking", category: "  " }, // blank category → default
      ],
    };
    const { cards } = coerceCuratedCards(raw, RAW);
    expect(cards).toEqual([
      { label: "Learn a language", category: "Aspiration" },
      { label: "Master cooking", category: "Aspiration" },
    ]);
  });

  it("de-duplicates the curated output case-insensitively by label", () => {
    const raw = {
      cards: [
        { label: "Learn a language", category: "Aspiration" },
        { label: "learn a language", category: "Aspiration" },
      ],
    };
    const { cards } = coerceCuratedCards(raw, RAW);
    expect(cards).toEqual([{ label: "Learn a language", category: "Aspiration" }]);
  });

  it("caps the curated set at 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      label: `Card ${i}`,
      category: "Aspiration",
    }));
    const bigInput = many.map((c) => ({ ...c }));
    const { cards } = coerceCuratedCards({ cards: many }, bigInput);
    expect(cards).toHaveLength(12);
  });

  it("falls back to the raw input when the model returns MORE cards than given (runaway invention)", () => {
    const raw = {
      cards: [
        ...RAW.map((c) => ({ label: c.label, category: c.category })),
        { label: "Something the person never said", category: "Aspiration" },
      ],
    };
    const { cards } = coerceCuratedCards(raw, RAW);
    expect(cards).toEqual(RAW);
  });

  it("falls back to the raw input on empty or malformed responses", () => {
    expect(coerceCuratedCards({ cards: [] }, RAW).cards).toEqual(RAW);
    expect(coerceCuratedCards(null, RAW).cards).toEqual(RAW);
    expect(coerceCuratedCards({}, RAW).cards).toEqual(RAW);
    expect(coerceCuratedCards("nonsense", RAW).cards).toEqual(RAW);
    expect(coerceCuratedCards({ cards: "not an array" }, RAW).cards).toEqual(RAW);
  });
});
