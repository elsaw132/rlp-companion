// The stage intros — which cohort reads which framing, and what stands in for
// Act while Act has nothing to open.
//
// The intro copy makes claims about the build: that Explore ran in order and is
// behind them, that Act's sessions can be taken in any order. Those claims are
// enforced elsewhere (the in-order gate in app/session/[id]/page.tsx); these
// tests pin the half that's easy to break silently — that the right cohort reads
// the right words, and that a rule which stops matching can't quietly serve
// someone a backward reference to a stage they never saw.

import { describe, it, expect, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_RETIREMENT_PATHS", "1");
const { STAGES, visibleModules, stageNameFor, PILOT_CALLOUT } = await import("@/lib/modules");
const { tailorCopy } = await import("@/lib/retirementCopy");
const { getActiveStageNumber } = await import("@/lib/progress");
import type { RetirementStage } from "@/lib/userData";

const RETIRED: RetirementStage[] = ["recently_retired", "established"];
const PRE: RetirementStage[] = ["working", "winding_down"];
const ALL: RetirementStage[] = [...PRE, ...RETIRED];
const stage = (n: number) => STAGES.find((s) => s.number === n)!;

// Mirrors HomeDashboard's tailoring of a stage intro.
function intro(n: number, rs: RetirementStage) {
  const s = stage(n);
  return {
    heading: tailorCopy(s.intro!.heading, rs),
    body: s.intro!.body.map((p) => tailorCopy(p, rs)),
  };
}

describe("every stage from 2 to 5 has an intro", () => {
  it("2, 3, 4 and 5 all carry one", () => {
    for (const n of [1, 2, 3, 4, 5]) expect(stage(n).intro, `stage ${n}`).toBeTruthy();
  });
});

describe("backward references name the stage each cohort actually saw", () => {
  it("Stage 2 says Imagine to the pre-retired and Review to the retired", () => {
    for (const rs of PRE) expect(intro(2, rs).body[0]).toContain("In Imagine,");
    for (const rs of RETIRED) {
      expect(intro(2, rs).body[0]).toContain("In Review,");
      expect(intro(2, rs).body[0]).not.toContain("In Imagine,");
    }
  });

  it("Stage 3 does the same, and every cohort is told they did Explore", () => {
    for (const rs of PRE) expect(intro(3, rs).body[0]).toContain("In Imagine you pictured");
    for (const rs of RETIRED) expect(intro(3, rs).body[0]).toContain("In Review you pictured");
    for (const rs of ALL)
      expect(intro(3, rs).body[0]).toContain("in Explore you looked at the elements of a balanced retirement one by one");
  });

  it("Stage 4 names Imagine/Review correctly and never the wrong one", () => {
    for (const rs of PRE) {
      expect(intro(4, rs).body[0]).toContain("In Imagine you pictured");
      expect(intro(4, rs).body[0]).not.toContain("In Review");
    }
    for (const rs of RETIRED) {
      expect(intro(4, rs).body[0]).toContain("In Review you pictured");
      expect(intro(4, rs).body[0]).not.toContain("In Imagine");
    }
  });

  it("only the cohorts still heading out of work are told they'll leave it", () => {
    expect(intro(4, "working").body[0]).toContain("when and how you'll leave work");
    expect(intro(4, "winding_down").body[0]).toContain("how you'll finish leaving work");
    // Telling someone already retired they're about to leave work would be wrong.
    for (const rs of RETIRED) expect(intro(4, rs).body[0]).not.toContain("leave work");
    expect(intro(4, "recently_retired").body[0]).toContain("now work is behind you");
  });
});

describe("Stage 4 heading and plan name follow the cohort", () => {
  it("pre-retired make a plan; the retired shape a reset", () => {
    for (const rs of PRE) expect(intro(4, rs).heading).toBe("Now let's make your plan");
    for (const rs of RETIRED) expect(intro(4, rs).heading).toBe("Now let's shape your reset");
  });

  it("the artefact is named as the code names it, per cohort", () => {
    for (const rs of PRE) {
      expect(intro(4, rs).body[2]).toContain("Retirement Life Plan");
      expect(stageNameFor(stage(4), rs)).toBe("Plan");
    }
    for (const rs of RETIRED) {
      expect(intro(4, rs).body[2]).toContain("Retirement Reset Plan");
      expect(intro(4, rs).body[2]).not.toContain("Retirement Life Plan");
      expect(stageNameFor(stage(4), rs)).toBe("Retirement Reset Plan");
    }
  });
});

describe("Stage 5 meets each cohort where they are", () => {
  it("shares its heading and first two paragraphs", () => {
    for (const rs of ALL) {
      expect(intro(5, rs).heading).toBe("Now let's put it to work");
      expect(intro(5, rs).body[1]).toContain("There's no set order");
    }
  });

  it("varies only the closing line, and never tells the retired to wait", () => {
    expect(intro(5, "working").body[2]).toContain("until retirement is closer");
    expect(intro(5, "winding_down").body[2]).toContain("as you finish leaving work");
    expect(intro(5, "recently_retired").body[2]).toContain("Now you're retired");
    expect(intro(5, "established").body[2]).toContain("speak straight to where you are");
    for (const rs of RETIRED) expect(intro(5, rs).body[2]).not.toContain("until retirement is closer");
    for (const rs of ALL) expect(intro(5, rs).body[2]).toContain("revisit your plan any time");
  });
});

describe("the pilot callout stands in for Act, and stands down on its own", () => {
  it("Act has no sessions for anyone today, so the callout is what shows", () => {
    for (const rs of ALL) expect(visibleModules(stage(5), rs)).toHaveLength(0);
    expect(PILOT_CALLOUT.buttonLabel).toBe("Back to my plan");
    expect(PILOT_CALLOUT.body[0]).toContain("isn't ready yet");
  });

  it("every cohort can actually reach Stage 5 once they've finished", () => {
    // The regression this guards: called without the cohort, 4.1 counts as
    // outstanding for the retired cohorts — who can never see it — and they
    // never arrive at Stage 5 to be told anything at all.
    for (const rs of ALL) {
      const done = STAGES.flatMap((s) => visibleModules(s, rs).map((m) => m.id));
      expect(getActiveStageNumber(done, rs), `${rs} should reach stage 5`).toBe(5);
    }
  });

  it("is gated on Act's sessions, not a flag — so it yields when Act ships", () => {
    // Simulate Act's session losing comingSoon: the gate must flip by itself.
    const act = stage(5);
    const real = { ...act.modules[0], comingSoon: false };
    const shipped = { ...act, modules: [real] };
    for (const rs of ALL) expect(visibleModules(shipped, rs).length).toBeGreaterThan(0);
  });
});
