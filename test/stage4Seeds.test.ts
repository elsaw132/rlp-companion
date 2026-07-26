import { describe, it, expect } from "vitest";
import { coerceGoalPaths } from "@/lib/goalPathsSeed";
import { coerceTradeOffs, type TradeOffsDraftInput } from "@/lib/tradeOffsSeed";
import { coerceFirstYear } from "@/lib/firstYearSeed";

// Each Stage-4 coerce fn must FAIL HONESTLY (null) when the model gives no usable
// content, rather than substituting a generic fallback dressed up as real data.

describe("coerceGoalPaths", () => {
  const goals = [
    { goal: "Run a marathon", track: "do" as const },
    { goal: "Be more present", track: "be" as const },
  ];

  it("returns null with no goals, or when the model produced nothing usable", () => {
    expect(coerceGoalPaths({ paths: [] }, [])).toBeNull();
    expect(coerceGoalPaths({ paths: [] }, goals)).toBeNull();
    expect(coerceGoalPaths("garbage", goals)).toBeNull();
  });

  it("keeps real model content, filling a skipped goal from the per-goal fallback", () => {
    const seed = coerceGoalPaths(
      { paths: [{ goal: "Run a marathon", milestones: [{ label: "Enter a 10k" }] }] },
      goals
    );
    expect(seed).not.toBeNull();
    expect(seed!.paths).toHaveLength(2); // one per goal
    expect(seed!.paths[0].milestones?.[0].label).toBe("Enter a 10k"); // real
    expect(seed!.paths[1].track).toBe("be"); // skipped be-goal kept via fallback
  });
});

describe("coerceTradeOffs", () => {
  const input = {
    values: [{ value: "Family" }, { value: "Freedom" }],
    goals: [{ goal: "Travel widely", track: "do" }],
  } as unknown as TradeOffsDraftInput;

  it("returns null when the model produced no usable scenario", () => {
    expect(coerceTradeOffs({ scenarios: [] }, input)).toBeNull();
    expect(coerceTradeOffs({ scenarios: [{ situation: "x" }] }, input)).toBeNull(); // missing options
  });

  it("keeps real scenarios and carries the real Stage-3 values", () => {
    const seed = coerceTradeOffs(
      { scenarios: [{ situation: "Two goals, one summer", optionA: "A", optionB: "B" }] },
      input
    );
    expect(seed).not.toBeNull();
    expect(seed!.scenarios).toHaveLength(1);
    expect(seed!.values).toEqual(["Family", "Freedom"]);
  });
});

describe("coerceFirstYear", () => {
  it("returns null when the model produced no usable items", () => {
    expect(coerceFirstYear({ items: [] })).toBeNull();
    expect(coerceFirstYear({ narrative: "a year" })).toBeNull();
  });

  it("keeps the model's real items", () => {
    const seed = coerceFirstYear({
      items: [{ label: "Big trip to Japan", kind: "trip", season: "s2" }],
      narrative: "A gentle opening.",
    });
    expect(seed).not.toBeNull();
    expect(seed!.items).toHaveLength(1);
    expect(seed!.items[0].label).toBe("Big trip to Japan");
  });
});
