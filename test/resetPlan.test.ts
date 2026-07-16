import { describe, it, expect, vi } from "vitest";
import { buildRlpPlan } from "@/lib/rlpPlan";
import { fearHorizonsFor } from "@/lib/stage3Seed";
import type { ModelSource } from "@/lib/userModel";
import type { StoredFact, FactCategory, FactData } from "@/lib/contextFacts";
import type { BuildResult } from "@/lib/modules";
import type { RetirementStage } from "@/lib/userData";

function fact(category: string, data: Record<string, unknown>): StoredFact {
  return {
    id: `${category}:${String(data.label)}`,
    userId: "u",
    category: category as FactCategory,
    domain: null,
    data: data as FactData,
    provenanceModule: "test",
    provenanceSource: "widget_pick",
    status: "active",
    supersededBy: null,
    confidence: "certain",
    createdAt: "2026-01-01",
    lastAffirmedAt: null,
  };
}

function makeSource(
  retirementStage: RetirementStage | undefined,
  facts: StoredFact[],
  builds: Record<string, BuildResult> = {}
): ModelSource {
  return {
    getBuild: (id) => builds[id] ?? null,
    getTakeaway: () => null,
    getDreams: () => null,
    getStage3Values: () => null,
    getOnboarding: () => ({
      partner: "No",
      ...(retirementStage ? { retirementStage } : {}),
    }),
    getActiveFacts: () => facts,
  };
}

const OPTS = { name: "Test", dateCreated: "2026-01-01" };

const RETIRED_FACTS = [
  fact("keep_change_leave", { label: "my slow mornings", description: "keep" }),
  fact("keep_change_leave", { label: "how I spend afternoons", description: "change" }),
  fact("keep_change_leave", { label: "too much TV", description: "leave" }),
  fact("unfinished_work", { label: "the mentoring I never finished" }),
  fact("retirement_onset", { label: "Mostly decided by circumstances" }),
];

const readiness: BuildResult = {
  type: "readiness-snapshot",
  transition: { position: 0.5, lean: "gradual" },
  window: null,
  factors: [{ id: "finances", label: "Finances", level: "Building" }],
  finance: { dateKnown: "Roughly" },
  summaryLabel: "Your readiness snapshot",
};

describe("3.5 fear horizons per cohort", () => {
  it("relabels the transition horizon and merges to two for established", () => {
    expect(fearHorizonsFor(true, null).map((h) => h.name)).toEqual([
      "The transition",
      "Life in retirement",
      "The longer view",
    ]);
    expect(fearHorizonsFor(true, "recently_retired")[0].name).toBe("Since work ended");
    expect(fearHorizonsFor(true, "winding_down")[0].name).toBe("As work winds down");
    // Established → TWO horizons (matches its primer), the first folded in.
    const est = fearHorizonsFor(true, "established");
    expect(est.map((h) => h.name)).toEqual([
      "Life in retirement now",
      "The longer view",
    ]);
  });
});

describe("Reset plan — flag OFF (default test env)", () => {
  it("a retired stage but flag off gives today's plan (no reset/orientation)", () => {
    const plan = buildRlpPlan(
      makeSource("recently_retired", RETIRED_FACTS, { "4.1": readiness }),
      OPTS
    );
    expect(plan.reset).toBeNull();
    expect(plan.orientation).toBe("");
    expect(plan.windDownExit).toBeNull();
    expect(plan.candidateGoals).toEqual([]);
    // Today's §8 still comes from the 4.1 build.
    expect(plan.leavingWork).not.toBeNull();
  });
});

describe("Reset plan — flag ON, per cohort", () => {
  it("reads the facts into §8, orientation, goals, anchors, tone", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RETIREMENT_PATHS", "1");
    const { buildRlpPlan: build } = await import("@/lib/rlpPlan");

    // --- Recently retired ---
    const rr = build(
      makeSource("recently_retired", RETIRED_FACTS, { "4.1": readiness }),
      OPTS
    );
    // The reset lists are capitalised for display (the raw facts are captured lower-case).
    expect(rr.reset).toEqual({
      keep: ["My slow mornings"],
      change: ["How I spend afternoons"],
      leaveBehind: ["Too much TV"],
    });
    expect(rr.leavingWork).toBeNull(); // the reset replaces the future-exit §8
    expect(rr.orientation.toLowerCase()).toContain("settling in");
    expect(rr.candidateGoals).toEqual([
      { label: "how I spend afternoons", source: "change" },
      { label: "the mentoring I never finished", source: "unfinished" },
    ]);
    // "Worth picking up" is FRAMED (deterministic fallback), never a reprint: one
    // per candidate, each longer than the bare label and carrying a first move.
    expect(rr.resetActions.length).toBe(2);
    rr.resetActions.forEach((a, i) => {
      expect(a).not.toBe(rr.candidateGoals[i].label);
      expect(a.length).toBeGreaterThan(rr.candidateGoals[i].label.length + 15);
    });
    expect(rr.anchors).toEqual(["my slow mornings"]);
    expect(rr.onsetGentle).toBe(true); // circumstantial → gentle framing

    // --- Established (chosen exit → normal framing) ---
    const est = build(
      makeSource("established", [
        fact("keep_change_leave", { label: "my volunteering", description: "keep" }),
        fact("retirement_onset", { label: "Mostly my own choice" }),
      ]),
      OPTS
    );
    expect(est.orientation.toLowerCase()).toContain("take stock");
    expect(est.reset).not.toBeNull();
    expect(est.onsetGentle).toBe(false);

    // --- Winding down, decided → the wind_down_exit fact ---
    const wdDecided = build(
      makeSource(
        "winding_down",
        [
          fact("wind_down_exit", {
            label: "Has a settled plan",
            decision: "A set date or plan",
            currentShape: "A day or two",
            windingDuration: "Under a year",
          }),
        ],
        { "4.1": readiness }
      ),
      OPTS
    );
    expect(wdDecided.windDownExit).not.toBeNull();
    expect(wdDecided.windDownExit?.currentShape).toBe("A day or two");
    expect(wdDecided.leavingWork).toBeNull(); // decided → fact, not the widget
    expect(wdDecided.reset).toBeNull();

    // --- Winding down, undecided → the 4.1 readiness build ---
    const wdUndecided = build(
      makeSource("winding_down", [], { "4.1": readiness }),
      OPTS
    );
    expect(wdUndecided.windDownExit).toBeNull();
    expect(wdUndecided.leavingWork).not.toBeNull();

    // --- Working → unchanged ---
    const working = build(makeSource("working", [], { "4.1": readiness }), OPTS);
    expect(working.reset).toBeNull();
    expect(working.windDownExit).toBeNull();
    expect(working.orientation).toBe("");
    expect(working.leavingWork).not.toBeNull();

    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
