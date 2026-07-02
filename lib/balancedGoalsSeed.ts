// Module 4.3 (balanced-goals) drafting contract.
//
// Unlike the rest of Stage 4, which pre-fills deterministically, 4.3 asks Vita
// to DRAFT a small, curated set of concrete, personal goals for the person to
// curate — keep, edit, swap for a bolder or quieter version, reject, or add
// their own. One structured Claude call (/api/balanced-goals) reads the picture
// built up across the earlier stages and returns well-articulated goals already
// sorted into the five balanced-retirement areas. Anything that goes wrong
// falls back to a small generic set so the surface always renders.

import type { BalancedAreaId } from "@/lib/modules";
import type { RetirementStage } from "@/lib/userData";
import { BALANCED_AREAS } from "@/lib/userModel";

// One intensity of a goal — a complete, standalone phrasing that reads clearly
// on its own. Each carries its own track and its own timing, so swapping to a
// bolder or quieter version changes the whole card, not just the wording.
export type GoalVariant = {
  // "do" is a thing to do or achieve; "be" is a way to live. A version may
  // switch track if that's the honest way to make it gentler or bolder.
  track: "do" | "be";
  // The goal itself at this intensity — specific, personal, plain language.
  label: string;
  // do-version: a rough "when / how often". Absent on a be-version.
  cadence?: string;
  // be-version: what it looks like in an ordinary week. Absent on a do-version.
  ordinaryWeek?: string;
};

// One drafted goal, sorted into a balanced area, carried at up to three
// intensities. "original" is the default the person sees; "bolder" and
// "quieter" are the same goal one notch more or less ambitious, for the one-tap
// swap. The person can step between them without losing the original.
export type GoalSuggestion = {
  area: BalancedAreaId;
  // One short line on why it was suggested, tied to something they said.
  why: string;
  original: GoalVariant;
  bolder?: GoalVariant;
  quieter?: GoalVariant;
};

export type BalancedGoalsSeed = { suggestions: GoalSuggestion[] };

// The picture the draft is built from. Assembled by the caller (the component
// has the rendered user model, onboarding line and per-area material).
export type BalancedGoalsDraftInput = {
  userModel: string;
  onboarding: string;
  hasPartner: boolean;
  // Where they are with work and retirement, or null when uncaptured. Carried on
  // the same rail as hasPartner for later phases; nothing branches on it yet.
  retirementStage: RetirementStage | null;
  springboards: { area: string; labels: string[] }[];
};

// Call the drafting route. Returns the drafted seed, or null on any failure so
// the caller can fall back. Shared so the surface and an earlier prefetch (run
// while the person reads the intro) use exactly the same request.
export async function fetchBalancedGoalsDraft(
  input: BalancedGoalsDraftInput
): Promise<BalancedGoalsSeed | null> {
  try {
    const res = await fetch("/api/balanced-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { seed: BalancedGoalsSeed | null };
    return data.seed && data.seed.suggestions.length > 0 ? data.seed : null;
  } catch {
    return null;
  }
}

// The five valid area ids, as a lookup so off-area model output is dropped.
const VALID_AREAS = new Set<string>(BALANCED_AREAS);

// ---- Fallback (generic, never empty) ----
// Only used when the model call fails entirely or there's nothing to draw on.
// Deliberately modest and common so it reads as a reasonable starting point the
// person edits, rejects, or adds on top of — never a dead end.
export const FALLBACK_BALANCED_GOALS: BalancedGoalsSeed = {
  suggestions: [
    {
      area: "restore",
      why: "a gentle anchor for rest in the week",
      original: {
        track: "be",
        label: "Keep one slow morning a week that belongs to nobody else",
        ordinaryWeek: "an unhurried morning with nothing booked in",
      },
      quieter: {
        track: "be",
        label: "Keep one slow morning a month that belongs to nobody else",
        ordinaryWeek: "an unhurried morning now and then",
      },
      bolder: {
        track: "be",
        label: "Keep a slow morning most days, and one whole slow day each week",
        ordinaryWeek: "unhurried mornings, and a full day with nothing booked",
      },
    },
    {
      area: "move",
      why: "keeping an active body in the picture",
      original: {
        track: "do",
        label: "Walk somewhere new most weeks, building up the distance over the first year",
        cadence: "most weeks",
      },
      quieter: {
        track: "do",
        label: "Take a short walk somewhere new when the mood takes you",
        cadence: "now and then",
      },
      bolder: {
        track: "do",
        label: "Walk somewhere new every week and work up to a long-distance route by year's end",
        cadence: "every week, building to a big walk",
      },
    },
    {
      area: "think",
      why: "a curious mind likes something to work at",
      original: {
        track: "do",
        label: "Take up one thing you've wanted to learn and stay with it for a season",
        cadence: "a little each week",
      },
      quieter: {
        track: "be",
        label: "Keep something you've wanted to learn ticking along, with no pressure to keep it up",
        ordinaryWeek: "a little time with it whenever it appeals",
      },
      bolder: {
        track: "do",
        label: "Take up something you've wanted to learn and work toward a real milestone in it this year",
        cadence: "several times a week",
      },
    },
    {
      area: "connect",
      why: "the relationships worth protecting",
      original: {
        track: "be",
        label: "See the people who matter often enough that it never feels like catching up",
        ordinaryWeek: "a regular call or visit with someone close",
      },
      quieter: {
        track: "be",
        label: "Stay in easy touch with the people who matter",
        ordinaryWeek: "a message or call when you think of them",
      },
      bolder: {
        track: "be",
        label: "Be the one who keeps everyone close — regular visits and something you all do together",
        ordinaryWeek: "frequent visits and a standing get-together",
      },
    },
    {
      area: "contribute",
      why: "a way to feel useful beyond the day-to-day",
      original: {
        track: "do",
        label: "Give a few hours to something beyond yourself once it's up and running",
        cadence: "a few hours a month",
      },
      quieter: {
        track: "do",
        label: "Lend a hand to something beyond yourself when you're asked",
        cadence: "once in a while",
      },
      bolder: {
        track: "do",
        label: "Take on a regular role with something beyond yourself",
        cadence: "most weeks",
      },
    },
  ],
};

// ---- Coercion ----
// Clean one intensity into a GoalVariant, or null if it has no usable label.
function coerceVariant(raw: unknown): GoalVariant | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;

  const track = o.track === "be" ? "be" : "do";
  const cadence = typeof o.cadence === "string" ? o.cadence.trim() : "";
  const ordinaryWeek =
    typeof o.ordinaryWeek === "string" ? o.ordinaryWeek.trim() : "";

  return {
    track,
    label,
    ...(track === "do" && cadence ? { cadence } : {}),
    ...(track === "be" && ordinaryWeek ? { ordinaryWeek } : {}),
  };
}

// Validate and clean whatever the model returned into the seed shape, dropping
// off-area entries and any goal with no usable original, and capping the set so
// the surface stays glanceable.
export function coerceBalancedGoals(raw: unknown): BalancedGoalsSeed {
  if (!raw || typeof raw !== "object") return FALLBACK_BALANCED_GOALS;
  const arr = (raw as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(arr)) return FALLBACK_BALANCED_GOALS;

  const out: GoalSuggestion[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const area = typeof o.area === "string" ? o.area.trim().toLowerCase() : "";
    if (!VALID_AREAS.has(area)) continue;

    const original = coerceVariant(o.original);
    if (!original) continue;
    const why = typeof o.why === "string" ? o.why.trim() : "";
    const bolder = coerceVariant(o.bolder);
    const quieter = coerceVariant(o.quieter);

    out.push({
      area: area as BalancedAreaId,
      why,
      original,
      ...(bolder ? { bolder } : {}),
      ...(quieter ? { quieter } : {}),
    });
  }

  return out.length ? { suggestions: out.slice(0, 8) } : FALLBACK_BALANCED_GOALS;
}
