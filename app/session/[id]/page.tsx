import Link from "next/link";
import SessionContainer from "../../components/SessionContainer";
import { ResetModuleLink } from "../../components/ResetControls";
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

  const { module: mod, stageNumber, stageName, totalStages, modulesInStage } =
    found;

  // Next module in this stage, or back to the dashboard if this is the last one.
  const nextId = getNextModule(mod.id);
  const nextHref = nextId ? `/session/${nextId}` : "/home";

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-alt)" }}>
      <style>{navCss}</style>

      <div style={styles.navBar}>
        <Link href="/home" className="ghost-link" style={styles.ghostLink}>
          ← Your modules
        </Link>
        <ResetModuleLink sessionId={mod.id} />
      </div>

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

      <div style={{ ...styles.navBar, ...styles.navBarBottom }}>
        <Link href={nextHref} className="ghost-link" style={styles.ghostLink}>
          Next module →
        </Link>
      </div>
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
  navBarBottom: {
    paddingTop: "0",
    paddingBottom: "48px",
    justifyContent: "flex-end",
  },
  ghostLink: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    textDecoration: "none",
    padding: "8px 4px",
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

const navCss = `
  .ghost-link:hover { text-decoration: underline; }
  .ghost-link:focus-visible {
    outline: none;
    border-radius: var(--r-sm);
    box-shadow: var(--focus-ring);
  }
`;
