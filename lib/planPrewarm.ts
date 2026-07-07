// Shared generation for the Retirement Life Plan's two generated-once pieces —
// Vita's written prose (/api/plan-intro) and the bespoke scene imagery
// (/api/plan-image). Both the reveal (on mount) and the 4.7 pre-warm run this
// exact logic, writing into the same planIntro / planImages caches the reveal
// already reads. It is cache-first (nothing regenerates once cached) and
// dedup-guarded at the module level, so whichever caller runs first fills the
// cache and a second caller — e.g. the member opening /plan before the pre-warm
// has finished — never generates the same piece twice.

import { buildUserModel, type ModelSource } from "@/lib/userModel";
import { coreValuesFromFacts } from "@/lib/resolverInputs";
import type { RlpPlan } from "@/lib/rlpPlan";
import type { PlanIntro, PlanIntroRequest } from "@/lib/planIntro";

// Factual candidate "open threads" — things still in motion, detected from the
// plan. The model turns these into honest first-person lines (or drops them).
export function openThreadSignals(plan: RlpPlan): string[] {
  const out: string[] = [];
  const lw = plan.leavingWork;
  if (lw && lw.financeDateKnown && lw.financeDateKnown !== "Yes, I have a clear sense") {
    out.push("a financial readiness date still to firm up");
  }
  for (const a of plan.balance.areas) {
    if (!a.deliberateGap && a.goals.length === 0) {
      out.push(`whether anything belongs in ${a.label}, still undecided`);
    }
  }
  // A spotlit goal with no specifics yet.
  for (const area of plan.prioritisedAreas) {
    for (const g of area.goals) {
      const vague =
        g.track === "do" ? !g.looksLike && !g.cadence : !g.ordinaryWeek;
      if (vague) out.push(`making the goal "${g.label}" more specific`);
    }
  }
  // An enduring aspiration with no path drafted.
  const pathGoals = new Set(plan.paths.paths.map((p) => p.goal.toLowerCase()));
  for (const e of plan.movingTowards.enduring) {
    if (!pathGoals.has(e.label.toLowerCase())) {
      // only surface a couple, and only aspiration-like enduring items
      if (out.length < 5) out.push(`a first move towards "${e.label}", which runs throughout but has no step yet`);
    }
  }
  return out.slice(0, 5);
}

// Assemble the /api/plan-intro request from an already-built plan and its source.
// The route stays a pure writer — every field here is the member's own confirmed
// material. Kept in one place so the reveal and the pre-warm send identical input.
export function buildPlanIntroRequest(
  plan: RlpPlan,
  source: ModelSource
): PlanIntroRequest {
  const model = buildUserModel(source);
  // Prefer the canonical profile's verbatim value descriptions for the intro
  // prose too, so it matches the plan document (falls back to the model).
  const factValues = coreValuesFromFacts(source.getActiveFacts?.() ?? []);
  const introValues = (factValues.length ? factValues : model.coreValues).map(
    (v) => ({ value: v.value, meaning: v.meaning })
  );
  return {
    name: plan.meta.name,
    withPartner: model.onboarding.withPartner,
    retirementStage: model.onboarding.retirementStage,
    onsetGentle: plan.onsetGentle,
    coreValues: introValues,
    roles: model.roles.all,
    mostAliveRoles: model.roles.mostAlive,
    energySources: model.energySources,
    aspirations: model.aspirations.map((a) => a.text),
    relationships: model.relationships,
    hopes: model.hopes,
    // §2 — per-area fullness so the balance line can name the shape.
    areas: plan.balance.areas.map((a) => ({
      label: a.label,
      goalCount: a.goals.length,
      focusGoals: a.goals.filter((g) => g.focus).map((g) => g.label),
      deliberateGap: a.deliberateGap,
    })),
    // §5 — the spotlit goals, so the insight + connections web can cite them.
    focusGoals: plan.prioritisedAreas.flatMap((a) =>
      a.goals.map((g) => ({
        label: g.label,
        area: a.label,
        ...(g.note ? { note: g.note } : {}),
      }))
    ),
    // §4 — the de-duplicated season placements + enduring threads.
    seasons: plan.movingTowards.seasons.map((s) => ({
      label: s.label,
      items: s.items.map((i) => i.label),
    })),
    enduring: plan.movingTowards.enduring.map((e) => e.label),
    // §7 — the week's feel and recurring activities.
    week: plan.week
      ? {
          structure: plan.week.structure,
          activities: plan.week.activities.map((a) => ({
            label: a.label,
            frequency: a.frequency,
            anchor: a.anchor,
            energy: a.energy,
            fixed: a.fixed,
          })),
        }
      : null,
    // §8 — the leaving-work signal (surface/signpost only).
    finance: plan.leavingWork
      ? {
          lean: plan.leavingWork.lean,
          shape: plan.leavingWork.shape,
          period: plan.leavingWork.period,
          window: plan.leavingWork.window,
          financeLevel: plan.leavingWork.financeLevel,
          financeDateKnown: plan.leavingWork.financeDateKnown,
          stillBuilding: plan.leavingWork.stillBuilding,
        }
      : null,
    // §10 — factual candidate "open threads" detected from the plan.
    openThreadSignals: openThreadSignals(plan),
  };
}

// The cache read/write + optional live-update hooks a caller provides. The reveal
// passes onIntro/onImage to update its own React state as pieces land; the
// pre-warm omits them and just fills the cache.
export type PlanGenIO = {
  getPlanIntro: () => PlanIntro | null;
  savePlanIntro: (intro: PlanIntro) => void;
  getPlanImages: () => Record<string, string>;
  savePlanImage: (slot: string, dataUrl: string) => void;
  onIntro?: (intro: PlanIntro) => void;
  onImage?: (slot: string, dataUrl: string) => void;
};

// Module-level in-flight jobs so two callers (reveal + pre-warm) share one
// generation rather than each firing its own. Keyed globally because a browser
// session is a single member. Cleared on settle so a failed attempt can retry
// later (the cache-first checks stop a *successful* one from re-running).
let introJob: Promise<PlanIntro | null> | null = null;
const imageJobs = new Map<string, Promise<string | null>>();

// Generate (or reuse) Vita's prose. Cache-first: returns immediately if already
// cached. Otherwise runs the single /api/plan-intro call once and hands the
// result to every awaiting caller.
export async function ensurePlanIntro(
  plan: RlpPlan,
  source: ModelSource,
  io: PlanGenIO
): Promise<void> {
  const cached = io.getPlanIntro();
  if (cached) {
    io.onIntro?.(cached);
    return;
  }
  if (!introJob) {
    const req = buildPlanIntroRequest(plan, source);
    introJob = (async () => {
      try {
        const res = await fetch("/api/plan-intro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        const data = (await res.json()) as { intro: PlanIntro | null };
        if (data.intro) {
          io.savePlanIntro(data.intro);
          return data.intro;
        }
      } catch {
        // keep the deterministic opening already in the plan
      }
      return null;
    })();
    void introJob.finally(() => {
      introJob = null;
    });
  }
  const intro = await introJob;
  if (intro) io.onIntro?.(intro);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// How many images generate at once. Small on purpose: image models rate-limit a
// big burst (429) on a fresh account. A cap of 3, with backoff on 429, keeps the
// set filling ~3× faster than one-at-a-time while staying under the limit.
const IMAGE_CONCURRENCY = 3;

// One scene image, deduped by slot and resilient to rate limiting. The route
// returns 429 when the image model throttles us; we wait and retry a few times
// with exponential backoff (the burst that triggered it drains quickly). Other
// failures (no key, a content rejection) return null and keep the placeholder.
function ensureOneImage(slot: string, prompt: string, io: PlanGenIO): Promise<string | null> {
  let job = imageJobs.get(slot);
  if (!job) {
    job = (async () => {
      const MAX_ATTEMPTS = 4;
      let backoff = 1500;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const res = await fetch("/api/plan-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
          });
          if (res.status === 429 && attempt < MAX_ATTEMPTS) {
            await sleep(backoff);
            backoff *= 2;
            continue;
          }
          const data = (await res.json()) as { image: string | null };
          if (data.image) {
            io.savePlanImage(slot, data.image);
            return data.image;
          }
          return null;
        } catch {
          if (attempt < MAX_ATTEMPTS) {
            await sleep(backoff);
            backoff *= 2;
            continue;
          }
          return null;
        }
      }
      return null;
    })();
    imageJobs.set(slot, job);
    void job.finally(() => imageJobs.delete(slot));
  }
  return job;
}

// Generate (or reuse) the missing scene images through a small worker pool, so up
// to IMAGE_CONCURRENCY render at once instead of strictly one at a time. Each
// result is cached (merge-safe) and surfaced as it lands, so they still fill in
// progressively. Per-slot dedup means the reveal and the pre-warm never generate
// the same image twice even when both run.
export async function ensurePlanImages(plan: RlpPlan, io: PlanGenIO): Promise<void> {
  const cached = io.getPlanImages();
  const missing = plan.scenes.filter((s) => !cached[s.slot]);
  let cursor = 0;
  const worker = async () => {
    while (cursor < missing.length) {
      const scene = missing[cursor++];
      const image = await ensureOneImage(scene.slot, scene.prompt, io);
      if (image) io.onImage?.(scene.slot, image);
    }
  };
  const workers = Array.from(
    { length: Math.min(IMAGE_CONCURRENCY, missing.length) },
    () => worker()
  );
  await Promise.all(workers);
}

// Kick off both generated pieces (prose + imagery) concurrently, cache-first and
// deduped. Used by the reveal on mount and by the 4.7 pre-warm.
export function ensurePlanGenerated(
  plan: RlpPlan,
  source: ModelSource,
  io: PlanGenIO
): Promise<void> {
  return Promise.all([
    ensurePlanIntro(plan, source, io),
    ensurePlanImages(plan, io),
  ]).then(() => undefined);
}
