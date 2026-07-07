// Stage 3 (Understand) seeding contract.
//
// Every Stage 3 surface is pre-seeded so the person never starts from a blank
// screen: a single structured Claude call (/api/stage3-seed) reads everything
// they shared in Stages 1–2 and the earlier Stage 3 modules and returns typed
// candidate content for the module they're about to do. The seed is persisted
// per module (key `seed:3.x`) so a refresh never regenerates it.
//
// Generation quality is iterative, so anything that goes wrong (network, bad
// JSON, sparse inputs) falls back to a safe generic seed — the surface must
// always render with something on it.

import type { RetirementStage } from "@/lib/userData";

// One inferred candidate with a short evidence line in the person's own terms,
// e.g. { label: "Curiosity", evidence: "showed up when you talked about
// astronomy in Keeping Your Mind Alive" }.
export type SeedCard = { label: string; evidence: string };

// ---- The VIA character strengths (the fixed universe for 3.1) ----
// 3.1 "Your strengths" is recognition against a known list, never open
// generation: every strength on the surface — seeded, browsed, or starred —
// must be one of these 24. They're the VIA classification in plain language,
// grouped into six virtue clusters so the list scans rather than overwhelms.
// This is the single source of truth: the seed route constrains the model to
// it, modules.ts feeds it to the surface, and the component shows "the rest of
// the list" as these minus whatever is already on a card.
export const VIA_CLUSTERS: { name: string; strengths: string[] }[] = [
  {
    name: "Head & curiosity",
    strengths: [
      "Curiosity",
      "Love of learning",
      "Creativity",
      "Good judgement",
      "Perspective",
    ],
  },
  {
    name: "Heart & courage",
    strengths: ["Bravery", "Perseverance", "Honesty", "Zest"],
  },
  {
    name: "People & warmth",
    strengths: ["Kindness", "Love", "Reading people"],
  },
  {
    name: "Fairness & leading",
    strengths: ["Fairness", "Leadership", "Teamwork"],
  },
  {
    name: "Steadiness & restraint",
    strengths: ["Forgiveness", "Humility", "Caution", "Self-control"],
  },
  {
    name: "Meaning & spirit",
    strengths: [
      "Eye for beauty",
      "Gratitude",
      "Hope",
      "Humour",
      "Sense of meaning",
    ],
  },
];

// Flat list of all 24, in cluster order.
export const VIA_STRENGTHS: string[] = VIA_CLUSTERS.flatMap((c) => c.strengths);

// Case-insensitive lookup: returns the canonical label for any VIA strength,
// or null if the label isn't in the set (so non-VIA model output is dropped).
const VIA_CANONICAL = new Map(
  VIA_STRENGTHS.map((s) => [s.toLowerCase(), s])
);

export function canonicalViaStrength(label: string): string | null {
  return VIA_CANONICAL.get(label.trim().toLowerCase()) ?? null;
}

// ---- The fixed value set (the universe for 3.2) ----
// 3.2 "Your values" works the same way as 3.1: recognition against a known set,
// never open generation. Every value on the surface — seeded, browsed from the
// rest of the set, or surfaced in evidence — must be one of these 27. They're
// grouped into six clusters so the rest-of-set palette scans rather than
// overwhelms. This is the single source of truth: the seed route constrains the
// model to it, the component shows "the rest of the set" as these minus
// whatever is already on a card.
// (Final wording and glosses to come from SMW; these labels are provisional.)
export const VALUE_CLUSTERS: { name: string; values: string[] }[] = [
  {
    name: "Connection & care",
    values: [
      "Connection",
      "Family",
      "Community",
      "Kindness",
      "Generosity",
      "Contribution",
    ],
  },
  {
    name: "Fairness & world",
    values: ["Fairness", "Nature", "Beauty"],
  },
  {
    name: "Freedom & exploration",
    values: [
      "Freedom",
      "Independence",
      "Curiosity",
      "Creativity",
      "Growth",
      "Adventure",
    ],
  },
  {
    name: "Mastery & enjoyment",
    values: ["Achievement", "Influence", "Pleasure", "Health", "Calm"],
  },
  {
    name: "Security & continuity",
    values: [
      "Security",
      "Stability",
      "Tradition",
      "Loyalty",
      "Faith or meaning",
    ],
  },
  {
    name: "Integrity",
    values: ["Authenticity", "Honesty"],
  },
];

// Flat list of all 27, in cluster order.
export const VALUE_SET: string[] = VALUE_CLUSTERS.flatMap((c) => c.values);

// Case-insensitive lookup: returns the canonical label for any value in the
// set, or null if the label isn't in it (so off-set model output is dropped).
const VALUE_CANONICAL = new Map(VALUE_SET.map((v) => [v.toLowerCase(), v]));

export function canonicalValue(label: string): string | null {
  return VALUE_CANONICAL.get(label.trim().toLowerCase()) ?? null;
}

// ---- The fixed fear bank (the universe for 3.5) ----
// 3.5 "Hopes and fears" runs its fears half as recognition against a known bank,
// grouped into three time horizons so the list scans rather than overwhelms. The
// seed surfaces a moderate handful per horizon as cards the person reacts to, and
// the component shows the rest of each horizon as a browsable palette. Unlike VIA
// strengths and values, fear labels aren't strictly canonicalised: where the
// person's own picture gives a clear hook the seed may personalise a card (e.g. a
// specific version of "what happens when the body can't keep that pace"), so we
// keep the labels as free short phrases rather than constraining them to the set.
export const FEAR_HORIZONS: { name: string; fears: string[] }[] = [
  {
    name: "The transition",
    fears: [
      "Losing the sense of purpose work gave me",
      "Not knowing who I am without the job",
      "The empty diary — too much unstructured time",
      "Missing the people and routine of work",
      "Feeling adrift at first",
      "Feeling I matter less",
    ],
  },
  {
    name: "Life in retirement",
    fears: [
      "Becoming isolated or lonely",
      "Boredom — days that blur together",
      "Being under each other's feet all the time",
      "Feeling irrelevant",
      "Money not stretching as hoped",
      "Slowing down and not getting the momentum back",
    ],
  },
  {
    name: "The longer view",
    fears: [
      "Declining health or energy",
      "Losing my independence",
      "Becoming a burden to my family",
      "Cognitive decline",
      "Losing a partner",
      "Outliving my savings",
    ],
  },
];

// The three horizon names, in order — the component groups cards under these and
// the seed must return its handful keyed to them.
export const FEAR_HORIZON_NAMES: string[] = FEAR_HORIZONS.map((h) => h.name);

// Flat list of every banked fear, in horizon order.
export const FEAR_SET: string[] = FEAR_HORIZONS.flatMap((h) => h.fears);

// Worries that only make sense for someone retiring alongside a partner. They're
// filtered out of both the seed bank and the browsable palette for anyone who
// flagged at onboarding that they're planning retirement on their own, so a solo
// person is never shown "losing a partner" or "under each other's feet".
export const PARTNER_FEARS: Set<string> = new Set([
  "Being under each other's feet all the time",
  "Losing a partner",
]);

// The name of the first ("transition") fear horizon, per retirement stage. The
// default "The transition" reads as still-ahead; the retired cohorts have been
// through it (retrospective/present) and winding-down is in it now (Phase 6).
// null / working keep the default, so the flag-off bank is unchanged.
function transitionHorizonName(rs: RetirementStage | null): string {
  switch (rs) {
    case "winding_down":
      return "As work winds down";
    case "recently_retired":
      return "Since work ended";
    case "established":
      return "Adjusting to life after work";
    default:
      return "The transition";
  }
}

// The fear bank for a given person: the full set if they have a partner,
// otherwise the bank with the partner-only worries removed (empty horizons are
// kept so the three horizons stay stable). The first horizon's NAME is reframed
// per retirement stage so it doesn't read as a change still ahead of someone who
// has already been through it (Phase 6); the later two horizons are timeless.
export function fearHorizonsFor(
  hasPartner: boolean,
  retirementStage: RetirementStage | null = null
): { name: string; fears: string[] }[] {
  const transitionName = transitionHorizonName(retirementStage);
  const horizons = FEAR_HORIZONS.map((h, i) => ({
    name: i === 0 ? transitionName : h.name,
    fears: hasPartner ? h.fears : h.fears.filter((f) => !PARTNER_FEARS.has(f)),
  }));
  // Established: a long-settled retiree is past any "transition", so the first
  // horizon folds into "Life in retirement now" — leaving TWO horizons, which is
  // what the 3.5 primer for this cohort says ("life in retirement now, and the
  // longer view").
  if (retirementStage === "established") {
    const [first, second, third] = horizons;
    return [
      { name: "Life in retirement now", fears: [...first.fears, ...second.fears] },
      third,
    ];
  }
  return horizons;
}

// The seed shape is keyed by the interaction type it feeds, so the seeding phase
// can match it to the module and the component can read it directly.
export type Stage3Seed =
  | { type: "mirror-cards"; cards: SeedCard[] }
  | { type: "value-triage"; cards: SeedCard[] }
  | {
      type: "priority-choices";
      pairs: { left: string; right: string }[];
      values: string[];
    }
  | {
      type: "value-definitions";
      values: {
        value: string;
        description: string;
        threat: string;
        protectors: string[];
      }[];
    }
  | {
      type: "hopes-fears";
      // A short, warm line reflecting back what the person has been reaching for
      // across the stage — confirmed from their own picture, shown read-only as an
      // on-ramp before the fears half.
      hopes: string;
      // A moderate handful of candidate fear cards per horizon, drawn from the
      // bank (or lightly personalised where their picture gives a clear hook).
      horizons: { horizon: string; fears: string[] }[];
    }
  | { type: "bigger-picture"; threads: string[]; draft: string };

export type Stage3SeedType = Stage3Seed["type"];

// The interaction types that go through the seeding phase. Kept here so both the
// session container and the API agree on what gets seeded.
export const SEEDED_TYPES: Stage3SeedType[] = [
  "mirror-cards",
  "value-triage",
  "priority-choices",
  "value-definitions",
  "hopes-fears",
  "bigger-picture",
];

export function isSeededType(type: string): type is Stage3SeedType {
  return (SEEDED_TYPES as string[]).includes(type);
}

// ---- Fallbacks (generic, never empty) ----
// Deliberately modest and common so they read as reasonable starting points
// even when nothing could be inferred. The person edits, rejects, and adds on
// top of them, so a thin fallback is never a dead end.

export const FALLBACK_SEEDS: Record<Stage3SeedType, Stage3Seed> = {
  "mirror-cards": {
    type: "mirror-cards",
    cards: [
      { label: "Curiosity", evidence: "the way you keep wanting to learn new things" },
      { label: "Kindness", evidence: "the people who ran through your earlier answers" },
      { label: "Perseverance", evidence: "the way you kept showing up for what mattered" },
    ],
  },
  "value-triage": {
    type: "value-triage",
    cards: [
      { label: "Connection", evidence: "the people who mattered in your picture" },
      { label: "Freedom", evidence: "the unstructured time you leaned toward" },
      { label: "Growth", evidence: "the things you still want to learn" },
      { label: "Contribution", evidence: "the ways you pictured helping" },
    ],
  },
  "priority-choices": {
    type: "priority-choices",
    pairs: [
      { left: "A free, unstructured week", right: "A week with people and plans in it" },
      { left: "Going deep on one thing", right: "A bit of everything" },
      { left: "Time on your own", right: "Time with others" },
    ],
    values: ["Freedom", "Connection", "Growth", "Contribution"],
  },
  "value-definitions": {
    type: "value-definitions",
    values: [
      {
        value: "Freedom",
        description: "choosing your own pace, not over-committing",
        threat: "A calendar that fills up with other people's plans before you notice.",
        protectors: [
          "Keeping some days each week with nothing booked in",
          "Saying no to standing commitments that don't earn their place",
          "Protecting your mornings for whatever you feel like",
        ],
      },
    ],
  },
  "hopes-fears": {
    type: "hopes-fears",
    hopes: "",
    horizons: [
      {
        horizon: "The transition",
        fears: [
          "Losing the sense of purpose work gave me",
          "Missing the people and routine of work",
          "The empty diary — too much unstructured time",
        ],
      },
      {
        horizon: "Life in retirement",
        fears: [
          "Becoming isolated or lonely",
          "Boredom — days that blur together",
          "Money not stretching as hoped",
        ],
      },
      {
        horizon: "The longer view",
        fears: [
          "Declining health or energy",
          "Losing my independence",
          "Becoming a burden to my family",
        ],
      },
    ],
  },
  "bigger-picture": {
    type: "bigger-picture",
    threads: [
      "The people I stayed close to",
      "The curiosity I never lost",
      "The way I kept showing up for what mattered",
    ],
    draft: "",
  },
};

// ---- Coercion ----
// Validate and clean whatever the model returned into the seed shape for this
// module type, falling back per-field (and ultimately to FALLBACK_SEEDS) so a
// partial or malformed response still yields a usable surface.

function strArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function cards(v: unknown, max: number): SeedCard[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (c): c is SeedCard =>
        !!c &&
        typeof c === "object" &&
        typeof (c as SeedCard).label === "string" &&
        (c as SeedCard).label.trim().length > 0
    )
    .map((c) => ({
      label: c.label.trim(),
      evidence: typeof c.evidence === "string" ? c.evidence.trim() : "",
    }))
    .slice(0, max);
}

// Like cards(), but keeps only labels that are real VIA strengths and rewrites
// each to its canonical spelling — so a model that strays off the list (or
// mis-cases a label) can't put a non-VIA card on the 3.1 surface.
function viaCards(v: unknown, max: number): SeedCard[] {
  const seen = new Set<string>();
  return cards(v, max * 2)
    .map((c) => {
      const canonical = canonicalViaStrength(c.label);
      return canonical ? { label: canonical, evidence: c.evidence } : null;
    })
    .filter((c): c is SeedCard => {
      if (!c || seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    })
    .slice(0, max);
}

// Like cards(), but keeps only labels that are in the fixed value set and
// rewrites each to its canonical spelling — so a model that invents a value (or
// labels evidence with a domain like "Home") can't put an off-set card on the
// 3.2 surface.
function valueCards(v: unknown, max: number): SeedCard[] {
  const seen = new Set<string>();
  return cards(v, max * 2)
    .map((c) => {
      const canonical = canonicalValue(c.label);
      return canonical ? { label: canonical, evidence: c.evidence } : null;
    })
    .filter((c): c is SeedCard => {
      if (!c || seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    })
    .slice(0, max);
}

export function coerceSeed(type: Stage3SeedType, raw: unknown): Stage3Seed {
  const fallback = FALLBACK_SEEDS[type];
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;

  switch (type) {
    case "mirror-cards": {
      const c = viaCards(obj.cards, 6);
      return c.length ? { type, cards: c } : fallback;
    }
    case "value-triage": {
      const c = valueCards(obj.cards, 5);
      return c.length ? { type, cards: c } : fallback;
    }
    case "priority-choices": {
      const pairs = Array.isArray(obj.pairs)
        ? obj.pairs
            .filter(
              (p): p is { left: string; right: string } =>
                !!p &&
                typeof p === "object" &&
                typeof (p as { left?: unknown }).left === "string" &&
                typeof (p as { right?: unknown }).right === "string"
            )
            .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
            .slice(0, 10)
        : [];
      const values = strArray(obj.values, 6);
      return pairs.length >= 3 && values.length >= 2
        ? { type, pairs, values }
        : fallback;
    }
    case "value-definitions": {
      const values = Array.isArray(obj.values)
        ? obj.values
            .filter(
              (x): x is Record<string, unknown> =>
                !!x &&
                typeof x === "object" &&
                typeof (x as { value?: unknown }).value === "string"
            )
            .map((x) => ({
              value: String(x.value).trim(),
              description:
                typeof x.description === "string" ? x.description.trim() : "",
              threat: typeof x.threat === "string" ? x.threat.trim() : "",
              protectors: strArray(x.protectors, 3),
            }))
            .filter((x) => x.value.length > 0)
            .slice(0, 5)
        : [];
      return values.length ? { type, values } : fallback;
    }
    case "hopes-fears": {
      const fb = fallback as Extract<Stage3Seed, { type: "hopes-fears" }>;
      const hopes = typeof obj.hopes === "string" ? obj.hopes.trim() : "";
      // Index the model's horizons by name (case-insensitive) so we can rebuild
      // them in the fixed order, regardless of how the model ordered or named
      // them. Anything that isn't one of the three known horizons is dropped.
      const byName = new Map<string, string[]>();
      if (Array.isArray(obj.horizons)) {
        for (const h of obj.horizons) {
          if (!h || typeof h !== "object") continue;
          const name = (h as { horizon?: unknown }).horizon;
          if (typeof name !== "string") continue;
          byName.set(name.trim().toLowerCase(), strArray((h as { fears?: unknown }).fears, 6));
        }
      }
      const horizons = FEAR_HORIZON_NAMES.map((name) => {
        const fears = byName.get(name.toLowerCase()) ?? [];
        const fallbackFears =
          fb.horizons.find((x) => x.horizon === name)?.fears ?? [];
        return { horizon: name, fears: fears.length ? fears : fallbackFears };
      });
      return { type, hopes, horizons };
    }
    case "bigger-picture": {
      const threads = strArray(obj.threads, 5);
      const draft = typeof obj.draft === "string" ? obj.draft.trim() : "";
      return threads.length ? { type, threads, draft } : fallback;
    }
    default:
      return fallback;
  }
}

// ---- Stage 3 stage-close summary (feeds Stage 4) ----
// On finishing the last Stage 3 module, the confirmed values are distilled into
// this record, mirroring how Stage 1/2 store a stage summary. confidence marks
// whether a value felt settled or was still forming (the "not sure" tray).
export type Stage3Value = {
  value: string;
  meaning: string;
  confidence: "certain" | "still forming";
};

export type Stage3ValuesSummary = {
  values: Stage3Value[];
  savedAt: string;
};
