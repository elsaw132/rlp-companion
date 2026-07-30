"use client";

// Module 4.3 (rework) — the opt-in "commit to your goals" surface.
//
// Presentational and self-contained: it is handed the DRAFTED goals (each with its
// provenance `source`) and two callbacks — one to fetch a goal's gentler/bolder
// sizes on demand, one to finish with the committed set. It owns no data fetching,
// so the real screen and the /preview page are both thin wrappers and the
// interaction can be driven and verified in isolation.

import { useState, type CSSProperties } from "react";
import type { GoalSuggestion, GoalVariant } from "@/lib/balancedGoalsSeed";

type Level = "quieter" | "original" | "bolder";
const ORDER: Level[] = ["quieter", "original", "bolder"];

// One goal the person has committed to — what the wrapper turns into a result row.
export type CommittedGoal = {
  label: string;
  cadence?: string;
  area: string;
  source?: string;
};

// Stage-aware copy, derived by the wrapper from retirement stage + horizon.
export type GoalsFraming = {
  title: string;
  intro: string;
  timeframe: string; // e.g. "This year" / "Year one"
  timeframeMake: string; // e.g. "this year" / "in your first year"
};

type Row = {
  id: string;
  source?: string;
  area: string;
  own: boolean;
  committed: boolean;
  level: Level;
  custom: string | null;
  editing: boolean;
  loadingVariants: boolean;
  variantsLoaded: boolean;
  variants: Partial<Record<Level, GoalVariant>> & { original: GoalVariant };
};

function toRow(g: GoalSuggestion, i: number): Row {
  return {
    id: `g${i}`,
    source: g.source,
    area: g.area,
    own: false,
    committed: false,
    level: "original",
    custom: null,
    editing: false,
    loadingVariants: false,
    variantsLoaded: !!(g.bolder && g.quieter),
    variants: {
      original: g.original,
      ...(g.bolder ? { bolder: g.bolder } : {}),
      ...(g.quieter ? { quieter: g.quieter } : {}),
    },
  };
}

function activeText(r: Row): string {
  return r.custom ?? (r.variants[r.level]?.label ?? r.variants.original.label);
}
function activeCadence(r: Row): string | undefined {
  if (r.custom != null) return r.variants.original.cadence;
  return (r.variants[r.level] ?? r.variants.original).cadence;
}
function provenance(r: Row): string {
  return r.own ? "Added by you" : `You mentioned ${r.source ?? "this"}`;
}

type Props = {
  goals: GoalSuggestion[];
  framing: GoalsFraming;
  labels: { finish: string; cancel?: string };
  mode?: "create" | "edit";
  onFetchVariants: (goal: {
    label: string;
    cadence?: string;
    source?: string;
  }) => Promise<{ bolder?: GoalVariant; quieter?: GoalVariant }>;
  onFinish: (committed: CommittedGoal[]) => void;
  onCancel?: () => void;
};

export default function GoalsCommit({
  goals,
  framing,
  labels,
  mode = "create",
  onFetchVariants,
  onFinish,
  onCancel,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    goals.map((g, i) => ({ ...toRow(g, i), committed: mode === "edit" }))
  );
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const nextId = useState(() => ({ n: 0 }))[0];

  const committedCount = rows.filter((r) => r.committed).length;

  const patch = (id: string, fn: (r: Row) => Row) =>
    setRows((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));

  function toggle(id: string) {
    patch(id, (r) => (r.editing ? r : { ...r, committed: !r.committed }));
  }
  function startEdit(id: string) {
    patch(id, (r) => ({ ...r, editing: true }));
  }
  function saveEdit(id: string, value: string) {
    patch(id, (r) => ({
      ...r,
      editing: false,
      custom: value.trim() || activeText(r),
    }));
  }
  // Step the ambition dial. The gentler/bolder sizes are fetched on first use.
  async function dial(id: string, dir: -1 | 1) {
    const r = rows.find((x) => x.id === id);
    if (!r || r.custom != null) return;
    if (!r.variantsLoaded && !r.loadingVariants) {
      patch(id, (x) => ({ ...x, loadingVariants: true }));
      const v = await onFetchVariants({
        label: r.variants.original.label,
        cadence: r.variants.original.cadence,
        source: r.source,
      });
      setRows((prev) =>
        prev.map((x) => {
          if (x.id !== id) return x;
          const variants = {
            ...x.variants,
            ...(v.bolder ? { bolder: v.bolder } : {}),
            ...(v.quieter ? { quieter: v.quieter } : {}),
          };
          const target = stepTo(x.level, dir, variants);
          return { ...x, variants, variantsLoaded: true, loadingVariants: false, level: target };
        })
      );
      return;
    }
    patch(id, (x) => ({ ...x, level: stepTo(x.level, dir, x.variants) }));
  }
  function addOwn() {
    const v = addText.trim();
    if (!v) return;
    setRows((prev) => [
      ...prev,
      {
        id: `own-${nextId.n++}`,
        area: "Your own",
        own: true,
        committed: true,
        level: "original",
        custom: v,
        editing: false,
        loadingVariants: false,
        variantsLoaded: true,
        variants: { original: { track: "do", label: v } },
      },
    ]);
    setAddText("");
    setAddOpen(false);
  }

  function finish() {
    const committed: CommittedGoal[] = rows
      .filter((r) => r.committed && activeText(r).trim())
      .map((r) => ({
        label: activeText(r).trim(),
        ...(activeCadence(r)?.trim() ? { cadence: activeCadence(r)!.trim() } : {}),
        area: r.area.trim() || "Goals",
        ...(r.source ? { source: r.source } : {}),
      }));
    onFinish(committed);
  }

  const ok = committedCount > 0;

  return (
    <section style={s.wrap}>
      <h2 style={s.title}>
        {framing.title} <span style={s.pill}>{framing.timeframe}</span>
      </h2>
      <p style={s.intro}>{framing.intro}</p>

      <div style={s.list}>
        {rows.map((r) => {
          const canGentler = r.custom == null && stepTo(r.level, -1, r.variants) !== r.level;
          const canBolder =
            r.custom == null &&
            (!r.variantsLoaded || stepTo(r.level, 1, r.variants) !== r.level);
          return (
            <div
              key={r.id}
              style={{ ...s.card, ...(r.committed ? s.cardOn : null) }}
              onClick={() => toggle(r.id)}
            >
              <div style={{ ...s.tick, ...(r.committed ? s.tickOn : null) }} aria-hidden>
                {r.committed ? "✓" : ""}
              </div>
              <div style={s.body}>
                <div style={s.goalRow}>
                  {r.editing ? (
                    <input
                      autoFocus
                      defaultValue={activeText(r)}
                      style={s.editInput}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => saveEdit(r.id, e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(r.id, e.currentTarget.value);
                      }}
                    />
                  ) : (
                    <p style={s.goal}>{activeText(r)}</p>
                  )}
                  <button
                    type="button"
                    style={s.editBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(r.id);
                    }}
                  >
                    ✎ Edit
                  </button>
                </div>
                <div style={s.prov}>{provenance(r)}</div>
                {r.committed && (
                  <div style={s.adjust} onClick={(e) => e.stopPropagation()}>
                    <span style={s.cap}>Make it</span>
                    <span style={s.steps}>
                      <button
                        type="button"
                        style={s.stepBtn}
                        disabled={!canGentler}
                        onClick={() => dial(r.id, -1)}
                      >
                        ← Gentler
                      </button>
                      <span style={s.mid}>
                        {r.loadingVariants
                          ? "…"
                          : r.custom != null
                            ? "your words"
                            : r.level === "quieter"
                              ? "gentler"
                              : r.level === "bolder"
                                ? "bolder"
                                : "as drafted"}
                      </span>
                      <button
                        type="button"
                        style={s.stepBtn}
                        disabled={!canBolder}
                        onClick={() => dial(r.id, 1)}
                      >
                        Bolder →
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {addOpen ? (
        <div style={s.addRow}>
          <input
            autoFocus
            value={addText}
            placeholder="What exactly will you do?"
            style={s.editInput}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addOwn();
            }}
          />
          <button type="button" style={s.addSave} onClick={addOwn}>
            Add
          </button>
        </div>
      ) : (
        <button type="button" style={s.addBtn} onClick={() => setAddOpen(true)}>
          + Add a goal of your own
        </button>
      )}

      <p style={s.footnote}>
        Not everything needs to be a goal. The rest of your life carries on just as it
        is.
      </p>

      <div style={s.foot}>
        <span style={s.status}>
          {ok
            ? `${committedCount} goal${committedCount > 1 ? "s" : ""} committed for ${framing.timeframe.toLowerCase()}`
            : "Choose at least one goal to carry on."}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          {mode === "edit" && onCancel && (
            <button type="button" style={s.cancelBtn} onClick={onCancel}>
              {labels.cancel ?? "Cancel"}
            </button>
          )}
          <button type="button" style={{ ...s.cta, ...(ok ? null : s.ctaOff) }} disabled={!ok} onClick={finish}>
            {labels.finish}
          </button>
        </div>
      </div>
    </section>
  );
}

// Move one notch in `dir`, skipping any size the draft didn't supply; unknown
// (not-yet-loaded) sizes are treated as reachable so the first tap triggers a fetch.
function stepTo(level: Level, dir: -1 | 1, variants: Partial<Record<Level, GoalVariant>>): Level {
  const i = ORDER.indexOf(level);
  for (let j = i + dir; j >= 0 && j < ORDER.length; j += dir) {
    if (variants[ORDER[j]]) return ORDER[j];
  }
  return level;
}

const s: Record<string, CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column" },
  title: {
    fontFamily: "var(--font-serif)",
    fontWeight: 500,
    fontSize: "var(--fs-h2, 27px)",
    color: "var(--ink)",
    margin: "0 0 10px",
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--brand-primary)",
    background: "var(--info-surface, #E7F3F1)",
    border: "1px solid var(--info-line, #CDE6E2)",
    borderRadius: 999,
    padding: "3px 10px",
    position: "relative",
    top: -3,
  },
  intro: { fontSize: 15.5, lineHeight: 1.55, color: "var(--text-muted)", margin: "0 0 20px", maxWidth: "60ch" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: {
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "var(--bg, #fff)",
    padding: "13px 15px",
    display: "flex",
    gap: 13,
    cursor: "pointer",
  },
  cardOn: { borderColor: "var(--brand-primary)", background: "var(--info-surface, #F6FBFA)" },
  tick: {
    flex: "0 0 22px",
    height: 22,
    borderRadius: 7,
    border: "2px solid var(--border)",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    color: "#fff",
    fontSize: 13,
  },
  tickOn: { background: "var(--brand-primary)", borderColor: "var(--brand-primary)" },
  body: { flex: 1, minWidth: 0 },
  goalRow: { display: "flex", alignItems: "flex-start", gap: 10 },
  goal: { fontSize: 16, lineHeight: 1.4, fontWeight: 500, margin: 0, flex: 1, color: "var(--ink)" },
  editBtn: {
    flex: "0 0 auto",
    border: "1px solid var(--border)",
    background: "#fff",
    color: "var(--text-muted)",
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    cursor: "pointer",
    borderRadius: 999,
    padding: "4px 10px",
    marginTop: 1,
  },
  prov: { fontSize: 12.5, color: "var(--text-muted)", margin: "5px 0 0", fontStyle: "italic" },
  editInput: {
    flex: 1,
    border: "1px solid var(--brand-primary)",
    borderRadius: 9,
    padding: "9px 11px",
    fontFamily: "var(--font-sans)",
    fontSize: 15,
    color: "var(--ink)",
  },
  adjust: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 11,
    paddingTop: 11,
    borderTop: "1px solid var(--border)",
  },
  cap: { fontSize: 12, color: "var(--text-muted)" },
  steps: { display: "inline-flex", border: "1px solid var(--border)", borderRadius: 999, overflow: "hidden", background: "#fff" },
  stepBtn: {
    border: 0,
    background: "#fff",
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    color: "var(--brand-primary)",
    padding: "5px 11px",
    cursor: "pointer",
  },
  mid: { borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 11, padding: "5px 10px" },
  addBtn: {
    marginTop: 12,
    border: "1px dashed var(--border)",
    background: "#fff",
    color: "var(--brand-primary)",
    borderRadius: 12,
    padding: 12,
    width: "100%",
    fontFamily: "var(--font-sans)",
    fontSize: 14.5,
    cursor: "pointer",
  },
  addRow: { display: "flex", gap: 8, marginTop: 12 },
  addSave: { border: 0, background: "var(--brand-primary)", color: "var(--brand-on-primary, #fff)", borderRadius: 9, padding: "0 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  footnote: { fontSize: 12.5, color: "var(--text-muted)", margin: "16px 0 0", lineHeight: 1.5 },
  foot: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 22, flexWrap: "wrap" },
  status: { fontSize: 13, color: "var(--text-muted)" },
  cta: { border: 0, background: "var(--brand-primary)", color: "var(--brand-on-primary, #fff)", fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 15, padding: "11px 20px", borderRadius: 12, cursor: "pointer" },
  ctaOff: { background: "var(--border)", cursor: "default" },
  cancelBtn: { border: "1px solid var(--border)", background: "#fff", color: "var(--text-muted)", borderRadius: 12, padding: "11px 16px", fontSize: 14, cursor: "pointer" },
};
