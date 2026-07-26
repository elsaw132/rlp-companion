// The resolver. Given a module and a user's active facts, it renders the module
// exactly the slice of the canonical profile its manifest declares — split into:
//   - a SEED view (structured + a compact text block) for the exercise-generation
//     call, and
//   - a VITA view (a few tidy lines) for the {priorReflections} slot in Vita's
//     prompt.
//
// Rules (the §2/§4 guardrails): status=active only; never raw transcripts; never
// the whole profile — a module sees only its manifest's categories/domains/tags;
// both views stay compact (the cost/latency win). For `value`, the user's own
// verbatim description rides along (plus threat/protectors where the manifest
// asks), never a re-distillation.
//
// Pure and client+server safe — the same code renders Vita's opening on the
// client and assembles the RLP on the server.

import type {
  StoredFact,
  FactCategory,
  RecurringDomain,
} from "@/lib/contextFacts";
import {
  getManifest,
  TAG_PREDICATES,
  ageFromDobFact,
  type ManifestInput,
  type ManifestRole,
} from "@/lib/moduleManifests";

// One resolved fact, flattened to what a consumer needs. `data` is kept for the
// few callers that want the structured extras (a goal's track/area, a chapter's
// seasons), but most read label/description.
export type ResolvedFact = {
  category: FactCategory;
  domain: RecurringDomain | null;
  label: string;
  description?: string;
  // The person's own "why" captured in conversation (contextFacts reason path).
  // Rides along wherever the fact renders, no manifest flag needed.
  reason?: string;
  threat?: string;
  protectors?: string[];
  data: StoredFact["data"];
};

export type SeedView = {
  // Resolved facts for the seed/both inputs, in manifest order.
  items: ResolvedFact[];
  // Age computed from the DOB fact, when the manifest asked for {age} (2.6).
  age: number | null;
  // One compact line per category (same rendering as the text block, unjoined).
  lines: string[];
  // A compact text block for routes that accept a single context string (drop-in
  // for the old renderUserModel(...) argument).
  text: string;
};

export type VitaView = {
  // The resolved facts for the vita/both inputs (same flattened shape as the
  // seed view's items), for callers that want them structured.
  items: ResolvedFact[];
  lines: string[];
  // The compact block for the {priorReflections} slot.
  text: string;
};

export type ResolvedViews = { seed: SeedView; vita: VitaView };

// ---- Selection --------------------------------------------------------------

const clean = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

// Whether a fact matches one manifest input (category, optional domain, optional
// semantic tag). status=active is assumed (callers pass active facts) but
// re-checked defensively.
function matches(fact: StoredFact, input: ManifestInput): boolean {
  if (fact.status !== "active") return false;
  if (fact.category !== input.category) return false;
  if (input.domain && fact.domain !== input.domain) return false;
  if (input.tag && !TAG_PREDICATES[input.tag](fact)) return false;
  return true;
}

function toResolved(fact: StoredFact, input: ManifestInput): ResolvedFact {
  const out: ResolvedFact = {
    category: fact.category,
    domain: fact.domain,
    label: clean(fact.data.label),
    data: fact.data,
  };
  if (input.withDescription) {
    const desc = clean(fact.data.description);
    if (desc) out.description = desc;
  }
  // A conversational reason travels with the fact everywhere (no manifest gate),
  // so the "why" reaches the plan wherever the pick already does.
  const reason = clean(fact.data.reason);
  if (reason) out.reason = reason;
  if (input.withThreatProtector) {
    const threat = clean(fact.data.threat);
    if (threat) out.threat = threat;
    const protectors = Array.isArray(fact.data.protectors)
      ? (fact.data.protectors as unknown[]).map(clean).filter(Boolean)
      : [];
    if (protectors.length) out.protectors = protectors;
  }
  return out;
}

// Collect the resolved facts for the inputs whose role is in `roles`, preserving
// manifest order and de-duplicating a fact that several inputs would select.
function collect(
  facts: StoredFact[],
  inputs: ManifestInput[],
  roles: ManifestRole[]
): ResolvedFact[] {
  const want = new Set(roles);
  const out: ResolvedFact[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    if (!want.has(input.role)) continue;
    for (const fact of facts) {
      if (!matches(fact, input)) continue;
      const lbl = clean(fact.data.label);
      if (!lbl) continue;
      const key = `${fact.category}|${fact.domain ?? ""}|${lbl.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(toResolved(fact, input));
    }
  }
  return out;
}

// ---- Rendering --------------------------------------------------------------

// The human phrase each category reads as in the rendered views. Kept terse —
// leanness is a guardrail.
const CATEGORY_LABEL: Record<FactCategory, string> = {
  day_picture_item: "In the day they pictured",
  role: "Roles they want to carry forward",
  week_shape_pref: "The week shape they leaned toward",
  letter_thread: "From the letter to their future self",
  one_off_dream: "Dreams they'd love (money no object)",
  aspiration: "Aspirations and interests they could work toward",
  recurring_activity: "Regular activities that matter to them",
  energy_pattern: "What lifts or drains their energy",
  relationship: "Relationships that feature most",
  social_balance_pref: "Their balance of solitude and company",
  commitment: "Commitments they've made",
  strength: "Their character strengths",
  value: "Their values",
  value_priority: "How they rank their values",
  hope: "What they're reaching for",
  fear: "Live worries to take account of",
  meaning_thread: "What they want these years to stand for",
  readiness: "Where they are on leaving work",
  chapter: "Chapters of retirement they've sketched",
  goal: "Goals they've set",
  goal_path: "How they plan to reach their goals",
  principle: "Decision principles they've settled on",
  week_plan: "The rhythm of their week",
  first_year_plan: "Their first-year picture",
  concern: "Concerns they've raised",
  onboarding_fact: "About them",
  wind_down_exit: "How and when they'll leave work",
  retirement_onset: "How leaving work came about",
  unfinished_work: "Work threads they left unfinished",
  keep_change_leave: "What they'd keep, change, or leave behind",
};

function renderFact(f: ResolvedFact): string {
  let s = f.label;
  if (f.description) s += ` (${f.description})`;
  if (f.reason) s += ` — because ${f.reason}`;
  if (f.threat) s += ` — at risk from: ${f.threat}`;
  if (f.protectors && f.protectors.length) {
    s += ` — protected by: ${f.protectors.join(", ")}`;
  }
  // "Tentative stays tentative": a fact the person only floated as a maybe is
  // marked so, so neither Vita nor the seed generators ever treat it as a settled
  // choice or an anchor (the rowing-with-Sarah case).
  if (f.data.tentative === true) s += " — only a maybe they floated, not settled";
  return s;
}

// One line per category, the facts joined — compact, ordered, never a transcript.
function renderLines(items: ResolvedFact[], age: number | null): string[] {
  const byCategory = new Map<FactCategory, ResolvedFact[]>();
  for (const it of items) {
    const arr = byCategory.get(it.category) ?? [];
    arr.push(it);
    byCategory.set(it.category, arr);
  }
  const lines: string[] = [];
  for (const [category, facts] of byCategory) {
    // The DOB fact reads as an age, not a date.
    if (category === "onboarding_fact" && age !== null && facts.some((f) => f.data.field === "dob")) {
      const others = facts.filter((f) => f.data.field !== "dob");
      lines.push(`- Age: ${age}.`);
      if (others.length) {
        lines.push(`- ${CATEGORY_LABEL[category]}: ${others.map(renderFact).join("; ")}.`);
      }
      continue;
    }
    lines.push(`- ${CATEGORY_LABEL[category]}: ${facts.map(renderFact).join("; ")}.`);
  }
  return lines;
}

const VITA_PREAMBLE =
  "Here is the relevant picture of this person built up across earlier sessions — your memory of them. Open by reflecting the relevant parts back before asking anything, and draw only on what's genuinely relevant to this session:";
const SEED_PREAMBLE =
  "What this person has already said that's relevant here (ground the exercise in this; never invent beyond it):";

// ---- Public API -------------------------------------------------------------

// Resolve both views for a module from the user's active facts.
export function resolveViews(moduleId: string, activeFacts: StoredFact[]): ResolvedViews {
  const manifest = getManifest(moduleId);
  if (!manifest) {
    return {
      seed: { items: [], age: null, lines: [], text: "" },
      vita: { items: [], lines: [], text: "" },
    };
  }

  const seedItems = collect(activeFacts, manifest.inputs, ["seed", "both"]);
  const vitaItems = collect(activeFacts, manifest.inputs, ["vita", "both"]);

  // Age, when the manifest asked for {age} (the DOB fact carried on a seed/both
  // input). Computed at read time so it never goes stale.
  let age: number | null = null;
  const wantsAge = manifest.inputs.some((i) => i.tag === "age");
  if (wantsAge) {
    const dobFact = activeFacts.find(
      (f) => f.status === "active" && f.category === "onboarding_fact" && f.data.field === "dob"
    );
    if (dobFact) age = ageFromDobFact(dobFact);
  }

  const seedLines = renderLines(seedItems, age);
  const vitaLines = renderLines(vitaItems, age);

  return {
    seed: {
      items: seedItems,
      age,
      lines: seedLines,
      text: seedLines.length ? [SEED_PREAMBLE, ...seedLines].join("\n") : "",
    },
    vita: {
      items: vitaItems,
      lines: vitaLines,
      text: vitaLines.length ? [VITA_PREAMBLE, ...vitaLines].join("\n") : "",
    },
  };
}

// Convenience wrappers for the common consumer needs.
export function resolveVitaText(moduleId: string, activeFacts: StoredFact[]): string {
  return resolveViews(moduleId, activeFacts).vita.text;
}

export function resolveSeedText(moduleId: string, activeFacts: StoredFact[]): string {
  return resolveViews(moduleId, activeFacts).seed.text;
}

// The resolved seed facts for one category (for callers that build a structured
// input — e.g. the springboards by area, the season cards). Manifest-scoped.
export function resolveSeedItems(
  moduleId: string,
  activeFacts: StoredFact[],
  category?: FactCategory
): ResolvedFact[] {
  const items = resolveViews(moduleId, activeFacts).seed.items;
  return category ? items.filter((i) => i.category === category) : items;
}
