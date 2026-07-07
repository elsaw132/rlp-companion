"use client";

// The /home dashboard. Reads the stage + module structure from lib/modules.ts
// and completion from progress.ts (getCompletedIds — the single source of truth);
// nothing about the programme is hardcoded here. Layout, components, spacing and
// states match design-reference/aviva-rlp-home-screen.html. CSS is scoped under
// .rlp-home so the replicated reference styles don't leak into other routes.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { STAGES, TOTAL_STAGES, visibleModules, stageNameFor, isRetired, titleFor } from "@/lib/modules";
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
import PoweredByChorus from "./PoweredByChorus";

// The soft illustrated thumbnail per module, by position within the stage —
// matches the order in the reference (sunrise, roles, cal, keep, mtn, future).
const THUMBS = ["sunrise", "roles", "cal", "keep", "mtn", "future"];

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeDashboard() {
  const { user } = useUser();
  const userData = useUserData();
  // The person's retirement stage, used to tailor stage-intro and module-card
  // copy (Phase 2). null (and so a no-op) with the flag off or before the data
  // has loaded, and for anyone still working.
  const retirementStage = userData.getRetirementStage();
  const router = useRouter();
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
    const currentStage = getActiveStageNumber(ids);
    const stage = STAGES.find((s) => s.number === currentStage);
    // A stage reveal's "Return home" links to /home?intro=skip so the person
    // lands on the dashboard itself, not straight into the next stage's intro.
    // Transient (this visit only) — the intro still shows on a later forward
    // entry, since this never records it as seen.
    const skipIntro =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("intro") === "skip";
    if (
      stage?.intro &&
      !skipIntro &&
      !userData.getStageIntrosSeen().includes(currentStage)
    ) {
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
      const introStageObj = stage.intro
        ? {
            ...stage,
            name: stageNameFor(stage, retirementStage),
            intro: {
              ...stage.intro,
              heading: reviewStage1
                ? REVIEW_STAGE1_INTRO_HEADING
                : stage.intro.heading,
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

  const stageModules = visibleModules(viewedStageData, retirementStage);
  const doneInStage = stageModules.filter((m) => completed.includes(m.id)).length;
  const totalInStage = stageModules.length;
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
    heroIntro = `You've finished everything that's ready so far — nicely done. New modules for ${activeStage.name} are on their way.`;
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
    const recap = priorTakeaway.textDirect ?? priorTakeaway.text;
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
    <div className="rlp-home">
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
              const inner = (
                <>
                  <span className={numClass}>{isDone ? "✓" : s.number}</span>
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
            <div className="sub">Grows as you complete the modules in this stage.</div>
          </div>

          {/* BRANDING — product-layer "Powered by Chorus Life", pinned to the
              bottom of the sidebar so it's always present on the home screen. */}
          <PoweredByChorus />
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
                const inner = (
                  <>
                    <div className="dot">{isDone ? "✓" : s.number}</div>
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
              <section className="done-head">
                <h2>
                  <span className="tick" aria-hidden="true">
                    ✓
                  </span>
                  {viewedStageData.name} — complete
                </h2>
                <p>Revisit any module below; your answers are saved.</p>
                <button
                  type="button"
                  className="link-back"
                  onClick={() => setViewedStage(null)}
                >
                  Back to your current step ›
                </button>
              </section>
            ) : (
            <section className="hero">
              <div className="body">
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
              <div className="scene" aria-hidden="true">
                <div className="sun-ill"></div>
                <div className="cloud"></div>
                <div className="cloud two"></div>
              </div>
            </section>
            )}

            {/* STAGE 1 PICTURE — only within the Imagine view, once all five
                Imagine modules are done. A loud "is ready" prompt until the
                picture is confirmed, then a calmer persistent entry. */}
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
                    <span className="pc-title">Your Imagine reveal is ready</span>
                    <span className="pc-sub">
                      The threads of what you imagined — and the retirement type
                      that&apos;s emerged. Yours to shape as you go.
                    </span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              )
            )}

            {/* STAGE 2 PICTURE — only within the Explore view, once all six
                Explore modules are done. Loud "is ready" prompt until viewed,
                then a calmer persistent entry. */}
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
                    <span className="pc-title">Your Explore reveal is ready</span>
                    <span className="pc-sub">
                      A fuller picture across the six areas of a balanced
                      retirement — and a few things worth knowing along the way.
                    </span>
                  </span>
                  <span className="pc-chev" aria-hidden="true">
                    ›
                  </span>
                </Link>
              )
            )}

            {/* STAGE 3 PICTURE — only within the Understand view, once all six
                Understand modules are done. Loud "is ready" prompt until viewed,
                then a calmer persistent entry. */}
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
                    <span className="pc-title">Your Understand reveal is ready</span>
                    <span className="pc-sub">
                      The person inside the picture — your strengths, your values,
                      and what these years are for, in your own words.
                    </span>
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
              <Link className="picture-card is-calm" href="/plan">
                <span className="pc-icon" aria-hidden="true">
                  ✦
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
              <div className="sec-head">Your modules in {viewedStageData.name}</div>
              <div className="sec-prog">
                {doneInStage} of {totalInStage} modules complete
              </div>
            </div>
            <div className="bar">
              <i style={{ width: `${stagePct}%` }}></i>
            </div>

            {totalInStage === 0 ? (
              <div className="info" style={{ marginBottom: "34px" }}>
                <div className="av" aria-hidden="true">
                  🌱
                </div>
                <div>
                  <h4>This stage is on its way</h4>
                  <p>
                    The modules for {viewedStageData.name}{" "}
                    are still being prepared. You can revisit anything you&apos;ve
                    already done in the meantime.
                  </p>
                </div>
              </div>
            ) : (
              <div className="cards">
                {stageModules.map((m, i) => {
                  const isComplete = completed.includes(m.id);
                  const isActiveStep = isViewingCurrent && nextModule?.id === m.id;
                  const thumb = THUMBS[i] ?? "future";
                  const body = (
                    <>
                      <div className={`thumb ${thumb}`} aria-hidden="true"></div>
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
              </div>
            )}

            {/* ENCOURAGEMENT */}
            <div className="info">
              <div className="av" aria-hidden="true">
                🌱
              </div>
              <div>
                <h4>There&apos;s no wrong way to do this</h4>
                <p>
                  Take your time. Each module is designed to be fun and
                  reflective, not hard or fast. We suggest setting aside 20
                  minutes each day to do one module at a time, and giving each
                  module time to settle before moving on to the next.
                </p>
              </div>
              <a href="#" className="lk">
                How it works ›
              </a>
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

.rlp-home .shell{display:flex;align-items:flex-start;max-width:1180px;margin:0 auto}
.rlp-home .sidebar{width:var(--sidebar-w);flex-shrink:0;padding:28px 20px 40px;border-right:1px solid var(--border);min-height:calc(100vh - var(--header-h));position:sticky;top:var(--header-h);display:flex;flex-direction:column}
.rlp-home .sidebar .rlp-poweredby{margin-top:auto;padding-top:24px;justify-content:flex-start}
.rlp-home .main{flex:1;min-width:0;padding:34px 40px 80px;display:flex;justify-content:center}
.rlp-home .col{width:100%;max-width:var(--content-max)}

.rlp-home .side-eyebrow{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);font-weight:600;padding:0 12px;margin-bottom:10px}
.rlp-home .navlist{display:flex;flex-direction:column;gap:4px;margin-bottom:28px}
.rlp-home .nav{display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:var(--r-sm);width:100%;text-align:left;background:none;border:none;font-family:inherit;cursor:pointer}
.rlp-home button.nav:hover{background:var(--bg-alt)}
.rlp-home .nav.is-viewing{background:var(--brand-primary-tint)}
.rlp-home .nav.is-viewing:hover{background:var(--brand-primary-tint)}
.rlp-home .nav.is-locked{opacity:.5;cursor:default}
.rlp-home .nav.is-locked:hover{background:none}
.rlp-home .nav .n{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;flex-shrink:0}
.rlp-home .nav .n--current{background:var(--brand-primary);color:#fff}
.rlp-home .nav .n--idle{background:#EBF1F8;color:var(--brand-primary)}
.rlp-home .nav .n--done{background:var(--brand-primary);color:#fff}
.rlp-home .nav > span:last-child{display:flex;flex-direction:column;gap:2px;min-width:0}
.rlp-home .nav .t{display:block;font-size:15px;font-weight:600;color:var(--ink);line-height:1.25}
.rlp-home .nav.is-idle .t{color:var(--text)}
.rlp-home .nav .s{display:block;font-size:12px;color:var(--text-muted);line-height:1.35}

.rlp-home .clarity{background:#fff;border:1px solid var(--border);border-radius:var(--r-md);padding:18px;box-shadow:var(--shadow-sm);text-align:center}
.rlp-home .radial-wrap{position:relative;display:inline-grid;place-items:center;margin-bottom:10px}
.rlp-home .radial{--p:0;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--brand-primary) calc(var(--p)*1%),var(--border) 0)}
.rlp-home .radial::before{content:"";position:absolute;width:58px;height:58px;border-radius:50%;background:#fff}
.rlp-home .radial span{position:relative;font-size:16px;font-weight:700;color:var(--brand-primary)}
.rlp-home .clarity .lab{font-size:13px;font-weight:600;color:var(--ink)}
.rlp-home .clarity .sub{font-size:12px;color:var(--text-muted);margin-top:4px;line-height:1.45}

.rlp-home .greeting{font-family:var(--font-serif);font-size:34px;font-weight:600;color:var(--ink);line-height:1.15;margin-bottom:6px}
.rlp-home .greet-sub{font-size:14px;color:var(--text-muted);margin-bottom:28px}

.rlp-home .picture-card{display:flex;align-items:center;gap:16px;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-md);padding:20px 22px;margin-bottom:28px;cursor:pointer;transition:box-shadow .15s ease,border-color .15s ease}
.rlp-home .picture-card:hover{box-shadow:var(--shadow-lg,var(--shadow-md));border-color:var(--brand-primary)}
.rlp-home .picture-card .pc-icon{width:42px;height:42px;border-radius:50%;background:var(--sun);display:grid;place-items:center;font-size:19px;flex-shrink:0;color:var(--ink)}
.rlp-home .picture-card .pc-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.rlp-home .picture-card .pc-title{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--ink);line-height:1.2}
.rlp-home .picture-card .pc-sub{font-size:14px;color:var(--text-muted);line-height:1.5}
.rlp-home .picture-card .pc-chev{margin-left:auto;font-size:24px;line-height:1;color:var(--text-muted);flex-shrink:0}
.rlp-home .picture-card.is-calm{background:#fff;border-color:var(--border);box-shadow:var(--shadow-sm);padding:16px 20px}
.rlp-home .picture-card.is-calm:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md)}
.rlp-home .picture-card.is-calm .pc-icon{width:34px;height:34px;font-size:16px;background:var(--bg-alt)}
.rlp-home .picture-card.is-calm .pc-title{font-family:var(--font-sans);font-size:15px;font-weight:600;color:var(--brand-primary)}

.rlp-home .steps{display:flex;align-items:flex-start;gap:0;margin-bottom:32px}
.rlp-home .step{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;flex:1;position:relative;background:none;border:none;font-family:inherit;padding:0}
.rlp-home button.step{cursor:pointer}
.rlp-home .step.is-locked{opacity:.5;cursor:default}
.rlp-home .step .dot{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;z-index:1}
.rlp-home .step.is-viewing .dot{box-shadow:0 0 0 4px var(--brand-primary-tint)}
.rlp-home .step.done .dot{background:var(--brand-primary);color:#fff}
.rlp-home .step.active .dot{background:var(--accent);color:#fff}
.rlp-home .step.todo .dot{background:var(--border);color:var(--text-faint)}
.rlp-home .step .cap{font-size:11.5px;color:var(--text-muted);font-weight:600}
.rlp-home .step.active .cap{color:var(--ink)}
.rlp-home .step:not(:last-child)::after{content:"";position:absolute;top:20px;left:50%;width:100%;height:2px;background:var(--border)}
.rlp-home .step.done:not(:last-child)::after{background:var(--brand-primary)}

.rlp-home .hero{display:grid;grid-template-columns:1.05fr .95fr;background:var(--warm-surface);border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--warm-line);box-shadow:var(--shadow-md);margin-bottom:34px}
.rlp-home .hero .body{padding:28px 28px 30px}
.rlp-home .hero .vita{display:flex;align-items:center;gap:9px;margin-bottom:12px}
.rlp-home .hero .vita .name{font-family:var(--font-serif);font-size:20px;font-weight:600;color:var(--ink)}
.rlp-home .coachpill{display:inline-block;background:var(--coach-pill);color:var(--coach-pill-text);font-size:12px;font-weight:700;padding:5px 11px;border-radius:var(--r-sm);margin-bottom:16px}
.rlp-home .hero p.intro{font-size:15px;color:var(--text);line-height:1.6;margin-bottom:22px}
.rlp-home .hero .ns-eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:3px}
.rlp-home .hero .ns-title{font-family:var(--font-serif);font-size:23px;font-weight:600;color:var(--ink);line-height:1.2;margin-bottom:18px}
.rlp-home .hero .ctarow{display:flex;align-items:center;gap:14px}
.rlp-home .hero .scene{background:linear-gradient(var(--ill-sky-pale),var(--ill-sky) 42%,var(--ill-hill) 60%,var(--ill-hill-deep));position:relative}
.rlp-home .hero .scene .sun-ill{position:absolute;right:30px;top:34px;width:42px;height:42px;border-radius:50%;background:radial-gradient(circle,#FFF3CF,var(--sun));box-shadow:0 0 30px rgba(251,210,78,.6)}
.rlp-home .hero .scene .cloud{position:absolute;width:64px;height:18px;background:rgba(255,255,255,.7);border-radius:20px;top:74px;right:54px}
.rlp-home .hero .scene .cloud.two{width:44px;top:104px;right:120px;opacity:.6}

.rlp-home .done-head{background:var(--success-surface);border:1px solid var(--success-line);border-radius:var(--r-lg);padding:24px 26px;margin-bottom:34px}
.rlp-home .done-head h2{font-family:var(--font-serif);font-size:24px;font-weight:600;color:var(--ink);line-height:1.2;margin-bottom:8px;display:flex;align-items:center;gap:10px}
.rlp-home .done-head .tick{width:30px;height:30px;border-radius:50%;background:var(--brand-primary);color:#fff;display:grid;place-items:center;font-size:15px;flex-shrink:0}
.rlp-home .done-head p{font-size:15px;color:var(--text);margin-bottom:14px}
.rlp-home .link-back{background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;color:var(--brand-primary);padding:8px 0;min-height:44px}
.rlp-home .link-back:hover{text-decoration:underline}

.rlp-home .btn{font-size:15px;font-weight:600;border:none;border-radius:var(--r-sm);padding:13px 20px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1;min-height:48px}
.rlp-home .btn-navy{background:var(--brand-primary);color:#fff}
.rlp-home .btn-navy:hover{background:var(--brand-primary-hover)}
.rlp-home .chip-time{display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--text-muted);background:#fff;border:1px solid var(--border);border-radius:var(--r-pill);padding:5px 12px;font-weight:500;white-space:nowrap}

.rlp-home .sec-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:4px}
.rlp-home .sec-head{font-size:18px;font-weight:700;color:var(--ink)}
.rlp-home .sec-prog{font-size:13px;color:var(--text-muted);white-space:nowrap}
.rlp-home .bar{height:6px;border-radius:var(--r-pill);background:var(--border);overflow:hidden;margin:10px 0 20px}
.rlp-home .bar i{display:block;height:100%;background:var(--brand-primary);border-radius:var(--r-pill)}

.rlp-home .cards{display:flex;flex-direction:column;gap:12px;margin-bottom:34px}
.rlp-home .scard{display:grid;grid-template-columns:88px minmax(0,1fr) auto auto;gap:18px;align-items:center;background:#fff;border:1px solid var(--border);border-radius:var(--r-md);padding:18px;box-shadow:var(--shadow-sm)}
.rlp-home .scard.is-active{background:var(--accent-surface);border-color:var(--accent-line);box-shadow:var(--shadow-md)}
.rlp-home .scard-done{cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease}
.rlp-home .scard-done:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md)}
.rlp-home .done-cap{display:inline-flex;align-items:center;gap:12px}
.rlp-home .done-cap .chev{font-size:22px;line-height:1;color:var(--text-muted)}
.rlp-home .scard > div:not(.thumb){min-width:0}
.rlp-home .thumb{width:88px;height:72px;border-radius:var(--r-md);overflow:hidden;position:relative;flex-shrink:0}
.rlp-home .thumb.sunrise{background:linear-gradient(var(--ill-sky-pale),var(--ill-hill) 70%)}
.rlp-home .thumb.sunrise::after{content:"";position:absolute;top:14px;left:50%;transform:translateX(-50%);width:20px;height:20px;border-radius:50%;background:var(--sun)}
.rlp-home .thumb.roles{background:#E7F2E2;display:grid;place-items:center}
.rlp-home .thumb.roles::after{content:"";width:44px;height:30px;background:radial-gradient(circle at 30% 50%,var(--ill-hill) 12px,transparent 13px),radial-gradient(circle at 70% 50%,var(--ill-hill-deep) 12px,transparent 13px)}
.rlp-home .thumb.cal{background:#FCE7B8;display:grid;place-items:center}
.rlp-home .thumb.cal::after{content:"";width:46px;height:34px;border-radius:6px;background:var(--coach-pill);box-shadow:inset 0 8px 0 #E7B53D}
.rlp-home .thumb.keep{background:#EFEAFB;display:grid;place-items:center}
.rlp-home .thumb.keep::after{content:"";width:40px;height:40px;border-radius:50%;border:6px solid var(--ill-lavender);border-right-color:transparent;transform:rotate(40deg)}
.rlp-home .thumb.mtn{background:#EEEAFB;position:relative;overflow:hidden}
.rlp-home .thumb.mtn::after{content:"";position:absolute;bottom:0;left:50%;transform:translateX(-50%);border-left:22px solid transparent;border-right:22px solid transparent;border-bottom:34px solid var(--ill-lavender)}
.rlp-home .thumb.future{background:linear-gradient(135deg,#DDEAF4,#C9D9CC)}
.rlp-home .thumb.future::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,rgba(251,210,78,.7) 10px,transparent 11px)}
.rlp-home .scard .title{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--ink);line-height:1.2}
.rlp-home .scard .desc{font-size:14px;color:var(--text-muted);margin-top:5px;max-width:34ch}
.rlp-home .badge{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;border-radius:var(--r-pill);padding:7px 14px;white-space:nowrap}
.rlp-home .badge-complete{color:var(--success-text);background:#fff;border:1.5px solid var(--success-line)}
.rlp-home .badge-notstarted{color:var(--text-muted);background:var(--muted-surface)}

.rlp-home .info{display:flex;gap:18px;align-items:flex-start;background:var(--info-surface);border:1px solid var(--info-line);border-radius:var(--r-md);padding:22px 24px;margin-bottom:30px}
.rlp-home .info .av{width:42px;height:42px;border-radius:50%;background:#C9D7F2;display:grid;place-items:center;font-size:18px;flex-shrink:0}
.rlp-home .info h4{font-family:var(--font-serif);font-size:18px;font-weight:600;color:var(--info-text);margin-bottom:5px}
.rlp-home .info p{font-size:14px;color:var(--text);max-width:52ch;line-height:1.55}
.rlp-home .info .lk{margin-left:auto;align-self:center;font-size:15px;font-weight:600;color:var(--brand-primary);white-space:nowrap;display:inline-flex;gap:6px;align-items:center}

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
  .rlp-home .hero{grid-template-columns:1fr}
  .rlp-home .hero .scene{min-height:120px}
  .rlp-home .greeting{font-size:28px}
  .rlp-home .scard{grid-template-columns:64px minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:14px;row-gap:12px;align-items:start}
  .rlp-home .scard .thumb{grid-column:1;grid-row:1 / span 2;width:64px;height:64px}
  .rlp-home .scard > div:not(.thumb){grid-column:2 / -1;grid-row:1}
  .rlp-home .scard .chip-time{grid-column:2;grid-row:2;align-self:center}
  .rlp-home .scard .badge,.rlp-home .scard .btn,.rlp-home .scard .done-cap{grid-column:3;grid-row:2;justify-self:end;align-self:center}
}
@media (max-width:440px){
  .rlp-home .scard{grid-template-columns:64px minmax(0,1fr);grid-template-rows:auto auto auto}
  .rlp-home .scard .chip-time{grid-column:2;grid-row:2;justify-self:start}
  .rlp-home .scard .badge,.rlp-home .scard .btn,.rlp-home .scard .done-cap{grid-column:2;grid-row:3;justify-self:start}
}
`;
