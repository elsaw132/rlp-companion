"use client";

// The Retirement Life Plan — the output of Stage 4.
//
// Unlike the Stage 1–3 reveals (staged "moments"), this is a single, calm,
// first-person DOCUMENT the member reads top to bottom, keeps, and returns to.
// This orchestrator assembles ONE RlpPlan from the live data layer (the captured
// outputs of the seven Stage 4 modules + the prior-stage user model), then
// overlays the two generated-once-and-cached pieces — Vita's written opening
// (chapter title + self-intro drafts) and the bespoke scene imagery — and hands
// it all to RlpPlanDocument. It re-presents what the member already curated; it
// never re-asks or re-derives. In development, when there's no Stage 4 data yet,
// it seeds with one realistic example member so it's not empty.

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useUserData } from "@/lib/userData";
import { buildUserModel, type ModelSource } from "@/lib/userModel";
import { coreValuesFromFacts } from "@/lib/resolverInputs";
import { buildRlpPlan, type RlpPlan } from "@/lib/rlpPlan";
import { SEED_SOURCE, SEED_MEMBER_NAME } from "@/lib/rlpPlanSeed";
import { todayISODate } from "@/lib/planDate";
import type { PlanIntro, PlanIntroRequest } from "@/lib/planIntro";
import RlpPlanDocument from "./RlpPlanDocument";

export default function RlpReveal() {
  const { user } = useUser();
  const userData = useUserData();

  const [intro, setIntro] = useState<PlanIntro | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  if (userData.loading) {
    return (
      <main className="rlp-plan-loading">
        <style>{loadingCss}</style>
        <p>Drawing your plan together&hellip;</p>
      </main>
    );
  }

  // ---- assemble the base plan (deterministic) ----
  const liveSource: ModelSource = {
    getBuild: userData.getBuild,
    getTakeaway: userData.getTakeaway,
    getDreams: userData.getDreams,
    getStage3Values: userData.getStage3Values,
    getOnboarding: userData.getOnboarding,
    // Phase 2: the plan reads values (verbatim description + 3.4 threat/protector)
    // from the canonical profile.
    getActiveFacts: userData.getActiveFacts,
  };

  const today = todayISODate();
  let plan = buildRlpPlan(liveSource, {
    name: userData.getDisplayName(user),
    dateCreated: today,
  });

  // Dev seeding: with no Stage 4 material yet, show one realistic member so the
  // document is never empty. The seed flows through the exact same assembler.
  const seeded = !plan.hasPlan;
  const source = seeded ? SEED_SOURCE : liveSource;
  if (seeded) {
    plan = buildRlpPlan(SEED_SOURCE, {
      name: userData.getDisplayName(user) ?? SEED_MEMBER_NAME,
      dateCreated: "2026-06-01",
      dateLastReviewed: "2026-06-01",
    });
  }

  // ---- generated-once pieces: Vita's opening, and the scene imagery ----
  async function generateIntro() {
    const model = buildUserModel(source);
    // Prefer the canonical profile's verbatim value descriptions for the intro
    // prose too, so it matches the plan document (falls back to the model).
    const factValues = coreValuesFromFacts(source.getActiveFacts?.() ?? []);
    const introValues = (factValues.length ? factValues : model.coreValues).map(
      (v) => ({ value: v.value, meaning: v.meaning })
    );
    const req: PlanIntroRequest = {
      name: plan.meta.name,
      withPartner: model.onboarding.withPartner,
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
    try {
      const res = await fetch("/api/plan-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = (await res.json()) as { intro: PlanIntro | null };
      if (data.intro) {
        setIntro(data.intro);
        void userData.savePlanIntro(data.intro);
      }
    } catch {
      // keep the deterministic opening already in the plan
    }
  }

  async function generateImages() {
    const cached = userData.getPlanImages();
    const missing = plan.scenes.filter((s) => !cached[s.slot]);
    // Sequential, not parallel: image models on a fresh account rate-limit a
    // burst of concurrent requests (429). One at a time is slower but reliable;
    // each result is cached as it lands, so they fill in progressively.
    for (const scene of missing) {
      try {
        const res = await fetch("/api/plan-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: scene.prompt }),
        });
        const data = (await res.json()) as { image: string | null };
        if (data.image) {
          setImages((prev) => ({ ...prev, [scene.slot]: data.image as string }));
          void userData.savePlanImage(scene.slot, data.image);
        }
      } catch {
        // keep the placeholder for this slot
      }
    }
  }

  // Kick generation once, after the data layer is ready. Mirrors the in-render
  // guard the other reveals use (so we never setState inside an effect).
  if (user && !loaded) {
    setLoaded(true);
    const cachedIntro = userData.getPlanIntro();
    if (cachedIntro) setIntro(cachedIntro);
    else void generateIntro();
    setImages(userData.getPlanImages());
    void generateImages();
  }

  // ---- overlay the generated prose where present ----
  // Each generated sentence overlays its slot; an empty one leaves the plan's
  // own value (deterministic title/drafts, or "" so the document drops it).
  const shownPlan = intro
    ? {
        ...plan,
        opening: {
          chapterTitle: intro.chapterTitle || plan.opening.chapterTitle,
          overview: intro.overview,
          insight: intro.insight,
          selfIntro: intro.selfIntro || plan.opening.selfIntro,
        },
        balance: { ...plan.balance, shape: intro.balanceShape },
        movingTowards: { ...plan.movingTowards, arc: intro.seasonsArc },
        week: plan.week ? { ...plan.week, rhythm: intro.weekRhythm } : plan.week,
        leavingWork: plan.leavingWork
          ? { ...plan.leavingWork, financeNote: intro.financeNote }
          : plan.leavingWork,
        connections: intro.connections,
        openThreads: intro.openThreads,
      }
    : plan;

  return (
    <RlpPlanDocument
      plan={shownPlan}
      seeded={seeded}
      images={images}
      savedSelfIntro={userData.getPlanSelfIntro()}
      onSaveSelfIntro={(text) => userData.savePlanSelfIntro(text)}
    />
  );
}

// Factual candidate "open threads" — things still in motion, detected from the
// plan. The model turns these into honest first-person lines (or drops them).
function openThreadSignals(plan: RlpPlan): string[] {
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

const loadingCss = `
.rlp-plan-loading{max-width:var(--content-max);margin:0 auto;padding:96px 24px;display:grid;place-items:center;min-height:50vh}
.rlp-plan-loading p{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-h2);color:var(--text-muted)}
`;
