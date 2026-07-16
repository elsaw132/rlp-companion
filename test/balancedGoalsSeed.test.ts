import { describe, it, expect, vi, afterEach } from "vitest";
import {
  coerceBalancedGoals,
  fetchBalancedGoalsDraft,
  FALLBACK_BALANCED_GOALS,
} from "@/lib/balancedGoalsSeed";

const variant = (label: string) => ({ track: "do", label, cadence: "most weeks" });
const goal = (area: string, label = "A real personal goal") => ({
  area,
  why: "because you said so",
  original: variant(label),
});

describe("coerceBalancedGoals — area normalisation", () => {
  it("keeps goals whose area is a close synonym, mapped to the canonical id", () => {
    const raw = {
      suggestions: [
        goal("grow", "Book a cookery school course"), // grow → think
        goal("health", "Keep running through the year"), // health → move
        goal("people", "Protect the daily school pick-ups"), // people → connect
        goal("purpose", "Set up a mentoring practice"), // purpose → contribute
        goal("MOVE", "Ski each winter"), // case-insensitive canonical
      ],
    };
    const out = coerceBalancedGoals(raw);
    expect(out).not.toBe(FALLBACK_BALANCED_GOALS);
    expect(out.suggestions.map((s) => s.area)).toEqual([
      "think",
      "move",
      "connect",
      "contribute",
      "move",
    ]);
    // the real labels survive — nothing silently dropped
    expect(out.suggestions.map((s) => s.original.label)).toContain(
      "Book a cookery school course"
    );
  });

  it("still returns the generic fallback when EVERY area is unrecognisable", () => {
    const raw = { suggestions: [goal("banana"), goal("xyzzy")] };
    expect(coerceBalancedGoals(raw)).toBe(FALLBACK_BALANCED_GOALS);
  });

  it("returns the generic fallback on malformed input", () => {
    expect(coerceBalancedGoals(null)).toBe(FALLBACK_BALANCED_GOALS);
    expect(coerceBalancedGoals({ suggestions: "nope" })).toBe(FALLBACK_BALANCED_GOALS);
  });
});

describe("fetchBalancedGoalsDraft — retry", () => {
  afterEach(() => vi.unstubAllGlobals());

  const okSeed = {
    seed: { suggestions: [goal("move", "Real goal")] },
  };

  it("retries past transient failures and returns the eventual real draft", async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n++;
      if (n < 3) return { ok: false } as Response; // two failures
      return { ok: true, json: async () => okSeed } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const seed = await fetchBalancedGoalsDraft({} as any, { attempts: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seed?.suggestions[0].original.label).toBe("Real goal");
  });

  it("does NOT retry when the first attempt already returns a real draft", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => okSeed } as unknown as Response));
    vi.stubGlobal("fetch", fetchMock);
    const seed = await fetchBalancedGoalsDraft({} as any, { attempts: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(seed).not.toBeNull();
  });

  it("returns null after exhausting all attempts (a null-seed retry signal)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ seed: null }) } as unknown as Response));
    vi.stubGlobal("fetch", fetchMock);
    const seed = await fetchBalancedGoalsDraft({} as any, { attempts: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seed).toBeNull();
  });

  it("treats a thrown fetch (network error) as retryable", async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n++;
      if (n === 1) throw new Error("network down");
      return { ok: true, json: async () => okSeed } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const seed = await fetchBalancedGoalsDraft({} as any, { attempts: 3 });
    expect(seed).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
