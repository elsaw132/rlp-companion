import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import SessionContainer from "../../components/SessionContainer";
import { ResetModuleLink } from "../../components/ResetControls";
import { ModulesBackLink } from "../../components/ModulesBackLink";
import {
  getModule,
  getNextModule,
  getModulesBefore,
  sensesSessionInstructions,
  sensesClosingCommitment,
  windDownFourOne,
  titleFor,
  windDownDecided,
  retiredLetter,
  isRetired,
  type BuildResult,
} from "@/lib/modules";
import { getUserData } from "@/lib/db";
import { ageFromDob } from "@/lib/planDate";
import { tailorCopy } from "@/lib/retirementCopy";
import { RETIREMENT_PATHS } from "@/lib/flags";
import type { RetirementStage } from "@/lib/userData";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  // One onboarding read serves three needs (only when signed in AND either the
  // retirement-paths flag is on or this is the senses module): the person's
  // retirementStage — which, behind the flag, scopes which modules they see and
  // tailors copy per cohort — and the horizon/age that drive the senses hearing
  // gate. Flag off + non-senses skips the read, so everything below is
  // byte-identical to today.
  let horizon: string | null = null;
  let age: number | null = null;
  let retirementStage: RetirementStage | null = null;
  if (userId && (RETIREMENT_PATHS || id === "2.6")) {
    try {
      const onboarding = await getUserData(userId, "onboarding");
      if (onboarding && typeof onboarding === "object") {
        const o = onboarding as {
          horizon?: unknown;
          dob?: unknown;
          retirementStage?: unknown;
        };
        if (typeof o.horizon === "string") horizon = o.horizon;
        // Prefer the real age computed from the onboarding date of birth; the
        // horizon stays as the graceful fallback when no DOB was given.
        if (typeof o.dob === "string") age = ageFromDob(o.dob);
        const s = o.retirementStage;
        if (
          s === "working" ||
          s === "winding_down" ||
          s === "recently_retired" ||
          s === "established"
        ) {
          retirementStage = s;
        }
      }
    } catch {
      horizon = null;
    }
  }

  // The stage that scopes module visibility — null (today's universal set) unless
  // the flag is on. Used for module lookup, gating, and the next-module chain.
  const effectiveRs = RETIREMENT_PATHS ? retirementStage : null;

  const found = getModule(id, effectiveRs);
  if (!found) {
    return (
      <main style={styles.notFoundPage}>
        <p style={styles.notFoundText}>Session not found</p>
      </main>
    );
  }

  const {
    module: mod,
    stageNumber,
    stageName,
    totalStages,
    modulesInStage,
    stageModuleIds,
  } = found;

  // In-order gate: a module opens only if it's already complete (revisiting) or
  // every module before it in programme order is done. This keeps the modules
  // sequential even against a directly-typed URL — the dashboard already offers
  // only the next module as a link. Fails open on a DB hiccup so a transient
  // error never locks a legitimate user out of their next module. Scoped to the
  // modules this person actually sees, so a winding-down user's extra first
  // module gates correctly and nobody else is blocked on a module they can't see.
  if (userId) {
    let completedIds: string[] | null = null;
    try {
      const raw = await getUserData(userId, "completed");
      completedIds = Array.isArray(raw) ? (raw as string[]) : [];
    } catch {
      completedIds = null;
    }
    if (completedIds) {
      const unlocked =
        completedIds.includes(mod.id) ||
        getModulesBefore(mod.id, effectiveRs).every((m) =>
          completedIds!.includes(m.id)
        );
      if (!unlocked) redirect("/home");
    }
  }

  const isSenses = mod.id === "2.6";

  // Winding-down 4.1 routing (Phase 3): if they've settled how/when they'll leave
  // (captured in the wind-down module), 4.1 becomes an anticipatory reflection
  // with no readiness widget; otherwise it's the readiness widget re-anchored to
  // completing the exit they've already begun. Null for everyone else — 4.1 is
  // unchanged.
  let windDown: ReturnType<typeof windDownFourOne> | null = null;
  if (effectiveRs === "winding_down" && mod.id === "4.1" && userId) {
    let wdBuild: BuildResult | null = null;
    try {
      const raw = await getUserData(userId, "interaction:1.winddown");
      if (raw && typeof raw === "object" && "type" in (raw as object)) {
        wdBuild = raw as BuildResult;
      }
    } catch {
      wdBuild = null;
    }
    windDown = windDownFourOne(windDownDecided(wdBuild), mod.interaction);
  }

  // Retired letter (Phase 4): the letter reflects on retirement so far and then
  // leads into a keep/change/leave conversation. Supplies a reframed primer and
  // writing prompt, plus the coachOpening/sessionInstructions that turn the
  // letter into a conversation (the presence of sessionInstructions is what
  // SessionContainer keys off). Null for everyone else — the default letter,
  // which has no conversation, is untouched.
  const retiredLtr =
    isRetired(effectiveRs) && mod.id === "1.letter" ? retiredLetter() : null;

  // Tailor the user- and Vita-facing copy for this person's retirement stage.
  // tailorCopy is a no-op when the flag is off, the stage is unset, or they're
  // still working — so those paths render the original strings unchanged. The
  // wind-down 4.1 variants (when present) fully replace 4.1's copy and
  // interaction, so they bypass tailorCopy.
  const sessionDescription = windDown
    ? windDown.description
    : tailorCopy(mod.description, retirementStage);
  const coachOpening = retiredLtr
    ? retiredLtr.coachOpening
    : windDown
      ? windDown.coachOpening
      : mod.coachOpening !== undefined
        ? tailorCopy(mod.coachOpening, retirementStage)
        : undefined;
  const primer = retiredLtr
    ? retiredLtr.primer
    : windDown
      ? windDown.primer
      : mod.primer.map((block) =>
          block.type === "text"
            ? { ...block, value: tailorCopy(block.value, retirementStage) }
            : block
        );
  const interaction = windDown ? windDown.interaction : mod.interaction;
  const sessionInstructions = isSenses
    ? sensesSessionInstructions(horizon, age)
    : retiredLtr
      ? retiredLtr.sessionInstructions
      : windDown
        ? windDown.sessionInstructions
        : mod.sessionInstructions !== undefined
          ? tailorCopy(mod.sessionInstructions, retirementStage)
          : undefined;
  // The reframed writing prompt for the retired letter surface (undefined
  // otherwise, so LetterFlow keeps its default placeholder).
  const letterWritingPlaceholder = retiredLtr?.writingPlaceholder;
  const closingCommitment = isSenses
    ? sensesClosingCommitment(horizon, age)
    : mod.closingCommitment;

  // The next module in this stage, if there is one — offered as a secondary
  // action on completion, alongside returning to the hub. Null on the last
  // module in the stage, where only "Back to home" shows.
  const nextId = getNextModule(mod.id, effectiveRs);
  const nextHref = nextId ? `/session/${nextId}` : null;
  // The next module's title, so Vita's closing can name it correctly instead of
  // guessing. Null on the last module of the stage.
  const nextModuleTitle = nextId
    ? (getModule(nextId, effectiveRs)?.module.title ?? null)
    : null;

  // The last module of a stage that has a stage-close reveal closes into it —
  // offered as the primary completion action so the reveal is reached on purpose
  // rather than stumbled on later from the hub. Stages 1–3 (Imagine, Explore,
  // Understand) close into their /stage reveal; Stage 4 (Plan) closes into the
  // finished Retirement Life Plan document at /plan.
  const revealHref = !nextId
    ? stageNumber === 4
      ? "/plan"
      : stageNumber === 1 || stageNumber === 2 || stageNumber === 3
        ? `/stage/${stageNumber}`
        : null
    : null;
  // The wording on that primary CTA. Stages 1–3 lead into a named "reveal";
  // Stage 4 leads into the plan itself, which isn't a reveal.
  const revealLabel =
    revealHref === null
      ? null
      : stageNumber === 4
        ? "See your Retirement Life Plan →"
        : `See your ${stageName} reveal →`;

  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg-alt)" }}>
      {/* Desktop back/reset row. Hidden on mobile (≤880px), where the unified
          MobileAppBar carries the back control instead. */}
      <div className="session-nav-bar">
        <ModulesBackLink sessionId={mod.id} />
        <ResetModuleLink sessionId={mod.id} />
      </div>

      <SessionContainer
        sessionId={mod.id}
        stageNumber={stageNumber}
        totalStages={totalStages}
        stageName={stageName}
        modulesInStage={modulesInStage}
        stageModuleIds={stageModuleIds}
        nextHref={nextHref}
        nextModuleTitle={nextModuleTitle}
        revealHref={revealHref}
        revealLabel={revealLabel}
        sessionTitle={titleFor(mod, effectiveRs)}
        sessionDescription={sessionDescription}
        durationMin={mod.durationMin}
        primer={primer}
        coachOpening={coachOpening}
        sessionInstructions={sessionInstructions}
        interaction={interaction}
        letterWritingPlaceholder={letterWritingPlaceholder}
        closingCommitment={closingCommitment}
        closeInOneStep={mod.closeInOneStep ?? false}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  notFoundPage: {
    minHeight: "100dvh",
    background: "var(--bg-alt)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
  },
  notFoundText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 600,
    color: "var(--ink)",
  },
};
