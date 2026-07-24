// Module 4.7 ("Your first year") drafting contract.
//
// This is the assembly module. Vita pre-assembles a sequenced picture of the first
// year of retirement from everything gathered across Stage 4 — the goals and trips
// (4.3), the weekly rhythm (4.6), the early-retirement priorities (4.2), and the
// shape of the work transition (4.1). Each piece arrives placed onto a four-part
// arc of the year, with trips flagged, a "top of the list" marker, goals that can
// run alongside each other noted, and a work lane showing how any phase-out lands
// across the year — so the person can see how much of year one is genuinely free.
// They react to the draft: keep, reorder, mark, remove, add. One structured Claude
// call (/api/first-year) returns the items. Anything that goes wrong falls back to
// a grounded assembly so the surface always renders.

import type {
  BalancedGoalsResult,
  SeasonsBoardResult,
  WeekShapeResult,
} from "@/lib/modules";
import { transitionShape, type TransitionShape } from "@/lib/weekShapeSeed";
import type { RetirementStage } from "@/lib/userData";
import { fetchSeedWithRetry } from "@/lib/seedRetry";

export { transitionShape, type TransitionShape };

// The four parts of the first-year arc, plus the "across the year" lane for things
// that run throughout (the weekly rhythm threads, an ongoing-work footprint that
// spans the year). These ids are what the result stores; the component's config
// supplies the display labels.
export const SEASON_IDS = ["s1", "s2", "s3", "s4"] as const;
export const ALL_YEAR = "all-year";

// The kinds of thing on the canvas. `trip` flags travel (a plane marker, a
// top-of-the-list candidate); `goal` and `project` are the things they'll start
// and can run in sequence or in parallel; `rhythm` is a thread of the weekly
// rhythm that runs all year; `work` is the ongoing-work footprint of a phase-out.
export const ITEM_KINDS = [
  "trip",
  "goal",
  "project",
  "rhythm",
  "work",
] as const;
export type FirstYearKind = (typeof ITEM_KINDS)[number];

// One drafted item on the first-year canvas.
export type FirstYearItemSeed = {
  label: string;
  kind: FirstYearKind;
  // One of SEASON_IDS, or ALL_YEAR for things that run throughout.
  season: string;
  // A headline moment of the year.
  top?: boolean;
  note?: string;
  // An ongoing-work commitment (the phase-out footprint) the year is built around.
  fixed?: boolean;
};

export type FirstYearSeed = {
  items: FirstYearItemSeed[];
  // Vita's short first-person story of the year, drawn from the arc.
  narrative: string;
};

// ---- The inputs the draft is assembled from ----

// A goal from 4.3, as the draft sees it.
export type FirstYearGoal = {
  goal: string;
  track: "do" | "be";
  area?: string;
  focus?: boolean;
  rank?: number;
  season?: string;
  note?: string;
};

// A thread of the weekly rhythm from 4.6 — the anchors and energy-givers that run
// through every week of the year.
export type FirstYearRhythm = {
  label: string;
  frequency: string;
  anchor?: boolean;
  energy?: boolean;
};

// An early-retirement priority from 4.2 — a thing the person placed in a season,
// with the season labels it sits in (so the draft knows what they wanted early).
export type FirstYearSeasonPriority = {
  label: string;
  seasons: string[];
};

export type FirstYearDraftInput = {
  userModel: string;
  onboarding: string;
  hasPartner: boolean;
  // Where they are with work and retirement, or null when uncaptured. Carried on
  // the same rail as hasPartner for later phases; nothing branches on it yet.
  retirementStage: RetirementStage | null;
  goals: FirstYearGoal[];
  rhythm: FirstYearRhythm[];
  // The early-leaning priorities from 4.2, plus the season order so the model
  // knows which labels count as "early".
  seasonPriorities: FirstYearSeasonPriority[];
  seasonOrder: string[];
  transition: TransitionShape | null;
};

// ---- Pull the inputs out of the earlier modules' saved results ----

// The goals the person shaped in 4.3, spotlighted ones first, each with its area
// label and the season they tagged it with. The full source for what begins in
// year one.
export function firstYearGoalInputs(
  prior: BalancedGoalsResult | null
): FirstYearGoal[] {
  if (!prior || !Array.isArray(prior.goals)) return [];
  const areaLabel = new Map<string, string>();
  if (Array.isArray(prior.areas)) {
    for (const a of prior.areas) {
      if (a && typeof a.id === "string" && typeof a.label === "string") {
        areaLabel.set(a.id, a.label.trim());
      }
    }
  }
  return prior.goals
    .filter((g) => typeof g.label === "string" && g.label.trim())
    .sort((a, b) => {
      const fa = a.focus ? 0 : 1;
      const fb = b.focus ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (a.rank ?? 99) - (b.rank ?? 99);
    })
    .map((g) => {
      const area = g.area ? areaLabel.get(g.area) : "";
      return {
        goal: g.label.trim(),
        track: g.track === "be" ? "be" : "do",
        ...(area ? { area } : {}),
        ...(g.focus ? { focus: true } : {}),
        ...(typeof g.rank === "number" ? { rank: g.rank } : {}),
        ...(g.season ? { season: g.season } : {}),
        ...(g.note ? { note: g.note } : {}),
      };
    });
}

// A few threads of the weekly rhythm from 4.6 — the anchors and energy-givers that
// run through the year. Capped so they colour the year without crowding it.
export function firstYearRhythmInputs(
  prior: WeekShapeResult | null
): FirstYearRhythm[] {
  if (!prior || !Array.isArray(prior.activities)) return [];
  const usable = prior.activities.filter(
    (a) => typeof a.label === "string" && a.label.trim() && !a.fixed
  );
  const chosen = usable.filter((a) => a.anchor || a.energy);
  return (chosen.length ? chosen : usable).slice(0, 4).map((a) => ({
    label: a.label.trim(),
    frequency: a.frequency || "Weekly",
    ...(a.anchor ? { anchor: true } : {}),
    ...(a.energy ? { energy: true } : {}),
  }));
}

// The early-leaning priorities from 4.2's seasons board, with the season labels
// they sit in, plus the season order. The model uses these to know what the person
// wanted to do early in retirement.
export function firstYearSeasonInputs(prior: SeasonsBoardResult | null): {
  priorities: FirstYearSeasonPriority[];
  seasonOrder: string[];
} {
  if (!prior || !Array.isArray(prior.placements)) {
    return { priorities: [], seasonOrder: [] };
  }
  const priorities = prior.placements
    .filter(
      (p) =>
        typeof p.label === "string" &&
        p.label.trim() &&
        Array.isArray(p.seasons) &&
        p.seasons.length > 0
    )
    .slice(0, 14)
    .map((p) => ({ label: p.label.trim(), seasons: p.seasons }));
  return {
    priorities,
    seasonOrder: Array.isArray(prior.seasonOrder) ? prior.seasonOrder : [],
  };
}

// Call the drafting route. Returns the drafted seed, or null on any failure.
export async function fetchFirstYearDraft(
  input: FirstYearDraftInput
): Promise<FirstYearSeed | null> {
  return fetchSeedWithRetry<FirstYearSeed>(
    "/api/first-year",
    input,
    (s) => s.items.length > 0
  );
}

// Ask Vita to reshape the timeline and/or rewrite the narrative from a natural-
// language instruction (the "edit" mode), or just rewrite the narrative after a
// direct move (the "narrate" mode). Returns the structured result, or null on any
// failure so the caller can leave the timeline as it is.
export type FirstYearChatInput = {
  mode: "edit" | "narrate";
  items: FirstYearItemSeed[];
  narrative: string;
  seasons: { id: string; label: string }[];
  userModel: string;
  onboarding: string;
  sessionInstructions: string;
  // Only for "edit".
  message?: string;
  history?: { role: "coach" | "user"; text: string }[];
};

export type FirstYearChatResult = {
  reply: string;
  clarify?: boolean;
  items?: FirstYearItemSeed[];
  narrative?: string;
};

export async function fetchFirstYearChat(
  input: FirstYearChatInput
): Promise<FirstYearChatResult | null> {
  try {
    const res = await fetch("/api/first-year/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return (await res.json()) as FirstYearChatResult;
  } catch {
    return null;
  }
}

// ---- Fallback (grounded where it can be, never empty) ----
// Only used when the model call fails entirely. Assembles a reasonable first year
// from whatever inputs exist, so the surface reads as a sensible starting point.
export function fallbackFirstYear(input: FirstYearDraftInput): FirstYearSeed {
  const items: FirstYearItemSeed[] = [];
  const seasons = SEASON_IDS;

  // Spread the goals across the year, spotlighted ones earlier; mark the first as
  // top of the list and flag anything that reads as a trip.
  const goals = input.goals ?? [];
  goals.slice(0, 8).forEach((g, i) => {
    const isTrip = /\b(trip|travel|visit|holiday|see |go to|journey|cruise)\b/i.test(
      g.goal
    );
    items.push({
      label: g.goal,
      kind: isTrip ? "trip" : g.track === "be" ? "project" : "goal",
      season: seasons[Math.min(i, seasons.length - 1)],
      ...(i === 0 ? { top: true } : {}),
      ...(g.note ? { note: g.note } : {}),
    });
  });

  // A couple of rhythm threads that run through the whole year.
  (input.rhythm ?? []).slice(0, 3).forEach((r) => {
    items.push({ label: r.label, kind: "rhythm", season: ALL_YEAR });
  });

  // The work footprint, if they're phasing out gradually.
  if (input.transition?.lean === "gradual") {
    items.push({
      label: input.transition.shape
        ? `Ongoing work — ${input.transition.shape}`
        : "Ongoing work, winding down",
      kind: "work",
      season: ALL_YEAR,
      fixed: true,
    });
  }

  return { items, narrative: fallbackNarrative(input) };
}

// A plain, grounded narrative for when the model call fails entirely.
function fallbackNarrative(input: FirstYearDraftInput): string {
  const first = input.goals?.[0]?.goal;
  const work =
    input.transition?.lean === "gradual"
      ? " Work is still part of the picture, winding down across the year, so the months around it have room to breathe."
      : " With a clean break from work, the year is yours to shape from the start.";
  return `Your first year opens gently, finding the rhythm of days that are your own again.${first ? ` ${first} is there near the front, one of the things you most want to begin.` : ""} As the months go on, more of what matters takes its place, with the steady threads of your week running underneath it all.${work} By the close of the year, the shape of this new chapter has settled into something that feels like yours.`;
}

// ---- Coercion ----
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeKind(raw: unknown): FirstYearKind {
  const low = str(raw).toLowerCase();
  if ((ITEM_KINDS as readonly string[]).includes(low)) return low as FirstYearKind;
  if (low.includes("trip") || low.includes("travel") || low.includes("holiday"))
    return "trip";
  if (low.includes("rhythm") || low.includes("routine") || low.includes("weekly"))
    return "rhythm";
  if (low.includes("work") || low.includes("job")) return "work";
  if (low.includes("goal")) return "goal";
  return "project";
}

function normalizeSeason(raw: unknown): string {
  const low = str(raw).toLowerCase();
  if ((SEASON_IDS as readonly string[]).includes(low)) return low;
  if (low.includes("all") || low.includes("through") || low.includes("ongoing"))
    return ALL_YEAR;
  // Tolerate "1".."4", "first".."fourth", "q1".."q4".
  if (/(^|\D)1(\D|$)|first|q1|early|opening/.test(low)) return "s1";
  if (/(^|\D)2(\D|$)|second|q2/.test(low)) return "s2";
  if (/(^|\D)3(\D|$)|third|q3/.test(low)) return "s3";
  if (/(^|\D)4(\D|$)|fourth|q4|end|clos/.test(low)) return "s4";
  return ALL_YEAR;
}

function coerceItem(raw: unknown): FirstYearItemSeed | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = str(o.label);
  if (!label) return null;
  const kind = normalizeKind(o.kind);
  return {
    label,
    kind,
    season: kind === "rhythm" ? ALL_YEAR : normalizeSeason(o.season),
    ...(o.top === true ? { top: true } : {}),
    ...(str(o.note) ? { note: str(o.note) } : {}),
    ...(o.fixed === true || kind === "work" ? { fixed: kind === "work" } : {}),
  };
}

// Clean an array of items the model returned, de-duplicating by label so nothing
// appears twice. Shared by the draft and the chat-edit routes.
export function coerceItemList(raw: unknown): FirstYearItemSeed[] {
  const items: FirstYearItemSeed[] = [];
  const byLabel = new Map<string, FirstYearItemSeed>();
  if (Array.isArray(raw)) {
    for (const it of raw) {
      const cleaned = coerceItem(it);
      if (!cleaned) continue;
      const key = cleaned.label.toLowerCase();
      if (byLabel.has(key)) continue;
      byLabel.set(key, cleaned);
      items.push(cleaned);
      if (items.length >= 24) break;
    }
  }
  return items;
}

// Validate and clean whatever the model returned into the seed shape. Items
// sharing a label are de-duplicated so nothing appears twice.
export function coerceFirstYear(
  raw: unknown,
  input: FirstYearDraftInput
): FirstYearSeed {
  const fb = fallbackFirstYear(input);
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const items = coerceItemList(obj.items);
  const narrative = str(obj.narrative);

  return {
    // Keep the model's real items; the fallback set is still built from the
    // person's own goals/rhythm, so it's a grounded floor if the model gave none.
    items: items.length ? items : fb.items,
    // Never fabricate the first-year prose. If the model gave no narrative, leave
    // it blank for the person to write, rather than inventing one for them.
    narrative,
  };
}
