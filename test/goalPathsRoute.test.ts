import { describe, it, expect, beforeEach, vi } from "vitest";

// Behaviour test for the 4.4 goal-paths route after the per-goal parallel rework.
// The route now drafts ONE goal per model call, in parallel, re-drafts only the
// goals that came back empty, and — this is the part that matters most — NEVER
// substitutes generic content for a goal it couldn't draft: if any goal is still
// missing after the re-draft, the whole response fails honestly (seed: null) so the
// surface shows "Try again" rather than boilerplate masquerading as the person's path.
//
// The Anthropic SDK is mocked so we control exactly what the model "returns" per goal.

// Records every model call's goal label + how many times each goal was asked for.
const calls: string[] = [];

// Per-goal script: what the mocked model returns on each successive call for a goal.
// A `null` entry means "empty draft" (no usable content); a string is a real path label.
let script: Record<string, Array<string | null>>;

const createMock = vi.fn(async (body: { messages: Array<{ content: string }> }) => {
  const userText = body.messages[0].content;
  const label = Object.keys(script).find((g) => userText.includes(g));
  if (!label) throw new Error(`test setup: no scripted goal found in prompt`);
  calls.push(label);

  const queued = script[label];
  const nth = calls.filter((c) => c === label).length - 1;
  const outcome = queued[Math.min(nth, queued.length - 1)];
  const isBe = userText.includes("[way to live (be)]");

  // An "empty" outcome returns a well-formed but content-free draft, exactly like a
  // model that produced nothing usable — coerce must turn this into null, not filler.
  const path = isBe
    ? outcome === null
      ? { goal: label, alreadyHelps: [], wouldHelp: [] }
      : { goal: label, alreadyHelps: [outcome], wouldHelp: [] }
    : outcome === null
      ? { goal: label, milestones: [] }
      : { goal: label, milestones: [{ label: outcome }] };

  return { content: [{ type: "text" as const, text: JSON.stringify({ paths: [path] }) }] };
});

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock };
    static APIError = class extends Error {};
  }
  return { default: MockAnthropic };
});

// Distinctive real labels, so we can prove the output is the REAL draft and not the
// generic fallback (whose do-label is "Get clear on what the first version looks like"
// and whose be-label is "The people already close to you").
const REAL_DO = "Build up to multi-day-trek fitness";
const REAL_BE = "Sunday lunches with the kids";

const goals = [
  { goal: "Walk the Annapurna Circuit", track: "do" as const },
  { goal: "Stay close to family", track: "be" as const },
];

async function callRoute() {
  const { POST } = await import("@/app/api/goal-paths/route");
  const req = new Request("http://test/api/goal-paths", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userModel: "A rich picture of this person from the earlier stages.",
      onboarding: "Five years from retiring; loves the hills.",
      goals,
      strengths: ["Perseverance", "Warmth"],
    }),
  });
  const res = await POST(req);
  return (await res.json()) as { seed: { paths: Array<Record<string, unknown>> } | null };
}

beforeEach(() => {
  calls.length = 0;
  createMock.mockClear();
});

describe("goal-paths route (per-goal parallel)", () => {
  it("drafts every goal in its own call and returns real, personalized paths", async () => {
    script = {
      "Walk the Annapurna Circuit": [REAL_DO],
      "Stay close to family": [REAL_BE],
    };

    const { seed } = await callRoute();

    expect(seed).not.toBeNull();
    expect(seed!.paths).toHaveLength(2);
    // Real content, not the generic fallback.
    expect((seed!.paths[0].milestones as Array<{ label: string }>)[0].label).toBe(REAL_DO);
    expect((seed!.paths[1].alreadyHelps as string[])[0]).toBe(REAL_BE);
    // One call per goal — proof it's per-goal, and no wasted re-draft when all succeed.
    expect(calls.sort()).toEqual(["Stay close to family", "Walk the Annapurna Circuit"]);
  });

  it("fails honestly (null) when a goal can't be drafted — never generic filler", async () => {
    script = {
      "Walk the Annapurna Circuit": [REAL_DO], // this one always succeeds
      "Stay close to family": [null, null], // empty on both the first pass and the re-draft
    };

    const { seed } = await callRoute();

    // The whole set fails honestly rather than showing the succeeded goal beside a
    // generic path for the failed one.
    expect(seed).toBeNull();
    // The failing goal was re-drafted once (two calls); no generic path was ever built.
    expect(calls.filter((c) => c === "Stay close to family")).toHaveLength(2);
  });

  it("recovers a transient miss on the second pass, re-drafting only the failed goal", async () => {
    script = {
      "Walk the Annapurna Circuit": [REAL_DO], // succeeds first time
      "Stay close to family": [null, REAL_BE], // empty first, real on the re-draft
    };

    const { seed } = await callRoute();

    expect(seed).not.toBeNull();
    expect(seed!.paths).toHaveLength(2);
    expect((seed!.paths[1].alreadyHelps as string[])[0]).toBe(REAL_BE);
    // Only the failed goal was retried: the succeeded "do" goal was called once.
    expect(calls.filter((c) => c === "Walk the Annapurna Circuit")).toHaveLength(1);
    expect(calls.filter((c) => c === "Stay close to family")).toHaveLength(2);
  });
});
