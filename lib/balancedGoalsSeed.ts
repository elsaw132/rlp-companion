// Module 4.3 (balanced-goals) drafting contract.
//
// Unlike the rest of Stage 4, which pre-fills deterministically, 4.3 asks Vita
// to DRAFT a small, curated set of concrete, personal goals for the person to
// curate — keep, edit, swap for a bolder or quieter version, reject, or add
// their own. One structured Claude call (/api/balanced-goals) reads the picture
// built up across the earlier stages and returns well-articulated goals already
// sorted into the five balanced-retirement areas. Anything that goes wrong
// falls back to a small generic set so the surface always renders.

import type { RetirementStage } from "@/lib/userData";
import { fetchSeedWithRetry } from "@/lib/seedRetry";

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
  // The area of the person's life this goal is about, in their own words — a free
  // label ("Travel & adventure", "Our home"), not one of a fixed set.
  area: string;
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

// Call the drafting route, retrying transient failures before giving up. A single
// slow response, a timeout, an overloaded model, or a garbage draft used to strand
// the person on the generic fallback with no recovery; now the route SIGNALS those
// (a null seed / non-ok) and we retry a few times with backoff. Returns the drafted
// seed, or null only after every attempt fails — the caller then shows the generic
// set. A genuinely-empty profile is NOT a failure: the route returns the fallback
// seed directly (suggestions present), so it comes back on the first try without a
// wasted retry. Shared so the surface and the intro prefetch behave identically.
export async function fetchBalancedGoalsDraft(
  input: BalancedGoalsDraftInput,
  opts: { attempts?: number } = {}
): Promise<BalancedGoalsSeed | null> {
  return fetchSeedWithRetry<BalancedGoalsSeed>(
    "/api/balanced-goals",
    input,
    (s) => s.suggestions.length > 0,
    opts.attempts ?? 3
  );
}

// ---- Fallback (generic, never empty) ----
// Only used when the model call fails entirely or there's nothing to draw on.
// Deliberately modest and common so it reads as a reasonable starting point the
// person edits, rejects, or adds on top of — never a dead end.
export const FALLBACK_BALANCED_GOALS: BalancedGoalsSeed = {
  suggestions: [
    {
      area: "A big trip",
      why: "retirement is the time for the trips you've put off",
      original: {
        track: "do",
        label: "Take one proper trip you've always meant to make — somewhere that needs real time",
        cadence: "a big trip in year one",
      },
      quieter: {
        track: "do",
        label: "Take a two-week trip somewhere you've always wanted to go",
        cadence: "once in the first year",
      },
      bolder: {
        track: "do",
        label: "Spend a month or more travelling somewhere that's always felt out of reach",
        cadence: "a long trip in the first two years",
      },
    },
    {
      area: "Something to master",
      why: "a real skill worth getting properly good at",
      original: {
        track: "do",
        label: "Take up something you've always wanted to learn and get properly good at it",
        cadence: "a course this year, then keeping it up",
      },
      quieter: {
        track: "do",
        label: "Start a class in something you've always wanted to learn",
        cadence: "a course in the first year",
      },
      bolder: {
        track: "do",
        label: "Learn it seriously — a full course, and a real milestone to work toward this year",
        cadence: "regularly, with a milestone in year one",
      },
    },
    {
      area: "A project of your own",
      why: "something to build, finish, and be proud of",
      original: {
        track: "do",
        label: "Take on a project you've wanted to do and see it all the way through",
        cadence: "over the first year",
      },
      quieter: {
        track: "do",
        label: "Finish one project you've had in mind, done to your own standard",
        cadence: "in the first year",
      },
      bolder: {
        track: "do",
        label: "Take on the ambitious version of a project you care about, start to finish",
        cadence: "a major push over the first two years",
      },
    },
  ],
};

// ---- Coercion ----
// Clean one size into a GoalVariant, or null if it has no usable label. Every goal is
// now a concrete thing to DO, so the track is always "do" with a rough cadence.
function coerceVariant(raw: unknown): GoalVariant | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;
  const cadence = typeof o.cadence === "string" ? o.cadence.trim() : "";
  return {
    track: "do",
    label,
    ...(cadence ? { cadence } : {}),
  };
}

// Validate and clean whatever the model returned into the seed shape: a small set of
// goals, each with a free-text area label, a usable original, and its bolder/quieter
// sizes. Drops any goal with no usable original, and caps at four so the surface stays
// a short, strong set.
export function coerceBalancedGoals(raw: unknown): BalancedGoalsSeed {
  if (!raw || typeof raw !== "object") return FALLBACK_BALANCED_GOALS;
  const arr = (raw as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(arr)) return FALLBACK_BALANCED_GOALS;

  const out: GoalSuggestion[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const original = coerceVariant(o.original);
    if (!original) continue;
    const area = typeof o.area === "string" ? o.area.trim() : "";
    const why = typeof o.why === "string" ? o.why.trim() : "";
    const bolder = coerceVariant(o.bolder);
    const quieter = coerceVariant(o.quieter);

    out.push({
      area,
      why,
      original,
      ...(bolder ? { bolder } : {}),
      ...(quieter ? { quieter } : {}),
    });
  }

  return out.length ? { suggestions: out.slice(0, 4) } : FALLBACK_BALANCED_GOALS;
}
