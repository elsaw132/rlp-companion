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
import { seedSourceForCohort, isSeedCohort } from "@/lib/rlpPlanSeedRetired";
import { todayISODate } from "@/lib/planDate";
import type { PlanIntro } from "@/lib/planIntro";
import { ensurePlanIntro, ensurePlanImages } from "@/lib/planPrewarm";
import RlpPlanDocument from "./RlpPlanDocument";

// Dev-only cohort override. Seeded material only (see the call site) — a real
// member's plan takes its stage from their own onboarding, never the URL.
function cohortFromUrl() {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("cohort");
  return isSeedCohort(v) ? v : null;
}

export default function RlpReveal() {
  const { user } = useUser();
  const userData = useUserData();

  const [intro, setIntro] = useState<PlanIntro | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  // True while Vita's prose is still being written (first-ever open). Lets the
  // prose-only tabs (Connections, Reflections) show a "still writing" note
  // instead of rendering blank, which reads as broken. Flips false the moment the
  // generation resolves — instantly on a cache hit, so a warm plan never shows it.
  const [generating, setGenerating] = useState(false);

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

  // The plan's creation date is STORED, not computed. It used to be todayISODate()
  // on every render, which meant the plan claimed to have been created on whatever
  // day you opened it, and "next review" (created + 12 months) slid forward with
  // you — so it could never come due. Stamped once, on the first view of a real
  // plan, and read back forever after.
  const today = todayISODate();
  const createdOn = userData.getPlanCreatedOn() ?? today;
  let plan = buildRlpPlan(liveSource, {
    name: userData.getDisplayName(user),
    dateCreated: createdOn,
  });

  // Dev seeding: with no Stage 4 material yet, show one realistic member so the
  // document is never empty. The seed flows through the exact same assembler.
  const seeded = !plan.hasPlan;
  // /plan?cohort=winding_down|recently_retired|established swaps the seed for a
  // retirement-path variant, so the cohort branches can actually be looked at.
  // Seeded dev material only — it can never touch a real member's plan.
  const cohort = seeded ? cohortFromUrl() : null;
  const seedFor = cohort ? seedSourceForCohort(cohort) : null;
  const source = seeded ? (seedFor?.source ?? SEED_SOURCE) : liveSource;
  if (seeded) {
    plan = buildRlpPlan(source, {
      // The cohort fixtures carry their own names — a Reset Plan headed with the
      // signed-in developer's name reads as if it were theirs.
      name: seedFor?.name ?? userData.getDisplayName(user) ?? SEED_MEMBER_NAME,
      dateCreated: "2026-06-01",
      dateLastReviewed: "2026-06-01",
    });
  }

  // ---- generated-once pieces: Vita's opening, and the scene imagery ----
  // Both live in lib/planPrewarm — the same cache-first, dedup-guarded path the
  // 4.7 pre-warm uses, so a plan opened after pre-warm is an instant cache hit
  // and nothing ever generates twice.
  // A cohort fixture must never touch the saved prose: its text would be written
  // over the signed-in member's own cached intro, and switching cohorts would
  // then read back the PREVIOUS cohort's copy — Ray's plan showing Jean's reset
  // suggestions. So the fixtures run cache-blind: generate every load, keep it in
  // React state, save nothing.
  const io = {
    getPlanIntro: cohort ? () => null : userData.getPlanIntro,
    savePlanIntro: cohort ? () => {} : userData.savePlanIntro,
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
    // Stamp the plan's birthday the first time a REAL plan is opened. Never for
    // the seed or a cohort fixture — their dates are fixture values, and writing
    // one would give the signed-in member a creation date they never had.
    if (!seeded && !userData.getPlanCreatedOn()) {
      userData.savePlanCreatedOn(today);
    }
    // /plan?regen=1 regenerates Vita's prose over the top of the saved copy —
    // the plan is generated once and cached, so prompt changes are otherwise
    // invisible on a plan that already exists.
    const regen =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("regen") === "1";
    // A cohort fixture always generates: its cache is stubbed out above, and
    // force also clears the module-level in-flight job so switching cohorts can't
    // reuse the previous one's generation.
    setGenerating(true);
    void ensurePlanIntro(plan, source, io, regen || !!cohort).finally(() =>
      setGenerating(false)
    );
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
        paths: { ...plan.paths, strengthsRead: intro.strengthsRead },
        movingTowards: { ...plan.movingTowards, arc: intro.seasonsArc },
        week: plan.week ? { ...plan.week, rhythm: intro.weekRhythm } : plan.week,
        leavingWork: plan.leavingWork
          ? { ...plan.leavingWork, financeNote: intro.financeNote }
          : plan.leavingWork,
        connections: intro.connections,
        openThreads: intro.openThreads,
        reflections: {
          balanceCallout: intro.balanceCallout,
          balanceRead: intro.balanceRead,
          realismCallout: intro.realismCallout,
          realismNote: intro.realismNote,
          strongCallout: intro.strongCallout,
          whatsStrong: intro.whatsStrong,
          coherenceCallout: intro.coherenceCallout,
          coherence: intro.coherence,
        },
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
      generating={generating && !intro}
      savedSelfIntro={userData.getPlanSelfIntro()}
      onSaveSelfIntro={(text) => userData.savePlanSelfIntro(text)}
    />
  );
}

const loadingCss = `
.rlp-plan-loading{max-width:var(--content-max);margin:0 auto;padding:96px 24px;display:grid;place-items:center;min-height:50vh}
.rlp-plan-loading p{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-h2);color:var(--text-muted)}
`;
