// Turning stored baseline answers into the shape the pilot actually analyses by.
//
// The store keeps what the person answered; analysis wants demographics — age
// rather than a date of birth, a readable work status rather than a code. That
// derivation lives here, once, so the admin table and the CSV export can never
// disagree about what someone's age or status is.

import type { BaselineSurveyRow } from "@/lib/db";

// Age in whole years at the moment the baseline was taken — NOT age today.
//
// Two reasons. It doesn't drift: a participant's recorded age stays the same
// however long the pilot runs and whenever the data is re-exported, which is
// what a research record needs. And it's deterministic: "age today" would depend
// on when the page happened to render, so the server and the browser could
// disagree and trip a hydration mismatch.
//
// null when the date of birth was skipped (it's optional) or unparseable.
export function ageAtBaseline(
  dob: string | null,
  takenAtIso: string
): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  const taken = new Date(takenAtIso);
  if (Number.isNaN(born.getTime()) || Number.isNaN(taken.getTime())) return null;

  let age = taken.getUTCFullYear() - born.getUTCFullYear();
  // Not had their birthday yet that year — step back one.
  const monthDiff = taken.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && taken.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  // A nonsense date (a typo'd year, a future DOB) is worse than no answer:
  // silently feeding it into an average would skew the cohort.
  return age >= 0 && age < 120 ? age : null;
}

// Age bands, for grouping a small pilot where individual ages are too sparse to
// compare. Bounded at both ends so every real age lands somewhere.
export function ageBand(age: number | null): string {
  if (age === null) return "";
  if (age < 50) return "under 50";
  if (age < 55) return "50–54";
  if (age < 60) return "55–59";
  if (age < 65) return "60–64";
  if (age < 70) return "65–69";
  return "70+";
}

// The stored retirementStage code as a person would say it. Codes are stable and
// belong in the database; a spreadsheet column reading "winding_down" does not.
const STAGE_LABEL: Record<string, string> = {
  working: "Still working",
  winding_down: "Winding down",
  recently_retired: "Retired < 2 years",
  established: "Retired 2+ years",
};

export function stageLabel(stage: string | null): string {
  if (!stage) return "";
  return STAGE_LABEL[stage] ?? stage;
}

// "Do you have a partner?" is stored as the answer given. It is NOT a full
// relationship status — the pilot survey asked for one and onboarding asks this
// instead — so it is labelled honestly wherever it surfaces rather than being
// dressed up as something it isn't.
export function partnerLabel(partner: string | null): string {
  if (!partner) return "";
  // "Me and my partner" predates the question being simplified to Yes/No.
  if (partner === "Yes" || partner === "Me and my partner") return "Has a partner";
  if (partner === "No") return "No partner";
  return partner;
}

// One participant's baseline, flattened for a table row or a CSV line.
export type BaselineAnalysisRow = {
  userId: string;
  age: number | null;
  ageBand: string;
  gender: string;
  stage: string;
  partner: string;
  horizon: string;
  feelings: string[];
  priorPlanning: string;
  confidence: number | null;
  expectations: string;
  takenAt: string;
};

export function toAnalysisRow(r: BaselineSurveyRow): BaselineAnalysisRow {
  const age = ageAtBaseline(r.dob, r.createdAt);
  return {
    userId: r.userId,
    age,
    ageBand: ageBand(age),
    gender: r.gender ?? "",
    stage: stageLabel(r.retirementStage),
    partner: partnerLabel(r.partner),
    horizon: r.horizon ?? "",
    feelings: r.feelings,
    priorPlanning: r.priorPlanning ?? "",
    confidence: r.planningConfidence,
    expectations: r.expectations ?? "",
    takenAt: r.createdAt,
  };
}
