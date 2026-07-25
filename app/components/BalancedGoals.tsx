"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  BalancedGoalsInteraction,
  BalancedGoalsResult,
} from "@/lib/modules";
import type { BalancedSeed } from "@/lib/userModel";
import {
  fetchGoalDraft,
  fetchGoalVariants,
  type GoalSuggestion,
} from "@/lib/balancedGoalsSeed";
import { goalThreadsFromFacts } from "@/lib/goalThreads";
import { useUserData } from "@/lib/userData";
import { type EditableProps } from "./InteractionShell";
import { DraftFailed } from "./DraftFailed";
import GoalsCommit, {
  type CommittedGoal,
  type GoalsFraming,
} from "./GoalsCommit";

// The coach-facing summary — the person's committed goals, each with the area of life
// it's about and its rough timing.
export function balancedGoalsSummaryText(result: BalancedGoalsResult): string {
  const label = result.summaryLabel ?? "Your most important goals";
  const lines = result.goals
    .filter((g) => g.label.trim())
    .map((g) => {
      const area = g.area ? `${g.area}: ` : "";
      const when = g.cadence ? ` (${g.cadence})` : "";
      return `${area}${g.label}${when}`;
    });
  if (!lines.length) return `${label}. (none set yet)`;
  return `${label}. ${lines.join(" · ")}`;
}

// The retirement-stage framing (see the build spec §4.4). Retired → "this year";
// someone 10+ years out → "first year" led by a no-rush line; everyone else in
// between → "first year".
function goalsFraming(
  stage: string | null,
  horizon: string | null | undefined
): GoalsFraming {
  const retired = stage === "recently_retired" || stage === "established";
  if (retired) {
    return {
      title: "What will you commit to this year?",
      intro:
        "These goals are drawn from everything you've told us — the specific things you could commit to this year. Tick at least one you'll take on, reword any with Edit, or add your own.",
      timeframe: "This year",
      timeframeMake: "this year",
    };
  }
  const far = horizon === "More than 10 years";
  const ack = far
    ? "Retirement is likely ten years or more off for you yet, so there's no rush to act on these now. "
    : "";
  return {
    title: "What will you commit to in your first year?",
    intro: `${ack}These goals are drawn from everything you've told us — the specific things you could commit to in your first year. Tick at least one you'll take on, reword any with Edit, or add your own.`,
    timeframe: "Year one",
    timeframeMake: "in your first year",
  };
}

// Reopen a saved result for editing: each kept goal becomes an "original" phrasing
// (the bolder/quieter dial was spent when it was kept).
function suggestionsFromResult(result: BalancedGoalsResult): GoalSuggestion[] {
  return result.goals.map((g) => ({
    area: g.area,
    ...(g.source ? { source: g.source } : {}),
    original: {
      track: "do" as const,
      label: g.label,
      ...(g.cadence ? { cadence: g.cadence } : {}),
    },
  }));
}

// Build the saved result from the committed set: every committed goal is spotlit
// (focus), ranked by the order shown, and carries its provenance source.
function buildResult(
  committed: CommittedGoal[],
  summaryLabel: string
): BalancedGoalsResult {
  const areaSeen = new Map<string, string>();
  for (const c of committed) {
    const key = c.area.trim().toLowerCase();
    if (key && !areaSeen.has(key)) areaSeen.set(key, c.area.trim());
  }
  return {
    type: "balanced-goals",
    goals: committed.map((c, i) => ({
      label: c.label.trim(),
      area: c.area.trim(),
      track: "do" as const,
      ...(c.cadence?.trim() ? { cadence: c.cadence.trim() } : {}),
      ...(c.source ? { source: c.source } : {}),
      focus: true,
      rank: i + 1,
    })),
    areas: Array.from(areaSeen.values()).map((a) => ({ id: a, label: a })),
    deliberateGaps: [],
    summaryLabel,
  };
}

type BalancedGoalsProps = {
  interaction: BalancedGoalsInteraction;
  // Kept for call-site compatibility; the rework draws its input from the fact-based
  // thread pool, not the rendered user-model string or the springboard seed.
  seed?: BalancedSeed;
  sessionId: string;
  userModelText?: string;
  onboardingContext: string;
  hasPartner?: boolean;
  onFinish: (result: BalancedGoalsResult) => void;
} & EditableProps<BalancedGoalsResult>;

export default function BalancedGoals({
  interaction,
  sessionId,
  onboardingContext,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: BalancedGoalsProps) {
  const { draftingLabel, summaryLabel } = interaction;
  const userData = useUserData();

  const framing = goalsFraming(
    userData.getRetirementStage(),
    userData.getOnboarding().horizon
  );

  // Editing reopens the saved goals; a fresh run uses any cached draft, or drafts one.
  const cachedSeed = initial ? null : userData.getGoalSeed(sessionId);
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">(
    initial || cachedSeed ? "ready" : "loading"
  );
  const [drafted, setDrafted] = useState<GoalSuggestion[]>(() => {
    if (initial) return suggestionsFromResult(initial);
    if (cachedSeed) return cachedSeed.suggestions;
    return [];
  });

  // Draft once, from the deterministic thread pool. Never drafts from an empty pool
  // (that yields the generic "we don't know you yet" set) — it waits until the facts
  // resolve; this effect re-runs as the snapshot fills in.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (phase !== "loading" || fetchedRef.current) return;
    const cached = userData.getGoalSeed(sessionId);
    const threads = goalThreadsFromFacts(userData.getActiveFacts());
    if (!cached && threads.length === 0) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      const draft = cached ?? (await fetchGoalDraft(threads, onboardingContext));
      if (cancelled) return;
      if (!draft) {
        setPhase("failed");
        return;
      }
      if (!cached) void userData.saveGoalSeed(sessionId, draft);
      setDrafted(draft.suggestions);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, userData.loading]);

  if (phase === "loading") {
    return (
      <section style={styles.wrap}>
        <div style={styles.draftCard}>
          <span style={styles.draftSun} aria-hidden="true">
            ☀
          </span>
          <p style={styles.draftText}>{draftingLabel}</p>
        </div>
      </section>
    );
  }

  if (phase === "failed") {
    return (
      <section style={styles.wrap}>
        <DraftFailed
          message="Something went wrong drafting your goals — your answers are all safe. Try again, and if it keeps happening, let the Chorus team know so we can fix it."
          onRetry={() => {
            fetchedRef.current = false;
            setPhase("loading");
          }}
        />
      </section>
    );
  }

  return (
    <section style={styles.wrap}>
      <GoalsCommit
        goals={drafted}
        framing={framing}
        labels={{ finish: mode === "edit" ? "Save changes" : "Commit to these", cancel: "Cancel" }}
        mode={mode}
        onFetchVariants={fetchGoalVariants}
        onFinish={(committed) => onFinish(buildResult(committed, summaryLabel))}
        onCancel={onCancel}
      />
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  draftCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "32px 24px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    textAlign: "center",
  },
  draftSun: { fontSize: "28px" },
  draftText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
    maxWidth: "34ch",
  },
};

// ---- The recap summary (unchanged): the person's committed goals ----
export function BalancedGoalsSummary({
  result,
}: {
  result: BalancedGoalsResult;
}) {
  const goals = result.goals.filter((g) => g.label.trim());
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel}</p>
      <div style={summaryStyles.goals}>
        {goals.length ? (
          goals.map((g, i) => (
            <div key={i} style={summaryStyles.goalBody}>
              {g.area && <span style={summaryStyles.area}>{g.area}</span>}
              <span style={summaryStyles.goalLabel}>{g.label}</span>
              {g.cadence && <span style={summaryStyles.detail}>{g.cadence}</span>}
            </div>
          ))
        ) : (
          <span style={summaryStyles.areaEmpty}>—</span>
        )}
      </div>
    </>
  );
}

const summaryStyles: Record<string, React.CSSProperties> = {
  heading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 16px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  goals: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  goalBody: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  goalLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  area: {
    fontWeight: 500,
    color: "var(--accent-strong)",
  },
  detail: {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: 0,
  },
  areaEmpty: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
};
