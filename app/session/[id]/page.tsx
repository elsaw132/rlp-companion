import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import SessionContainer from "../../components/SessionContainer";
import { ResetModuleLink } from "../../components/ResetControls";
import { ModulesBackLink } from "../../components/ModulesBackLink";
import { getModule, getNextModule, getModulesBefore } from "@/lib/modules";
import { getUserData } from "@/lib/db";

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
        sessionDescription={mod.description}
        durationMin={mod.durationMin}
        primer={mod.primer}
        coachOpening={mod.coachOpening}
        sessionInstructions={mod.sessionInstructions}
        interaction={mod.interaction}
        closingCommitment={mod.closingCommitment}
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
