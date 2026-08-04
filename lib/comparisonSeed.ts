// The Vita-generated half of the couples comparison: the framing opener and the
// three observation groups plus seed talk topics. Everything deterministic (the
// goals/hopes/fears lists, the partner labels) is rendered from data, not from
// the model. Mirrors the coerce-and-fallback convention of lib/stage3Seed.ts:
// defensive field-by-field parsing, hard caps, and a safe fallback constant the
// route can detect by identity.

// One observation. `sides` optionally carries each partner's own position (used
// for the clearest complementary/different points); `clearest` marks the single
// clearest difference that leads its section.
export type ComparisonObservation = {
  text: string;
  sides?: { name: string; text: string }[];
  clearest?: boolean;
};

export type Comparison = {
  // The generated opener only — the fixed close is appended in the view.
  framingOpener: string;
  sharedGround: string[];
  complementary: ComparisonObservation[];
  different: ComparisonObservation[];
  talkTopics: string[];
};

// Returned when generation fails or produces nothing usable. Empty groups render
// as absent sections; the talk-list empty state covers the empty talkTopics. The
// opener is deliberately plain and true-for-anyone (no invented specifics).
export const FALLBACK_COMPARISON: Comparison = {
  framingOpener:
    "You've each built a plan of your own, and here they sit side by side.",
  sharedGround: [],
  complementary: [],
  different: [],
  talkTopics: [],
};

const MAX_OBS = 12;
const MAX_LIST = 12;
const MAX_SIDES = 2;

function str(v: unknown, max = 600): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function strArray(v: unknown, max = MAX_LIST): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => str(x))
    .filter((s) => s.length > 0)
    .slice(0, max);
}

function sides(v: unknown): { name: string; text: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((s) => {
      const o = (s ?? {}) as { name?: unknown; text?: unknown };
      return { name: str(o.name, 80), text: str(o.text) };
    })
    .filter((s) => s.name && s.text)
    .slice(0, MAX_SIDES);
  return out.length ? out : undefined;
}

function observations(v: unknown): ComparisonObservation[] {
  if (!Array.isArray(v)) return [];
  const out: ComparisonObservation[] = [];
  for (const raw of v) {
    const o = (raw ?? {}) as {
      text?: unknown;
      sides?: unknown;
      clearest?: unknown;
    };
    const text = str(o.text);
    if (!text) continue;
    const obs: ComparisonObservation = { text };
    const s = sides(o.sides);
    if (s) obs.sides = s;
    if (o.clearest === true) obs.clearest = true;
    out.push(obs);
    if (out.length >= MAX_OBS) break;
  }
  // At most one "clearest" difference leads — keep the first, clear the rest.
  let seenClearest = false;
  for (const o of out) {
    if (o.clearest) {
      if (seenClearest) delete o.clearest;
      else seenClearest = true;
    }
  }
  return out;
}

// Validate the model's JSON into a Comparison. Returns FALLBACK_COMPARISON (by
// identity, so the caller can decide null-vs-fallback) when there's no usable
// opener at all.
export function coerceComparison(raw: unknown): Comparison {
  const o = (raw ?? {}) as Record<string, unknown>;
  const framingOpener = str(o.framingOpener);
  if (!framingOpener) return FALLBACK_COMPARISON;
  return {
    framingOpener,
    sharedGround: strArray(o.sharedGround),
    complementary: observations(o.complementary),
    different: observations(o.different),
    talkTopics: strArray(o.talkTopics),
  };
}
