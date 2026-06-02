import { ResetAllDataLink } from "../components/ResetControls";

export default function HomePage() {
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
      <div style={{ padding: "40px 48px" }}>
        <button
          style={{
            background: "var(--brand-primary)",
            color: "var(--brand-on-primary)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--fs-body)",
            fontWeight: 600,
            border: "none",
            borderRadius: "var(--r-sm)",
            padding: "12px 28px",
            cursor: "pointer",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          Continue →
        </button>

        <div style={{ marginTop: "32px" }}>
          <ResetAllDataLink />
        </div>
      </div>
    </div>
  );
}
