import { describe, it, expect } from "vitest";
import {
  sanitizeCoreValues,
  constrainSeedToCore,
  type Stage3Seed,
} from "@/lib/stage3Seed";

describe("sanitizeCoreValues", () => {
  it("trims, de-dupes case-insensitively, and caps at 5", () => {
    expect(
      sanitizeCoreValues([" Growth ", "growth", "Family", "", "Adventure"])
    ).toEqual(["Growth", "Family", "Adventure"]);
    expect(
      sanitizeCoreValues(["A", "B", "C", "D", "E", "F", "G"])
    ).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("returns [] for missing/empty input", () => {
    expect(sanitizeCoreValues(undefined)).toEqual([]);
    expect(sanitizeCoreValues([])).toEqual([]);
    expect(sanitizeCoreValues(["", "   "])).toEqual([]);
  });
});

describe("constrainSeedToCore — priority-choices", () => {
  const seed: Stage3Seed = {
    type: "priority-choices",
    pairs: [
      { left: "A free week", right: "A full week" },
      { left: "Near", right: "Far" },
      { left: "Make", right: "Rest" },
    ],
    // What the model drifted to — includes values that were never marked core.
    values: ["Connection", "Adventure", "Independence", "Achievement"],
  };

  it("replaces the ranking pool with exactly the marked-core set, keeping pairs", () => {
    const core = ["Adventure", "Calm", "Creativity", "Nature", "Health"];
    const out = constrainSeedToCore(seed, core);
    expect(out.type).toBe("priority-choices");
    if (out.type !== "priority-choices") throw new Error("wrong type");
    expect(out.values).toEqual(core);
    expect(out.pairs).toEqual(seed.pairs);
  });

  it("is a no-op when there is no recorded core", () => {
    expect(constrainSeedToCore(seed, [])).toBe(seed);
  });
});

describe("constrainSeedToCore — value-definitions", () => {
  // A hypothetical case: the model drafts a set that diverges from the marked
  // core — it drops values that were marked and introduces ones that weren't.
  const seed: Stage3Seed = {
    type: "value-definitions",
    values: [
      {
        value: "Connection",
        description: "the calls with people far away",
        threat: "Letting the calls slide",
        protectors: ["A fixed weekly call"],
      },
      {
        value: "Adventure",
        description: "seeing new corners of the world",
        threat: "Never booking the trip",
        protectors: ["One trip on the calendar each year"],
      },
      {
        value: "Creativity",
        description: "making things with your hands",
        threat: "The studio staying shut",
        protectors: ["One making morning a week"],
      },
    ],
  };
  // Marked core: two of these overlap the model's set, three don't.
  const core = ["Adventure", "Calm", "Creativity", "Nature", "Health"];

  it("produces exactly one card per marked-core value, in order", () => {
    const out = constrainSeedToCore(seed, core);
    if (out.type !== "value-definitions") throw new Error("wrong type");
    expect(out.values.map((v) => v.value)).toEqual(core);
  });

  it("keeps the model's drafted content where a value matches", () => {
    const out = constrainSeedToCore(seed, core);
    if (out.type !== "value-definitions") throw new Error("wrong type");
    const adventure = out.values.find((v) => v.value === "Adventure")!;
    expect(adventure.threat).toBe("Never booking the trip");
    expect(adventure.protectors).toEqual(["One trip on the calendar each year"]);
  });

  it("blanks the marked values the model never drafted (to fill in), not dropped", () => {
    const out = constrainSeedToCore(seed, core);
    if (out.type !== "value-definitions") throw new Error("wrong type");
    for (const label of ["Calm", "Nature", "Health"]) {
      const card = out.values.find((v) => v.value === label)!;
      expect(card).toBeDefined();
      expect(card.threat).toBe("");
      expect(card.protectors).toEqual([]);
    }
  });

  it("drops the model's values that were not marked core", () => {
    const out = constrainSeedToCore(seed, core);
    if (out.type !== "value-definitions") throw new Error("wrong type");
    expect(out.values.some((v) => v.value === "Connection")).toBe(false);
  });

  it("matches case-insensitively so casing drift can't duplicate a value", () => {
    const out = constrainSeedToCore(seed, ["adventure"]);
    if (out.type !== "value-definitions") throw new Error("wrong type");
    expect(out.values).toHaveLength(1);
    expect(out.values[0].value).toBe("adventure");
    expect(out.values[0].threat).toBe("Never booking the trip");
  });
});
