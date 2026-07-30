// Module 4.3 — deterministic goal-thread assembly.
//
// The confidence guarantee for the "Your most important goals" rework (see the
// build spec): the list of goals must be COMPLETE, de-duplicated, and traceable —
// never at the mercy of the model's judgement about "what's central" (the failure
// that dropped grandchildren and over-merged sport on the seasons board).
//
// This module does the part that must NOT be left to the model: it gathers the
// person's priority-bearing facts into a de-duplicated pool of candidate THREADS,
// and marks the subset that are explicit stated wants — the aspirations and goals
// that a drafted list MUST represent (dropping one is the John / Winchester slip).
// The drafting step then writes one goal per thread and phrases it; a validation
// pass asserts every must-cover thread produced a goal and no thread is duplicated.

import type { StoredFact, FactCategory } from "@/lib/contextFacts";

export type GoalThread = {
  // The de-duplicated thing the person said, in their own words.
  label: string;
  // Where it came from — drives the "You mentioned {source}" provenance line and
  // lets us match a drafted goal back to its thread.
  category: FactCategory;
  provenanceModule: string;
  // An explicit stated want (an aspiration or an already-named goal). Every one of
  // these MUST be represented by a drafted goal — that is the anti-drop contract.
  mustCover: boolean;
};

// Which fact categories feed goal threads, and whether each is a must-cover want.
// Notes on what's deliberately absent:
//   • `goal` — the OUTPUT of a prior 4.3 run. Seeding a new draft from it is circular
//     and duplicative (proven live: John's prior goals re-appeared as near-duplicates).
//     A rework always drafts fresh from original source material.
//   • `one_off_dream` — dream-walled out of Stage 4.
const THREAD_CATEGORIES: { category: FactCategory; mustCover: boolean }[] = [
  { category: "aspiration", mustCover: true },
  { category: "hope", mustCover: false },
  { category: "recurring_activity", mustCover: false },
  { category: "relationship", mustCover: false },
];

function clean(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

// Assemble the de-duplicated candidate-thread pool from a person's active facts.
// Exact-label de-dup here is deterministic and total; paraphrase near-duplicates
// are merged by the drafting prompt and caught again by the output coercion.
export function goalThreadsFromFacts(facts: StoredFact[]): GoalThread[] {
  const active = facts.filter((f) => f.status === "active");
  const threads: GoalThread[] = [];
  const seen = new Set<string>();

  for (const { category, mustCover } of THREAD_CATEGORIES) {
    for (const f of active) {
      if (f.category !== category) continue;
      const label = clean(f.data?.label);
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      threads.push({
        label,
        category,
        provenanceModule: f.provenanceModule ?? "",
        mustCover,
      });
    }
  }
  return threads;
}

// The threads a drafted goal list must each represent — the explicit stated wants.
export function mustCoverThreads(threads: GoalThread[]): GoalThread[] {
  return threads.filter((t) => t.mustCover);
}
