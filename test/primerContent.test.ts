// The primer content drop — which cohort sees which copy.
//
// retirementCopy.test.ts already guards the rules' find-strings against drift.
// This guards the layer above it: that the copy actually lands on the right
// people. The routing is easy to break silently, because a rule that stops
// matching fails open — it returns the base copy rather than erroring, so a
// retired member would quietly get future-tense copy written for someone who
// hasn't left work.
//
// The split, per the content spec: working + winding_down get the base copy;
// recently_retired + established get the retired variant where one exists, and
// the base copy where one doesn't.

import { describe, it, expect, vi } from "vitest";
import { existsSync } from "fs";

// tailorCopy is a no-op with the flag off, so nothing here means anything
// until it's stubbed on — same as the other retirement-paths suites.
vi.stubEnv("NEXT_PUBLIC_RETIREMENT_PATHS", "1");

const { getModule, titleFor, retiredLetter, STAGES } = await import("@/lib/modules");
const { tailorCopy } = await import("@/lib/retirementCopy");
import type { RetirementStage } from "@/lib/userData";
import type { ContentBlock } from "@/lib/modules";

const RETIRED: RetirementStage[] = ["recently_retired", "established"];
const BASE_COHORTS: RetirementStage[] = ["working", "winding_down"];
const ALL: RetirementStage[] = [...BASE_COHORTS, ...RETIRED];

// What app/session/[id]/page.tsx does to a primer's text blocks.
function primerText(id: string, rs: RetirementStage): string[] {
  const mod = getModule(id)!.module;
  return mod.primer
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => tailorCopy(b.value, rs));
}

describe("1.day — a day in your retirement", () => {
  it("gives working and winding_down the base copy", () => {
    for (const rs of BASE_COHORTS) {
      expect(primerText("1.day", rs)[0]).toContain("Before you begin planning");
    }
  });

  it("gives the retired cohorts the retired variant, and the reframed title", () => {
    for (const rs of RETIRED) {
      const text = primerText("1.day", rs)[0];
      expect(text).toContain("You're living these days now");
      expect(text).not.toContain("Before you begin planning");
      expect(titleFor(getModule("1.day")!.module, rs)).toBe(
        "A day in your retirement now"
      );
    }
  });
});

describe("1.roles — the roles you play", () => {
  it("gives working and winding_down the base copy", () => {
    for (const rs of BASE_COHORTS) {
      expect(primerText("1.roles", rs)[0]).toContain(
        "As work takes up less of your week"
      );
    }
  });

  it("gives the retired cohorts the retired variant, and the reframed title", () => {
    for (const rs of RETIRED) {
      const text = primerText("1.roles", rs)[0];
      expect(text).toContain("Now that work no longer takes up the week");
      expect(titleFor(getModule("1.roles")!.module, rs)).toBe("The roles you play");
    }
  });
});

describe("1.letter — the retired variant comes from retiredLetter()", () => {
  it("reframes the letter and keeps its follow-on conversation", () => {
    const rl = retiredLetter();
    const text = rl.primer.find((b) => b.type === "text");
    expect(text && "value" in text ? text.value : "").toContain(
      "You're living the retirement you once wondered about"
    );
    // The conversation hooks are what make this variant more than new copy.
    expect(rl.sessionInstructions.length).toBeGreaterThan(0);
    // Both cohorts' letters carry the same music.
    expect(rl.primer.some((b) => b.type === "audio")).toBe(true);
  });
});

describe("modules with no retired variant fall back to the base copy", () => {
  it("1.week reads the same for every cohort", () => {
    for (const rs of ALL) {
      expect(primerText("1.week", rs)[0]).toContain(
        "An ideal week isn't about fitting everything in"
      );
    }
  });

  it("Stage 2 and Stage 3 are universal — identical for every cohort", () => {
    const ids = ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6"];
    for (const id of ids) {
      const base = primerText(id, "working");
      for (const rs of ALL) expect(primerText(id, rs)).toEqual(base);
    }
  });
});

describe("every primer asset resolves to a real file", () => {
  it("references nothing that isn't in public/primers/", () => {
    const srcs: string[] = [];
    const collect = (blocks: ContentBlock[]) => {
      for (const b of blocks) {
        if (b.type === "image" || b.type === "audio" || b.type === "self-hosted-video") srcs.push(b.src);
        if (b.type === "image-slideshow") srcs.push(...b.images.map((i) => i.src));
        if (b.type === "links") srcs.push(...b.links.map((l) => l.url).filter((u) => u.startsWith("/primers/")));
      }
    };
    for (const stage of STAGES) for (const m of stage.modules) collect(m.primer);
    collect(retiredLetter().primer);

    expect(srcs.length).toBeGreaterThan(0);
    const missing = srcs.filter((s) => !existsSync(`public${s}`));
    expect(missing).toEqual([]);
  });
});
