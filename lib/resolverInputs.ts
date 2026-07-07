// Small structured-input builders that turn the resolver's manifest-scoped facts
// into the exact shapes the Stage-4 seed routes already accept — so the routes
// (and their prompts) stay unchanged while their data now comes from the
// canonical profile instead of the lossy buildUserModel re-derivation or a
// transcript scrape. Pure and client+server safe.

import type { ResolvedFact } from "@/lib/contextResolver";
import { type RecurringDomain, type StoredFact, draftsFromSnapshot } from "@/lib/contextFacts";
import type { BalancedArea, SeasonCard, BalancedSeed, ValueEntry, ModelSource } from "@/lib/userModel";
import { STAGES } from "@/lib/modules";

// Synthesize a set of active facts from a ModelSource's structured builds —
// reconstructing the snapshot it implies and running the phase-1 backfill mapper
// over it. Used where there's no live profile to read from: the fictional seed
// member (so the RLP demo shows verbatim values + threat/protector) and the
// before/after review tooling. The result mirrors what backfill would store.
export function synthesizeActiveFacts(source: ModelSource): StoredFact[] {
  const snapshot: Record<string, unknown> = {};
  for (const stage of STAGES) {
    for (const m of stage.modules) {
      const b = source.getBuild(m.id);
      if (b) snapshot[`interaction:${m.id}`] = b;
    }
  }
  const dreams = source.getDreams("1.money");
  if (dreams) snapshot["dreams:1.money"] = dreams;
  const s3 = source.getStage3Values();
  if (s3) snapshot["stage3-values"] = s3;
  snapshot["onboarding"] = source.getOnboarding();

  return draftsFromSnapshot(snapshot).map((d, i) => ({
    id: String(i + 1),
    userId: "synthetic",
    category: d.category,
    domain: d.domain ?? null,
    data: d.data,
    provenanceModule: d.provenanceModule,
    provenanceSource: d.provenanceSource,
    status: "active" as const,
    supersededBy: null,
    confidence: d.confidence,
    createdAt: "synthetic",
    lastAffirmedAt: null,
  }));
}

// The recurring-activity domain → balanced-area id (4.3's five areas).
export function domainToAreaId(domain: RecurringDomain | null): BalancedArea | null {
  switch (domain) {
    case "Restore":
      return "restore";
    case "Move":
      return "move";
    case "Think":
      return "think";
    case "Connect":
      return "connect";
    case "Contribute":
      return "contribute";
    default:
      return null;
  }
}

const AREAS: BalancedArea[] = ["restore", "move", "think", "connect", "contribute"];

// 4.3 springboards: the recurring activities the person already mapped across the
// balanced areas (Stage 2), grouped by area, in their own words. Replaces
// balancedSpringboardsFromModel — same shape, fact-sourced (so a removed activity
// is genuinely gone). An empty area was empty at Stage 2, never a classifier miss.
export function springboardsFromFacts(
  recurringFacts: ResolvedFact[]
): BalancedSeed {
  // One entry per activity label, carrying the area(s) it appears in (an activity
  // mapped to two areas in Stage 2 shows under both).
  const byLabel = new Map<string, Springboard>();
  for (const f of recurringFacts) {
    const area = domainToAreaId(f.domain);
    if (!area || !f.label) continue;
    const key = f.label.toLowerCase();
    const existing = byLabel.get(key);
    if (existing) {
      if (!existing.areas.includes(area)) existing.areas.push(area);
    } else {
      byLabel.set(key, { label: f.label, areas: [area] });
    }
  }
  return { springboards: [...byLabel.values()] };
}

type Springboard = BalancedSeed["springboards"][number];

// The per-area { area, labels } shape the /api/balanced-goals route receives.
export function springboardAreasFromFacts(
  recurringFacts: ResolvedFact[]
): { area: BalancedArea; labels: string[] }[] {
  const seed = springboardsFromFacts(recurringFacts);
  return AREAS.map((area) => ({
    area,
    labels: seed.springboards
      .filter((s) => s.areas.includes(area))
      .map((s) => s.label),
  }));
}

// 4.2 season cards: short tokens to sort onto the board, drawn from the same
// kinds the old seasonCardsFromModel used — aspirations, activities and the
// people who feature — now fact-sourced and dream-walled (one_off_dream is not
// in 4.2's manifest, so it can't appear here). Capped at a sortable dozen.
export function seasonCardsFromFacts(items: ResolvedFact[]): SeasonCard[] {
  const cards: SeasonCard[] = [];
  const seen = new Set<string>();
  const add = (label: string, category: string) => {
    const text = conciseCardLabel(label);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    cards.push({ label: text, category });
  };

  for (const f of items) {
    if (f.category === "aspiration") add(f.label, "Aspiration");
  }
  for (const f of items) {
    if (f.category === "recurring_activity" || f.category === "energy_pattern") {
      add(f.label, "Activity");
    }
  }
  for (const f of items) {
    if (f.category === "relationship") add(f.label, "People");
  }
  return cards.slice(0, 12);
}

// Aspirations often carry the person's own aside after a dash/colon; keep just
// the thing itself so cards stay short and near-duplicates collapse.
function conciseCardLabel(text: string): string {
  const head = text.split(/\s+(?:--|—|–)\s+|:\s+/)[0].trim();
  return head || text.trim();
}

// The plan's core values, read straight from the canonical profile: the user's
// VERBATIM description (never the 3.6 LLM re-distillation) plus the 3.4 threat and
// protectors, ordered by the Stage-3 ranking (value_priority facts). Prefers the
// values flagged core-five; falls back to all value facts when none are flagged.
// Empty when there are no value facts (the caller then keeps its old derivation).
export function coreValuesFromFacts(facts: StoredFact[]): ValueEntry[] {
  const active = facts.filter((f) => f.status === "active");
  const valueFacts = active.filter((f) => f.category === "value");
  if (!valueFacts.length) return [];

  const rankByLabel = new Map<string, number>();
  for (const f of active) {
    if (f.category !== "value_priority") continue;
    const lbl = (f.data.label ?? "").trim().toLowerCase();
    const rank = typeof f.data.rank === "number" ? f.data.rank : 99;
    if (lbl && !rankByLabel.has(lbl)) rankByLabel.set(lbl, rank);
  }

  const flagged = valueFacts.filter((f) => f.data.coreFive === true);
  const chosen = flagged.length ? flagged : valueFacts;

  const entries: ValueEntry[] = chosen.map((f) => {
    const value = (f.data.label ?? "").trim();
    const meaning = typeof f.data.description === "string" ? f.data.description.trim() : "";
    const threat = typeof f.data.threat === "string" ? f.data.threat.trim() : "";
    const protectors = Array.isArray(f.data.protectors)
      ? (f.data.protectors as unknown[]).map((p) => String(p).trim()).filter(Boolean)
      : [];
    return {
      value,
      ...(meaning ? { meaning } : {}),
      confidence: f.confidence === "still_forming" ? "still forming" : "certain",
      ...(threat ? { threat } : {}),
      ...(protectors.length ? { protectors } : {}),
    };
  });

  entries.sort(
    (a, b) =>
      (rankByLabel.get(a.value.toLowerCase()) ?? 99) -
      (rankByLabel.get(b.value.toLowerCase()) ?? 99)
  );
  return entries;
}

// ---- Retirement-paths fact reads (Phase 5) ----------------------------------
// Deterministic reads of the facts captured in Phases 3–4, for the plan model.
// Nothing new is captured here.

// The retired letter's stock-take, split by disposition. The extractor stores the
// element in `label` and one of keep/change/leave in `description`.
export type KeepChangeLeave = { keep: string[]; change: string[]; leaveBehind: string[] };

export function keepChangeLeaveFromFacts(facts: StoredFact[]): KeepChangeLeave {
  const out: KeepChangeLeave = { keep: [], change: [], leaveBehind: [] };
  for (const f of facts) {
    if (f.status !== "active" || f.category !== "keep_change_leave") continue;
    const label = String(f.data.label ?? "").trim();
    if (!label) continue;
    const d = String(f.data.description ?? "").toLowerCase();
    if (d.includes("leave")) out.leaveBehind.push(label);
    else if (d.includes("change") || d.includes("reshape")) out.change.push(label);
    else if (d.includes("keep")) out.keep.push(label);
    // An unclear disposition is dropped rather than guessed at.
  }
  return out;
}

// The unfinished-work threads from the retired "what work gave you" module —
// surfaced gently as things they might still want to pick back up.
export function unfinishedWorkFromFacts(facts: StoredFact[]): string[] {
  return facts
    .filter((f) => f.status === "active" && f.category === "unfinished_work")
    .map((f) => String(f.data.label ?? "").trim())
    .filter(Boolean);
}

// Whether leaving work was NOT fully their own choice (circumstantial or a mix),
// so the plan framing stays gentle and never celebrates a "chosen fresh start".
// No onset fact on record → false (default to the normal, neutral framing).
export function retirementOnsetCircumstantial(facts: StoredFact[]): boolean {
  const f = facts.find(
    (x) => x.status === "active" && x.category === "retirement_onset"
  );
  if (!f) return false;
  return !String(f.data.label ?? "").toLowerCase().includes("own choice");
}

// The winding-down exit, when they've settled a plan (the decided path for §8).
export type WindDownExitRead = {
  label: string;
  decision: string;
  currentShape: string;
  windingDuration: string;
};

export function windDownExitFromFacts(facts: StoredFact[]): WindDownExitRead | null {
  const f = facts.find(
    (x) => x.status === "active" && x.category === "wind_down_exit"
  );
  if (!f) return null;
  return {
    label: String(f.data.label ?? "").trim(),
    decision: String(f.data.decision ?? "").trim(),
    currentShape: String(f.data.currentShape ?? "").trim(),
    windingDuration: String(f.data.windingDuration ?? "").trim(),
  };
}

// 4.6 week rhythm: the person's real recurring activities, as the structured
// seed the week-shape draft is built from — replacing the transcript scrape.
export type RecurringSeed = { label: string; domain: string | null };

export function recurringSeedFromFacts(
  recurringFacts: ResolvedFact[]
): RecurringSeed[] {
  const out: RecurringSeed[] = [];
  const seen = new Set<string>();
  for (const f of recurringFacts) {
    if (!f.label) continue;
    const key = f.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: f.label, domain: f.domain ?? null });
  }
  return out;
}
