import { describe, it, expect, vi } from "vitest";
import {
  getModule,
  getModulesBefore,
  windDownDecided,
  windDownFourOne,
  type BuildResult,
  type ReadinessSnapshotInteraction,
} from "@/lib/modules";
import { factsFromBuild } from "@/lib/contextFacts";
// getNextModule and getActiveStageNumber are exercised through the flag-on
// dynamic import below (m.getNextModule / p.getActiveStageNumber).

// A wind-down module build with a given decision answer.
function windDownBuild(decision: string): BuildResult {
  return {
    type: "screening-check",
    answers: [
      { id: "shape", prompt: "How much are you still working?", choice: "A day or two" },
      { id: "duration", prompt: "How long?", choice: "Under a year" },
      { id: "decision", prompt: "Have you decided?", choice: decision },
    ],
    summaryLabel: "Where you are with winding down",
  };
}

describe("wind-down module visibility — flag OFF (default test env)", () => {
  it("hides 1.winddown from everyone, even a winding-down stage", () => {
    expect(getModule("1.winddown")).toBeNull();
    expect(getModule("1.winddown", "winding_down")).toBeNull();
  });

  it("keeps Imagine at five modules and 1.day first", () => {
    const day = getModule("1.day", "winding_down");
    expect(day?.modulesInStage).toBe(5);
    expect(day?.stageModuleIds[0]).toBe("1.day");
    expect(getModulesBefore("1.day", "winding_down")).toEqual([]);
  });
});

describe("wind-down module visibility — flag ON", () => {
  it("shows 1.winddown first in Imagine only for winding-down", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RETIREMENT_PATHS", "1");
    const m = await import("@/lib/modules");
    const p = await import("@/lib/progress");

    // Winding-down: extra first module, gated before 1.day.
    const wd = m.getModule("1.winddown", "winding_down");
    expect(wd?.module.title).toBe("Your wind-down so far");
    expect(wd?.stageModuleIds).toEqual([
      "1.winddown",
      "1.day",
      "1.money",
      "1.roles",
      "1.week",
      "1.letter",
    ]);
    expect(m.getModulesBefore("1.day", "winding_down").map((x) => x.id)).toEqual([
      "1.winddown",
    ]);
    expect(m.getNextModule("1.winddown", "winding_down")).toBe("1.day");
    // A winding-down user who has done nothing is on stage 1 (the wind-down module).
    expect(p.getActiveStageNumber([], "winding_down")).toBe(1);

    // Everyone else: unchanged, no wind-down module.
    expect(m.getModule("1.winddown", "working")).toBeNull();
    expect(m.getModule("1.day", "working")?.modulesInStage).toBe(5);
    expect(m.getModulesBefore("1.day", "working")).toEqual([]);
    expect(m.getModule("1.winddown", null)).toBeNull();

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});

describe("windDownDecided", () => {
  it("is true only for a settled plan", () => {
    expect(windDownDecided(windDownBuild("A set date or plan"))).toBe(true);
    expect(windDownDecided(windDownBuild("A rough window"))).toBe(false);
    expect(windDownDecided(windDownBuild("Not yet — still open"))).toBe(false);
    expect(windDownDecided(null)).toBe(false);
  });
});

describe("windDownFourOne routing", () => {
  const base = getModule("4.1")?.module.interaction;

  it("decided → anticipatory reflection with no widget", () => {
    const r = windDownFourOne(true, base);
    expect(r.interaction).toBeUndefined();
    expect(r.description.toLowerCase()).toContain("reflection");
    // No readiness-snapshot language leaks into the reflection.
    expect(r.sessionInstructions).toContain("anticipatory reflection");
  });

  it("undecided → readiness widget re-anchored to completing the wind-down", () => {
    const r = windDownFourOne(false, base);
    expect(r.interaction?.type).toBe("readiness-snapshot");
    const snap = r.interaction as ReadinessSnapshotInteraction;
    expect(snap.transition.left).toBe("Wrap it up before long");
    expect(snap.transition.right).toBe("Keep easing out gradually");
    // The rest of the readiness widget is preserved (factors, levels).
    expect(snap.factors.length).toBeGreaterThan(0);
  });
});

describe("factsFromBuild — 1.winddown writes wind_down_exit only when decided", () => {
  it("decided → one wind_down_exit fact carrying the structured shape", () => {
    const facts = factsFromBuild("1.winddown", windDownBuild("A set date or plan"));
    expect(facts.length).toBe(1);
    expect(facts[0].category).toBe("wind_down_exit");
    expect(facts[0].data.decision).toBe("A set date or plan");
    expect(facts[0].data.currentShape).toBe("A day or two");
    expect(facts[0].data.windingDuration).toBe("Under a year");
  });

  it("not decided → no fact (routes to the 4.1 widget instead)", () => {
    expect(factsFromBuild("1.winddown", windDownBuild("A rough window"))).toEqual([]);
    expect(factsFromBuild("1.winddown", windDownBuild("Not yet — still open"))).toEqual(
      []
    );
  });
});
