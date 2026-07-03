import { describe, it, expect, vi } from "vitest";
import { RULES, TAILORED_STAGES, tailorCopy } from "@/lib/retirementCopy";
import { STAGES } from "@/lib/modules";

// Every string of module copy the sweep can touch: stage intros + each module's
// description, coachOpening, sessionInstructions and text primer blocks. The
// find/replace rules match against exactly these, so this is the corpus a rule
// must still hit.
function copyCorpus(): string {
  const parts: string[] = [];
  for (const stage of STAGES) {
    if (stage.intro) {
      parts.push(stage.intro.heading, ...stage.intro.body, stage.intro.buttonLabel);
    }
    for (const mod of stage.modules) {
      parts.push(mod.description);
      if (mod.coachOpening) parts.push(mod.coachOpening);
      if (mod.sessionInstructions) parts.push(mod.sessionInstructions);
      for (const block of mod.primer) {
        if (block.type === "text") parts.push(block.value);
      }
    }
  }
  return parts.join("\n\n");
}

describe("retirement-paths copy rules", () => {
  const corpus = copyCorpus();

  it("every rule's find-string still exists verbatim in the module copy", () => {
    // Guards against silent drift: if the underlying copy is reworded, the rule
    // stops matching and retirees would quietly get the future-tense default.
    for (const rule of RULES) {
      expect(corpus, `missing find-string: "${rule.find}"`).toContain(rule.find);
    }
  });

  it("no two rules share a find-string", () => {
    const finds = RULES.map((r) => r.find);
    expect(new Set(finds).size).toBe(finds.length);
  });

  it("retired cohorts never keep the future-tense default", () => {
    // recently_retired and established are already retired, so every flagged
    // phrase must actually change for them — no future-tense-for-retirees left.
    for (const rule of RULES) {
      for (const stage of ["recently_retired", "established"] as const) {
        expect(
          rule.variants[stage],
          `unchanged for ${stage}: "${rule.find}"`
        ).not.toBe(rule.find);
      }
    }
  });

  it("every variant is a non-empty string for every tailored stage", () => {
    for (const rule of RULES) {
      for (const stage of TAILORED_STAGES) {
        expect(typeof rule.variants[stage]).toBe("string");
        expect(rule.variants[stage].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("is a no-op when the flag is off (default test env)", () => {
    // Proves the flag-off path is byte-identical: even a retired stage returns the
    // input unchanged while RETIREMENT_PATHS is off.
    for (const rule of RULES) {
      expect(tailorCopy(rule.find, "established")).toBe(rule.find);
    }
  });

  it("rewrites per cohort when the flag is on, and stays a no-op for working/unset", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RETIREMENT_PATHS", "1");
    const mod = await import("@/lib/retirementCopy");
    for (const rule of mod.RULES) {
      for (const stage of mod.TAILORED_STAGES) {
        expect(mod.tailorCopy(rule.find, stage)).toBe(rule.variants[stage]);
      }
      // Still-working and unset keep today's forward-looking copy.
      expect(mod.tailorCopy(rule.find, "working")).toBe(rule.find);
      expect(mod.tailorCopy(rule.find, null)).toBe(rule.find);
    }
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
