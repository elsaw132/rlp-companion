import SessionContainer from "../../components/SessionContainer";
import { ResetModuleLink } from "../../components/ResetControls";
import { ModulesBackLink } from "../../components/ModulesBackLink";
import { getModule, getNextModule } from "@/lib/modules";

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

  // The next module in this stage, if there is one — offered as a secondary
  // action on completion, alongside returning to the hub. Null on the last
  // module in the stage, where only "Back to home" shows.
  const nextId = getNextModule(mod.id);
  const nextHref = nextId ? `/session/${nextId}` : null;
  // The next module's title, so Vita's closing can name it correctly instead of
  // guessing. Null on the last module of the stage.
  const nextModuleTitle = nextId ? (getModule(nextId)?.module.title ?? null) : null;

  // The last module of the Imagine stage (stage 1) closes into its reveal —
  // offered as the primary completion action so the reveal is reached on
  // purpose rather than stumbled on later from the hub.
  const revealHref = !nextId && stageNumber === 1 ? "/stage/1" : null;

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
