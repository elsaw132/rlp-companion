"use client";

// TEMPORARY PREVIEW — drives the reworked 4.3 "commit to your goals" surface
// (GoalsCommit) with mock data, so the interaction can be verified in isolation
// before it's wired into the real flow. No auth, no live API. Safe to delete.

import { useState } from "react";
import GoalsCommit, {
  type CommittedGoal,
  type GoalsFraming,
} from "../../components/GoalsCommit";
import type { GoalSuggestion, GoalVariant } from "@/lib/balancedGoalsSeed";

// A representative slice of John's real drafted goals, each with proper gentler /
// bolder sizes — the same three-level shape the real model produces. The `goals`
// prop is stripped to originals only (below), so dialling a goal exercises the lazy
// fetch, and the stub returns these real phrasings.
const FULL_GOALS: (GoalSuggestion & { quieter: GoalVariant; bolder: GoalVariant })[] = [
  { source: "wanting to be a Winchester guide", area: "Winchester & history", original: { track: "do", label: "Become a Winchester guide — study its history and lead a few guided walks for friends and family", cadence: "Over the first year" }, quieter: { track: "do", label: "Read deeply into Winchester's history and lead one informal walk for friends this year", cadence: "One walk this year" }, bolder: { track: "do", label: "Train as a proper Winchester guide and run walks for visitors by the end of year one", cadence: "Leading public walks within a year" } },
  { source: "rowing", area: "On the water", original: { track: "do", label: "Join the rowing club and bring two or three local friends in alongside you", cadence: "Weekly through the season" }, quieter: { track: "do", label: "Get out with the rowing club a few times this season to see how it fits", cadence: "A few times this season" }, bolder: { track: "do", label: "Join the rowing club, row weekly, and enter a crew race with your friends next summer", cadence: "A race by next summer" } },
  { source: "padel", area: "Sport", original: { track: "do", label: "Take a beginner padel course and join a regular club session", cadence: "A course this year" }, quieter: { track: "do", label: "Try a few padel taster sessions at the local club", cadence: "A few sessions this year" }, bolder: { track: "do", label: "Get properly good at padel — lessons, then play in a local league by next summer", cadence: "In a league by next summer" } },
  { source: "wanting a big trip with Sarah", area: "Travel", original: { track: "do", label: "Take the big trip to Vancouver with Sarah, researching the culture, food and history beforehand", cadence: "Within eighteen months" }, quieter: { track: "do", label: "Plan one proper, well-researched trip away with Sarah this year", cadence: "One trip this year" }, bolder: { track: "do", label: "Spend a month in Canada with Sarah — Vancouver and the Rockies — with deep research before you go", cadence: "A month away within two years" } },
  { source: "wanting to give back", area: "Volunteering", original: { track: "do", label: "Find and commit to a regular volunteering role supporting people who are isolated", cadence: "Weekly, from the first year" }, quieter: { track: "do", label: "Try volunteering for a cause once a month to find the right fit", cadence: "Monthly to start" }, bolder: { track: "do", label: "Take on a volunteering role with real responsibility, supporting isolated people every week", cadence: "A committed weekly role" } },
  { source: "being there for the grandchildren", area: "Family", original: { track: "do", label: "Set up a regular, committed slot with the grandchildren they can count on", cadence: "Weekly" }, quieter: { track: "do", label: "Have the grandchildren over most weeks", cadence: "Most weeks" }, bolder: { track: "do", label: "Be the weekly childcare anchor in term time — school runs and all", cadence: "Every week in term time" } },
  { source: "sea swimming", area: "Keeping fit", original: { track: "do", label: "Make sea swimming a regular seasonal habit, built into the week when the weather allows", cadence: "Through the warmer months" }, quieter: { track: "do", label: "Get in the sea a handful of times over the summer", cadence: "A few times this summer" }, bolder: { track: "do", label: "Swim in the sea every week through the warmer months, and join a group swim", cadence: "Weekly, with a group" } },
  { source: "evening reading with Sarah", area: "Home", original: { track: "do", label: "Protect the evening reading habit with Sarah as a daily fixture", cadence: "Daily" }, quieter: { track: "do", label: "Read together with Sarah most evenings", cadence: "Most evenings" }, bolder: { track: "do", label: "Read a book a fortnight with Sarah, taking turns to choose", cadence: "A book a fortnight" } },
];

// What the surface receives: originals only (so the dial fetches the sizes lazily).
const MOCK_GOALS: GoalSuggestion[] = FULL_GOALS.map(({ source, area, original }) => ({
  source,
  area,
  original,
}));

const STAGES: Record<string, GoalsFraming> = {
  retired: {
    title: "What will you commit to this year?",
    intro:
      "These goals are drawn from everything you've told us — the specific things you could commit to this year. Tick at least one you'll take on, reword any with Edit, or add your own.",
    timeframe: "This year",
    timeframeMake: "this year",
  },
  soon: {
    title: "What will you commit to in your first year?",
    intro:
      "These goals are drawn from everything you've told us — the specific things you could commit to in your first year. Tick at least one you'll take on, reword any with Edit, or add your own.",
    timeframe: "Year one",
    timeframeMake: "in your first year",
  },
  far: {
    title: "What will you commit to in your first year?",
    intro:
      "Retirement is likely ten years or more off for you yet, so there's no rush to act on these now. These goals are drawn from everything you've told us — the specific things you could commit to in your first year. Tick at least one you'll take on, reword any with Edit, or add your own.",
    timeframe: "Year one",
    timeframeMake: "in your first year",
  },
};

// Stubbed variant fetch: pretend to call the API, then return this goal's real
// gentler/bolder phrasings (matched by source) after a beat — exactly the shape the
// live model returns.
async function stubVariants(goal: { label: string; cadence?: string; source?: string }) {
  await new Promise((r) => setTimeout(r, 400));
  const g = FULL_GOALS.find((x) => x.source === goal.source);
  return g ? { quieter: g.quieter, bolder: g.bolder } : {};
}

export default function GoalsReworkPreview() {
  const [stage, setStage] = useState<keyof typeof STAGES>("retired");
  const [result, setResult] = useState<CommittedGoal[] | null>(null);

  return (
    <div style={{ maxWidth: 660, margin: "0 auto", padding: "24px 20px 80px", fontFamily: "var(--font-sans)" }}>
      <div style={{ background: "#EAF4F3", border: "1px solid #CFE6E3", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#28524d", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
        <b>Preview</b>
        <span>retirement stage:</span>
        {(["retired", "soon", "far"] as const).map((k) => (
          <button
            key={k}
            onClick={() => { setStage(k); setResult(null); }}
            style={{ border: "1px solid #B9D8D3", borderRadius: 999, padding: "5px 11px", fontSize: 12.5, cursor: "pointer", background: stage === k ? "var(--brand-primary)" : "#fff", color: stage === k ? "#fff" : "#28524d" }}
          >
            {k === "retired" ? "Already retired" : k === "soon" ? "Retiring soon" : "10+ years away"}
          </button>
        ))}
      </div>

      {result ? (
        <div>
          <h3 style={{ fontFamily: "var(--font-serif)", color: "var(--ink)" }}>Committed ({result.length})</h3>
          <pre style={{ background: "var(--info-surface, #F3F0E7)", padding: 14, borderRadius: 10, fontSize: 12.5, overflowX: "auto", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
          <button onClick={() => setResult(null)} style={{ marginTop: 10, border: "1px solid var(--border)", background: "#fff", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
            ← Back to the goals
          </button>
        </div>
      ) : (
        <GoalsCommit
          key={stage}
          goals={MOCK_GOALS}
          framing={STAGES[stage]}
          labels={{ finish: "Commit to these" }}
          onFetchVariants={stubVariants}
          onFinish={setResult}
        />
      )}
    </div>
  );
}
