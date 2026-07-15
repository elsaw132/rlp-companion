// The retired cohorts, as seeded example members — a DEV FIXTURE.
//
// Every retirement-path branch in the plan (the Reset Plan title, the reset
// stock-take, "Worth picking up", the chapter-ahead framing, the missing
// leaving-work panel) is gated on a retirementStage that the main seed member
// doesn't have: Margaret is still working, so opening /plan shows exactly one of
// the four cohorts and the other three are unreviewable. This wraps SEED_SOURCE,
// overriding only the two things that decide a cohort — the onboarding
// retirementStage, and the retired-letter facts the resolvers read — so the
// variants flow through the SAME assembler as everything else. Nothing here is
// bespoke to the render; it is the real path with different inputs.
//
// Reached via /plan?cohort=<stage> in development. See RlpReveal.

import type { ModelSource } from "@/lib/userModel";
import type { StoredFact } from "@/lib/contextFacts";
import type { RetirementStage } from "@/lib/userData";
import { SEED_SOURCE } from "@/lib/rlpPlanSeed";

// A retired member's stock-take (keep / change / leave). The extractor stores the
// element in `label` and the disposition in `description`, so these mirror the
// real fact shape rather than a convenient one.
type Stock = { label: string; description: string };

const RECENTLY_RETIRED_STOCK: Stock[] = [
  { label: "Thursday mornings with the choir", description: "keep" },
  { label: "The long walk before the day starts", description: "keep" },
  { label: "Sunday lunch with the whole family", description: "keep" },
  { label: "The afternoons that drift with no shape", description: "change" },
  { label: "Saying yes to things out of habit", description: "change" },
  { label: "Being the one everybody calls first", description: "leave" },
  { label: "The 6am alarm I never needed", description: "leave" },
];

const ESTABLISHED_STOCK: Stock[] = [
  { label: "Tuesdays at the community garden", description: "keep" },
  { label: "The reading group I've been in for years", description: "keep" },
  { label: "Swimming twice a week", description: "keep" },
  { label: "How little I see of friends outside the village", description: "change" },
  { label: "Meaning to write things down and never doing it", description: "change" },
  { label: "Feeling I should be busier than I want to be", description: "leave" },
];

const RECENTLY_RETIRED_UNFINISHED = [
  "The mentoring I started and never saw through",
  "Teaching someone the things I spent thirty years learning",
];

const ESTABLISHED_UNFINISHED = ["Passing on what I know, properly this time"];

function fact(
  category: string,
  data: Record<string, unknown>,
  i: number
): StoredFact {
  return {
    id: `seed-retired-${category}-${i}`,
    userId: "seed",
    category: category as StoredFact["category"],
    domain: null,
    data: data as StoredFact["data"],
    provenanceModule: "seed",
    provenanceSource: "extracted" as StoredFact["provenanceSource"],
    status: "active",
    supersededBy: null,
    confidence: "high" as StoredFact["confidence"],
    createdAt: "2026-06-01T09:00:00.000Z",
    lastAffirmedAt: null,
  };
}

function retiredFacts(
  stock: Stock[],
  unfinished: string[],
  // True for the member whose retirement wasn't fully their own choice, so the
  // gentle framing (onsetGentle) can be seen rather than taken on trust.
  circumstantial: boolean
): StoredFact[] {
  const out: StoredFact[] = [
    ...stock.map((s, i) => fact("keep_change_leave", s, i)),
    ...unfinished.map((label, i) => fact("unfinished_work", { label }, i)),
    fact(
      "retirement_onset",
      {
        label: circumstantial
          ? "A restructure made the decision for me"
          : "It was my own choice, at my own time",
      },
      0
    ),
  ];
  return out;
}

const VARIANTS: Record<string, { name: string; facts: StoredFact[] }> = {
  recently_retired: {
    name: "Jean",
    // Not fully her own choice — exercises the gentle onset framing.
    facts: retiredFacts(RECENTLY_RETIRED_STOCK, RECENTLY_RETIRED_UNFINISHED, true),
  },
  established: {
    name: "Ray",
    facts: retiredFacts(ESTABLISHED_STOCK, ESTABLISHED_UNFINISHED, false),
  },
};

// The winding-down member who has SETTLED how they're leaving — the one path that
// renders the short wind-down exit panel instead of the full 4.1 readiness one.
const WIND_DOWN_DECIDED: StoredFact[] = [
  {
    ...fact(
      "wind_down_exit",
      {
        label: "Three days now, nothing by the spring",
        decision: "Settled",
        currentShape: "Three days a week",
        windingDuration: "Over the next eight months",
      },
      0
    ),
  },
];

export const RETIRED_COHORTS = [
  "winding_down",
  "recently_retired",
  "established",
] as const;

export function isSeedCohort(v: string | null): v is RetirementStage {
  return !!v && (RETIRED_COHORTS as readonly string[]).includes(v);
}

// A ModelSource identical to the main seed except for the retirement stage and
// the retired-letter facts. Everything else — values, goals, seasons, week, first
// year — is Margaret's, deliberately: holding the rest constant is what makes the
// cohort differences legible rather than confounded by different content.
export function seedSourceForCohort(stage: RetirementStage): {
  source: ModelSource;
  name: string;
} {
  const variant = VARIANTS[stage];
  const extra = variant?.facts ?? WIND_DOWN_DECIDED;
  const base = SEED_SOURCE.getActiveFacts?.() ?? [];
  return {
    name: variant?.name ?? "Pat",
    source: {
      ...SEED_SOURCE,
      getOnboarding: () => ({
        ...SEED_SOURCE.getOnboarding(),
        retirementStage: stage,
      }),
      getActiveFacts: () => [...base, ...extra],
    },
  };
}
