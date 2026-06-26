import { describe, it, expect } from "vitest";
import { ageFromDob } from "@/lib/planDate";
import { hearingCheckRecommended } from "@/lib/modules";
import { resolveViews } from "@/lib/contextResolver";
import { SEED_SOURCE } from "@/lib/rlpPlanSeed";

// End-to-end checks for the new onboarding date-of-birth → age gate (§0): the
// DOB drives 2.6's hearing-check recommendation through real age, with a
// graceful fall-back to the retirement-horizon signal when there's no DOB.

describe("ageFromDob", () => {
  it("computes whole years and rejects bad / future dates", () => {
    expect(ageFromDob("1963-09-12")).toBeGreaterThanOrEqual(60);
    expect(ageFromDob("")).toBeNull();
    expect(ageFromDob("not-a-date")).toBeNull();
    expect(ageFromDob("2099-01-01")).toBeNull(); // future
    expect(ageFromDob("1990-02-31")).toBeNull(); // impossible day
  });
});

describe("hearingCheckRecommended — real age takes precedence", () => {
  it("recommends at 50+ regardless of horizon", () => {
    expect(hearingCheckRecommended("More than 10 years", 62)).toBe(true);
    expect(hearingCheckRecommended(null, 55)).toBe(true);
  });
  it("withholds under 50 even if the horizon would have qualified", () => {
    expect(hearingCheckRecommended("Not sure", 42)).toBe(false);
    expect(hearingCheckRecommended("2–5 years", 49)).toBe(false);
  });
  it("falls back to the horizon when no DOB/age is given", () => {
    expect(hearingCheckRecommended("2–5 years")).toBe(true);
    expect(hearingCheckRecommended("More than 10 years")).toBe(false);
    expect(hearingCheckRecommended(null)).toBe(false);
  });
});

describe("2.6 resolves the seed member's age + letter through the resolver", () => {
  const facts = SEED_SOURCE.getActiveFacts?.() ?? [];

  it("the DOB fact yields an age the gate would recommend on", () => {
    const { seed } = resolveViews("2.6", facts);
    expect(seed.age).not.toBeNull();
    expect(hearingCheckRecommended(null, seed.age)).toBe(true);
  });

  it("the letter_thread feeds 2.6's Vita view", () => {
    const { vita } = resolveViews("2.6", facts);
    expect(vita.items.some((i) => i.category === "letter_thread")).toBe(true);
  });
});
