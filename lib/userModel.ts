// Part C — the prior-stage user model.
//
// Stage 4 (Plan) only works if Vita already knows the person. Every Stage 4
// module opens by reflecting earlier material back, and most pre-populate their
// exercise from it. Rather than have each module re-read the raw Stage 1–3
// outputs, this file assembles one curated synthesis — the "user model" — from
// what the person has already produced, and renders it as a single context
// block Vita and the seeding calls can read.
//
// It is a *curated* synthesis, not the raw transcripts: it reads the already-
// distilled structured results (the confirmed values, the dreams record, the
// day they pictured, their strengths) and the AI-written per-module takeaways.
// The assembly is deterministic — no extra model call — so it's instant, free
// and faithful to what the person actually confirmed.
//
// This is the same object that later populates the Retirement Life Plan and
// powers the annual review, so the structured shape is the source of truth and
// the text rendering is derived from it.

import type {
  BuildResult,
  DayBuilderResult,
  RolePickerResult,
  MirrorCardsResult,
  HopesFearsResult,
  BiggerPictureResult,
} from "@/lib/modules";
import type { Takeaway } from "@/lib/takeaways";
import type { Dreams } from "@/lib/dreams";
import type { Stage3ValuesSummary } from "@/lib/stage3Seed";

// ---- The read surface ----
// The useUserData() hook satisfies this directly, so callers pass it straight
// through (the same way CarrySource works for the Stage 2/3 carry-forward).
export type ModelSource = {
  getBuild: (moduleId: string) => BuildResult | null;
  getTakeaway: (moduleId: string) => Takeaway | null;
  getDreams: (moduleId: string) => Dreams | null;
  getStage3Values: () => Stage3ValuesSummary | null;
  getOnboarding: () => {
    partner?: string;
    horizon?: string;
    motivation?: string | null;
  };
};

// ---- The curated synthesis ----

export type ValueEntry = {
  value: string;
  // The person's own short description of the value, where they gave one.
  meaning?: string;
  // From the Stage 3 values close: whether they were certain or still forming.
  confidence?: "certain" | "still forming";
};

export type Aspiration = {
  // The dream or interest in the person's own words.
  text: string;
  // Why it stands out for them, where they said.
  reason?: string;
};

export type DayPart = { part: string; activities: string[] };

export type UserModel = {
  onboarding: {
    // true with a partner, false planning alone, null if not recorded.
    withPartner: boolean | null;
    horizon: string | null;
    motivation: string | null;
  };
  // Core values, ordered by relative importance where it's known (the Stage 3
  // ranking). Each carries the person's own description and how settled it felt.
  coreValues: ValueEntry[];
  // Named tensions between priorities — the trade-offs they weighed in Stage 3.
  valueTensions: string[];
  // The day-to-day picture from Stage 1 (the "Tuesday"): the parts of the day
  // and what they put in each. Null if they never built it.
  dayPicture: { parts: DayPart[] } | null;
  // The AI-written takeaway prose for the day they pictured, if captured.
  dayPictureNote: string | null;
  // Current and envisaged roles / sources of identity (Stage 1 roles).
  roles: { all: string[]; mostAlive: string[] };
  // Character strengths from Stage 3, with the signature few starred.
  strengths: { all: string[]; signature: string[] };
  // Recurring aspirations, dreams and interests (the money module + curiosity).
  aspirations: Aspiration[];
  // Sources of energy, enjoyment and engagement (staying active, purpose).
  energySources: string[];
  // Relationships that feature prominently in their picture.
  relationships: string[];
  // Practical constraints or circumstances they've volunteered.
  constraints: string[];
  // Live worries heavy enough that the plan should take account of them (3.5).
  liveConcerns: string[];
  // The warm "what they're reaching for" hopes line from Stage 3.
  hopes: string | null;
  // The reflective passage they wrote looking back (Stage 3 close).
  lookingBack: string | null;
};

// ---- Small typed readers ----

function build<T extends BuildResult["type"]>(
  source: ModelSource,
  moduleId: string,
  type: T
): Extract<BuildResult, { type: T }> | null {
  const b = source.getBuild(moduleId);
  return b && b.type === type
    ? (b as Extract<BuildResult, { type: T }>)
    : null;
}

function takeawayText(source: ModelSource, moduleId: string): string | null {
  const t = source.getTakeaway(moduleId);
  const text = t?.text?.trim();
  return text ? text : null;
}

function uniq(items: string[]): string[] {
  return [...new Set(items.filter((s) => s && s.trim()))];
}

// Roles that read as relationships, used to fold Stage 1 role picks into the
// relationships picture alongside the dedicated people module.
const RELATIONSHIP_ROLES = new Set<string>([
  "Partner",
  "Parent",
  "Grandparent",
  "Friend",
  "Sibling",
  "Neighbour",
  "Carer",
  "Host",
]);

// ---- Field extractors ----

function coreValues(source: ModelSource): ValueEntry[] {
  // Preferred: the confirmed values distilled at the Stage 3 close — already
  // curated, with the person's own meaning and how settled each felt.
  const summary = source.getStage3Values();
  if (summary && summary.values.length > 0) {
    const ranked = orderByRanking(
      summary.values.map((v) => v.value),
      source
    );
    const byValue = new Map(summary.values.map((v) => [v.value, v]));
    return ranked.map((label) => {
      const v = byValue.get(label);
      return {
        value: label,
        ...(v?.meaning ? { meaning: v.meaning } : {}),
        ...(v?.confidence ? { confidence: v.confidence } : {}),
      };
    });
  }

  // Fallback: the core values marked in the triage module, with any descriptions
  // captured in the values-definitions module.
  const triage = build(source, "3.2", "value-triage");
  if (!triage || triage.core.length === 0) return [];
  const defs = build(source, "3.4", "value-definitions");
  const descByValue = new Map(
    (defs?.values ?? []).map((d) => [d.value, d.description])
  );
  return orderByRanking(triage.core, source).map((value) => ({
    value,
    ...(descByValue.get(value) ? { meaning: descByValue.get(value) } : {}),
  }));
}

// Reorder a set of value labels by the Stage 3 ranking (most protected first);
// labels not in the ranking keep their original order, appended after.
function orderByRanking(values: string[], source: ModelSource): string[] {
  const ranked = build(source, "3.3", "priority-choices")?.ranked ?? [];
  if (ranked.length === 0) return values;
  const inRank = ranked.filter((v) => values.includes(v));
  const rest = values.filter((v) => !inRank.includes(v));
  return uniq([...inRank, ...rest]);
}

function valueTensions(source: ModelSource): string[] {
  const choices = build(source, "3.3", "priority-choices")?.choices ?? [];
  return choices
    .filter((c) => c.left && c.right)
    .map((c) => `"${c.left}" vs "${c.right}" — they leaned to "${c.chose}"`);
}

function dayPicture(source: ModelSource): { parts: DayPart[] } | null {
  const day = build(source, "1.day", "day-builder") as DayBuilderResult | null;
  if (!day) return null;
  const parts = day.parts
    .map((part) => ({ part, activities: day.assigned[part] ?? [] }))
    .filter((p) => p.activities.length > 0);
  return parts.length > 0 ? { parts } : null;
}

function roles(source: ModelSource): { all: string[]; mostAlive: string[] } {
  const r = build(source, "1.roles", "role-picker") as RolePickerResult | null;
  if (!r) return { all: [], mostAlive: [] };
  return { all: uniq(r.picked), mostAlive: uniq(r.starred) };
}

function strengths(source: ModelSource): { all: string[]; signature: string[] } {
  const m = build(source, "3.1", "mirror-cards") as MirrorCardsResult | null;
  if (!m) return { all: [], signature: [] };
  return {
    all: uniq(m.kept.map((k) => k.label)),
    signature: uniq(m.starred),
  };
}

function aspirations(source: ModelSource): Aspiration[] {
  const out: Aspiration[] = [];
  const dreams = source.getDreams("1.money");
  if (dreams) {
    for (const t of dreams.top3) {
      if (t.dream.trim()) {
        out.push({
          text: t.dream.trim(),
          ...(t.reason?.trim() ? { reason: t.reason.trim() } : {}),
        });
      }
    }
    for (const p of dreams.pipeDreams) {
      if (p.trim()) out.push({ text: p.trim() });
    }
  }
  // Curiosity / learning interests from the Explore stage.
  const curiosity = build(source, "2.2", "role-picker") as RolePickerResult | null;
  for (const c of curiosity?.starred ?? curiosity?.picked ?? []) {
    out.push({ text: c });
  }
  // De-dupe on the text.
  const seen = new Set<string>();
  return out.filter((a) => {
    const key = a.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function picks(source: ModelSource, moduleId: string): string[] {
  const r = build(source, moduleId, "role-picker") as RolePickerResult | null;
  if (!r) return [];
  // Lead with any starred as most alive.
  return uniq([...r.starred, ...r.picked]);
}

function energySources(source: ModelSource): string[] {
  // Staying active (2.1) and purpose/contribution (2.4) are the clearest read
  // on what gives them energy and engagement.
  return uniq([...picks(source, "2.1"), ...picks(source, "2.4")]);
}

function relationships(source: ModelSource): string[] {
  const people = picks(source, "2.3");
  const r = build(source, "1.roles", "role-picker") as RolePickerResult | null;
  const relationshipRoles = (r?.picked ?? []).filter((role) =>
    RELATIONSHIP_ROLES.has(role)
  );
  return uniq([...people, ...relationshipRoles]);
}

function constraints(source: ModelSource): string[] {
  const out: string[] = [];
  const { horizon } = source.getOnboarding();
  if (horizon && horizon !== "Not sure") {
    out.push(`Retirement is roughly ${horizon} away.`);
  }
  return out;
}

function liveConcerns(source: ModelSource): string[] {
  const hf = build(source, "3.5", "hopes-fears") as HopesFearsResult | null;
  if (!hf) return [];
  return uniq(
    hf.fears
      .filter(
        (f) =>
          f.weighs ||
          f.reaction === "on-my-mind" ||
          f.reaction === "newly-recognised"
      )
      .map((f) => (f.note?.trim() ? `${f.label} — ${f.note.trim()}` : f.label))
  );
}

function hopes(source: ModelSource): string | null {
  const hf = build(source, "3.5", "hopes-fears") as HopesFearsResult | null;
  const line = hf?.hopes?.trim();
  return line ? line : null;
}

function lookingBack(source: ModelSource): string | null {
  const bp = build(source, "3.6", "bigger-picture") as BiggerPictureResult | null;
  const body = bp?.body?.trim();
  return body ? body : null;
}

// ---- The assembler ----

export function buildUserModel(source: ModelSource): UserModel {
  const onboarding = source.getOnboarding();
  return {
    onboarding: {
      withPartner:
        onboarding.partner === "Me and my partner"
          ? true
          : onboarding.partner === "Just me"
            ? false
            : null,
      horizon: onboarding.horizon?.trim() || null,
      motivation: onboarding.motivation?.trim() || null,
    },
    coreValues: coreValues(source),
    valueTensions: valueTensions(source),
    dayPicture: dayPicture(source),
    dayPictureNote: takeawayText(source, "1.day"),
    roles: roles(source),
    strengths: strengths(source),
    aspirations: aspirations(source),
    energySources: energySources(source),
    relationships: relationships(source),
    constraints: constraints(source),
    liveConcerns: liveConcerns(source),
    hopes: hopes(source),
    lookingBack: lookingBack(source),
  };
}

// ---- Seasons-board cards (Module 4.2) ----
// The seasons board (4.2) is pre-populated with cards drawn from earlier
// answers — the four sources the spec calls for: aspirations, activities,
// sources of purpose (both folded into energySources), and the people who
// feature most. Roles/identity is deliberately left out: it overlaps with the
// relationships and activities already here (e.g. "Grandparent" the role vs
// "Helping raise grandchildren" the activity). The board is for sorting these
// into seasons, so we keep a manageable handful rather than every item.
// Deterministic and free — the same philosophy as the user model.

export type SeasonCard = { label: string; category: string };

// Cards are short tokens to sort onto a board. Aspirations often carry the
// person's own commentary after a dash or colon (e.g. "Ballymaloe cookery school
// — something as intensive as this is probably out of reach"); keep just the
// thing itself so cards stay short and near-duplicates collapse on dedupe.
function conciseCardLabel(text: string): string {
  const head = text.split(/\s+(?:--|—|–)\s+|:\s+/)[0].trim();
  return head || text.trim();
}

export function seasonCardsFromModel(model: UserModel): SeasonCard[] {
  const cards: SeasonCard[] = [];
  const seen = new Set<string>();
  const add = (label: string, category: string) => {
    const text = conciseCardLabel(label);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    cards.push({ label: text, category });
  };

  for (const a of model.aspirations) add(a.text, "Aspiration");
  for (const e of model.energySources) add(e, "Activity");
  for (const r of model.relationships) add(r, "People");

  // Keep the board readable — a dozen cards is plenty to sort into seasons.
  return cards.slice(0, 12);
}

// ---- Balanced-retirement springboards (Module 4.3) ----
// Module 4.3 works through a fixed scaffold — the five areas of a balanced
// retirement: Restore, Move, Think, Connect, Contribute. Under each, we surface
// what the person has already said that lands there, in their own words, as
// springboards for shaping a real goal. An item can land in more than one area;
// these are prompts, not a filing system, so multiple membership is fine and
// nothing has to be "correctly" sorted. Deterministic and free — no seed call.

export type BalancedArea =
  | "restore"
  | "move"
  | "think"
  | "connect"
  | "contribute";

export const BALANCED_AREAS: BalancedArea[] = [
  "restore",
  "move",
  "think",
  "connect",
  "contribute",
];

// A prompt the person already placed in this area back in Stage 2, carried
// across in their own selection. `areas` is usually one entry; an item picked in
// two Stage 2 modules (e.g. "Caring for someone" under both Purpose and Energy)
// carries both, so it appears under each.
export type Springboard = { label: string; areas: BalancedArea[] };
export type BalancedSeed = { springboards: Springboard[] };

// 4.3 inherits its per-area springboards straight from the Stage 2 (Explore)
// area modules, where the person already mapped their life and interests across
// the balanced-retirement areas. We do NOT re-classify anything here: each
// balanced area is fed by one Stage 2 module, and we carry that module's picks
// across as-is, in the person's own words. An empty area means it was empty at
// Stage 2 — never a classifier miss.
type Stage2Source = {
  moduleId: string;
  // Stage 2 picks we want sometimes sit inside a composite; this is the index of
  // the role-picker step that holds them, or null when the module is itself a
  // role-picker.
  compositeStep: number | null;
};

const BALANCED_SOURCES: Record<BalancedArea, Stage2Source> = {
  restore: { moduleId: "2.5", compositeStep: 0 }, // energy & wellbeing: what lifts them
  move: { moduleId: "2.1", compositeStep: 0 }, // staying active
  think: { moduleId: "2.2", compositeStep: null }, // keeping the mind alive
  connect: { moduleId: "2.3", compositeStep: 0 }, // the people in their life
  contribute: { moduleId: "2.4", compositeStep: null }, // purpose & contribution
};

function pickedFrom(source: ModelSource, src: Stage2Source): string[] {
  const b = source.getBuild(src.moduleId);
  if (!b) return [];
  const picker =
    src.compositeStep === null
      ? b
      : b.type === "composite"
        ? (b.results[src.compositeStep] ?? null)
        : null;
  return picker && picker.type === "role-picker" ? picker.picked : [];
}

export function balancedSpringboardsFromModel(source: ModelSource): BalancedSeed {
  // Merge by label so an item placed in two Stage 2 areas carries both.
  const byLabel = new Map<string, Springboard>();
  for (const area of BALANCED_AREAS) {
    for (const raw of pickedFrom(source, BALANCED_SOURCES[area])) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const existing = byLabel.get(key);
      if (existing) {
        if (!existing.areas.includes(area)) existing.areas.push(area);
      } else {
        byLabel.set(key, { label, areas: [area] });
      }
    }
  }
  return { springboards: [...byLabel.values()] };
}

// Whether there's enough in the model to be worth reflecting back at all.
export function hasUserModel(model: UserModel): boolean {
  return (
    model.coreValues.length > 0 ||
    model.dayPicture !== null ||
    model.roles.all.length > 0 ||
    model.aspirations.length > 0
  );
}

// ---- The text rendering ----
// One labelled block for Vita's {priorReflections} slot and the Stage 4 seed
// calls. Empty fields are omitted so the block never carries hollow headings.

function dayLine(day: { parts: DayPart[] }): string {
  return day.parts
    .map((p) => `${p.part}: ${p.activities.join(", ")}`)
    .join("; ");
}

export function renderUserModel(model: UserModel): string {
  const lines: string[] = [];

  if (model.coreValues.length > 0) {
    const vals = model.coreValues
      .map((v) => (v.meaning ? `${v.value} (${v.meaning})` : v.value))
      .join("; ");
    lines.push(
      `- Core values, most important first: ${vals}.`
    );
  }
  if (model.valueTensions.length > 0) {
    lines.push(
      `- Tensions they've weighed between priorities: ${model.valueTensions.join("; ")}.`
    );
  }
  if (model.dayPicture) {
    lines.push(`- The day they pictured in Stage 1: ${dayLine(model.dayPicture)}.`);
  } else if (model.dayPictureNote) {
    lines.push(`- The day they pictured in Stage 1: ${model.dayPictureNote}`);
  }
  if (model.roles.all.length > 0) {
    const alive = model.roles.mostAlive.length
      ? ` (most alive: ${model.roles.mostAlive.join(", ")})`
      : "";
    lines.push(`- Roles and identity they want to carry forward: ${model.roles.all.join(", ")}${alive}.`);
  }
  if (model.strengths.all.length > 0) {
    const sig = model.strengths.signature.length
      ? ` (signature: ${model.strengths.signature.join(", ")})`
      : "";
    lines.push(`- Their character strengths: ${model.strengths.all.join(", ")}${sig}.`);
  }
  if (model.aspirations.length > 0) {
    const asp = model.aspirations
      .map((a) => (a.reason ? `${a.text} — ${a.reason}` : a.text))
      .join("; ");
    lines.push(`- Recurring aspirations, dreams and interests: ${asp}.`);
  }
  if (model.energySources.length > 0) {
    lines.push(`- Sources of energy and engagement: ${model.energySources.join(", ")}.`);
  }
  if (model.relationships.length > 0) {
    lines.push(`- Relationships that feature most: ${model.relationships.join(", ")}.`);
  }
  if (model.liveConcerns.length > 0) {
    lines.push(`- Worries heavy enough to plan around: ${model.liveConcerns.join("; ")}.`);
  }
  if (model.hopes) {
    lines.push(`- What they've been reaching for: ${model.hopes}`);
  }
  if (model.constraints.length > 0) {
    lines.push(`- Circumstances they've mentioned: ${model.constraints.join(" ")}`);
  }

  if (lines.length === 0) return "";

  return [
    "Here is the picture of this person built up across the earlier stages. It is your memory of them — open by reflecting the relevant parts back before asking anything, so it never feels like a fresh interview. Draw only on what's genuinely relevant to this module:",
    ...lines,
  ].join("\n");
}
