import { describe, it, expect } from "vitest";
import { deriveShareableItems } from "@/lib/coupleShare";
import {
  buildComparisonAssembly,
  comparisonInputHash,
} from "@/lib/coupleComparison";
import { coerceComparison, FALLBACK_COMPARISON } from "@/lib/comparisonSeed";

function person(goals: string[], hope: string, fears: string[], stage: string) {
  return {
    onboarding: { retirementStage: stage },
    "interaction:4.3": {
      type: "balanced-goals",
      goals: goals.map((label) => ({ label, area: "Life", track: "do" })),
      areas: [],
      deliberateGaps: [],
      summaryLabel: "Goals",
    },
    "interaction:3.5": {
      type: "hopes-fears",
      hopes: hope,
      fears: fears.map((label) => ({ label, horizon: "soon", reaction: "on-my-mind" })),
      summaryLabel: "Hopes and fears",
    },
    "interaction:4.6": { type: "week-shape", structure: 30, activities: [], summaryLabel: "W" },
  };
}

const refsFor = (data: Record<string, unknown>) =>
  deriveShareableItems(data, []).map((i) => i.ref);

describe("buildComparisonAssembly", () => {
  const aData = person(["Stay in this house", "Take painting seriously"], "To feel useful", ["Losing purpose"], "winding_down");
  const bData = person(["Stay in this house", "A big trip"], "Unhurried time together", ["We might drift"], "recently_retired");

  it("marks a goal held by both, and keeps each person's own goals", () => {
    const asm = buildComparisonAssembly({
      aData,
      bData,
      aSharedRefs: refsFor(aData),
      bSharedRefs: refsFor(bData),
      aName: "Maya",
      bName: "Ray",
    });
    const shared = asm.deterministic.goals.a.find((g) => g.label === "Stay in this house")!;
    const own = asm.deterministic.goals.a.find((g) => g.label === "Take painting seriously")!;
    expect(shared.both).toBe(true);
    expect(own.both).toBe(false);
    // cohort + plan name resolved per person
    expect(asm.partners.a.cohort).toBe("Winding down");
    expect(asm.partners.a.planName).toBe("Retirement Life Plan");
    expect(asm.partners.b.planName).toBe("Retirement Reset Plan");
  });

  it("never includes an unshared item", () => {
    // Share everything of a's EXCEPT the painting goal and the fear.
    const aRefs = refsFor(aData).filter(
      (r) => !r.startsWith("goal:take-painting") && !r.startsWith("fear:")
    );
    const asm = buildComparisonAssembly({
      aData,
      bData,
      aSharedRefs: aRefs,
      bSharedRefs: refsFor(bData),
      aName: "Maya",
      bName: "Ray",
    });
    expect(asm.deterministic.goals.a.some((g) => g.label.includes("painting"))).toBe(false);
    expect(asm.shared.a.goals).not.toContain("Take painting seriously");
    expect(asm.shared.a.fears.length).toBe(0);
    expect(asm.deterministic.fears.some((f) => f.slot === "a")).toBe(false);
    // b still shared their fear
    expect(asm.deterministic.fears.some((f) => f.slot === "b")).toBe(true);
  });

  it("summarises rhythm only when it's shared", () => {
    const withRhythm = buildComparisonAssembly({
      aData,
      bData,
      aSharedRefs: refsFor(aData),
      bSharedRefs: refsFor(bData),
      aName: "Maya",
      bName: "Ray",
    });
    expect(withRhythm.shared.a.rhythm).toBeTruthy();

    const noRhythm = buildComparisonAssembly({
      aData,
      bData,
      aSharedRefs: refsFor(aData).filter((r) => r !== "plan:rhythm"),
      bSharedRefs: refsFor(bData),
      aName: "Maya",
      bName: "Ray",
    });
    expect(noRhythm.shared.a.rhythm).toBeNull();
  });

  it("hash changes when the shared inputs change", () => {
    const full = buildComparisonAssembly({
      aData, bData,
      aSharedRefs: refsFor(aData), bSharedRefs: refsFor(bData),
      aName: "Maya", bName: "Ray",
    });
    const fewer = buildComparisonAssembly({
      aData, bData,
      aSharedRefs: refsFor(aData).filter((r) => !r.startsWith("goal:take-painting")),
      bSharedRefs: refsFor(bData),
      aName: "Maya", bName: "Ray",
    });
    expect(comparisonInputHash(full.shared.a, full.shared.b)).not.toBe(
      comparisonInputHash(fewer.shared.a, fewer.shared.b)
    );
  });
});

describe("coerceComparison", () => {
  it("parses a good payload and keeps observation sides", () => {
    const out = coerceComparison({
      framingOpener: "You're at different points.",
      sharedGround: ["You both want slow mornings.", ""],
      complementary: [
        { text: "Days fit together.", sides: [{ name: "Maya", text: "Two days at work." }, { name: "Ray", text: "Weekdays open." }] },
      ],
      different: [
        { text: "Travel.", clearest: true },
        { text: "Week shape.", clearest: true },
      ],
      talkTopics: ["Time together and apart."],
    });
    expect(out.framingOpener).toContain("different points");
    expect(out.sharedGround).toEqual(["You both want slow mornings."]); // empty dropped
    expect(out.complementary[0].sides).toHaveLength(2);
    // only the first "clearest" is kept
    expect(out.different.filter((d) => d.clearest).length).toBe(1);
  });

  it("falls back (by identity) when there's no opener", () => {
    expect(coerceComparison({ sharedGround: ["x"] })).toBe(FALLBACK_COMPARISON);
    expect(coerceComparison("garbage")).toBe(FALLBACK_COMPARISON);
  });
});
