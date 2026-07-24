// Module 4.3 — thread-based goal drafting + validation.
//
// Takes the deterministic thread pool (lib/goalThreads.ts) and drafts the goals the
// person will commit to. The model's job is to PHRASE and CONSOLIDATE — never to
// decide what's worthy. Its output is validated against the threads: every stated
// want must be represented, nothing duplicated, nothing vague. The route is a thin
// wrapper; the live harness calls draftGoalsFromThreads directly so we can watch real
// generated lists (and the coverage report) before any UI exists.
//
// LATENCY: the initial draft returns ONE phrasing per goal (the "original"). The
// gentler/bolder sizes are generated per-goal, on demand (draftGoalVariants), when a
// person dials a goal they've committed to. This cuts the up-front generation to
// roughly a third — a goal-rich person's list is dominated by the three-variant
// output — so the prefetch far more reliably lands before they reach the screen.

import type Anthropic from "@anthropic-ai/sdk";
import type { GoalSuggestion, GoalVariant } from "@/lib/balancedGoalsSeed";
import type { GoalThread } from "@/lib/goalThreads";

export const GOAL_DRAFT_MODEL = "claude-sonnet-4-6";
// The gentler/bolder rephrasings are mechanical and low-stakes — a fast model is fine.
export const GOAL_VARIANTS_MODEL = "claude-haiku-4-5-20251001";

export function goalDraftSystemPrompt(): string {
  return `You are drafting the GOALS someone will COMMIT TO for their retirement, in the "Plan" stage of a guided retirement life-planning programme. You know them well from the earlier stages.

A goal here is a SPECIFIC COMMITMENT — a concrete thing to do or achieve that they could one day say they have done ("Run the Great South Run this autumn", "Look after the grandchildren every week in term time"). It is NEVER a way of living or a vague intention. "Stay active", "be more present", "keep learning" are not goals here; leave them out entirely.

You are given two lists, both drawn from what THIS person actually said:

1. STATED WANTS — aspirations they named themselves. You MUST represent EVERY one of these with a goal. Where two say the same thing in different words ("Padel Tennis" and "Learn and play Padel Tennis"; "Vancouver" and "a trip to Vancouver with Sarah"), MERGE them into one goal. A fragment ("deep pre-trip research…") folds into the goal it belongs to. Never silently drop a stated want.

2. A POOL — the activities they do, the people in their life, and broader hopes. Draw further goals from here wherever there is a real, specific commitment to make. Do NOT make one goal per activity: group everyday activities into a single goal only where they genuinely form one pursuit, but KEEP a prominently-named pursuit (a named sport, a named place) as its own goal. Bias toward keeping named things distinct — the person sees the whole list, so a fuller, specific set beats an over-merged one.

EACH GOAL CARRIES
- "source": the specific thing they said that this goal came from, written to read after the words "You mentioned " — e.g. "rowing", "getting out walking", or for a stated want their intent, "wanting to be a Winchester guide". Short, lower-case unless a proper noun, true to what they said.
- "area": the area of their life this is about, in their own words, two to four words ("Travel", "The grandchildren", "Our home").
- "label": the goal as a short, vivid phrase with a real shape — a specific commitment.
- "cadence": a rough when or how-often, starting with a capital letter — "Over the first year", "One big trip a year", "A course this year, then weekly".

HOW MANY — as many as the material genuinely supports: one per stated want (after merging), plus the real commitments in the pool. A rich, full life yields many; a sparse one yields a few. Never pad, never invent a want, never drop a stated want to hit a number.

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive, genuinely. Never use negative-contrast or "it's not X, it's Y" structures. Speak directly and in the affirmative.

Respond with ONLY this JSON object — no markdown, no preamble:
{"goals":[{"source":"rowing","area":"On the water","label":"Join the rowing club and row through the season, bringing friends along","cadence":"Weekly through the season"}]}`;
}

// Format the thread pool for the model: stated wants first (must be covered), then
// the consolidatable pool.
export function buildGoalUserContent(
  threads: GoalThread[],
  opts: { onboarding?: string } = {}
): string {
  const wants = threads.filter((t) => t.mustCover).map((t) => `- ${t.label}`);
  const pool = threads.filter((t) => !t.mustCover).map((t) => `- ${t.label}`);
  return [
    opts.onboarding?.trim() ? `ABOUT THEM:\n${opts.onboarding.trim()}` : "",
    `STATED WANTS (represent EVERY one with a goal; merge duplicates and fold in fragments):\n${wants.join("\n") || "(none)"}`,
    `THE POOL — activities, people, hopes (draw further goals; consolidate sensibly, keep named pursuits distinct):\n${pool.join("\n") || "(none)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// A drafted goal's label reads as a real commitment, never a way-of-living.
const VAGUE = /^\s*(stay|keep|be|remain|continue|maintain|being)\b/i;

// Validate + clean the model's output into well-formed goals: non-empty source and
// label, drop vague labels, de-duplicate by source and by phrasing. Only the
// "original" phrasing is drafted up front; bolder/quieter fill in later.
export function coerceDraftedGoals(raw: unknown): GoalSuggestion[] {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const arr = Array.isArray(obj.goals) ? obj.goals : [];
  const out: GoalSuggestion[] = [];
  const seenSource = new Set<string>();
  const seenLabel = new Set<string>();
  for (const g of arr) {
    if (!g || typeof g !== "object") continue;
    const o = g as Record<string, unknown>;
    const source = typeof o.source === "string" ? o.source.trim() : "";
    const area = typeof o.area === "string" ? o.area.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!source || !label) continue;
    if (VAGUE.test(label)) continue; // not a commitment
    const sKey = source.toLowerCase();
    const lKey = label.toLowerCase();
    if (seenSource.has(sKey) || seenLabel.has(lKey)) continue; // dedup
    seenSource.add(sKey);
    seenLabel.add(lKey);
    const cadence = typeof o.cadence === "string" ? o.cadence.trim() : "";
    out.push({
      area: area || "Goals",
      source,
      original: { track: "do", label, ...(cadence ? { cadence } : {}) },
    });
  }
  return out;
}

// Draft the goals (originals only). Returns null on any failure or empty input —
// never a generic fallback; the surface shows an honest "something went wrong" state.
export async function draftGoalsFromThreads(
  anthropic: Anthropic,
  threads: GoalThread[],
  opts: { onboarding?: string } = {}
): Promise<GoalSuggestion[] | null> {
  if (threads.length === 0) return null; // goals must be grounded in real threads
  try {
    const res = await anthropic.messages.create({
      model: GOAL_DRAFT_MODEL,
      // Originals-only keeps this modest even for a rich profile (~18 goals).
      max_tokens: 4000,
      system: goalDraftSystemPrompt(),
      messages: [{ role: "user", content: buildGoalUserContent(threads, opts) }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
    const goals = coerceDraftedGoals(JSON.parse(slice));
    return goals.length ? goals : null;
  } catch (err) {
    // Never swallow silently — a recurring failure must be visible to the team.
    console.error("[goal-draft] drafting failed:", err);
    return null;
  }
}

// ---- On-demand gentler/bolder sizes (generated when a goal is dialled) ----------

export function goalVariantsSystemPrompt(): string {
  return `Given ONE retirement goal a person has committed to, write two alternative sizes of the SAME goal, keeping its intent:
- "quieter": a gentler on-ramp — smaller, easier to begin, still specific and complete.
- "bolder": more ambitious — bigger, further, or sooner — still realistic and theirs.
Each reads fully on its own. Each is {"label": the goal at this size, "cadence": a rough when/how-often starting with a capital letter}.
Voice: warm, specific, plain. Never use: reflect, explore, unpack, journey, growth, share, deep dive, genuinely. No "it's not X, it's Y" structures.
Respond with ONLY: {"quieter":{"label":"…","cadence":"…"},"bolder":{"label":"…","cadence":"…"}}`;
}

function coerceVariant(raw: unknown): GoalVariant | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;
  const cadence = typeof o.cadence === "string" ? o.cadence.trim() : "";
  return { track: "do", label, ...(cadence ? { cadence } : {}) };
}

// Generate the gentler + bolder sizes for one committed goal. Best-effort: returns
// whatever it got (possibly empty); the dial simply shows fewer sizes on failure.
export async function draftGoalVariants(
  anthropic: Anthropic,
  goal: { label: string; cadence?: string; source?: string }
): Promise<{ bolder?: GoalVariant; quieter?: GoalVariant }> {
  try {
    const user = [
      `The goal: ${goal.label}${goal.cadence ? ` (${goal.cadence})` : ""}`,
      goal.source ? `Drawn from: ${goal.source}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const res = await anthropic.messages.create({
      model: GOAL_VARIANTS_MODEL,
      max_tokens: 500,
      system: goalVariantsSystemPrompt(),
      messages: [{ role: "user", content: user }],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const o = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const bolder = coerceVariant(o.bolder);
    const quieter = coerceVariant(o.quieter);
    return { ...(bolder ? { bolder } : {}), ...(quieter ? { quieter } : {}) };
  } catch (err) {
    console.error("[goal-variants] failed:", err);
    return {};
  }
}

// ---- Validation (the confidence gate) ------------------------------------------

const STOP = new Set([
  "the","a","an","and","or","to","of","in","on","with","for","your","you","my",
  "their","them","that","this","some","more","most","one","two","three","into",
  "make","have","want","wanting","get","getting","play","playing","find","own",
  "including","longer","truly","really","first","full","year","years","retirement",
  "time","things","people","friends","new","local","home",
]);
function keyTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

// The stated wants that no drafted goal appears to represent — the drop check.
export function coverageGaps(
  mustCover: GoalThread[],
  goals: GoalSuggestion[]
): GoalThread[] {
  const haystacks = goals.map((g) =>
    `${g.source ?? ""} ${g.original.label} ${g.area}`.toLowerCase()
  );
  return mustCover.filter((m) => {
    const toks = keyTokens(m.label);
    if (toks.length === 0) return false; // nothing distinctive to check
    return !haystacks.some((h) => toks.some((t) => h.includes(t)));
  });
}

// Any goals sharing a source that slipped past coercion.
export function duplicateGoals(goals: GoalSuggestion[]): string[] {
  const bySource = new Map<string, number>();
  const dups: string[] = [];
  for (const g of goals) {
    const k = (g.source ?? "").toLowerCase();
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
    if (bySource.get(k) === 2) dups.push(`source "${g.source}"`);
  }
  return dups;
}
