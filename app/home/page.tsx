import { ResetAllDataLink } from "../components/ResetControls";
import StageModules from "../components/StageModules";
import { STAGES, TOTAL_STAGES } from "@/lib/modules";

export default function HomePage() {
  const stage = STAGES[0];
  const modules = stage.modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    durationMin: m.durationMin,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-alt)" }}>
      {/* Dark navy header bar */}
      <div
        style={{
          background: "var(--ink)",
          padding: "32px 48px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--fs-display)",
            color: "#fff",
            margin: 0,
            fontWeight: 400,
          }}
        >
          Good morning, Elsa
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: "var(--content-max)",
          margin: "0 auto",
          padding: "40px 24px",
        }}
      >
        <StageModules
          stageNumber={stage.number}
          stageName={stage.name}
          totalStages={TOTAL_STAGES}
          modules={modules}
        />

        <div style={{ marginTop: "32px" }}>
          <ResetAllDataLink />
        </div>
      </div>
    </div>
  );
}
