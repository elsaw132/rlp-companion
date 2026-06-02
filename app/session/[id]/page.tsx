import SessionContainer from "../../components/SessionContainer";
import { getModule } from "@/lib/modules";

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

  const { module: mod, stageNumber, stageName, totalStages, modulesInStage } =
    found;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-alt)" }}>
      <SessionContainer
        sessionId={mod.id}
        stageNumber={stageNumber}
        totalStages={totalStages}
        stageName={stageName}
        modulesInStage={modulesInStage}
        modulesCompleted={0}
        sessionTitle={mod.title}
        sessionDescription={mod.description}
        durationMin={mod.durationMin}
        contentType={mod.contentType}
        contentValue={mod.contentValue}
        coachOpening={mod.coachOpening}
        sessionInstructions={mod.sessionInstructions}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
