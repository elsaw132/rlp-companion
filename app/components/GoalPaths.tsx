"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  BalancedGoalsResult,
  GoalPathsInteraction,
  GoalPathsResult,
} from "@/lib/modules";
import {
  fetchGoalPathsDraft,
  seedFromResult,
  spotlightGoalInputs,
  type GoalPath,
} from "@/lib/goalPathsSeed";
import { useUserData } from "@/lib/userData";
import { DraftFailed } from "./DraftFailed";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

type Track = "do" | "be";

// One stepping stone in the editor — same shape as a saved milestone plus a
// stable id so reordering and removal never confuse React.
type Stone = { id: string; label: string; when?: string; done: boolean };

// One support line in the editor (used for be-goals) — a string with an id.
type Support = { id: string; label: string };

// One path on the curation surface. do-goals carry `stones`; be-goals carry
// `alreadyHelps` / `wouldHelp`. Both may carry `lean`.
type Path = {
  id: string;
  goal: string;
  track: Track;
  stones: Stone[];
  alreadyHelps: Support[];
  wouldHelp: Support[];
  // The person's own named strengths that most fit this goal — shown as tags.
  strengths: string[];
};

// The coach-facing summary — each path with the route already walked called out,
// so Vita can open by noticing how much is behind them. do-goals list their
// stones (with the done ones marked); be-goals list what helps and what would.
export function goalPathsSummaryText(result: GoalPathsResult): string {
  const label = result.summaryLabel ?? "The path to your goals";
  const lines = result.paths.map((p) => {
    if (p.track === "be") {
      const helps = (p.alreadyHelps ?? []).join(", ");
      const would = (p.wouldHelp ?? []).join(", ");
      const strengths = (p.strengths ?? []).join(", ");
      const bits = [
        helps && `already helps: ${helps}`,
        would && `would help it take root: ${would}`,
        strengths && `strengths to lean on: ${strengths}`,
      ]
        .filter(Boolean)
        .join("; ");
      return `${p.goal} (a way to live — ${bits || "a light note, no ladder"})`;
    }
    const stones = p.milestones ?? [];
    const done = stones.filter((m) => m.done);
    const remaining = stones.filter((m) => !m.done);
    const stoneText = stones
      .map((m) => `${m.done ? "✓ " : ""}${m.label}${m.when ? ` (${m.when})` : ""}`)
      .join(" → ");
    const strengths = (p.strengths ?? []).length
      ? `; strengths to lean on: ${(p.strengths ?? []).join(", ")}`
      : "";
    return `${p.goal} (a thing to do — ${done.length} of ${stones.length} stepping stones already behind them, ${remaining.length} to go: ${stoneText}${strengths})`;
  });
  return `${label}. ${lines.join(" ")}`;
}

function pathsFromSeed(paths: GoalPath[]): Path[] {
  return paths.map((p, i) => ({
    id: `p${i}`,
    goal: p.goal,
    track: p.track === "be" ? "be" : "do",
    stones: (p.milestones ?? []).map((m, j) => ({
      id: `p${i}-s${j}`,
      label: m.label,
      ...(m.when ? { when: m.when } : {}),
      done: m.done === true,
    })),
    alreadyHelps: (p.alreadyHelps ?? []).map((s, j) => ({
      id: `p${i}-a${j}`,
      label: s,
    })),
    wouldHelp: (p.wouldHelp ?? []).map((s, j) => ({
      id: `p${i}-w${j}`,
      label: s,
    })),
    strengths: p.strengths ?? [],
  }));
}

type GoalPathsProps = {
  interaction: GoalPathsInteraction;
  sessionId: string;
  // The rendered user-model block and onboarding line, the rich input for the
  // draft. hasPartner filters partner-only framing.
  userModelText: string;
  onboardingContext: string;
  hasPartner: boolean;
  // The person's named strengths (from their Stage-3 list), for the "strengths to
  // lean on" tags on each path.
  strengths: string[];
  onFinish: (result: GoalPathsResult) => void;
} & EditableProps<GoalPathsResult>;

export default function GoalPaths({
  interaction,
  sessionId,
  userModelText,
  onboardingContext,
  hasPartner,
  strengths,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: GoalPathsProps) {
  const {
    draftingLabel,
    curationInstruction,
    ladderLabel,
    whenLabel,
    whenPlaceholder,
    doneLabel,
    addStepLabel,
    addStepPlaceholder,
    alreadyHelpsLabel,
    wouldHelpLabel,
    addSupportPlaceholder,
    boundaryHint,
    summaryLabel,
  } = interaction;

  const userData = useUserData();

  // The goals to draw a path for come straight from 4.3's spotlight, in rank
  // order. Read once; the list is fixed for this run.
  const goalInputsRef = useRef(
    spotlightGoalInputs(
      (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
    )
  );
  const goalInputs = goalInputsRef.current;

  // Editing reopens straight onto the curation view from the saved paths; a
  // fresh run uses any cached draft, or fetches one (the "loading" phase).
  const cachedSeed = initial ? null : userData.getGoalPathSeed(sessionId);

  const [phase, setPhase] = useState<"loading" | "curate" | "failed">(
    initial || cachedSeed ? "curate" : "loading"
  );

  const [paths, setPaths] = useState<Path[]>(() => {
    if (initial) return pathsFromSeed(seedFromResult(initial).paths);
    if (cachedSeed) return pathsFromSeed(cachedSeed.paths);
    return [];
  });

  // Draft the paths once, the first time a fresh run has no cached draft.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (phase !== "loading" || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      // A prefetch started during the intro may have already landed in the cache.
      const cached = userData.getGoalPathSeed(sessionId);
      const draft =
        cached ??
        (await fetchGoalPathsDraft({
          userModel: userModelText,
          onboarding: onboardingContext,
          hasPartner,
          retirementStage: userData.getRetirementStage(),
          goals: goalInputs,
          strengths,
        }));
      if (cancelled) return;
      if (!draft) {
        setPhase("failed");
        return;
      }
      if (!cached) void userData.saveGoalPathSeed(sessionId, draft);
      setPaths(pathsFromSeed(draft.paths));
      setPhase("curate");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Monotonic counters for ids of stones/supports the person adds. Refs so they
  // survive re-renders and never collide with the drafted ids.
  const nextIdRef = useRef(0);
  const makeId = (kind: string) => `${kind}-added-${nextIdRef.current++}`;


  // ---- stone editing (do-goals) ----
  function updateStone(pid: string, sid: string, patch: Partial<Stone>) {
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pid
          ? {
              ...p,
              stones: p.stones.map((s) =>
                s.id === sid ? { ...s, ...patch } : s
              ),
            }
          : p
      )
    );
  }
  function moveStone(pid: string, index: number, dir: -1 | 1) {
    setPaths((prev) =>
      prev.map((p) => {
        if (p.id !== pid) return p;
        const next = [...p.stones];
        const target = index + dir;
        if (target < 0 || target >= next.length) return p;
        [next[index], next[target]] = [next[target], next[index]];
        return { ...p, stones: next };
      })
    );
  }
  function removeStone(pid: string, sid: string) {
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, stones: p.stones.filter((s) => s.id !== sid) }
          : p
      )
    );
  }
  function addStone(pid: string) {
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pid
          ? {
              ...p,
              stones: [
                ...p.stones,
                { id: makeId("stone"), label: "", done: false },
              ],
            }
          : p
      )
    );
  }

  // ---- support editing (be-goals) ----
  function updateSupport(
    pid: string,
    field: "alreadyHelps" | "wouldHelp",
    sid: string,
    label: string
  ) {
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pid
          ? {
              ...p,
              [field]: p[field].map((s) =>
                s.id === sid ? { ...s, label } : s
              ),
            }
          : p
      )
    );
  }
  function removeSupport(
    pid: string,
    field: "alreadyHelps" | "wouldHelp",
    sid: string
  ) {
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, [field]: p[field].filter((s) => s.id !== sid) }
          : p
      )
    );
  }
  function addSupport(pid: string, field: "alreadyHelps" | "wouldHelp") {
    setPaths((prev) =>
      prev.map((p) =>
        p.id === pid
          ? { ...p, [field]: [...p[field], { id: makeId(field), label: "" }] }
          : p
      )
    );
  }

  function buildResultObject(): GoalPathsResult {
    return {
      type: "goal-paths",
      paths: paths.map((p) => {
        const strengths = p.strengths.map((s) => s.trim()).filter(Boolean);
        if (p.track === "be") {
          const alreadyHelps = p.alreadyHelps
            .map((s) => s.label.trim())
            .filter(Boolean);
          const wouldHelp = p.wouldHelp
            .map((s) => s.label.trim())
            .filter(Boolean);
          return {
            goal: p.goal,
            track: "be" as const,
            ...(alreadyHelps.length ? { alreadyHelps } : {}),
            ...(wouldHelp.length ? { wouldHelp } : {}),
            ...(strengths.length ? { strengths } : {}),
          };
        }
        const milestones = p.stones
          .filter((s) => s.label.trim())
          .map((s) => ({
            label: s.label.trim(),
            ...(s.when?.trim() ? { when: s.when.trim() } : {}),
            ...(s.done ? { done: true } : {}),
          }));
        return {
          goal: p.goal,
          track: "do" as const,
          ...(milestones.length ? { milestones } : {}),
          ...(strengths.length ? { strengths } : {}),
        };
      }),
      summaryLabel,
    };
  }

  if (phase === "failed") {
    return (
      <section style={styles.wrap}>
        <style>{pathCss}</style>
        <DraftFailed
          message="We couldn't sketch the paths for your goals just now. Your answers are all saved. Try again in a moment."
          onRetry={() => {
            fetchedRef.current = false;
            setPhase("loading");
          }}
        />
      </section>
    );
  }

  if (phase === "loading") {
    return (
      <section style={styles.wrap}>
        <style>{pathCss}</style>
        <div style={styles.draftCard}>
          <span style={styles.draftSun} aria-hidden="true">
            ☀️
          </span>
          <p style={styles.draftText}>{draftingLabel}</p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.wrap}>
      <style>{pathCss}</style>

      <p style={styles.instruction}>{curationInstruction}</p>

      <div style={styles.helperGroup}>
        <HelperLine>Tap a step to mark it done, or add your own.</HelperLine>
        <div style={styles.pathList}>
        {paths.map((path) => (
          <PathCard
            key={path.id}
            path={path}
            ladderLabel={ladderLabel}
            whenLabel={whenLabel}
            whenPlaceholder={whenPlaceholder}
            doneLabel={doneLabel}
            addStepLabel={addStepLabel}
            addStepPlaceholder={addStepPlaceholder}
            alreadyHelpsLabel={alreadyHelpsLabel}
            wouldHelpLabel={wouldHelpLabel}
            addSupportPlaceholder={addSupportPlaceholder}
            onUpdateStone={updateStone}
            onMoveStone={moveStone}
            onRemoveStone={removeStone}
            onAddStone={addStone}
            onUpdateSupport={updateSupport}
            onRemoveSupport={removeSupport}
            onAddSupport={addSupport}
          />
        ))}
        </div>
      </div>

      <p style={styles.boundaryHint}>{boundaryHint}</p>

      <FinishControls
        mode={mode}
        disabled={false}
        onFinish={() => onFinish(buildResultObject())}
        onCancel={onCancel}
      />
    </section>
  );
}

// ---- one goal's path on the curation surface ----
function PathCard({
  path,
  ladderLabel,
  whenLabel,
  whenPlaceholder,
  doneLabel,
  addStepLabel,
  addStepPlaceholder,
  alreadyHelpsLabel,
  wouldHelpLabel,
  addSupportPlaceholder,
  onUpdateStone,
  onMoveStone,
  onRemoveStone,
  onAddStone,
  onUpdateSupport,
  onRemoveSupport,
  onAddSupport,
}: {
  path: Path;
  ladderLabel: string;
  whenLabel: string;
  whenPlaceholder: string;
  doneLabel: string;
  addStepLabel: string;
  addStepPlaceholder: string;
  alreadyHelpsLabel: string;
  wouldHelpLabel: string;
  addSupportPlaceholder: string;
  onUpdateStone: (pid: string, sid: string, patch: Partial<Stone>) => void;
  onMoveStone: (pid: string, index: number, dir: -1 | 1) => void;
  onRemoveStone: (pid: string, sid: string) => void;
  onAddStone: (pid: string) => void;
  onUpdateSupport: (
    pid: string,
    field: "alreadyHelps" | "wouldHelp",
    sid: string,
    label: string
  ) => void;
  onRemoveSupport: (
    pid: string,
    field: "alreadyHelps" | "wouldHelp",
    sid: string
  ) => void;
  onAddSupport: (pid: string, field: "alreadyHelps" | "wouldHelp") => void;
}) {
  const doneCount = path.stones.filter((s) => s.done && s.label.trim()).length;
  const total = path.stones.filter((s) => s.label.trim()).length;

  return (
    <div style={styles.pathCard}>
      <div style={styles.pathHead}>
        <span style={styles.trackTag}>
          {path.track === "do" ? "A thing to do" : "A way to live"}
        </span>
        <h3 style={styles.goalTitle}>{path.goal}</h3>
        {path.track === "do" && total > 0 && (
          <p style={styles.progressLine}>
            {doneCount > 0
              ? `${doneCount} of ${total} already behind you`
              : `${total} stepping stones`}
          </p>
        )}
      </div>

      {path.track === "do" ? (
        <div style={styles.ladder}>
          <p style={styles.sectionLabel}>{ladderLabel}</p>
          {path.stones.map((stone, index) => (
            <StoneRow
              key={stone.id}
              stone={stone}
              index={index}
              count={path.stones.length}
              labelPlaceholder={addStepPlaceholder}
              whenLabel={whenLabel}
              whenPlaceholder={whenPlaceholder}
              doneLabel={doneLabel}
              onUpdate={(patch) => onUpdateStone(path.id, stone.id, patch)}
              onMove={(dir) => onMoveStone(path.id, index, dir)}
              onRemove={() => onRemoveStone(path.id, stone.id)}
            />
          ))}
          <button
            type="button"
            className="path-add"
            style={styles.addBtn}
            onClick={() => onAddStone(path.id)}
          >
            <span aria-hidden="true" style={styles.addPlus}>
              +
            </span>
            {addStepLabel}
          </button>
        </div>
      ) : (
        <div style={styles.supports}>
          <SupportList
            label={alreadyHelpsLabel}
            field="alreadyHelps"
            items={path.alreadyHelps}
            placeholder={addSupportPlaceholder}
            onUpdate={(sid, v) =>
              onUpdateSupport(path.id, "alreadyHelps", sid, v)
            }
            onRemove={(sid) => onRemoveSupport(path.id, "alreadyHelps", sid)}
            onAdd={() => onAddSupport(path.id, "alreadyHelps")}
          />
          <SupportList
            label={wouldHelpLabel}
            field="wouldHelp"
            items={path.wouldHelp}
            placeholder={addSupportPlaceholder}
            onUpdate={(sid, v) => onUpdateSupport(path.id, "wouldHelp", sid, v)}
            onRemove={(sid) => onRemoveSupport(path.id, "wouldHelp", sid)}
            onAdd={() => onAddSupport(path.id, "wouldHelp")}
          />
        </div>
      )}

      {path.strengths.length > 0 && (
        <div style={styles.strengthsField}>
          <span style={styles.subLabel}>Strengths to lean on</span>
          <div style={styles.strengthChips}>
            {path.strengths.map((s) => (
              <span key={s} style={styles.strengthChip}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- one stepping stone ----
function StoneRow({
  stone,
  index,
  count,
  labelPlaceholder,
  whenLabel,
  whenPlaceholder,
  doneLabel,
  onUpdate,
  onMove,
  onRemove,
}: {
  stone: Stone;
  index: number;
  count: number;
  labelPlaceholder: string;
  whenLabel: string;
  whenPlaceholder: string;
  doneLabel: string;
  onUpdate: (patch: Partial<Stone>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ ...styles.stoneRow, ...(stone.done ? styles.stoneDone : null) }}>
      <div style={styles.stoneMarker}>
        <span style={{ ...styles.stoneDot, ...(stone.done ? styles.stoneDotOn : null) }}>
          {stone.done ? "✓" : index + 1}
        </span>
        {index < count - 1 && <span style={styles.stoneLine} aria-hidden="true" />}
      </div>

      <div style={styles.stoneBody}>
        <AutoTextarea
          className="path-input"
          style={styles.stoneInput}
          minRows={1}
          value={stone.label}
          ariaLabel="Stepping stone"
          placeholder={labelPlaceholder}
          autoFocus={stone.label === ""}
          onChange={(val) => onUpdate({ label: val })}
        />

        <div style={styles.stoneMeta}>
          <div style={styles.whenField}>
            <label style={styles.metaLabel}>{whenLabel}</label>
            <AutoTextarea
              className="path-input"
              style={styles.whenInput}
              minRows={1}
              value={stone.when ?? ""}
              ariaLabel={whenLabel}
              placeholder={whenPlaceholder}
              onChange={(val) => onUpdate({ when: val })}
            />
          </div>

          <button
            type="button"
            className="path-done"
            style={{
              ...styles.doneBtn,
              ...(stone.done ? styles.doneBtnOn : null),
            }}
            aria-pressed={stone.done}
            onClick={() => onUpdate({ done: !stone.done })}
          >
            {stone.done ? "✓ " : ""}
            {doneLabel}
          </button>
        </div>

        <div style={styles.stoneActions}>
          <button
            type="button"
            className="path-arrow rlp-tap"
            style={styles.arrow}
            aria-label="Move step earlier"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="path-arrow rlp-tap"
            style={styles.arrow}
            aria-label="Move step later"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="path-remove rlp-tap"
            style={styles.removeBtn}
            aria-label="Remove step"
            onClick={onRemove}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- an editable list of short support lines (be-goals) ----
function SupportList({
  label,
  field,
  items,
  placeholder,
  onUpdate,
  onRemove,
  onAdd,
}: {
  label: string;
  field: "alreadyHelps" | "wouldHelp";
  items: Support[];
  placeholder: string;
  onUpdate: (sid: string, v: string) => void;
  onRemove: (sid: string) => void;
  onAdd: () => void;
}) {
  return (
    <div style={styles.supportGroup}>
      <p style={styles.sectionLabel}>{label}</p>
      {items.map((item) => (
        <div key={item.id} style={styles.supportRow}>
          <span
            aria-hidden="true"
            style={field === "alreadyHelps" ? styles.helpDot : styles.wouldDot}
          />
          <AutoTextarea
            className="path-input"
            style={styles.supportInput}
            minRows={1}
            value={item.label}
            ariaLabel={label}
            placeholder={placeholder}
            autoFocus={item.label === ""}
            onChange={(val) => onUpdate(item.id, val)}
          />
          <button
            type="button"
            className="path-remove rlp-tap"
            style={styles.removeBtn}
            aria-label="Remove"
            onClick={() => onRemove(item.id)}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="path-add"
        style={styles.addBtnSmall}
        onClick={onAdd}
      >
        <span aria-hidden="true" style={styles.addPlus}>
          +
        </span>
        Add
      </button>
    </div>
  );
}

// A textarea that grows to fit its content, so wrapped lines are never clipped.
function AutoTextarea({
  value,
  onChange,
  className,
  style,
  placeholder,
  ariaLabel,
  autoFocus,
  minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      style={{ ...style, overflow: "hidden", resize: "none" }}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  draftCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "32px 24px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    textAlign: "center",
  },
  draftSun: { fontSize: "28px" },
  draftText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },
  // Keep the helper line close above the path cards (tighter than the wrap's
  // 20px gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  pathList: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  pathCard: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
  },
  pathHead: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  trackTag: {
    alignSelf: "flex-start",
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--accent-strong)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  goalTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  progressLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    margin: "2px 0 0",
  },
  ladder: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },
  stoneRow: {
    display: "flex",
    gap: "12px",
  },
  stoneDone: {
    opacity: 0.85,
  },
  stoneMarker: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
  },
  stoneDot: {
    width: "26px",
    height: "26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "var(--muted-surface)",
    color: "var(--text-muted)",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    fontWeight: 700,
  },
  stoneDotOn: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
  },
  stoneLine: {
    flex: 1,
    width: "2px",
    minHeight: "16px",
    marginTop: "4px",
    background: "var(--border)",
  },
  stoneBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingBottom: "8px",
  },
  stoneInput: {
    width: "100%",
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  stoneMeta: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  whenField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: "1 1 160px",
  },
  metaLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  whenInput: {
    width: "100%",
    padding: "7px 10px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  doneBtn: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "7px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text)",
    cursor: "pointer",
  },
  doneBtnOn: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
  },
  stoneActions: {
    display: "flex",
    gap: "4px",
  },
  arrow: {
    width: "32px",
    height: "32px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    cursor: "pointer",
  },
  removeBtn: {
    flexShrink: 0,
    width: "34px",
    height: "34px",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  addBtn: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    background: "var(--bg)",
    border: "1px dashed var(--brand-primary)",
    borderRadius: "var(--r-pill)",
    padding: "8px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    cursor: "pointer",
  },
  addBtnSmall: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    background: "var(--bg)",
    border: "1px dashed var(--brand-primary)",
    borderRadius: "var(--r-pill)",
    padding: "5px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    cursor: "pointer",
  },
  addPlus: {
    fontWeight: 700,
    color: "var(--brand-primary)",
  },
  supports: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  supportGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  supportRow: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  helpDot: {
    flexShrink: 0,
    width: "10px",
    height: "10px",
    marginTop: "14px",
    borderRadius: "50%",
    background: "var(--brand-primary)",
  },
  wouldDot: {
    flexShrink: 0,
    width: "10px",
    height: "10px",
    marginTop: "14px",
    borderRadius: "50%",
    background: "var(--accent-strong)",
  },
  supportInput: {
    flex: 1,
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  strengthsField: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingTop: "14px",
    borderTop: "1px solid var(--border)",
  },
  strengthChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  strengthChip: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    borderRadius: "var(--r-pill)",
    padding: "5px 12px",
  },
  subLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  fieldInput: {
    width: "100%",
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  boundaryHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--ink)",
    background: "var(--warm-surface)",
    borderRadius: "var(--r-sm)",
    padding: "12px 16px",
    margin: 0,
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation — each goal's path, with the stones already walked marked. The
// neutral card wrapper is the caller's.
export function GoalPathsSummary({ result }: { result: GoalPathsResult }) {
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel}</p>
      <div style={summaryStyles.paths}>
        {result.paths.map((p) => (
          <div key={p.goal} style={summaryStyles.pathRow}>
            <p style={summaryStyles.goalLabel}>
              {p.goal}
              <span style={summaryStyles.track}>
                {" · "}
                {p.track === "do" ? "a thing to do" : "a way to live"}
              </span>
            </p>

            {p.track === "do" ? (
              <ol style={summaryStyles.stoneList}>
                {(p.milestones ?? []).map((m, i) => (
                  <li key={i} style={summaryStyles.stoneItem}>
                    <span
                      style={{
                        ...summaryStyles.stoneMark,
                        ...(m.done ? summaryStyles.stoneMarkOn : null),
                      }}
                    >
                      {m.done ? "✓" : i + 1}
                    </span>
                    <span
                      style={{
                        ...summaryStyles.stoneText,
                        ...(m.done ? summaryStyles.stoneTextDone : null),
                      }}
                    >
                      {m.label}
                      {m.when && (
                        <span style={summaryStyles.when}> · {m.when}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div style={summaryStyles.supportBlock}>
                {(p.alreadyHelps ?? []).length > 0 && (
                  <p style={summaryStyles.supportLine}>
                    <span style={summaryStyles.supportKey}>Already helps:</span>{" "}
                    {(p.alreadyHelps ?? []).join(", ")}
                  </p>
                )}
                {(p.wouldHelp ?? []).length > 0 && (
                  <p style={summaryStyles.supportLine}>
                    <span style={summaryStyles.supportKey}>Would help:</span>{" "}
                    {(p.wouldHelp ?? []).join(", ")}
                  </p>
                )}
              </div>
            )}

            {(p.strengths ?? []).length > 0 && (
              <p style={summaryStyles.lean}>
                Strengths to lean on: {(p.strengths ?? []).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

const summaryStyles: Record<string, React.CSSProperties> = {
  heading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 16px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  paths: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  pathRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  goalLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  track: {
    fontWeight: 500,
    fontSize: "var(--fs-sm)",
    color: "var(--accent-strong)",
  },
  stoneList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  stoneItem: {
    display: "flex",
    gap: "8px",
    alignItems: "baseline",
  },
  stoneMark: {
    flexShrink: 0,
    width: "18px",
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "var(--muted-surface)",
    color: "var(--text-muted)",
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    alignSelf: "center",
  },
  stoneMarkOn: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
  },
  stoneText: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
  },
  stoneTextDone: {
    color: "var(--text-muted)",
  },
  when: {
    color: "var(--text-muted)",
  },
  supportBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  supportLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
  supportKey: {
    fontWeight: 600,
    color: "var(--ink)",
  },
  lean: {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontStyle: "italic",
    color: "var(--text-muted)",
    margin: 0,
  },
};

const pathCss = `
  .path-arrow:focus-visible, .path-remove:focus-visible, .path-done:focus-visible,
  .path-add:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .path-done:not([aria-pressed="true"]):hover { border-color: var(--brand-primary); }
  .path-arrow:not(:disabled):hover, .path-remove:hover { border-color: var(--brand-primary); }
  .path-arrow:disabled { opacity: 0.4; cursor: not-allowed; }
  .path-add:hover { background: var(--brand-primary-tint); }
  .path-input:focus-visible {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
`;
