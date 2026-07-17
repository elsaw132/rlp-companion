import { describe, it, expect } from "vitest";
import { medianMs, fmtDuration } from "@/lib/durations";

describe("medianMs", () => {
  it("is the middle value of an odd-length list", () => {
    expect(medianMs([60_000, 120_000, 900_000])).toBe(120_000);
  });

  it("averages the middle two of an even-length list", () => {
    expect(medianMs([60_000, 120_000, 180_000, 240_000])).toBe(150_000);
  });

  it("does not care about input order", () => {
    expect(medianMs([900_000, 60_000, 120_000])).toBe(120_000);
  });

  it("resists the outlier a mean would fall for", () => {
    // Four ~10-minute sessions and one tab left focused for four hours. The mean
    // would claim the typical session is nearly an hour; nobody experienced
    // that. The median reports the 11 minutes four of the five actually had.
    const times = [
      10 * 60_000,
      11 * 60_000,
      9 * 60_000,
      12 * 60_000,
      4 * 60 * 60_000,
    ];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    expect(Math.round(mean / 60_000)).toBe(56);
    expect(medianMs(times)).toBe(11 * 60_000);
  });

  it("has no median for no data", () => {
    expect(medianMs([])).toBeNull();
  });
});

describe("fmtDuration", () => {
  it("keeps sub-minute times visible rather than rounding them to 0m", () => {
    expect(fmtDuration(12_000)).toBe("12s");
    expect(fmtDuration(59_000)).toBe("59s");
  });

  it("reads in minutes for a normal session", () => {
    expect(fmtDuration(14 * 60_000)).toBe("14m");
    expect(fmtDuration(60_000)).toBe("1m");
  });

  it("reads in hours once it's absurd", () => {
    expect(fmtDuration(90 * 60_000)).toBe("1h 30m");
  });

  it("shows nothing when there's nothing", () => {
    expect(fmtDuration(null)).toBe("—");
  });
});
