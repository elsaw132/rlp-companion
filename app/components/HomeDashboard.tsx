"use client";

// The /home dashboard. Reads the stage + module structure from lib/modules.ts
// and completion from progress.ts (getCompletedIds — the single source of truth);
// nothing about the programme is hardcoded here. Layout, components, spacing and
// states match design-reference/aviva-rlp-home-screen.html. CSS is scoped under
// .rlp-home so the replicated reference styles don't leak into other routes.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { STAGES, TOTAL_STAGES, visibleModules, stageNameFor, stageSubtitleFor, isRetired, titleFor, PILOT_CALLOUT } from "@/lib/modules";
import {
  WINDING_STAGE1_INTRO_BODY,
  REVIEW_STAGE1_INTRO_HEADING,
  REVIEW_STAGE1_INTRO_BODY,
} from "@/lib/modules";
import { RETIREMENT_PATHS } from "@/lib/flags";
import { getActiveStageNumber } from "@/lib/progress";
import { useUserData } from "@/lib/userData";
import { tailorCopy } from "@/lib/retirementCopy";
import StageIntro from "./StageIntro";
import OpeningCapture from "./OpeningCapture";
import VitaMark from "./VitaMark";
import { stageColorFor, stageForegroundFor, stageWashFor, stageHeroGroundFor, stageHeroGraphicFor, STAGE_KEYS } from "@/lib/stageColors";
import { stageHeroFor } from "@/lib/stageHeroes";
import { ModuleIconChip } from "./module/ModuleIconChip";
import ChorusBloom from "./ChorusBloom";
import ChorusVectorGraphic from "./ChorusVectorGraphic";


function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// A session's takeaway is written as 2–4 sentences and reused as Vita's memory and
// to seed the plan, so it runs long. On the dashboard we only want the gist, so
// show just the opening sentence(s) up to a short budget — always whole sentences,
// never a cut-off fragment. The stored takeaway is untouched everywhere else.
const RECAP_MAX_CHARS = 240;
function shortenRecap(text: string): string {
  const trimmed = text.trim();
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?=\s|$)/g);
  if (!sentences || sentences.length <= 1) return trimmed;
  let out = sentences[0].trim();
  for (let i = 1; i < sentences.length; i++) {
    const next = sentences[i].trim();
    if (`${out} ${next}`.length > RECAP_MAX_CHARS) break;
    out += ` ${next}`;
  }
  return out;
}

export default function HomeDashboard() {
  const { user } = useUser();
  const userData = useUserData();
  // The person's retirement stage, used to tailor stage-intro and module-card
  // copy (Phase 2). null (and so a no-op) with the flag off or before the data
  // has loaded, and for anyone still working.
  const retirementStage = userData.getRetirementStage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [completed, setCompleted] = useState<string[]>([]);
  const [greeting, setGreeting] = useState("Good morning");
  // The resolved name for the greeting, or null when none is known — in which
  // case the greeting shows the time of day alone, never "there".
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Whether the Stage 1 reveal has been generated yet. Controls whether the
  // Imagine view shows the loud "is ready" prompt or the calmer "View" entry.
  const [hasStage1Reveal, setHasStage1Reveal] = useState(false);
  // Whether the Stage 2 (Explore) reveal has been generated yet — same loud vs.
  // calm distinction as Stage 1.
  const [hasStage2Reveal, setHasStage2Reveal] = useState(false);
  // Whether the Stage 3 (Understand) reveal has been generated yet — same loud
  // vs. calm distinction as the earlier stages.
  const [hasStage3Reveal, setHasStage3Reveal] = useState(false);
  // The stage the person is currently looking at. null means "follow the current
  // stage"; clicking a finished stage (in the nav or the arc) pins it to a number.
  const [viewedStage, setViewedStage] = useState<number | null>(null);
  // The stage number whose intro to show as a full-screen framing moment before
  // the dashboard, or null. Set once on load, when the current stage has an
  // intro the person hasn't seen yet (first forward entry only).
  const [introStage, setIntroStage] = useState<number | null>(null);
  // Whether to show the Stage 1 opening capture ("Where you're starting from").
  // It's a stage-opening step, not a module — shown once, after the Imagine
  // intro and before module 1.1, while 1.1 isn't done yet. Set once on load.
  const [showOpeningCapture, setShowOpeningCapture] = useState(false);

  // Sync the mobile app bar's "Jump to a stage" deep-link (?stage=N) into the
  // viewed stage — reactively, so it also works when we're already on /home (a
  // same-page Link navigation doesn't remount, so the once-on-load read below
  // wouldn't catch it). The render logic clamps N to a stage actually reached.
  const stageParam = searchParams.get("stage");
  useEffect(() => {
    if (stageParam === null) return;
    const n = Number(stageParam);
    // Syncing an external system (the URL) into local state — the sanctioned use
    // of an effect, not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Number.isInteger(n) && n >= 1) setViewedStage(n);
  }, [stageParam]);

  // Read completion once the data layer has loaded. Done during render (not an
  // effect) so the first paint after load already has the saved state. The
  // onboarding gate now lives server-side in /home, so the dashboard only waits
  // on its own data. The time-based greeting is browser-only.
  if (user && !userData.loading && !loaded) {
    setLoaded(true);
    const ids = userData.getCompletedIds();
    setCompleted(ids);
    setGreeting(greetingWord());
    setDisplayName(userData.getDisplayName(user));
    setHasStage1Reveal(userData.hasStage1Reveal());
    setHasStage2Reveal(userData.hasStage2Reveal());
    setHasStage3Reveal(userData.hasStage3Reveal());
    // Show the current stage's intro once, the first time it's the active stage.
    // Tying it to the current stage (not the viewed one) means navigating back to
    // a finished stage never re-triggers it, and anyone already past a stage
    // won't suddenly see that stage's intro.
    //
    // The cohort has to be passed here, as it is everywhere else this is called:
    // without it, 4.1 counts toward "what's left" for the retired cohorts, who
    // can never see or complete it (it's hideFrom them). They would sit on stage
    // 4 for good and never reach stage 5 — so the two cohorts most likely to
    // finish would be the ones who never saw the end of the programme.
    const currentStage = getActiveStageNumber(ids, retirementStage);
    const stage = STAGES.find((s) => s.number === currentStage);
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    // Deep-link from the mobile app bar's "Jump to a stage": pin the viewed stage
    // to ?stage=N. Only stages already reached are honoured (later stages are
    // locked and clamp back to the current one anyway).
    const stageParam = params ? Number(params.get("stage")) : NaN;
    if (
      Number.isInteger(stageParam) &&
      stageParam >= 1 &&
      stageParam <= currentStage
    ) {
      setViewedStage(stageParam);
    }
    // A stage reveal's "Return home" links to /home?intro=skip so the person
    // lands on the dashboard itself, not straight into the next stage's intro.
    // A stage deep-link (?stage=N) is likewise not interrupted by the intro.
    // Transient (this visit only) — the intro still shows on a later forward
    // entry, since this never records it as seen.
    const skipIntro =
      !!params &&
      (params.get("intro") === "skip" || params.get("stage") !== null);
    // While Act has no sessions to open, the pilot callout stands in for its
    // intro. It keeps its own seen flag, so meeting the callout doesn't use up
    // Act's real intro — that still has to land the day Act's sessions do.
    const actIsEmpty =
      currentStage === 5 &&
      !!stage &&
      visibleModules(stage, retirementStage).length === 0;
    const introSeen = actIsEmpty
      ? userData.hasSeenPilotCallout()
      : userData.getStageIntrosSeen().includes(currentStage);
    if ((stage?.intro || actIsEmpty) && !skipIntro && !introSeen) {
      setIntroStage(currentStage);
    }
    // The Stage 1 opening capture comes right after that intro and before module
    // 1.day. Shown once (its own seen flag), and only while 1.day isn't complete,
    // so anyone already into Stage 1 isn't interrupted by it.
    if (
      currentStage === 1 &&
      !ids.includes("1.day") &&
      !userData.hasSeenStage1Starting()
    ) {
      setShowOpeningCapture(true);
    }
  }

  // Hold the dashboard back until the data layer has loaded, so we never paint
  // an empty dashboard before completion is known. The ProviderBand from the
  // parent still shows.
  if (userData.loading) {
    return null;
  }

  // The framing moment takes over the screen before anything else. Continuing
  // records it as seen so it never shows again, then reveals the dashboard.
  if (introStage !== null) {
    const stage = STAGES.find((s) => s.number === introStage);
    if (stage) {
      // Stage 1 gets a present-progressive rewrite for winding-down (Phase 3):
      // they've already started the shift, so the "before you can plan" opening
      // reads wrong. Everyone else's Stage 1 intro is unchanged. Other stages
      // fall through to the per-cohort copy sweep (Phase 2), which is a no-op with
      // the flag off or for a still-working/unset stage.
      const windingStage1 =
        RETIREMENT_PATHS &&
        retirementStage === "winding_down" &&
        stage.number === 1;
      // Retired cohorts: Stage 1 is "Review" — a new heading, present-tense body,
      // and the eyebrow name swapped to "Review" (via stageNameFor). Phase 4.
      const reviewStage1 =
        RETIREMENT_PATHS && isRetired(retirementStage) && stage.number === 1;
      // Act with nothing in it: the pilot callout replaces its intro entirely,
      // and its button goes back to the plan rather than on into a stage that
      // has nothing to open. Keyed off Act's actual sessions, so it stops
      // standing in of its own accord once they exist.
      const actIsEmpty =
        stage.number === 5 &&
        visibleModules(stage, retirementStage).length === 0;
      const introStageObj = actIsEmpty
        ? { ...stage, name: stageNameFor(stage, retirementStage), intro: PILOT_CALLOUT }
        : stage.intro
          ? {
              ...stage,
              name: stageNameFor(stage, retirementStage),
              intro: {
                ...stage.intro,
                // The heading is tailored too, not just the body: Stage 4's asks
                // the retired cohorts to shape a reset rather than make a plan.
                // No rule matches the other stages' headings, so they pass
                // through untouched.
                heading: reviewStage1
                  ? REVIEW_STAGE1_INTRO_HEADING
                  : tailorCopy(stage.intro.heading, retirementStage),
                body: reviewStage1
                  ? REVIEW_STAGE1_INTRO_BODY
                  : windingStage1
                    ? WINDING_STAGE1_INTRO_BODY
                    : stage.intro.body.map((p) => tailorCopy(p, retirementStage)),
              },
            }
          : stage;
      return (
        <StageIntro
          stage={introStageObj}
          onContinue={() => {
            if (actIsEmpty) {
              // "Back to my plan" — record the callout against its own flag, so
              // Act's real intro is still waiting when Act's sessions land.
              if (user) void userData.markPilotCalloutSeen();
              router.push("/plan");
              return;
            }
            if (user) void userData.markStageIntroSeen(introStage);
            setIntroStage(null);
          }}
        />
      );
    }
  }

  // After the Stage 1 intro is dismissed, the opening capture takes the screen
  // before the dashboard. Saving stores their starting thoughts; skipping (or a
  // blank) just records it as seen. Either way they land back on the dashboard
  // with module 1.1 as their next step.
  if (showOpeningCapture) {
    return (
      <OpeningCapture
        onComplete={(text) => {
          if (user) {
            if (text) void userData.saveStartingThoughts(text);
            void userData.markStage1StartingSeen();
          }
          setShowOpeningCapture(false);
        }}
      />
    );
  }

  // Every module in programme order this person actually sees, tagged with its
  // stage number. Cohort-scoped so a winding-down user's extra first module is
  // counted and everyone else's programme is unchanged.
  const allModules = STAGES.flatMap((s) =>
    visibleModules(s, retirementStage).map((m) => ({ ...m, stageNumber: s.number }))
  );

  // The single next step: the first incomplete module in programme order.
  const nextModule = allModules.find((m) => !completed.includes(m.id)) ?? null;

  // First-time wording for the next-step button: a brand-new user who hasn't
  // started or completed any module is invited to "Get started"; everyone else
  // picks up where they left off. Derived from the DB-backed user data.
  const ctaLabel = userData.hasStartedAnyModule()
    ? "Continue with Vita →"
    : "Get started →";

  // The stage the person is "on": the one holding the next step, or — if every
  // built module is complete — the first stage that isn't fully finished.
  const activeStageNumber = getActiveStageNumber(completed, retirementStage);
  // STAGES with each stage's NAME resolved for this person (Review / Retirement
  // Reset Plan for the retired cohorts). Used wherever a stage name is shown; the
  // module/gating logic still reads the real STAGES via visibleModules, so only
  // the labels change.
  const stagesView = STAGES.map((s) => ({
    ...s,
    name: stageNameFor(s, retirementStage),
    subtitle: stageSubtitleFor(s, retirementStage),
  }));
  const activeStage =
    stagesView.find((s) => s.number === activeStageNumber) ?? stagesView[0];

  // Whether a stage is fully finished (every module this person sees is
  // complete). Empty future stages don't count as done.
  const isStageDone = (s: (typeof STAGES)[number]) => {
    const mods = visibleModules(s, retirementStage);
    return mods.length > 0 && mods.every((m) => completed.includes(m.id));
  };

  // The stage being looked at. Defaults to the current stage and stays there
  // until the person pins an earlier one. Stages past the current one are locked
  // and can't be viewed, so clamp to the current stage if anything tries.
  const viewedStageNumber =
    viewedStage !== null && viewedStage <= activeStageNumber
      ? viewedStage
      : activeStageNumber;
  const viewedStageData =
    stagesView.find((s) => s.number === viewedStageNumber) ?? activeStage;
  const isViewingCurrent = viewedStageNumber === activeStageNumber;
  // The hero photograph (and, on a finished stage, Vita's recap) for the stage
  // being viewed. One image per stage; see lib/stageHeroes.ts.
  const viewedHero = stageHeroFor(viewedStageNumber);

  const stageModules = visibleModules(viewedStageData, retirementStage);
  const doneInStage = stageModules.filter((m) => completed.includes(m.id)).length;
  const totalInStage = stageModules.length;
  // Coming-soon placeholders live on the stage but outside the real programme
  // (see moduleVisibleFor). Shown on the dashboard only, and only to people the
  // module is for (e.g. partner-gated modules need a partner).
  const comingSoonModules = viewedStageData.modules.filter(
    (m) => m.comingSoon && (!m.requiresPartner || userData.hasPartner())
  );
  const stagePct =
    totalInStage > 0 ? Math.round((doneInStage / totalInStage) * 100) : 0;

  // The most recent completed module (programme order), for the hero callback.
  const completedModules = allModules.filter((m) => completed.includes(m.id));
  const lastCompleted = completedModules[completedModules.length - 1] ?? null;
  const priorTakeaway =
    user && loaded && lastCompleted
      ? userData.getTakeaway(lastCompleted.id)
      : null;

  // Vita's personalised hero intro. A placeholder until the real wiring lands:
  // it draws on the latest takeaway when there is one, else the last title.
  let heroIntro: string;
  if (!nextModule) {
    heroIntro = `You've finished everything that's ready so far — nicely done. New sessions for ${activeStage.name} are on their way.`;
  } else if (!lastCompleted) {
    heroIntro =
      "We'll start by picturing a single ordinary day in your retirement — not the big questions yet, just what the day actually feels like.";
  } else if (lastCompleted.stageNumber !== nextModule.stageNumber) {
    // Crossing into a new stage: don't echo the last module's takeaway, which
    // reads as an arbitrary fragment here. Speak to the whole stage just closed
    // and frame the one beginning, then hand off to today's first module.
    const finishedStage = stagesView.find(
      (s) => s.number === lastCompleted.stageNumber
    );
    const startingStage = stagesView.find(
      (s) => s.number === nextModule.stageNumber
    );
    const finishedName = finishedStage?.name ?? "the last stage";
    const startingName = startingStage?.name ?? "this stage";
    const backNod = finishedStage?.lookBack?.trim();
    const aheadNod = startingStage?.lookAhead?.trim();
    const backPart = backNod
      ? `That's the whole of ${finishedName} behind you now — ${backNod}.`
      : `That's the whole of ${finishedName} behind you now.`;
    const aheadPart = aheadNod
      ? ` Next comes ${startingName}, where ${aheadNod}.`
      : ` Next comes ${startingName}.`;
    heroIntro = `${backPart}${aheadPart} Today, let's look at "${nextModule.title}".`;
  } else if (priorTakeaway?.text) {
    // Vita reads the recap directly to the user here, so use the second-person
    // version; older takeaways without it fall back to the third-person text.
    const recap = shortenRecap(priorTakeaway.textDirect ?? priorTakeaway.text);
    heroIntro = `${recap} Today, let's look at "${nextModule.title}".`;
  } else {
    heroIntro = `Last time, you worked through "${lastCompleted.title}". Today, let's look at "${nextModule.title}".`;
  }

  async function handleReset() {
    if (!user) return;
    const confirmed = window.confirm(
      "This clears all your answers and conversations. Start over?"
    );
    if (!confirmed) return;
    await userData.resetAll();
    router.push("/onboarding");
  }

  return (
    <div
      className="rlp-home"
      style={
        {
          // The viewed stage's crisp MARK colour (its own for Plan/Act, Chorus
          // Dark Green for the pale stages) with white text, plus its light tint
          // FILL — shared with every stage-level wayfinding element below (sidebar
          // selection, ring, completion panel, module bar, tiles). Driven by the
          // VIEWED stage, not the current programme stage — so revisiting Plan
          // stays orange even when the current stage is Act.
          ["--stage-color"]: stageColorFor(viewedStageNumber),
          ["--stage-fg"]: stageForegroundFor(viewedStageNumber),
          ["--stage-wash"]: stageWashFor(viewedStageNumber),
        } as React.CSSProperties
      }
    >
      <style>{homeCss}</style>

      <div className="shell">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="side-eyebrow">Your programme</div>
          <nav className="navlist">
            {stagesView.map((s) => {
              const isCurrent = s.number === activeStageNumber;
              const isDone = isStageDone(s);
              const isLocked = s.number > activeStageNumber;
              const isViewing = s.number === viewedStageNumber;
              const numClass = isCurrent
                ? "n n--current"
                : isDone
                  ? "n n--done"
                  : "n n--idle";
              const navClass = [
                "nav",
                isViewing ? "is-viewing" : "",
                isLocked ? "is-locked" : "",
                !isCurrent && !isDone ? "is-idle" : "",
              ]
                .filter(Boolean)
                .join(" ");
              // Stage colour is the wayfinding cue: the stage being viewed and the
              // current programme stage each carry their own fixed stage colour on
              // the number/check circle. Other done/idle stages stay restrained.
              // Every reached stage (done, current, or viewed) shows its own
              // stage-mark colour; only not-yet-reached stages stay muted.
              const stageCircleStyle =
                isViewing || isCurrent || isDone
                  ? ({
                      background: stageColorFor(s.number),
                      color: stageForegroundFor(s.number),
                    } as React.CSSProperties)
                  : undefined;
              const inner = (
                <>
                  <span className={numClass} style={stageCircleStyle}>
                    {isDone ? "✓" : s.number}
                  </span>
                  <span>
                    <span className="t">{s.name}</span>
                    <span className="s">{s.subtitle}</span>
                  </span>
                </>
              );
              // Finished stages and the current stage are navigable; later stages
              // are locked and inert.
              return isLocked ? (
                <div key={s.number} className={navClass} aria-disabled="true">
                  {inner}
                </div>
              ) : (
                <button
                  key={s.number}
                  type="button"
                  className={navClass}
                  aria-current={isViewing ? "true" : undefined}
                  onClick={() => setViewedStage(s.number)}
                >
                  {inner}
                </button>
              );
            })}
          </nav>

          <div className="clarity">
            <div className="radial-wrap">
              <div
                className="radial"
                style={{ ["--p"]: stagePct } as React.CSSProperties}
              >
                <span>{stagePct}%</span>
              </div>
            </div>
            <div className="lab">Your {viewedStageData.name} progress</div>
            <div className="sub">Grows as you complete the sessions in this stage.</div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="col">
            {/* GREETING */}
            <h1 className="greeting">
              {greeting}
              {displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="greet-sub">
              You&apos;re on Stage {activeStageNumber} of {TOTAL_STAGES} —{" "}
              {activeStage.name}.
            </p>

            {/* STAGE ARC */}
            <div className="steps">
              {stagesView.map((s) => {
                const isCurrent = s.number === activeStageNumber;
                const isDone = isStageDone(s);
                const isLocked = s.number > activeStageNumber;
                const isViewing = s.number === viewedStageNumber;
                const stepState = isDone ? "done" : isCurrent ? "active" : "todo";
                const stepClass = [
                  "step",
                  stepState,
                  isViewing ? "is-viewing" : "",
                  isLocked ? "is-locked" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                // Same wayfinding cue as the sidebar: the viewed and current
                // stages fill their whole dot with the stage colour (no ring).
                const stageDotStyle =
                  isViewing || isCurrent || isDone
                    ? ({
                        background: stageColorFor(s.number),
                        color: stageForegroundFor(s.number),
                      } as React.CSSProperties)
                    : undefined;
                const inner = (
                  <>
                    <div className="dot" style={stageDotStyle}>
                      {isDone ? "✓" : s.number}
                    </div>
                    <div className="cap">{s.name}</div>
                  </>
                );
                return isLocked ? (
                  <div key={s.number} className={stepClass} aria-disabled="true">
                    {inner}
                  </div>
                ) : (
                  <button
                    key={s.number}
                    type="button"
                    className={stepClass}
                    aria-current={isViewing ? "true" : undefined}
                    onClick={() => setViewedStage(s.number)}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>

            {/* COACH NEXT-STEP HERO — only when looking at the current stage.
                Viewing an earlier, finished stage shows a calmer header instead. */}
            {!isViewingCurrent ? (
              <section
                className="done-head"
                style={{ background: stageHeroGroundFor(viewedStageNumber) }}
              >
                <div
                  className="hero-gfx"
                  style={{ color: stageHeroGraphicFor(viewedStageNumber) }}
                  aria-hidden="true"
                >
                  <ChorusVectorGraphic className="hero-gfx-svg" />
                </div>
                <div className="hero-card">
                  <h2>
                    <span className="tick" aria-hidden="true">
                      ✓
                    </span>
                    {viewedStageData.name} — complete
                  </h2>
                  <p>
                    {viewedHero
                      ? viewedHero.recap
                      : "Revisit any session below; your answers are saved."}
                  </p>
                  <p className="dh-hint">Revisit any session below — your answers are saved.</p>
                  <button
                    type="button"
                    className="link-back"
                    onClick={() => setViewedStage(null)}
                  >
                    Back to your current step ›
                  </button>
                </div>
              </section>
            ) : (
            <section
              className="hero"
              style={{ background: stageHeroGroundFor(viewedStageNumber) }}
            >
              <div
                className="hero-gfx"
                style={{ color: stageHeroGraphicFor(viewedStageNumber) }}
                aria-hidden="true"
              >
                <ChorusVectorGraphic className="hero-gfx-svg" />
              </div>
              <div className="hero-card">
                <div className="vita">
                  <VitaMark size={36} />
                  <span className="name">Vita</span>
                </div>
                <span className="coachpill">Your retirement coach</span>
                <p className="intro">{heroIntro}</p>
                <div className="ns-eyebrow">Your next step</div>
                <div className="ns-title">
                  {nextModule ? nextModule.title : "More coming soon"}
                </div>
                {nextModule && (
                  <div className="ctarow">
                    <Link className="btn btn-navy" href={`/session/${nextModule.id}`}>
                      {ctaLabel}
                    </Link>
                    <span className="chip-time">🕐 {nextModule.durationMin} min</span>
                  </div>
                )}
              </div>
            </section>
            )}

            {/* STAGE 1 PICTURE — only within the Imagine view, once all five
                Imagine modules are done. A louder card until the reveal is opened,
                then a calmer persistent entry — same "View" wording in both. */}
            {viewedStageNumber === 1 && isStageDone(STAGES[0]) && (
              hasStage1Reveal ? (
                <Link className="picture-card is-calm" href="/stage/1">
                  <span className="pc-icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="pc-body">
                    <span className="pc-title">View your Imagine reveal</span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ) : (
                <Link className="picture-card" href="/stage/1">
                  <span className="pc-icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="pc-body">
                    <span className="pc-title">View your Imagine reveal</span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              )
            )}

            {/* STAGE 2 PICTURE — only within the Explore view, once all six
                Explore modules are done. A louder card until the reveal is opened,
                then a calmer persistent entry — same "View" wording in both. */}
            {viewedStageNumber === 2 && isStageDone(STAGES[1]) && (
              hasStage2Reveal ? (
                <Link className="picture-card is-calm" href="/stage/2">
                  <span className="pc-icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="pc-body">
                    <span className="pc-title">View your Explore reveal</span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ) : (
                <Link className="picture-card" href="/stage/2">
                  <span className="pc-icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="pc-body">
                    <span className="pc-title">View your Explore reveal</span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              )
            )}

            {/* STAGE 3 PICTURE — only within the Understand view, once all six
                Understand modules are done. A louder card until the reveal is opened,
                then a calmer persistent entry — same "View" wording in both. */}
            {viewedStageNumber === 3 && isStageDone(STAGES[2]) && (
              hasStage3Reveal ? (
                <Link className="picture-card is-calm" href="/stage/3">
                  <span className="pc-icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="pc-body">
                    <span className="pc-title">View your Understand reveal</span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ) : (
                <Link className="picture-card" href="/stage/3">
                  <span className="pc-icon" aria-hidden="true">
                    ✦
                  </span>
                  <span className="pc-body">
                    <span className="pc-title">View your Understand reveal</span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              )
            )}

            {/* Stage 4 (Plan): the Retirement Life Plan document, once the seven
                Plan modules are done. A calm, persistent entry to the document
                they keep and return to. */}
            {viewedStageNumber === 4 && isStageDone(STAGES[3]) && (
              <Link className="picture-card is-calm is-rlp" href="/plan">
                <span className="pc-icon" aria-hidden="true">
                  <ChorusBloom className="pc-bloom" fill="var(--color-brand-primary)" />
                </span>
                <span className="pc-body">
                  <span className="pc-title">View your Retirement Life Plan</span>
                  <span className="pc-sub">
                    Everything you&apos;ve shaped, drawn together into one document
                    to keep and return to.
                  </span>
                </span>
                <span className="pc-chev" aria-hidden="true">
                  ›
                </span>
              </Link>
            )}

            {/* STAGE SESSIONS */}
            <div className="sec-row">
              <div className="sec-head">Your sessions in {viewedStageData.name}</div>
              {totalInStage > 0 && (
                <div className="sec-prog">
                  {doneInStage} of {totalInStage} sessions complete
                </div>
              )}
            </div>
            {totalInStage > 0 && (
              <div className="bar">
                <i style={{ width: `${stagePct}%` }}></i>
              </div>
            )}

            {totalInStage === 0 && comingSoonModules.length === 0 ? (
              <div className="info" style={{ marginBottom: "34px" }}>
                <div className="av" aria-hidden="true">
                  🌱
                </div>
                <div>
                  <h4>This stage is on its way</h4>
                  <p>
                    The sessions for {viewedStageData.name}{" "}
                    are still being prepared. You can revisit anything you&apos;ve
                    already done in the meantime.
                  </p>
                </div>
              </div>
            ) : (
              <div className="cards">
                {stageModules.map((m) => {
                  const isComplete = completed.includes(m.id);
                  const isActiveStep = isViewingCurrent && nextModule?.id === m.id;
                  const body = (
                    <>
                      <ModuleIconChip
                        className="thumb"
                        stageKey={STAGE_KEYS[viewedStageData.number - 1]}
                        moduleId={m.id}
                        size="md"
                      />
                      <div>
                        <div className="title">{titleFor(m, retirementStage)}</div>
                        <div className="desc">
                          {tailorCopy(m.description, retirementStage)}
                        </div>
                      </div>
                      <span className="chip-time">🕐 {m.durationMin} min</span>
                    </>
                  );
                  // Completed steps are clickable — they reopen the module to
                  // re-read or carry on. The whole card is the link.
                  if (isComplete) {
                    return (
                      <Link
                        key={m.id}
                        className="scard scard-done"
                        href={`/session/${m.id}`}
                      >
                        {body}
                        <span className="done-cap">
                          <span className="badge badge-complete">Complete ✓</span>
                          <span className="chev" aria-hidden="true">
                            ›
                          </span>
                        </span>
                      </Link>
                    );
                  }
                  return (
                    <div
                      key={m.id}
                      className={isActiveStep ? "scard is-active" : "scard"}
                    >
                      {body}
                      {isActiveStep ? (
                        <Link className="btn btn-navy" href={`/session/${m.id}`}>
                          {ctaLabel}
                        </Link>
                      ) : (
                        <span className="badge badge-notstarted">Not started</span>
                      )}
                    </div>
                  );
                })}
                {comingSoonModules.map((m) => (
                  <div key={m.id} className="scard scard-soon" aria-disabled="true">
                    <ModuleIconChip
                      className="thumb"
                      stageKey={STAGE_KEYS[viewedStageData.number - 1]}
                      moduleId={m.id}
                      size="md"
                    />
                    <div>
                      <div className="title">{m.title}</div>
                      <div className="desc">{m.description}</div>
                    </div>
                    <span className="badge badge-soon">Coming soon</span>
                  </div>
                ))}
              </div>
            )}

            {/* ENCOURAGEMENT */}
            <div className="info">
              <div>
                <p>
                  Take your time — each session is meant to be enjoyable and
                  reflective. Do a couple at a time at most, and leave a little
                  space between them so each has room to settle.
                </p>
              </div>
              <Link href="/how-it-works" className="lk">
                Help &amp; guidance ›
              </Link>
            </div>

            {/* RESET */}
            <div className="reset">
              <button type="button" onClick={handleReset}>
                Start over
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const homeCss = `
.rlp-home a{color:inherit;text-decoration:none}
.rlp-home button{font-family:inherit}
.rlp-home :focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
/* Editorial warmth: a richer cream ground at the top settles into the app's warm
   base (--bg-alt is now warm app-wide, so nothing feels grey). */
.rlp-home{background:linear-gradient(180deg,var(--ground-cream) 0,var(--bg-alt) 560px)}

.rlp-home .shell{display:flex;align-items:flex-start;max-width:1180px;margin:0 auto}
.rlp-home .sidebar{width:var(--sidebar-w);flex-shrink:0;padding:34px 22px 44px;border-right:1px solid color-mix(in srgb,var(--border) 55%,transparent);min-height:calc(100vh - var(--header-h));position:sticky;top:var(--header-h);display:flex;flex-direction:column}
.rlp-home .sidebar .rlp-poweredby{margin-top:auto;padding-top:24px;justify-content:flex-start}
.rlp-home .main{flex:1;min-width:0;padding:46px 48px 96px;display:flex;justify-content:center}
.rlp-home .col{width:100%;max-width:var(--content-max)}

.rlp-home .side-eyebrow{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);font-weight:600;padding:0 12px;margin-bottom:10px}
.rlp-home .navlist{display:flex;flex-direction:column;gap:4px;margin-bottom:28px}
.rlp-home .nav{display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:var(--r-sm);width:100%;text-align:left;background:none;border:none;font-family:inherit;cursor:pointer}
.rlp-home button.nav:hover{background:var(--bg-alt)}
/* The selected (viewed) stage row inherits its own stage colour: a 10% tint fill
   with a stage-colour hairline (drawn as an inset shadow so it adds no layout). */
.rlp-home .nav.is-viewing{background:var(--stage-wash);box-shadow:inset 0 0 0 1.5px var(--stage-color)}
.rlp-home .nav.is-viewing:hover{background:var(--stage-wash)}
.rlp-home .nav.is-locked{opacity:.5;cursor:default}
.rlp-home .nav.is-locked:hover{background:none}
.rlp-home .nav .n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;flex-shrink:0;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-brand-primary) 55%,transparent)}
.rlp-home .nav .n--current{background:var(--brand-primary);color:#fff}
.rlp-home .nav .n--idle{background:var(--brand-primary-tint);color:var(--brand-primary)}
.rlp-home .nav .n--done{background:var(--brand-primary);color:#fff}
.rlp-home .nav > span:last-child{display:flex;flex-direction:column;gap:2px;min-width:0}
.rlp-home .nav .t{display:block;font-size:15px;font-weight:600;color:var(--ink);line-height:1.25}
.rlp-home .nav.is-idle .t{color:var(--text)}
.rlp-home .nav .s{display:block;font-size:12px;color:var(--text-muted);line-height:1.35}

.rlp-home .clarity{background:#fff;border:1px solid color-mix(in srgb,var(--border) 45%,transparent);border-radius:var(--r-lg);padding:24px 22px;box-shadow:var(--shadow-md);text-align:center}
.rlp-home .radial-wrap{position:relative;display:inline-grid;place-items:center;margin-bottom:10px}
.rlp-home .radial{--p:0;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--stage-color,var(--brand-primary)) calc(var(--p)*1%),var(--border) 0)}
.rlp-home .radial::before{content:"";position:absolute;width:58px;height:58px;border-radius:50%;background:#fff}
.rlp-home .radial span{position:relative;font-size:16px;font-weight:700;color:var(--color-text-primary)}
.rlp-home .clarity .lab{font-size:13px;font-weight:600;color:var(--ink)}
.rlp-home .clarity .sub{font-size:12px;color:var(--text-muted);margin-top:4px;line-height:1.45}

.rlp-home .greeting{font-family:var(--font-serif);font-size:40px;font-weight:600;color:var(--ink);line-height:1.12;letter-spacing:-.01em;margin-bottom:8px}
.rlp-home .greet-sub{font-size:15px;color:var(--text-muted);margin-bottom:30px}

/* Stage reveal cards — one consistent, neutral treatment for every stage, in both
   the "ready" and "viewed" states, so no single stage stands out. The distinctive
   Vita-purple bloom treatment is reserved for the RLP card (.is-rlp) below. */
.rlp-home .picture-card{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid color-mix(in srgb,var(--border) 45%,transparent);border-radius:var(--r-lg);box-shadow:var(--shadow-md);padding:22px 24px;margin-bottom:32px;cursor:pointer;transition:box-shadow .15s ease,transform .15s ease}
.rlp-home .picture-card:hover{box-shadow:var(--shadow-lg);transform:translateY(-1px)}
.rlp-home .picture-card .pc-icon{width:42px;height:42px;border-radius:50%;background:var(--bg-alt);display:grid;place-items:center;font-size:19px;flex-shrink:0;color:var(--color-brand-primary)}
.rlp-home .picture-card .pc-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.rlp-home .picture-card .pc-title{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--ink);line-height:1.2}
.rlp-home .picture-card .pc-sub{font-size:14px;color:var(--text-muted);line-height:1.5}
.rlp-home .picture-card .pc-chev{margin-left:auto;font-size:24px;line-height:1;color:var(--text-muted);flex-shrink:0}
.rlp-home .picture-card.is-calm{background:#fff;padding:18px 22px}
.rlp-home .picture-card.is-calm:hover{box-shadow:var(--shadow-lg);transform:translateY(-1px)}
.rlp-home .picture-card.is-calm .pc-icon{width:34px;height:34px;font-size:16px}
.rlp-home .picture-card.is-calm .pc-title{font-family:var(--font-sans);font-size:15px;font-weight:600;color:var(--brand-primary)}
/* RLP card only — the flagship. A bold, high-contrast dark-green card with a
   Chorus-lime accent so it stands out as the most important thing on the page. */
.rlp-home .picture-card.is-rlp{background:var(--color-brand-primary);border-color:var(--color-brand-primary);box-shadow:var(--shadow-lg);padding:22px 24px}
.rlp-home .picture-card.is-rlp:hover{border-color:var(--color-brand-primary);box-shadow:var(--shadow-lg);transform:translateY(-1px)}
.rlp-home .picture-card.is-rlp .pc-icon{width:46px;height:46px;background:var(--chorus-lime);color:var(--color-brand-primary)}
.rlp-home .picture-card.is-rlp .pc-bloom{width:24px;height:auto;display:block}
.rlp-home .picture-card.is-rlp .pc-title{font-family:var(--font-serif);font-size:21px;font-weight:600;color:#fff}
.rlp-home .picture-card.is-rlp .pc-sub{color:rgba(255,255,255,.74)}
.rlp-home .picture-card.is-rlp .pc-chev{color:rgba(255,255,255,.62)}

.rlp-home .steps{display:flex;align-items:flex-start;gap:0;margin:8px 0 42px}
.rlp-home .step{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;flex:1;position:relative;background:none;border:none;font-family:inherit;padding:0}
.rlp-home button.step{cursor:pointer}
.rlp-home .step.is-locked{opacity:.5;cursor:default}
.rlp-home .step .dot{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;z-index:1;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--color-brand-primary) 55%,transparent)}
.rlp-home .step.done .dot{background:var(--brand-primary);color:#fff}
.rlp-home .step.active .dot{background:var(--accent);color:#fff}
.rlp-home .step.todo .dot{background:var(--border);color:var(--text-faint)}
.rlp-home .step .cap{font-size:11.5px;color:var(--text-muted);font-weight:600}
.rlp-home .step.active .cap{color:var(--ink)}
.rlp-home .step:not(:last-child)::after{content:"";position:absolute;top:20px;left:50%;width:100%;height:2px;background:var(--border)}
.rlp-home .step.done:not(:last-child)::after{background:var(--brand-primary)}

/* Hero + finished-stage panel share one shape: a solid stage-colour FIELD with the
   Chorus vector graphic cropped behind a white card (the card carries Vita / the
   completion note). The graphic position is set once here (tuned in the positioner)
   and recolours per stage via an inline color on .hero-gfx. The card is in normal
   flow so it always grows to fit its text — nothing can spill. */
.rlp-home .hero,.rlp-home .done-head{position:relative;overflow:hidden;border-radius:var(--r-lg);box-shadow:var(--shadow-lg);margin-bottom:34px}
.rlp-home .hero-gfx{position:absolute;inset:0;pointer-events:none}
.rlp-home .hero-gfx-svg{position:absolute;height:280%;width:auto;left:79%;top:95%;transform:translate(-50%,-50%)}
.rlp-home .hero-card{position:relative;z-index:1;width:52%;margin:24px;background:#fff;border-radius:var(--r-lg);box-shadow:var(--shadow-md);padding:28px 30px}
.rlp-home .hero .vita{display:flex;align-items:center;gap:9px;margin-bottom:12px}
.rlp-home .hero .vita .name{font-family:var(--font-serif);font-size:20px;font-weight:600;color:var(--color-vita)}
.rlp-home .coachpill{display:inline-block;background:var(--color-vita);color:#fff;font-size:12px;font-weight:700;padding:5px 11px;border-radius:var(--r-sm);margin-bottom:16px}
.rlp-home .hero p.intro{font-size:15px;color:var(--text);line-height:1.6;margin-bottom:22px}
.rlp-home .hero .ns-eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:3px}
.rlp-home .hero .ns-title{font-family:var(--font-serif);font-size:23px;font-weight:600;color:var(--ink);line-height:1.2;margin-bottom:18px}
.rlp-home .hero .ctarow{display:flex;align-items:center;gap:14px}

/* Stage-completion panel — a light tint of the viewed stage, not generic success
   green. The tick circle is the full stage colour; body text stays neutral. */
.rlp-home .done-head h2{font-family:var(--font-serif);font-size:24px;font-weight:600;color:var(--ink);line-height:1.2;margin-bottom:8px;display:flex;align-items:center;gap:10px}
.rlp-home .done-head .tick{width:30px;height:30px;border-radius:50%;background:var(--stage-color);color:var(--stage-fg);display:grid;place-items:center;font-size:15px;flex-shrink:0}
.rlp-home .done-head p{font-size:15px;color:var(--text);margin-bottom:10px}
.rlp-home .done-head .dh-hint{font-size:13px;color:var(--text-muted);margin-bottom:14px}
.rlp-home .link-back{background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;color:var(--brand-primary);padding:8px 0;min-height:44px}
.rlp-home .link-back:hover{text-decoration:underline}

.rlp-home .btn{font-size:15px;font-weight:600;border:none;border-radius:var(--r-sm);padding:13px 20px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1;min-height:48px}
.rlp-home .btn-navy{background:var(--brand-primary);color:#fff}
.rlp-home .btn-navy:hover{background:var(--brand-primary-hover)}
.rlp-home .chip-time{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--text-muted);background:#fff;border:1px solid var(--border);border-radius:var(--r-pill);padding:5px 12px;font-weight:500;white-space:nowrap}

.rlp-home .sec-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:8px}
.rlp-home .sec-head{font-size:19px;font-weight:600;color:var(--ink)}
.rlp-home .sec-prog{font-size:13px;color:var(--text-muted);white-space:nowrap}
.rlp-home .bar{height:5px;border-radius:var(--r-pill);background:color-mix(in srgb,var(--border) 70%,transparent);overflow:hidden;margin:12px 0 26px}
.rlp-home .bar i{display:block;height:100%;background:var(--stage-color);border-radius:var(--r-pill)}

.rlp-home .cards{display:flex;flex-direction:column;gap:14px;margin-bottom:40px}
.rlp-home .scard{display:grid;grid-template-columns:56px minmax(0,1fr) auto auto;gap:18px;align-items:center;background:#fff;border:1px solid color-mix(in srgb,var(--border) 45%,transparent);border-radius:var(--r-lg);padding:20px 22px;box-shadow:var(--shadow-md)}
.rlp-home .scard.is-active{background:var(--accent-surface);border-color:var(--accent-line);box-shadow:var(--shadow-md)}
.rlp-home .scard-done{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}
.rlp-home .scard-done:hover{box-shadow:var(--shadow-lg);transform:translateY(-1px)}
.rlp-home .done-cap{display:inline-flex;align-items:center;gap:12px}
.rlp-home .done-cap .chev{font-size:22px;line-height:1;color:var(--text-muted)}
.rlp-home .scard > div:not(.thumb){min-width:0}
/* All illustration tiles in a stage share one light tint of that stage's colour;
   the line work is Chorus dark green. Modules are never coloured individually. */
.rlp-home .thumb{width:88px;height:72px;border-radius:var(--r-md);overflow:hidden;position:relative;flex-shrink:0;background:var(--stage-wash)}
.rlp-home .thumb.roles{display:grid;place-items:center}
.rlp-home .thumb.roles::after{content:"";width:44px;height:30px;background:radial-gradient(circle at 30% 50%,var(--color-brand-primary) 12px,transparent 13px),radial-gradient(circle at 70% 50%,var(--color-brand-primary) 12px,transparent 13px)}
.rlp-home .thumb.cal{display:grid;place-items:center}
.rlp-home .thumb.cal::after{content:"";width:46px;height:34px;border-radius:6px;background:var(--color-brand-primary);box-shadow:inset 0 8px 0 color-mix(in srgb,var(--color-brand-primary) 55%,#fff)}
.rlp-home .thumb.keep{display:grid;place-items:center}
.rlp-home .thumb.keep::after{content:"";width:40px;height:40px;border-radius:50%;border:6px solid var(--color-brand-primary);border-right-color:transparent;transform:rotate(40deg)}
.rlp-home .thumb.mtn::after{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);border-left:22px solid transparent;border-right:22px solid transparent;border-bottom:34px solid var(--color-brand-primary)}
.rlp-home .thumb.sunrise::after{content:"";position:absolute;top:14px;left:50%;transform:translateX(-50%);width:20px;height:20px;border-radius:50%;background:var(--color-brand-primary)}
.rlp-home .thumb.future::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,var(--color-brand-primary) 10px,transparent 11px)}
.rlp-home .scard .title{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--ink);line-height:1.2}
.rlp-home .scard .desc{font-size:14px;color:var(--text-muted);margin-top:5px;max-width:34ch}
.rlp-home .badge{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;border-radius:var(--r-pill);padding:7px 14px;white-space:nowrap}
.rlp-home .badge-complete{color:var(--success-text);background:#fff;border:1.5px solid var(--success-line)}
.rlp-home .badge-notstarted{color:var(--text-muted);background:var(--muted-surface)}
.rlp-home .badge-soon{color:var(--text-muted);background:var(--muted-surface)}
/* Coming-soon placeholder card: a real-looking module card that isn't clickable. */
.rlp-home .scard-soon{cursor:default}
.rlp-home .scard-soon .badge-soon{grid-column:3 / -1;justify-self:end}

.rlp-home .info{display:flex;gap:18px;align-items:flex-start;background:var(--info-surface);border:1px solid color-mix(in srgb,var(--info-line) 60%,transparent);border-radius:var(--r-lg);padding:24px 26px;margin-bottom:32px}
.rlp-home .info .av{width:42px;height:42px;border-radius:50%;background:var(--brand-primary-tint);display:grid;place-items:center;font-size:18px;flex-shrink:0}
.rlp-home .info h4{font-family:var(--font-serif);font-size:18px;font-weight:600;color:var(--info-text);margin-bottom:5px}
.rlp-home .info p{font-size:14px;color:var(--text);max-width:52ch;line-height:1.55}
/* The help/guidance shortcut: an outlined pill in Chorus green so it reads as a
   clear, tappable door to the guide (and meets the 44px touch minimum). Fills on
   hover/focus. */
.rlp-home .info .lk{margin-left:auto;align-self:center;font-size:15px;font-weight:600;color:var(--brand-primary);white-space:nowrap;display:inline-flex;gap:6px;align-items:center;justify-content:center;border:1.5px solid var(--brand-primary);border-radius:var(--r-pill);padding:11px 18px;min-height:44px;background:transparent;transition:background .15s ease,color .15s ease}
.rlp-home .info .lk:hover{background:var(--brand-primary);color:var(--brand-on-primary);text-decoration:none}
.rlp-home .info .lk:focus-visible{outline:none;box-shadow:var(--focus-ring)}

.rlp-home .reset{text-align:center;font-size:13px;color:var(--text-faint)}
.rlp-home .reset button{background:none;border:none;color:var(--text-muted);font-size:13px;text-decoration:underline;cursor:pointer;padding:8px 12px;min-height:44px}

@media (prefers-reduced-motion:no-preference){
  .rlp-home .col > *{animation:rlp-rise .5s ease both}
  .rlp-home .col > *:nth-child(1){animation-delay:.02s}.rlp-home .col > *:nth-child(2){animation-delay:.07s}
  .rlp-home .col > *:nth-child(3){animation-delay:.12s}.rlp-home .col > *:nth-child(4){animation-delay:.17s}
  .rlp-home .col > *:nth-child(5){animation-delay:.22s}.rlp-home .col > *:nth-child(n+6){animation-delay:.27s}
  @keyframes rlp-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
}

@media (max-width:880px){
  .rlp-home .sidebar{display:none}
  .rlp-home .main{padding:24px 18px 80px}
  /* On phones the hero goes square-ish: the card spans nearly full width with the
     graphic reduced to hints peeking behind it (positioned in the mobile tab of the
     positioner). The card still sizes to its text, so it grows rather than clips. */
  .rlp-home .hero-card{width:auto;margin:16px}
  .rlp-home .hero-gfx-svg{height:223%;left:42%;top:94%}
  .rlp-home .greeting{font-size:28px}
  .rlp-home .scard{grid-template-columns:56px minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:14px;row-gap:12px;align-items:start}
  .rlp-home .scard .thumb{grid-column:1;grid-row:1 / span 2;width:64px;height:64px}
  .rlp-home .scard > div:not(.thumb){grid-column:2 / -1;grid-row:1}
  .rlp-home .scard .chip-time{grid-column:2;grid-row:2;align-self:center}
  .rlp-home .scard .badge,.rlp-home .scard .btn,.rlp-home .scard .done-cap{grid-column:3;grid-row:2;justify-self:end;align-self:center}
}
@media (max-width:440px){
  .rlp-home .scard{grid-template-columns:56px minmax(0,1fr);grid-template-rows:auto auto auto}
  .rlp-home .scard .chip-time{grid-column:2;grid-row:2;justify-self:start}
  .rlp-home .scard .badge,.rlp-home .scard .btn,.rlp-home .scard .done-cap{grid-column:2;grid-row:3;justify-self:start}
}
`;
