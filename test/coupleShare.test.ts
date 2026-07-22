import { describe, it, expect } from "vitest";
import {
  deriveShareableItems,
  defaultSharedRefs,
  fearItems,
} from "@/lib/coupleShare";

// A data map like getAllUserData / the useUserData snapshot: interaction:<id> keys.
function data(overrides: Record<string, unknown> = {}) {
  return {
    "interaction:4.3": {
      type: "balanced-goals",
      goals: [
        { label: "Time with the grandchildren", area: "Family", track: "do" },
        { label: "Take painting seriously", area: "Creativity", track: "do" },
        { label: "A big trip in the first year", area: "Travel & adventure", track: "do" },
      ],
      areas: [],
      deliberateGaps: [],
      summaryLabel: "Goals",
    },
    "interaction:3.5": {
      type: "hopes-fears",
      hopes: "To feel useful, not sidelined, once I step back from work.",
      fears: [
        { label: "That I'll lose my sense of purpose", horizon: "soon", reaction: "on-my-mind" },
        { label: "That we want different things and drift", horizon: "later", reaction: "newly-recognised" },
        { label: "Something I don't really worry about", horizon: "later", reaction: "not-me" },
      ],
      summaryLabel: "Hopes and fears",
    },
    "interaction:4.6": {
      type: "week-shape",
      structure: 50,
      activities: [],
      summaryLabel: "Week",
    },
    "interaction:4.1": {
      type: "readiness-snapshot",
      transition: { position: 40, lean: "gradual" },
      window: null,
      factors: [],
      finance: {},
      summaryLabel: "Readiness",
    },
    ...overrides,
  };
}

describe("deriveShareableItems", () => {
  it("produces plan (rhythm, goals, travel, leaving-work), hopes and fears", () => {
    const items = deriveShareableItems(data());
    const refs = items.map((i) => i.ref);
    expect(refs).toContain("plan:rhythm");
    expect(refs).toContain("plan:travel"); // from the "Travel & adventure" goal
    expect(refs).toContain("plan:leaving-work");
    expect(refs).toContain("hope:main");
    // one ref per named goal
    expect(items.filter((i) => i.ref.startsWith("goal:")).length).toBe(3);
  });

  it("drops 'not-me' fears and keeps the live ones", () => {
    const fears = fearItems(deriveShareableItems(data()));
    expect(fears.length).toBe(2);
    expect(fears.some((f) => f.label.includes("don't really worry"))).toBe(false);
  });

  it("defaults everything on, and about-partner fears off with a flag", () => {
    const items = deriveShareableItems(data());
    const driftFear = items.find((i) => i.label.includes("drift"))!;
    // Without classification everything is on
    expect(driftFear.defaultOn).toBe(true);

    // With the drift fear classified as about-partner, it defaults off + flagged
    const classified = deriveShareableItems(data(), [driftFear.ref]);
    const drift2 = classified.find((i) => i.ref === driftFear.ref)!;
    expect(drift2.defaultOn).toBe(false);
    expect(drift2.aboutPartner).toBe(true);
    // and it's excluded from the default shared set
    expect(defaultSharedRefs(classified)).not.toContain(driftFear.ref);
  });

  it("omits plan items whose source module is absent", () => {
    const noReadiness = data();
    delete (noReadiness as Record<string, unknown>)["interaction:4.1"];
    delete (noReadiness as Record<string, unknown>)["interaction:4.6"];
    const refs = deriveShareableItems(noReadiness).map((i) => i.ref);
    expect(refs).not.toContain("plan:leaving-work");
    expect(refs).not.toContain("plan:rhythm");
  });

  it("gives each goal a stable, unique ref", () => {
    const items = deriveShareableItems(data());
    const goalRefs = items.filter((i) => i.ref.startsWith("goal:")).map((i) => i.ref);
    expect(new Set(goalRefs).size).toBe(goalRefs.length);
    // stable across calls
    expect(deriveShareableItems(data()).map((i) => i.ref)).toEqual(
      items.map((i) => i.ref)
    );
  });
});
