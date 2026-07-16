import { describe, it, expect } from "vitest";
import { coerceCuratedCards } from "@/lib/seasonsCardsSeed";

describe("coerceCuratedCards", () => {
  it("keeps a well-formed curated set, preserving order and category", () => {
    const raw = {
      cards: [
        { label: "Unhurried time with Harry", category: "People" },
        { label: "Be there for the grandchildren", category: "People" },
        { label: "Travel as much as possible", category: "Aspiration" },
        { label: "Paint big, free work", category: "Activity" },
      ],
    };
    const seed = coerceCuratedCards(raw);
    expect(seed).not.toBeNull();
    expect(seed!.cards.map((c) => c.label)).toEqual([
      "Unhurried time with Harry",
      "Be there for the grandchildren",
      "Travel as much as possible",
      "Paint big, free work",
    ]);
    expect(seed!.cards[0].category).toBe("People");
  });

  it("defaults a missing/blank category and drops blank-label cards", () => {
    const raw = {
      cards: [
        { label: "Learn a language" }, // no category
        { label: "   ", category: "Aspiration" }, // blank label → dropped
        { label: "Master cooking", category: "  " }, // blank category → default
      ],
    };
    const seed = coerceCuratedCards(raw);
    expect(seed!.cards).toEqual([
      { label: "Learn a language", category: "Aspiration" },
      { label: "Master cooking", category: "Aspiration" },
    ]);
  });

  it("de-duplicates case-insensitively by label", () => {
    const seed = coerceCuratedCards({
      cards: [
        { label: "Learn a language", category: "Aspiration" },
        { label: "learn a language", category: "Aspiration" },
      ],
    });
    expect(seed!.cards).toEqual([
      { label: "Learn a language", category: "Aspiration" },
    ]);
  });

  it("caps the curated set at 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      label: `Card ${i}`,
      category: "Aspiration",
    }));
    const seed = coerceCuratedCards({ cards: many });
    expect(seed!.cards).toHaveLength(12);
  });

  it("returns null on empty or malformed responses (so the caller falls back)", () => {
    expect(coerceCuratedCards({ cards: [] })).toBeNull();
    expect(coerceCuratedCards(null)).toBeNull();
    expect(coerceCuratedCards({})).toBeNull();
    expect(coerceCuratedCards("nonsense")).toBeNull();
    expect(coerceCuratedCards({ cards: "not an array" })).toBeNull();
    expect(coerceCuratedCards({ cards: [{ label: "  " }, { notALabel: 1 }] })).toBeNull();
  });
});
