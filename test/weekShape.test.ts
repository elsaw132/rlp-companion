import { describe, it, expect } from "vitest";
import { coerceWeekShape } from "@/lib/weekShapeSeed";

describe("coerceWeekShape", () => {
  it("returns null when the model supplied no usable activities", () => {
    // The masquerade fix: an empty/failed draft must fail honestly (null), never
    // fall back to a generic rhythm dressed up as the person's real week.
    expect(coerceWeekShape({ structure: 50, activities: [] })).toBeNull();
    expect(coerceWeekShape({ structure: 50 })).toBeNull();
    expect(coerceWeekShape("not an object")).toBeNull();
    expect(coerceWeekShape({ activities: [{ frequency: "Weekly" }] })).toBeNull(); // no labels
  });

  it("keeps the model's real activities, clamps structure, and normalises frequency", () => {
    const seed = coerceWeekShape({
      structure: 140,
      activities: [
        { label: "Badminton at the club", category: "movement", frequency: "twice a week", anchor: true, energy: true },
        { label: "Sunday lunch with the family", frequency: "weekly" },
      ],
    });
    expect(seed).not.toBeNull();
    expect(seed!.structure).toBe(100); // clamped from 140
    expect(seed!.activities).toHaveLength(2);
    expect(seed!.activities[0]).toMatchObject({
      label: "Badminton at the club",
      frequency: "A few times a week",
      anchor: true,
      energy: true,
    });
  });

  it("de-duplicates activities by label, folding stronger tags into the kept one", () => {
    const seed = coerceWeekShape({
      activities: [
        { label: "Choir", frequency: "Weekly" },
        { label: "choir", frequency: "Weekly", anchor: true, energy: true },
      ],
    });
    expect(seed!.activities).toHaveLength(1);
    expect(seed!.activities[0]).toMatchObject({ label: "Choir", anchor: true, energy: true });
  });
});
