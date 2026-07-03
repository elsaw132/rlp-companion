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
  const found = getModule(id);

  if (!found) {
    return (
      <main style={styles.notFoundPage}>
        <p style={styles.notFoundText}>Module not found</p>
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
  // error never locks a legitimate user out of their next module.
  const { userId } = await auth();
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
        getModulesBefore(mod.id).every((m) => completedIds!.includes(m.id));
      if (!unlocked) redirect("/home");
    }
  }

  // The senses module (2.6) age-gates its hearing-check recommendation on the
  // person's retirement horizon — the only age signal we capture at onboarding.
  // Read it here so the conversation guidance and the closing plan step can be
  // tailored before they reach the client. Any miss (no data, a DB hiccup) falls
  // back to withholding the hearing nudge rather than showing it to everyone.
  // One onboarding read serves two needs: the senses hearing gate (horizon/age)
  // and — behind the RETIREMENT_PATHS flag — the person's retirementStage, which
  // tailors this module's copy per cohort (Phase 2 sweep). With the flag off and
  // a non-senses module we skip the read entirely, so the copy passes through
  // untouched and byte-identical to today.
  const isSenses = mod.id === "2.6";
  let horizon: string | null = null;
  let age: number | null = null;
  let retirementStage: RetirementStage | null = null;
  if ((isSenses || RETIREMENT_PATHS) && userId) {
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

  // Tailor the user- and Vita-facing copy for this person's retirement stage.
  // tailorCopy is a no-op when the flag is off, the stage is unset, or they're
  // still working — so those paths render the original strings unchanged.
  const sessionDescription = tailorCopy(mod.description, retirementStage);
  const coachOpening =
    mod.coachOpening !== undefined
      ? tailorCopy(mod.coachOpening, retirementStage)
      : undefined;
  const primer = mod.primer.map((block) =>
    block.type === "text"
      ? { ...block, value: tailorCopy(block.value, retirementStage) }
      : block
  );
  const sessionInstructions = isSenses
    ? sensesSessionInstructions(horizon, age)
    : mod.sessionInstructions !== undefined
      ? tailorCopy(mod.sessionInstructions, retirementStage)
      : undefined;
  const closingCommitment = isSenses
    ? sensesClosingCommitment(horizon, age)
    : mod.closingCommitment;

  // The next module in this stage, if there is one — offered as a secondary
  // action on completion, alongside returning to the hub. Null on the last
  // module in the stage, where only "Back to home" shows.
  const nextId = getNextModule(mod.id);
  const nextHref = nextId ? `/session/${nextId}` : null;
  // The next module's title, so Vita's closing can name it correctly instead of
  // guessing. Null on the last module of the stage.
  const nextModuleTitle = nextId ? (getModule(nextId)?.module.title ?? null) : null;

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
    <main style={{ minHeight: "100vh", background: "var(--bg-alt)" }}>
      <div style={styles.navBar}>
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
        sessionTitle={mod.title}
        sessionDescription={sessionDescription}
        durationMin={mod.durationMin}
        primer={primer}
        coachOpening={coachOpening}
        sessionInstructions={sessionInstructions}
        interaction={mod.interaction}
        closingCommitment={closingCommitment}
        closeInOneStep={mod.closeInOneStep ?? false}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  navBar: {
    width: "100%",
    maxWidth: "var(--content-max)",
    margin: "0 auto",
    padding: "20px 24px 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  notFoundPage: {
    minHeight: "100vh",
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
