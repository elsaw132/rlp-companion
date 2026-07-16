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

describe("coerceBalancedGoals — free-text areas", () => {
  it("keeps the area label verbatim (no fixed-category mapping) and forces track 'do'", () => {
    const raw = {
      suggestions: [
        goal("Travel & adventure", "Spend a month island-hopping in Croatia"),
        goal("Our home", "Renovate the house into a dream home"),
        // a "be"-style variant is coerced to a concrete do goal
        { area: "Cooking", why: "you love it", original: { track: "be", label: "Master cooking" } },
      ],
    };
    const out = coerceBalancedGoals(raw);
    expect(out).not.toBe(FALLBACK_BALANCED_GOALS);
    expect(out.suggestions.map((s) => s.area)).toEqual([
      "Travel & adventure",
      "Our home",
      "Cooking",
    ]);
    expect(out.suggestions.every((s) => s.original.track === "do")).toBe(true);
  });

  it("caps the set at four", () => {
    const raw = {
      suggestions: Array.from({ length: 7 }, (_, i) => goal(`Area ${i}`, `Goal ${i}`)),
    };
    expect(coerceBalancedGoals(raw).suggestions).toHaveLength(4);
  });

  it("keeps a goal even with a blank area (the person names it later)", () => {
    const out = coerceBalancedGoals({ suggestions: [goal("", "Do the big trip")] });
    expect(out.suggestions).toHaveLength(1);
    expect(out.suggestions[0].area).toBe("");
  });

  it("drops goals with no usable original label", () => {
    const raw = { suggestions: [{ area: "X", why: "", original: { label: "  " } }] };
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
