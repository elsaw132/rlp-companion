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
import { type ModelSource } from "@/lib/userModel";
import { buildRlpPlan } from "@/lib/rlpPlan";
import { SEED_SOURCE, SEED_MEMBER_NAME } from "@/lib/rlpPlanSeed";
import { todayISODate } from "@/lib/planDate";
import type { PlanIntro } from "@/lib/planIntro";
import { ensurePlanIntro, ensurePlanImages } from "@/lib/planPrewarm";
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
  // Both live in lib/planPrewarm — the same cache-first, dedup-guarded path the
  // 4.7 pre-warm uses, so a plan opened after pre-warm is an instant cache hit
  // and nothing ever generates twice.
  const io = {
    getPlanIntro: userData.getPlanIntro,
    savePlanIntro: userData.savePlanIntro,
    getPlanImages: userData.getPlanImages,
    savePlanImage: userData.savePlanImage,
    onIntro: (next: PlanIntro) => setIntro(next),
    onImage: (slot: string, dataUrl: string) =>
      setImages((prev) => ({ ...prev, [slot]: dataUrl })),
  };

  // Kick generation once, after the data layer is ready. Mirrors the in-render
  // guard the other reveals use (so we never setState inside an effect).
  if (user && !loaded) {
    setLoaded(true);
    setImages(userData.getPlanImages());
    void ensurePlanIntro(plan, source, io);
    void ensurePlanImages(plan, io);
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
        // "Worth picking up": the richer generated version when it landed, else
        // the plan's deterministic framed fallback — never the raw items.
        resetActions: intro.resetActions?.length
          ? intro.resetActions
          : plan.resetActions,
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

const loadingCss = `
.rlp-plan-loading{max-width:var(--content-max);margin:0 auto;padding:96px 24px;display:grid;place-items:center;min-height:50vh}
.rlp-plan-loading p{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-h2);color:var(--text-muted)}
`;
