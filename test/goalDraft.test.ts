import { describe, it, expect } from "vitest";
import { goalThreadsFromFacts, mustCoverThreads } from "@/lib/goalThreads";
import { coerceDraftedGoals, coverageGaps, duplicateGoals } from "@/lib/goalDraft";
import type { StoredFact, FactCategory } from "@/lib/contextFacts";

let n = 0;
function fact(category: FactCategory, label: string, status: StoredFact["status"] = "active"): StoredFact {
  return { id: `f${n++}`, userId: "u", category, domain: null, data: { label }, provenanceModule: "1.x", provenanceSource: "widget_pick", status, supersededBy: null, confidence: "certain", createdAt: "2026-01-01", lastAffirmedAt: null };
}

describe("goalThreadsFromFacts", () => {
  it("de-dupes, marks aspirations must-cover, and excludes prior goals + dreams", () => {
    const facts = [
      fact("aspiration", "Learn padel"),
      fact("aspiration", "learn padel"), // case dup -> collapsed
      fact("recurring_activity", "Rowing"),
      fact("relationship", "My daughter"),
      fact("goal", "A goal from a prior 4.3 run"), // excluded (prior output)
      fact("one_off_dream", "A villa in Tuscany"), // dream-walled, excluded
      fact("aspiration", "Superseded want", "superseded"), // not active
    ];
    const threads = goalThreadsFromFacts(facts);
    const labels = threads.map((t) => t.label);
    expect(labels).toEqual(["Learn padel", "Rowing", "My daughter"]);
    expect(mustCoverThreads(threads).map((t) => t.label)).toEqual(["Learn padel"]);
  });
});

describe("coerceDraftedGoals", () => {
  it("keeps well-formed goals, drops vague + source-less, de-dupes", () => {
    const goals = coerceDraftedGoals({
      goals: [
        { source: "rowing", area: "Water", label: "Join the rowing club this season", cadence: "Weekly" },
        { source: "rowing", area: "Water", label: "Row a lot" }, // dup source -> dropped
        { source: "fitness", area: "Health", label: "Stay active and outdoors" }, // vague -> dropped
        { source: "", area: "X", label: "No source" }, // no source -> dropped
        { source: "padel", area: "Sport", label: "Learn padel and join a league" },
      ],
    });
    expect(goals.map((g) => g.source)).toEqual(["rowing", "padel"]);
    expect(goals[0].original.label).toBe("Join the rowing club this season");
  });
});

describe("validation gate", () => {
  const must = [
    { label: "Become a Winchester guide", category: "aspiration" as FactCategory, provenanceModule: "1.day", mustCover: true },
    { label: "Learn padel", category: "aspiration" as FactCategory, provenanceModule: "1.money", mustCover: true },
  ];
  it("flags a stated want no goal covers, and passes when covered", () => {
    const goals = coerceDraftedGoals({ goals: [
      { source: "wanting to be a Winchester guide", area: "History", label: "Study Winchester's history and lead a walk" },
    ]});
    expect(coverageGaps(must, goals).map((t) => t.label)).toEqual(["Learn padel"]);
    const both = coerceDraftedGoals({ goals: [
      { source: "wanting to be a Winchester guide", area: "History", label: "Study Winchester's history and lead a walk" },
      { source: "padel", area: "Sport", label: "Take up padel and join a club" },
    ]});
    expect(coverageGaps(must, both)).toHaveLength(0);
    expect(duplicateGoals(both)).toHaveLength(0);
  });
});
