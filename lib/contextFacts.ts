// The canonical, typed "context profile" — one fact per row, lossless, and able
// to be corrected. This file holds the PURE layer: the category catalogue, the
// fact shapes, and the deterministic mappers that turn a module's structured
// build (and the few special records — dreams, stage-3 values, onboarding) into
// typed facts. It imports no database and no server-only code, so the same
// mapping logic runs in the backfill (server), the capture path (server), and
// the unit tests.
//
// Phase 1 scope: facts are WRITTEN and VALIDATED only. Nothing here is read by a
// live consumer yet — the existing read paths (buildUserModel, priorReflections,
// the RLP assembly) are left exactly as they are. Phase 2 adds the resolver.
//
// Hard wall (Appendix A): one_off_dream, aspiration and recurring_activity are
// distinct kinds. A money-no-object dream may become a one_off_dream or, when it
// turns out to be achievable, an aspiration — but it can NEVER be stored as a
// recurring_activity. The mappers below enforce that by construction.

import type {
  BuildResult,
  DayBuilderResult,
  RolePickerResult,
  SlidersResult,
  LetterResult,
  SparkPromptsResult,
  ScreeningCheckResult,
  CompositeResult,
  MirrorCardsResult,
  ValueTriageResult,
  PriorityChoicesResult,
  ValueDefinitionsResult,
  HopesFearsResult,
  BiggerPictureResult,
  ReadinessSnapshotResult,
  SeasonsBoardResult,
  BalancedGoalsResult,
  GoalPathsResult,
  TradeOffsResult,
  WeekShapeResult,
  FirstYearResult,
} from "@/lib/modules";
import type { Dreams } from "@/lib/dreams";
import type { Stage3Value } from "@/lib/stage3Seed";
import type { OnboardingAnswers } from "@/lib/userData";

// ---- The locked category catalogue (Appendix A) ----------------------------

export type FactCategory =
  | "day_picture_item"
  | "role"
  | "week_shape_pref"
  | "letter_thread"
  | "one_off_dream"
  | "aspiration"
  | "recurring_activity"
  | "energy_pattern"
  | "relationship"
  | "social_balance_pref"
  | "commitment"
  | "strength"
  | "value"
  | "value_priority"
  | "hope"
  | "fear"
  | "meaning_thread"
  | "readiness"
  | "chapter"
  | "goal"
  | "goal_path"
  | "principle"
  | "week_plan"
  | "first_year_plan"
  | "concern"
  | "onboarding_fact";

// The five life areas a recurring_activity (and a goal) can belong to. Named to
// match the balanced-goals area ids, capitalised per Appendix A's Restore/Move/
// Think/Connect/Contribute labels.
export type RecurringDomain =
  | "Restore"
  | "Move"
  | "Think"
  | "Connect"
  | "Contribute";

// The synthetic snapshot key the bulk fetch attaches active facts under, so the
// phase-2 client can read them synchronously like any other snapshot value.
// Lives here (the pure, client-safe module) so both the client data layer and
// the server backfill can reference it.
export const CONTEXT_FACTS_SNAPSHOT_KEY = "__context_facts";

export type FactStatus = "active" | "superseded" | "rejected";

export type FactConfidence = "certain" | "still_forming";

// Where a fact came from. widget_pick = a confirmed selection in a module's
// build; confirmed_takeaway = surfaced and confirmed in the module summary;
// conversational_statement = stated only in chat (the correction loop).
export type FactProvenanceSource =
  | "widget_pick"
  | "confirmed_takeaway"
  | "conversational_statement";

// Every fact's payload carries a `label`: the primary human-readable text, used
// both for display and — lower-cased and trimmed — as the fact's identity for
// de-duplication and the re-edit diff. Composite categories (value especially)
// add their structured fields alongside the label.
export type FactData = {
  label: string;
  [key: string]: unknown;
};

// The composite `value` payload (3.2 + 3.4). description is the user's own words
// (never the LLM re-distillation); threat/protectors come from 3.4; coreFive
// flags one of the five core values.
export type ValueFactData = FactData & {
  description?: string;
  evidence?: string;
  threat?: string;
  protectors?: string[];
  coreFive?: boolean;
};

// The `fear` payload (3.5): horizon plus whether to act on it or accept it.
export type FearFactData = FactData & {
  horizon?: string;
  actOn?: boolean;
};

// A fact as it exists before it's written to the database — no id, status, or
// timestamps yet. The backfill and capture paths produce these; the db layer
// turns each into a row.
export type DraftFact = {
  category: FactCategory;
  domain?: RecurringDomain | null;
  data: FactData;
  provenanceModule: string;
  provenanceSource: FactProvenanceSource;
  confidence: FactConfidence;
};

// A fact as it lives in the database (the shape activeFacts and the debug route
// return).
export type StoredFact = {
  id: string;
  userId: string;
  category: FactCategory;
  domain: RecurringDomain | null;
  data: FactData;
  provenanceModule: string;
  provenanceSource: FactProvenanceSource;
  status: FactStatus;
  supersededBy: string | null;
  confidence: FactConfidence;
  createdAt: string;
  lastAffirmedAt: string | null;
};

// ---- Identity ---------------------------------------------------------------

// A stable identity for a fact, independent of id/timestamps. Two facts with the
// same identity are "the same fact" for de-duplication and the re-edit diff: a
// pick that disappears between builds is detected by its identity vanishing from
// the desired set. Category + domain + the normalised label.
export function factIdentity(
  fact: Pick<DraftFact, "category" | "domain" | "data">
): string {
  const label = (fact.data.label ?? "").trim().toLowerCase();
  return `${fact.category}|${fact.domain ?? ""}|${label}`;
}

// Helper to build a draft fact with the common defaults.
function draft(
  category: FactCategory,
  data: FactData,
  provenanceModule: string,
  opts: {
    domain?: RecurringDomain | null;
    source?: FactProvenanceSource;
    confidence?: FactConfidence;
  } = {}
): DraftFact {
  return {
    category,
    domain: opts.domain ?? null,
    data,
    provenanceModule,
    provenanceSource: opts.source ?? "widget_pick",
    confidence: opts.confidence ?? "certain",
  };
}

const clean = (s: string | undefined | null): string => (s ?? "").trim();

// Drop facts whose label is empty (a blank widget field, an unanswered slider),
// and collapse exact-identity duplicates so a build never yields two identical
// facts. First occurrence wins.
function tidy(facts: DraftFact[]): DraftFact[] {
  const seen = new Set<string>();
  const out: DraftFact[] = [];
  for (const f of facts) {
    if (!clean(f.data.label)) continue;
    const key = factIdentity(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

// ---- Per-module build → facts ----------------------------------------------

// The energy/sleep module (2.5) is a 7-step composite in a fixed order:
// [energy sources, drains, sleep, energy, eating, recovery, the lever to build
// on]. Map each sub-result by its position.
const ENERGY_SLIDER_LEVERS = ["sleep", "energy", "eating", "recovery"];

function factsFrom25(result: CompositeResult): DraftFact[] {
  const out: DraftFact[] = [];
  result.results.forEach((part, i) => {
    if (i === 0 && part.type === "role-picker") {
      part.picked.forEach((p) =>
        out.push(draft("energy_pattern", { label: p, kind: "source" }, "2.5"))
      );
    } else if (i === 1 && part.type === "role-picker") {
      part.picked.forEach((p) =>
        out.push(draft("energy_pattern", { label: p, kind: "drain" }, "2.5"))
      );
    } else if (i >= 2 && i <= 5 && part.type === "sliders") {
      const lever = ENERGY_SLIDER_LEVERS[i - 2];
      part.spectrums.forEach((s) =>
        out.push(
          draft(
            "energy_pattern",
            { label: lever, kind: "lever", left: s.left, right: s.right, position: s.position },
            "2.5"
          )
        )
      );
    } else if (i === 6 && part.type === "role-picker") {
      // The one lever they chose to build on.
      part.picked.forEach((p) =>
        out.push(
          draft("energy_pattern", { label: p, kind: "chosen-lever" }, "2.5")
        )
      );
    }
  });
  return out;
}

function rolePickerFacts(
  result: RolePickerResult,
  moduleId: string,
  category: FactCategory,
  domain?: RecurringDomain | null
): DraftFact[] {
  const starred = new Set(result.starred.map((s) => s.toLowerCase()));
  return result.picked.map((p) =>
    draft(
      category,
      { label: p, starred: starred.has(p.toLowerCase()) },
      moduleId,
      { domain: domain ?? null }
    )
  );
}

function sliderFacts(
  result: SlidersResult,
  moduleId: string,
  category: FactCategory
): DraftFact[] {
  const out: DraftFact[] = result.spectrums.map((s) =>
    draft(
      category,
      { label: `${s.left} ↔ ${s.right}`, left: s.left, right: s.right, position: s.position },
      moduleId
    )
  );
  if (result.seasonal && clean(result.seasonal.answer)) {
    out.push(
      draft(
        category,
        { label: result.seasonal.answer as string, prompt: result.seasonal.prompt, seasonal: true },
        moduleId
      )
    );
  }
  return out;
}

// Turn one module's build into typed facts. Switches on the module id (not just
// the interaction type) because the same widget means different things in
// different modules: a role-picker is a `role` in 1.roles, a Think
// recurring_activity in 2.2, a `relationship` in 2.3, and a Contribute
// recurring_activity in 2.4.
//
// NB: 1.money is handled by factsFromDreams, not here — the achievable/pipe-dream
// split lives in the dreams record, and that split is what keeps a pipe-dream
// from ever being read as plan-actionable. factsFromBuild('1.money') returns a
// safe lossless fallback (every entry as a one_off_dream) for the rare case
// where no dreams record exists.
export function factsFromBuild(
  moduleId: string,
  result: BuildResult
): DraftFact[] {
  return tidy(factsFromBuildRaw(moduleId, result));
}

function factsFromBuildRaw(moduleId: string, result: BuildResult): DraftFact[] {
  switch (moduleId) {
    // ---- Stage 1 — Imagine ----
    case "1.day": {
      if (result.type !== "day-builder") return [];
      const r = result as DayBuilderResult;
      const out: DraftFact[] = [];
      for (const part of r.parts) {
        for (const item of r.assigned[part] ?? []) {
          out.push(draft("day_picture_item", { label: item, part }, "1.day"));
        }
      }
      return out;
    }
    case "1.money": {
      // Safe lossless fallback only — see factsFromDreams for the real split.
      if (result.type !== "spark-prompts") return [];
      return (result as SparkPromptsResult).entries.map((e) =>
        draft("one_off_dream", { label: e.text, prompt: e.label, sparkId: e.id }, "1.money")
      );
    }
    case "1.roles":
      return result.type === "role-picker"
        ? rolePickerFacts(result, "1.roles", "role")
        : [];
    case "1.week":
      return result.type === "sliders"
        ? sliderFacts(result, "1.week", "week_shape_pref")
        : [];
    case "1.letter": {
      if (result.type !== "letter") return [];
      const r = result as LetterResult;
      // The full letter stays as cold text in interaction:1.letter. We keep one
      // letter_thread carrying the recipient + body so it isn't lost; richer
      // thread extraction is an LLM/reflective job (still_forming).
      return [
        draft(
          "letter_thread",
          { label: r.body, recipientLabel: r.recipientLabel, recipientId: r.recipientId },
          "1.letter",
          { confidence: "still_forming" }
        ),
      ];
    }

    // ---- Stage 2 — Explore ----
    case "2.1": {
      if (result.type !== "composite") return [];
      const out: DraftFact[] = [];
      (result as CompositeResult).results.forEach((part) => {
        if (part.type === "role-picker") {
          out.push(...rolePickerFacts(part, "2.1", "recurring_activity", "Move"));
        } else if (part.type === "sliders") {
          out.push(...sliderFacts(part, "2.1", "week_shape_pref"));
        }
      });
      return out;
    }
    case "2.2":
      // Keeping the mind alive — interests/absorptions to keep (Think domain).
      return result.type === "role-picker"
        ? rolePickerFacts(result, "2.2", "recurring_activity", "Think")
        : [];
    case "2.3":
      // The people in your life — relationships that matter.
      return result.type === "role-picker"
        ? rolePickerFacts(result, "2.3", "relationship")
        : [];
    case "2.4":
      // Purpose and contribution — forms of contribution (Contribute domain).
      return result.type === "role-picker"
        ? rolePickerFacts(result, "2.4", "recurring_activity", "Contribute")
        : [];
    case "2.5":
      return result.type === "composite" ? factsFrom25(result) : [];
    case "2.6": {
      if (result.type !== "screening-check") return [];
      // The screening answers become commitments (a behaviour intention). The
      // actual screening rhythm is also stored as a commitment:{id} record and
      // backfilled separately.
      return (result as ScreeningCheckResult).answers.map((a) =>
        draft("commitment", { label: a.choice, prompt: a.prompt, answerId: a.id }, "2.6")
      );
    }

    // ---- Stage 3 — Understand ----
    case "3.1": {
      if (result.type !== "mirror-cards") return [];
      const r = result as MirrorCardsResult;
      const starred = new Set(r.starred.map((s) => s.toLowerCase()));
      return r.kept.map((k) =>
        draft(
          "strength",
          {
            label: k.label,
            evidence: clean(k.evidence) || undefined,
            note: clean(k.note) || undefined,
            signature: starred.has(k.label.toLowerCase()),
          },
          "3.1"
        )
      );
    }
    case "3.2": {
      if (result.type !== "value-triage") return [];
      const r = result as ValueTriageResult;
      const core = new Set(r.core.map((c) => c.toLowerCase()));
      // "me" and "unsure" trays become value facts; "not" is dropped. "unsure"
      // is recorded explicitly as still_forming.
      return r.sorted
        .filter((s) => s.tray !== "not")
        .map((s) =>
          draft(
            "value",
            {
              label: s.label,
              description: clean(s.evidence) || undefined,
              evidence: clean(s.evidence) || undefined,
              coreFive: core.has(s.label.toLowerCase()),
            } as ValueFactData,
            "3.2",
            { confidence: s.tray === "unsure" ? "still_forming" : "certain" }
          )
        );
    }
    case "3.3": {
      if (result.type !== "priority-choices") return [];
      const r = result as PriorityChoicesResult;
      return r.ranked.map((label, i) =>
        draft("value_priority", { label, rank: i + 1 }, "3.3")
      );
    }
    case "3.4": {
      if (result.type !== "value-definitions") return [];
      const r = result as ValueDefinitionsResult;
      // The composite value with the user's own description plus the 3.4 threat
      // and protectors. These are value facts too (same category as 3.2) — the
      // reconcile/merge keeps the richest description; here we carry everything.
      return r.values.map((v) =>
        draft(
          "value",
          {
            label: v.value,
            description: clean(v.description) || undefined,
            threat: clean(v.threat) || undefined,
            protectors: (v.protectors ?? []).map(clean).filter(Boolean),
          } as ValueFactData,
          "3.4"
        )
      );
    }
    case "3.5": {
      if (result.type !== "hopes-fears") return [];
      const r = result as HopesFearsResult;
      const out: DraftFact[] = [];
      if (clean(r.hopes)) {
        out.push(draft("hope", { label: r.hopes }, "3.5"));
      }
      for (const f of r.fears) {
        // "not-me" fears are the ones the person set aside — drop them. The rest
        // are live fears. `weighs` (heavy enough to shape the plan) maps to the
        // act-on flag.
        if (f.reaction === "not-me") continue;
        out.push(
          draft(
            "fear",
            {
              label: f.label,
              horizon: clean(f.horizon) || undefined,
              actOn: f.weighs === true,
              note: clean(f.note) || undefined,
            } as FearFactData,
            "3.5",
            { confidence: f.reaction === "newly-recognised" ? "still_forming" : "certain" }
          )
        );
      }
      return out;
    }
    case "3.6":
      return result.type === "bigger-picture"
        ? [draft("meaning_thread", { label: (result as BiggerPictureResult).body }, "3.6")]
        : [];

    // ---- Stage 4 — Plan ----
    case "4.1": {
      if (result.type !== "readiness-snapshot") return [];
      const r = result as ReadinessSnapshotResult;
      const out: DraftFact[] = [];
      const t = r.transition;
      out.push(
        draft(
          "readiness",
          {
            label: t.lean === "clean-break" ? "A clean break" : "A gradual wind-down",
            lean: t.lean,
            position: t.position,
            shape: clean(t.shape) || undefined,
            period: clean(t.period) || undefined,
          },
          "4.1"
        )
      );
      if (r.window) {
        out.push(
          draft(
            "readiness",
            { label: `${r.window.fromLabel}–${r.window.toLabel}`, kind: "window" },
            "4.1"
          )
        );
      }
      for (const f of r.factors) {
        out.push(
          draft(
            "readiness",
            { label: f.label, level: f.level, factorId: f.id, kind: "factor" },
            "4.1"
          )
        );
      }
      return out;
    }
    case "4.2": {
      if (result.type !== "seasons-board") return [];
      const r = result as SeasonsBoardResult;
      return r.placements
        .filter((p) => p.seasons.length > 0)
        .map((p) =>
          draft(
            "chapter",
            { label: p.label, seasons: p.seasons, category: p.category, own: p.own === true },
            "4.2"
          )
        );
    }
    case "4.3": {
      if (result.type !== "balanced-goals") return [];
      const r = result as BalancedGoalsResult;
      const domainOf: Record<string, RecurringDomain> = {
        restore: "Restore",
        move: "Move",
        think: "Think",
        connect: "Connect",
        contribute: "Contribute",
      };
      return r.goals.map((g) =>
        draft(
          "goal",
          {
            label: g.label,
            area: g.area,
            track: g.track,
            focus: g.focus === true,
            rank: g.rank,
            meaning: clean(g.note) || undefined,
            season: clean(g.season) || undefined,
            successIndicator: clean(g.looksLike) || undefined,
            cadence: clean(g.cadence) || undefined,
          },
          "4.3",
          { domain: domainOf[g.area] ?? null }
        )
      );
    }
    case "4.4": {
      if (result.type !== "goal-paths") return [];
      const r = result as GoalPathsResult;
      return r.paths.map((p) =>
        draft(
          "goal_path",
          {
            label: p.goal,
            track: p.track,
            milestones: (p.milestones ?? []).map((m) => m.label).filter(Boolean),
            alreadyHelps: p.alreadyHelps ?? [],
            wouldHelp: p.wouldHelp ?? [],
            lean: clean(p.lean) || undefined,
          },
          "4.4"
        )
      );
    }
    case "4.5": {
      if (result.type !== "trade-offs") return [];
      return factsFromPrinciples(
        (result as TradeOffsResult).principles,
        (result as TradeOffsResult).values
      );
    }
    case "4.6": {
      if (result.type !== "week-shape") return [];
      const r = result as WeekShapeResult;
      return r.activities.map((a) =>
        draft(
          "week_plan",
          {
            label: a.label,
            frequency: a.frequency,
            category: a.category,
            anchor: a.anchor === true,
            own: a.own === true,
          },
          "4.6"
        )
      );
    }
    case "4.7": {
      if (result.type !== "first-year") return [];
      const r = result as FirstYearResult;
      return r.items.map((it) =>
        draft(
          "first_year_plan",
          {
            label: it.label,
            kind: it.kind,
            season: it.season,
            top: it.top === true,
            note: clean(it.note) || undefined,
          },
          "4.7"
        )
      );
    }
    default:
      return [];
  }
}

// ---- 4.5 principles ---------------------------------------------------------

// The decision principles a user settles on in 4.5 become `principle` facts. The
// non-negotiable/flexible buckets ride along on the relevant principle set as
// context. Used by both factsFromBuild('4.5') and the conversational 4.5 fold-in.
export function factsFromPrinciples(
  principles: string[],
  values?: TradeOffsResult["values"]
): DraftFact[] {
  const nonNegotiables = (values ?? [])
    .filter((v) => v.bucket === "non-negotiable")
    .map((v) => v.value);
  const flexibles = (values ?? [])
    .filter((v) => v.bucket === "flexible")
    .map((v) => v.value);
  return tidy(
    principles.map((p) =>
      draft(
        "principle",
        { label: p, nonNegotiables, flexibles },
        "4.5"
      )
    )
  );
}

// The principles a user should have after the 4.5 conversation: the build's
// principles plus any new ones stated in chat, minus any they confirmed dropping.
// Pure, so the 4.5 write-back (which pushes this back into interaction:4.5 — the
// key the RLP reads) is unit-testable. De-duplicated, order preserved.
export function principlesAfterConversation(
  current: string[],
  deltas: ConversationalDeltas
): string[] {
  const dropped = new Set(
    deltas.removals
      .filter((r) => (!r.category || r.category === "principle") && r.userConfirmedInChat === true)
      .map((r) => clean(r.label).toLowerCase())
  );
  const additions = deltas.additions
    .filter((a) => a.category === "principle")
    .map((a) => clean(a.label))
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of [...current.map(clean), ...additions]) {
    const key = p.toLowerCase();
    if (!p || seen.has(key) || dropped.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// ---- 1.money dreams ---------------------------------------------------------

// The authoritative source for the money module's dreams: the structured Dreams
// record (top-3, achievable, pipe-dreams), which carries the split that walls a
// pipe-dream off from anything plan-actionable.
//
// - pipeDreams      → one_off_dream (reflective only)
// - achievable      → aspiration (plan-actionable)
// - top3            → aspiration (plan-actionable; the headline three)
// - any remaining allDreams entry not represented above → one_off_dream
//   (the conservative default — never promote an unknown dream to actionable,
//   and never, ever to a recurring_activity)
export function factsFromDreams(dreams: Dreams): DraftFact[] {
  const out: DraftFact[] = [];
  const represented = new Set<string>();
  const mark = (s: string) => represented.add(clean(s).toLowerCase());

  for (const p of dreams.pipeDreams) {
    if (!clean(p)) continue;
    out.push(draft("one_off_dream", { label: p }, "1.money", { source: "confirmed_takeaway" }));
    mark(p);
  }
  for (const a of dreams.achievable) {
    if (!clean(a.dream)) continue;
    out.push(
      draft(
        "aspiration",
        { label: a.dream, adaptedIdea: clean(a.adaptedIdea) || undefined },
        "1.money",
        { source: "confirmed_takeaway" }
      )
    );
    mark(a.dream);
  }
  for (const t of dreams.top3) {
    if (!clean(t.dream)) continue;
    out.push(
      draft(
        "aspiration",
        { label: t.dream, reason: clean(t.reason) || undefined, top3: true },
        "1.money",
        { source: "confirmed_takeaway" }
      )
    );
    mark(t.dream);
  }
  // Losslessly fold in any verbatim spark entry not already captured above.
  for (const e of dreams.allDreams) {
    if (!clean(e.text) || represented.has(clean(e.text).toLowerCase())) continue;
    out.push(
      draft("one_off_dream", { label: e.text, prompt: e.label, sparkId: e.id }, "1.money")
    );
  }
  return tidy(out);
}

// ---- Stage-3 confirmed values ----------------------------------------------

// The stage-close values summary (stage3-values) is a small, confirmed set with
// the user's own meaning. These are confirmed_takeaway value facts; they merge
// with the 3.2/3.4 value facts of the same label (richest description wins) in
// the reconcile.
export function factsFromStage3Values(values: Stage3Value[]): DraftFact[] {
  return tidy(
    values.map((v) =>
      draft(
        "value",
        { label: v.value, description: clean(v.meaning) || undefined } as ValueFactData,
        "3.6",
        {
          source: "confirmed_takeaway",
          confidence: v.confidence === "still forming" ? "still_forming" : "certain",
        }
      )
    )
  );
}

// ---- Onboarding + opening capture ------------------------------------------

export function factsFromOnboarding(o: OnboardingAnswers): DraftFact[] {
  const out: DraftFact[] = [];
  if (clean(o.partner)) {
    out.push(draft("onboarding_fact", { label: o.partner as string, field: "partner" }, "onboarding"));
  }
  if (clean(o.horizon)) {
    out.push(draft("onboarding_fact", { label: o.horizon as string, field: "horizon" }, "onboarding"));
  }
  if (clean(o.motivation ?? "")) {
    out.push(
      draft("onboarding_fact", { label: o.motivation as string, field: "motivation" }, "onboarding")
    );
  }
  if (clean(o.dob)) {
    // The DOB is the raw fact; age is computed from it at read time (the
    // resolver's {age} filter), so it never goes stale.
    out.push(draft("onboarding_fact", { label: o.dob as string, field: "dob" }, "onboarding"));
  }
  return tidy(out);
}

// The pre-Stage-1 opening capture ("anything you're already dreaming about?").
// It's free prose the person had in mind before any module framed it — stored as
// one_off_dream(s): reflective, never plan-actionable, never recurring.
export function factsFromStartingThoughts(text: string): DraftFact[] {
  const t = clean(text);
  if (!t) return [];
  return [
    draft("one_off_dream", { label: t, opening: true }, "stage1-start", {
      source: "confirmed_takeaway",
      confidence: "still_forming",
    }),
  ];
}

// ---- Conversational correction loop ----------------------------------------

// A new fact stated only in conversation (no widget pick). Emitted by the
// takeaway/delta LLM call alongside the summary.
export type FactAdditionDelta = {
  category: FactCategory;
  domain?: RecurringDomain | null;
  label: string;
  description?: string;
  confidence?: FactConfidence;
  [key: string]: unknown;
};

// A correction that removes an existing fact (the "solo coffee at 11am, told to
// Vita" case). `userConfirmedInChat` is set by the model when the transcript
// already shows the person directly asking to drop it — that exchange IS the
// in-conversation confirmation, so the removal may be applied. Otherwise the
// removal waits for an explicit confirmation (its identity in the confirmed set)
// before anything is rejected.
export type FactRemovalDelta = {
  label: string;
  category?: FactCategory;
  domain?: RecurringDomain | null;
  userConfirmedInChat?: boolean;
  quote?: string;
};

export type ConversationalDeltas = {
  additions: FactAdditionDelta[];
  removals: FactRemovalDelta[];
};

// A removal that matched an existing fact but is NOT yet confirmed — surfaced so
// the UI can ask Vita to acknowledge it ("Got it — I'll drop the 11am coffee")
// and apply it only once the person doesn't object.
export type PendingRemoval = {
  factId: string;
  identity: string;
  label: string;
  quote?: string;
};

// Coerce whatever the model returned into a clean deltas object — robust to
// missing fields and wrong types, so a malformed payload degrades to "no
// deltas" rather than throwing. (The caller still wraps the whole parse in a
// try/catch and falls back to summary-only.)
export function normalizeDeltas(raw: unknown): ConversationalDeltas {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const additions = Array.isArray(obj.additions) ? obj.additions : [];
  const removals = Array.isArray(obj.removals) ? obj.removals : [];
  return {
    additions: additions
      .filter((a): a is FactAdditionDelta => !!a && typeof a === "object" && typeof (a as FactAdditionDelta).label === "string")
      .filter((a) => clean(a.label) !== ""),
    removals: removals
      .filter((r): r is FactRemovalDelta => !!r && typeof r === "object" && typeof (r as FactRemovalDelta).label === "string")
      .filter((r) => clean(r.label) !== ""),
  };
}

// Decide what to apply for a set of conversational deltas, given the facts
// currently active for the module and the set of removal identities the person
// has confirmed. PURE — the route executes the result. Additions that duplicate
// an active fact are dropped; a removal is only rejected once confirmed (either
// the model flagged it confirmed in chat, or its identity is in
// `confirmedRemovalKeys`); unconfirmed removals come back as `pending`.
export function planConversationalApply(
  moduleId: string,
  deltas: ConversationalDeltas,
  existing: Pick<StoredFact, "id" | "category" | "domain" | "data">[],
  confirmedRemovalKeys: Set<string> = new Set()
): { toAdd: DraftFact[]; toRejectIds: string[]; pending: PendingRemoval[] } {
  const activeByIdentity = new Map<string, Pick<StoredFact, "id" | "category" | "domain" | "data">>();
  for (const e of existing) activeByIdentity.set(factIdentity(e), e);

  // Additions → drafts, skipping anything already active.
  const toAdd: DraftFact[] = [];
  for (const a of deltas.additions) {
    const d = draft(
      a.category,
      { ...a, label: clean(a.label), category: undefined, domain: undefined, confidence: undefined } as FactData,
      moduleId,
      {
        domain: a.domain ?? null,
        source: "conversational_statement",
        confidence: a.confidence ?? "still_forming",
      }
    );
    // Strip the helper keys we folded into data above.
    delete (d.data as Record<string, unknown>).category;
    delete (d.data as Record<string, unknown>).domain;
    delete (d.data as Record<string, unknown>).confidence;
    if (activeByIdentity.has(factIdentity(d))) continue;
    toAdd.push(d);
  }

  // Removals → match to active facts by identity (label, and category/domain when
  // the delta names them).
  const toRejectIds: string[] = [];
  const pending: PendingRemoval[] = [];
  for (const r of deltas.removals) {
    const label = clean(r.label).toLowerCase();
    const matches = existing.filter((e) => {
      if ((e.data.label ?? "").trim().toLowerCase() !== label) return false;
      if (r.category && e.category !== r.category) return false;
      if (r.domain != null && e.domain !== r.domain) return false;
      return true;
    });
    for (const m of matches) {
      const identity = factIdentity(m);
      const confirmed = r.userConfirmedInChat === true || confirmedRemovalKeys.has(identity);
      if (confirmed) toRejectIds.push(m.id);
      else pending.push({ factId: m.id, identity, label: m.data.label, quote: r.quote });
    }
  }

  return { toAdd, toRejectIds, pending };
}

// ---- Merge facts of the same identity --------------------------------------

// Where a value's description can come from, best first. The user's own wording
// at 3.4 and 3.2 is preferred over the 3.6 LLM re-distillation (the bleed the new
// store is meant to fix).
const DESCRIPTION_PRIORITY: Record<string, number> = {
  "3.4": 3,
  "3.2": 2,
  "3.6": 1,
};

// Merge drafts that share an identity into one fact, combining their data rather
// than dropping the duplicates. This is what keeps a `value` lossless: the label
// comes from 3.2, the 3.4 pass adds threat + protectors, and the user's own
// description is preserved (never overwritten by the weaker 3.6 distillation).
// Scalars: last non-empty wins (description by source priority). Arrays: unioned.
// Booleans: OR'd. Confidence: certain if any contributor is certain.
export function mergeDraftsByIdentity(facts: DraftFact[]): DraftFact[] {
  const byIdentity = new Map<string, DraftFact>();
  const descSource = new Map<string, number>();

  for (const f of facts) {
    if (!clean(f.data.label)) continue;
    const id = factIdentity(f);
    const existing = byIdentity.get(id);
    if (!existing) {
      byIdentity.set(id, {
        ...f,
        data: { ...f.data, label: clean(f.data.label) },
      });
      if (clean((f.data as ValueFactData).description)) {
        descSource.set(id, DESCRIPTION_PRIORITY[f.provenanceModule] ?? 0);
      }
      continue;
    }
    // Merge field by field.
    for (const [key, value] of Object.entries(f.data)) {
      if (key === "label") continue;
      const cur = existing.data[key];
      if (Array.isArray(value)) {
        const merged = new Set([
          ...(Array.isArray(cur) ? (cur as unknown[]) : []),
          ...value,
        ]);
        existing.data[key] = Array.from(merged);
      } else if (typeof value === "boolean") {
        existing.data[key] = Boolean(cur) || value;
      } else if (key === "description") {
        const incomingPriority = DESCRIPTION_PRIORITY[f.provenanceModule] ?? 0;
        if (clean(value as string) && incomingPriority >= (descSource.get(id) ?? -1)) {
          existing.data[key] = value;
          descSource.set(id, incomingPriority);
        }
      } else if (value !== undefined && value !== null && value !== "") {
        existing.data[key] = value;
      }
    }
    if (f.confidence === "certain") existing.confidence = "certain";
  }

  return Array.from(byIdentity.values());
}

// ---- Whole-snapshot assembly (backfill core) -------------------------------

// The id the Stage 1 opening capture is stored under (a takeaway key).
export const STAGE1_STARTING_TAKEAWAY_KEY = "takeaway:stage1-start";

// Assemble every draft fact implied by a user's stored rows (their whole
// user_data snapshot). PURE — no database, no server-only code — so the backfill,
// the population check, and the unit tests all share exactly this logic.
// Lossless: every structured pick becomes a fact with no caps. Only `value`
// facts merge across modules (3.2 label + 3.4 threat/protectors + the user's own
// description); everything else stays one-fact-per-pick.
export function draftsFromSnapshot(data: Record<string, unknown>): DraftFact[] {
  const valueDrafts: DraftFact[] = [];
  const otherDrafts: DraftFact[] = [];
  const push = (facts: DraftFact[]) => {
    for (const f of facts) {
      if (f.category === "value") valueDrafts.push(f);
      else otherDrafts.push(f);
    }
  };

  const dreamsRecord = data["dreams:1.money"];
  const hasDreamsRecord =
    !!dreamsRecord &&
    typeof dreamsRecord === "object" &&
    Array.isArray((dreamsRecord as { allDreams?: unknown }).allDreams);

  // Every module's structured build → typed facts. 1.money is handled via its
  // dreams record (the achievable/pipe split lives there); its raw build is only
  // a fallback when no dreams record exists.
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith("interaction:")) continue;
    const moduleId = key.slice("interaction:".length);
    if (!value || typeof value !== "object" || !("type" in value)) continue;
    if (moduleId === "1.money" && hasDreamsRecord) continue;
    push(factsFromBuild(moduleId, value as BuildResult));
  }

  if (hasDreamsRecord) {
    push(factsFromDreams(dreamsRecord as Dreams));
  }

  const s3 = data["stage3-values"];
  if (s3 && typeof s3 === "object" && Array.isArray((s3 as { values?: unknown }).values)) {
    push(factsFromStage3Values((s3 as { values: Stage3Value[] }).values));
  }

  const onboarding = data["onboarding"];
  if (onboarding && typeof onboarding === "object") {
    push(factsFromOnboarding(onboarding as OnboardingAnswers));
  }

  const starting = data[STAGE1_STARTING_TAKEAWAY_KEY];
  if (
    starting &&
    typeof starting === "object" &&
    typeof (starting as { text?: unknown }).text === "string"
  ) {
    push(factsFromStartingThoughts((starting as { text: string }).text));
  }

  const mergedValues = mergeDraftsByIdentity(valueDrafts);
  return [...otherDrafts, ...mergedValues];
}

// ---- Re-edit / reconcile diff ----------------------------------------------

// Given the facts a build SHOULD now produce and the facts currently stored for
// that module+source, work out the diff: which drafts are genuinely new (to add)
// and which stored facts no longer appear (to remove). Identity-based, so an
// unchanged pick is neither added nor removed. This is the engine behind both
// the first capture and the re-edit case (a pick that disappears is detected,
// not silently left behind).
export function diffFacts(
  desired: DraftFact[],
  existing: Pick<StoredFact, "id" | "category" | "domain" | "data">[]
): { toAdd: DraftFact[]; toRemoveIds: string[] } {
  const existingByIdentity = new Map<string, string>(); // identity -> id
  for (const e of existing) existingByIdentity.set(factIdentity(e), e.id);

  const desiredIdentities = new Set(desired.map(factIdentity));

  const toAdd = desired.filter((d) => !existingByIdentity.has(factIdentity(d)));
  const toRemoveIds = existing
    .filter((e) => !desiredIdentities.has(factIdentity(e)))
    .map((e) => e.id);

  return { toAdd, toRemoveIds };
}
