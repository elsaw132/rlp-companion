import { describe, it, expect } from "vitest";
import {
  ageAtBaseline,
  ageBand,
  stageLabel,
  partnerLabel,
} from "@/lib/baselineAnalysis";

describe("ageAtBaseline", () => {
  it("counts whole years", () => {
    expect(ageAtBaseline("1966-03-10", "2026-07-17T12:00:00.000Z")).toBe(60);
  });

  it("does not count a birthday that hasn't happened yet this year", () => {
    // Born December, answering in July — still 59, not 60.
    expect(ageAtBaseline("1966-12-01", "2026-07-17T12:00:00.000Z")).toBe(59);
  });

  it("counts the birthday itself", () => {
    expect(ageAtBaseline("1966-07-17", "2026-07-17T12:00:00.000Z")).toBe(60);
  });

  it("does not count the day before the birthday", () => {
    expect(ageAtBaseline("1966-07-18", "2026-07-17T12:00:00.000Z")).toBe(59);
  });

  it("is age when answered, not age now — so a record never drifts", () => {
    const dob = "1966-03-10";
    const atBaseline = ageAtBaseline(dob, "2026-07-17T12:00:00.000Z");
    // The same baseline re-exported years later must read the same.
    expect(ageAtBaseline(dob, "2026-07-17T12:00:00.000Z")).toBe(atBaseline);
  });

  it("returns null when the date of birth was skipped", () => {
    expect(ageAtBaseline(null, "2026-07-17T12:00:00.000Z")).toBeNull();
    expect(ageAtBaseline("", "2026-07-17T12:00:00.000Z")).toBeNull();
  });

  it("rejects nonsense rather than skewing the cohort", () => {
    // A future date of birth, and a typo'd year.
    expect(ageAtBaseline("2030-01-01", "2026-07-17T12:00:00.000Z")).toBeNull();
    expect(ageAtBaseline("1066-01-01", "2026-07-17T12:00:00.000Z")).toBeNull();
    expect(ageAtBaseline("not-a-date", "2026-07-17T12:00:00.000Z")).toBeNull();
  });
});

describe("ageBand", () => {
  it("bands ages, bounded at both ends", () => {
    expect(ageBand(48)).toBe("under 50");
    expect(ageBand(50)).toBe("50–54");
    expect(ageBand(54)).toBe("50–54");
    expect(ageBand(55)).toBe("55–59");
    expect(ageBand(64)).toBe("60–64");
    expect(ageBand(69)).toBe("65–69");
    expect(ageBand(70)).toBe("70+");
    expect(ageBand(95)).toBe("70+");
  });

  it("has no band for a missing age", () => {
    expect(ageBand(null)).toBe("");
  });
});

describe("labels", () => {
  it("reads retirement stage codes as a person would say them", () => {
    expect(stageLabel("winding_down")).toBe("Winding down");
    expect(stageLabel("established")).toBe("Retired 2+ years");
    expect(stageLabel(null)).toBe("");
  });

  it("passes through an unknown stage rather than hiding it", () => {
    expect(stageLabel("something_new")).toBe("something_new");
  });

  it("reads the partner answer, including the pre-simplification wording", () => {
    expect(partnerLabel("Yes")).toBe("Has a partner");
    expect(partnerLabel("Me and my partner")).toBe("Has a partner");
    expect(partnerLabel("No")).toBe("No partner");
    expect(partnerLabel(null)).toBe("");
  });
});
