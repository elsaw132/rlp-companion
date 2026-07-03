import { describe, it, expect, vi } from "vitest";
import {
  getModule,
  stageNameFor,
  isRetired,
  retiredLetter,
  STAGES,
  type BuildResult,
} from "@/lib/modules";
import { factsFromBuild } from "@/lib/contextFacts";

const stage1 = STAGES.find((s) => s.number === 1)!;
const stage4 = STAGES.find((s) => s.number === 4)!;

// A 1.worklife composite build: what-they-miss picker + how-leaving-came-about.
function worklifeBuild(onset: string): BuildResult {
  return {
    type: "composite",
    results: [
      { type: "role-picker", picked: ["A sense of purpose"], starred: [] },
      { type: "role-picker", picked: [onset], starred: [] },
    ],
  };
}

describe("Review stage — flag OFF (default test env)", () => {
  it("hides 1.worklife and keeps Imagine's 5 modules / order", () => {
    expect(getModule("1.worklife")).toBeNull();
    expect(getModule("1.worklife", "recently_retired")).toBeNull();
    const day = getModule("1.day", "recently_retired");
    expect(day?.stageModuleIds).toEqual([
      "1.day",
      "1.money",
      "1.roles",
      "1.week",
      "1.letter",
    ]);
    expect(day?.stageName).toBe("Imagine");
  });

  it("keeps 4.1 in Plan for everyone", () => {
    expect(getModule("4.1", "recently_retired")?.module.id).toBe("4.1");
  });

  it("stageNameFor returns base names", () => {
    expect(stageNameFor(stage1, "recently_retired")).toBe("Imagine");
    expect(stageNameFor(stage4, "established")).toBe("Plan");
  });
});

describe("Review stage — flag ON", () => {
  it("re-orders Review, adds 1.worklife second, and drops 4.1 from Plan", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RETIREMENT_PATHS", "1");
    const m = await import("@/lib/modules");

    for (const stage of ["recently_retired", "established"] as const) {
      const day = m.getModule("1.day", stage);
      expect(day?.stageName).toBe("Review");
      expect(day?.stageModuleIds).toEqual([
        "1.day",
        "1.worklife",
        "1.roles",
        "1.week",
        "1.money",
        "1.letter",
      ]);
      // The work-life reflection is in Review...
      expect(m.getModule("1.worklife", stage)?.module.title).toBe(
        "What work gave you"
      );
      // ...and 4.1 is gone from Plan for them.
      expect(m.getModule("4.1", stage)).toBeNull();
      // Plan is renamed (label only).
      expect(m.stageNameFor(m.STAGES[3], stage)).toBe("Retirement Reset Plan");
    }

    // Working keeps Imagine + 4.1; no work-life module.
    expect(m.getModule("1.worklife", "working")).toBeNull();
    expect(m.getModule("1.day", "working")?.stageName).toBe("Imagine");
    expect(m.getModule("4.1", "working")?.module.id).toBe("4.1");

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("isRetired", () => {
  it("covers the two retired cohorts only", () => {
    expect(isRetired("recently_retired")).toBe(true);
    expect(isRetired("established")).toBe(true);
    expect(isRetired("winding_down")).toBe(false);
    expect(isRetired("working")).toBe(false);
    expect(isRetired(null)).toBe(false);
  });
});

describe("retiredLetter — turns the letter into a keep/change/leave conversation", () => {
  it("supplies the conversation hooks the default letter lacks", () => {
    const rl = retiredLetter();
    // sessionInstructions is what SessionContainer keys off to run the follow-on
    // conversation — the default 1.letter module has none.
    expect(rl.sessionInstructions.length).toBeGreaterThan(0);
    expect(rl.sessionInstructions.toLowerCase()).toContain("keep");
    expect(rl.coachOpening.length).toBeGreaterThan(0);
    expect(rl.writingPlaceholder.length).toBeGreaterThan(0);
    expect(rl.primer[0].type).toBe("text");
    // The default letter module carries no sessionInstructions, so its flow is
    // untouched.
    expect(getModule("1.letter")?.module.sessionInstructions).toBeUndefined();
  });
});

describe("factsFromBuild — 1.worklife writes retirement_onset", () => {
  it("captures how leaving came about from the onset picker", () => {
    const facts = factsFromBuild(
      "1.worklife",
      worklifeBuild("Mostly decided by circumstances")
    );
    expect(facts.length).toBe(1);
    expect(facts[0].category).toBe("retirement_onset");
    expect(facts[0].data.label).toBe("Mostly decided by circumstances");
  });

  it("returns nothing when the onset pick is missing", () => {
    const empty: BuildResult = {
      type: "composite",
      results: [
        { type: "role-picker", picked: ["A sense of purpose"], starred: [] },
        { type: "role-picker", picked: [], starred: [] },
      ],
    };
    expect(factsFromBuild("1.worklife", empty)).toEqual([]);
  });
});
