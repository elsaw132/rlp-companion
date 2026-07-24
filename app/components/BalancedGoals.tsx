"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  BalancedGoalsInteraction,
  BalancedGoalsResult,
} from "@/lib/modules";
import type { BalancedSeed } from "@/lib/userModel";
import {
  fetchBalancedGoalsDraft,
  type GoalSuggestion,
  type GoalVariant,
} from "@/lib/balancedGoalsSeed";
import { useUserData } from "@/lib/userData";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";
import { DraftFailed } from "./DraftFailed";

// A goal is carried at up to three sizes; the person steps between them without
// losing any. Each is a complete phrasing with its own rough timing (cadence).
type Intensity = "quieter" | "original" | "bolder";
const INTENSITY_ORDER: Intensity[] = ["quieter", "original", "bolder"];

type Variant = { label: string; cadence?: string };
type Goal = {
  id: string;
  // The area of the person's life this goal is about, in their own words — a free
  // label ("Travel & adventure", "Our home"), not one of a fixed set.
  area: string;
  // The one-line "why we suggested this", carried from the draft; absent on a goal
  // the person adds.
  why?: string;
  // Which size is showing. "original" always exists; bolder/quieter may not.
  level: Intensity;
  variants: Partial<Record<Intensity, Variant>> & { original: Variant };
};

// The phrasing currently in view — what gets edited and committed.
function activeVariant(g: Goal): Variant {
  return g.variants[g.level] ?? g.variants.original;
}

// The coach-facing summary — the person's chosen goals, each with the area of life
// it is about and its rough timing.
export function balancedGoalsSummaryText(result: BalancedGoalsResult): string {
  const label = result.summaryLabel ?? "Your most important goals";
  const lines = result.goals
    .filter((g) => g.label.trim())
    .map((g) => {
      const area = g.area ? `${g.area}: ` : "";
      const when = g.cadence ? ` (${g.cadence})` : "";
      return `${area}${g.label}${when}`;
    });
  if (!lines.length) return `${label}. (none set yet)`;
  return `${label}. ${lines.join(" · ")}`;
}

// Capitalise the first letter — the draft's "why" and timing lines sometimes read as
// mid-sentence continuations ("you kept coming back…", "start with two…"), so they
// begin lower-case; nudge them to a proper sentence start for the card.
function capFirst(s: string): string {
  const t = s.trimStart();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : s;
}

function toVariant(v: GoalVariant): Variant {
  return { label: v.label, ...(v.cadence ? { cadence: capFirst(v.cadence) } : {}) };
}

function mapSuggestions(suggestions: GoalSuggestion[]): Goal[] {
  return suggestions.map((s, i) => ({
    id: `g${i}`,
    area: s.area,
    level: "original" as Intensity,
    ...(s.why ? { why: capFirst(s.why) } : {}),
    variants: {
      original: toVariant(s.original),
      ...(s.bolder ? { bolder: toVariant(s.bolder) } : {}),
      ...(s.quieter ? { quieter: toVariant(s.quieter) } : {}),
    },
  }));
}

type BalancedGoalsProps = {
  interaction: BalancedGoalsInteraction;
  seed: BalancedSeed;
  sessionId: string;
  // The rendered user-model block and onboarding line — the rich input for the draft.
  userModelText: string;
  onboardingContext: string;
  hasPartner: boolean;
  onFinish: (result: BalancedGoalsResult) => void;
} & EditableProps<BalancedGoalsResult>;

export default function BalancedGoals({
  interaction,
  sessionId,
  userModelText,
  onboardingContext,
  hasPartner,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: BalancedGoalsProps) {
  const {
    draftingLabel,
    curationInstruction,
    cadenceLabel,
    cadencePlaceholder,
    bolderLabel,
    quieterLabel,
    rejectLabel,
    addGoalLabel,
    addGoalPlaceholder,
    summaryLabel,
  } = interaction;

  const userData = useUserData();

  // Editing reopens straight onto the goals from the saved result; a fresh run uses
  // any cached draft, or fetches one (the "loading" phase).
  const cachedSeed = initial ? null : userData.getGoalSeed(sessionId);
  const [phase, setPhase] = useState<"loading" | "curate" | "failed">(
    initial || cachedSeed ? "curate" : "loading"
  );

  const [goals, setGoals] = useState<Goal[]>(() => {
    if (initial) {
      // A saved goal keeps only its chosen phrasing — it reopens as a single
      // "original", since the bolder/quieter dial was spent when it was kept.
      return initial.goals.map((g, i) => ({
        id: `g${i}`,
        area: g.area,
        level: "original" as Intensity,
        variants: {
          original: { label: g.label, ...(g.cadence ? { cadence: capFirst(g.cadence) } : {}) },
        },
      }));
    }
    if (cachedSeed) return mapSuggestions(cachedSeed.suggestions);
    return [];
  });

  // Draft the goals once, the first time a fresh run has no cached draft.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (phase !== "loading" || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      const cached = userData.getGoalSeed(sessionId);
      const draft =
        cached ??
        (await fetchBalancedGoalsDraft({
          userModel: userModelText,
          onboarding: onboardingContext,
          hasPartner,
          retirementStage: userData.getRetirementStage(),
          springboards: [],
        }));
      if (cancelled) return;
      if (!draft) {
        // Generation genuinely failed — show an honest retry, never fabricated goals.
        setPhase("failed");
        return;
      }
      if (!cached) void userData.saveGoalSeed(sessionId, draft);
      setGoals(mapSuggestions(draft.suggestions));
      setPhase("curate");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // A monotonic counter for ids of goals the person adds — a ref so it survives
  // re-renders and never collides with the drafted "g0, g1…" ids.
  const nextIdRef = useRef(0);
  const makeId = () => `goal-added-${nextIdRef.current++}`;
  const namedGoals = goals.filter((g) => activeVariant(g).label.trim());

  function addGoal() {
    setGoals((prev) => [
      ...prev,
      { id: makeId(), area: "", level: "original", variants: { original: { label: "" } } },
    ]);
  }
  // Edit the phrasing currently in view, leaving the other sizes intact.
  function updateActiveVariant(id: string, patch: Partial<Variant>) {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id
          ? { ...g, variants: { ...g.variants, [g.level]: { ...activeVariant(g), ...patch } } }
          : g
      )
    );
  }
  function updateArea(id: string, area: string) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, area } : g)));
  }
  // Step toward a bolder (+1) or quieter (-1) size, skipping any the draft didn't
  // supply. Stepping back lands on the original, untouched.
  function stepLevel(id: string, dir: -1 | 1) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const i = INTENSITY_ORDER.indexOf(g.level);
        for (let j = i + dir; j >= 0 && j < INTENSITY_ORDER.length; j += dir) {
          if (g.variants[INTENSITY_ORDER[j]]) return { ...g, level: INTENSITY_ORDER[j] };
        }
        return g;
      })
    );
  }
  function removeGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  const enoughGoals = namedGoals.length >= 1;

  function buildResultObject(): BalancedGoalsResult {
    const named = namedGoals;
    // The distinct areas of life these goals touch, for the recap and downstream.
    const areaSeen = new Map<string, string>();
    for (const g of named) {
      const key = g.area.trim().toLowerCase();
      if (key && !areaSeen.has(key)) areaSeen.set(key, g.area.trim());
    }
    return {
      type: "balanced-goals",
      goals: named.map((g, i) => {
        const v = activeVariant(g);
        return {
          label: v.label.trim(),
          area: g.area.trim(),
          // Every goal here is a concrete thing to DO — the "be"/way-of-living track
          // was retired. Kept so downstream readers that branch on track still work.
          track: "do" as const,
          ...(v.cadence?.trim() ? { cadence: v.cadence.trim() } : {}),
          // This is a small set of the person's MOST important goals — all are
          // spotlit, ranked by the order shown.
          focus: true,
          rank: i + 1,
        };
      }),
      areas: Array.from(areaSeen.values()).map((a) => ({ id: a, label: a })),
      deliberateGaps: [],
      summaryLabel,
    };
  }

  if (phase === "loading") {
    return (
      <section style={styles.wrap}>
        <style>{balCss}</style>
        <div style={styles.draftCard}>
          <span style={styles.draftSun} aria-hidden="true">
            ☀
          </span>
          <p style={styles.draftText}>{draftingLabel}</p>
        </div>
      </section>
    );
  }

  if (phase === "failed") {
    return (
      <section style={styles.wrap}>
        <style>{balCss}</style>
        <DraftFailed
          message="We couldn't draft your goals just now. Your answers are all saved. Try again in a moment."
          onRetry={() => {
            fetchedRef.current = false;
            setPhase("loading");
          }}
        />
      </section>
    );
  }

  return (
    <section style={styles.wrap}>
      <style>{balCss}</style>
      <p style={styles.instruction}>{curationInstruction}</p>

      <div style={styles.helperGroup}>
        <HelperLine>
          Push a goal bolder or gentler until it feels right — or set one aside.
        </HelperLine>
        <div style={styles.goalList}>
          {goals.map((goal) => (
            <CurateCard
              key={goal.id}
              goal={goal}
              areaPlaceholder="What this is about…"
              labelPlaceholder={addGoalPlaceholder}
              cadenceLabel={cadenceLabel}
              cadencePlaceholder={cadencePlaceholder}
              bolderLabel={bolderLabel}
              quieterLabel={quieterLabel}
              rejectLabel={rejectLabel}
              onUpdateVariant={updateActiveVariant}
              onUpdateArea={updateArea}
              onStep={stepLevel}
              onRemove={removeGoal}
            />
          ))}
        </div>
        <button
          type="button"
          className="bal-add"
          style={styles.addOwnBtn}
          onClick={addGoal}
        >
          <span aria-hidden="true" style={styles.addPlus}>
            +
          </span>
          {addGoalLabel}
        </button>
      </div>

      <FinishControls
        mode={mode}
        disabled={!enoughGoals}
        onFinish={() => onFinish(buildResultObject())}
        onCancel={onCancel}
        hint={enoughGoals ? undefined : "Keep at least one goal to carry on."}
      />
    </section>
  );
}

// ---- one goal, on the curation surface: the area, the goal, its timing, and the
// bolder/quieter dial ----
function CurateCard({
  goal,
  areaPlaceholder,
  labelPlaceholder,
  cadenceLabel,
  cadencePlaceholder,
  bolderLabel,
  quieterLabel,
  rejectLabel,
  onUpdateVariant,
  onUpdateArea,
  onStep,
  onRemove,
}: {
  goal: Goal;
  areaPlaceholder: string;
  labelPlaceholder: string;
  cadenceLabel: string;
  cadencePlaceholder: string;
  bolderLabel: string;
  quieterLabel: string;
  rejectLabel: string;
  onUpdateVariant: (id: string, patch: Partial<Variant>) => void;
  onUpdateArea: (id: string, area: string) => void;
  onStep: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const v = activeVariant(goal);
  const i = INTENSITY_ORDER.indexOf(goal.level);
  const canQuieter = INTENSITY_ORDER.slice(0, i).some((l) => goal.variants[l]);
  const canBolder = INTENSITY_ORDER.slice(i + 1).some((l) => goal.variants[l]);
  const levelNote =
    goal.level === "bolder" ? "Bolder" : goal.level === "quieter" ? "Gentler" : null;

  return (
    <div style={styles.goalCard}>
      <AutoTextarea
        className="bal-input"
        style={styles.areaField}
        placeholder={areaPlaceholder}
        value={goal.area}
        onChange={(val) => onUpdateArea(goal.id, val)}
        ariaLabel="Area of life this goal is about"
      />
      {goal.why && <p style={styles.whyLine}>{goal.why}</p>}
      {levelNote && <span style={styles.levelTag}>{levelNote}</span>}

      <AutoTextarea
        className="bal-input"
        style={styles.labelInput}
        minRows={2}
        placeholder={labelPlaceholder}
        value={v.label}
        onChange={(val) => onUpdateVariant(goal.id, { label: val })}
        ariaLabel="Goal"
      />

      <Field
        label={cadenceLabel}
        placeholder={cadencePlaceholder}
        value={v.cadence ?? ""}
        rows={2}
        onChange={(val) => onUpdateVariant(goal.id, { cadence: val })}
      />

      <div style={styles.actionRow}>
        <button
          type="button"
          className="bal-arrow"
          style={{ ...styles.ghostBtn, ...(canQuieter ? null : styles.ghostBtnDisabled) }}
          disabled={!canQuieter}
          onClick={() => onStep(goal.id, -1)}
        >
          {"↓ "}
          {quieterLabel}
        </button>
        <button
          type="button"
          className="bal-arrow"
          style={{ ...styles.ghostBtn, ...(canBolder ? null : styles.ghostBtnDisabled) }}
          disabled={!canBolder}
          onClick={() => onStep(goal.id, 1)}
        >
          {"↑ "}
          {bolderLabel}
        </button>
        <button
          type="button"
          className="bal-remove"
          style={{ ...styles.ghostBtn, ...styles.rejectBtn }}
          onClick={() => onRemove(goal.id)}
        >
          {rejectLabel}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  rows,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.subLabel}>{label}</label>
      {rows ? (
        <AutoTextarea
          className="bal-input"
          style={styles.textarea}
          minRows={rows}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      ) : (
        <input
          type="text"
          className="bal-input"
          style={styles.fieldInput}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

// A textarea that grows to fit its content, so wrapped lines are never clipped
// or hidden behind a scrollbar. Resizes on every value change.
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
  draftSun: {
    fontSize: "28px",
  },
  draftText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  strip: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  cell: {
    flex: "1 1 90px",
    minWidth: "90px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "10px 8px",
    fontFamily: "var(--font-sans)",
  },
  cellFilled: {
    borderColor: "var(--accent)",
  },
  cellLabel: {
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  cellCount: {
    width: "22px",
    height: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "var(--muted-surface)",
    color: "var(--text-muted)",
    fontSize: "12px",
    fontWeight: 700,
  },
  cellCountOn: {
    background: "var(--accent-strong)",
    color: "var(--brand-on-primary)",
  },
  balanceHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: "-8px 0 0",
  },
  areaProgress: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0 0 6px",
  },
  areaSection: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    paddingTop: "20px",
    borderTop: "1px solid var(--border)",
  },
  areaTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  areaBlurb: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text-muted)",
    margin: "4px 0 0",
  },
  goalList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  goalCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "18px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
  },
  // The area-of-life label at the top of each card — reads as a tag, editable so an
  // added goal can be named and a drafted one retitled.
  areaField: {
    width: "100%",
    padding: "2px 0",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: "1.4",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--accent-strong)",
    background: "transparent",
    border: "none",
    boxSizing: "border-box",
  },
  labelInput: {
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
    resize: "vertical",
    boxSizing: "border-box",
  },
  whyLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    fontStyle: "italic",
    margin: "-2px 0 0",
  },
  levelTag: {
    alignSelf: "flex-start",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    fontWeight: 700,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    color: "var(--brand-primary)",
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    borderRadius: "var(--r-pill)",
    padding: "2px 10px",
  },
  trackRow: {
    display: "flex",
    gap: "8px",
  },
  trackBtn: {
    flex: 1,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "9px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text)",
    cursor: "pointer",
  },
  trackSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
  },
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  ghostBtn: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "7px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    cursor: "pointer",
  },
  ghostBtnDisabled: {
    color: "var(--text-muted)",
    opacity: 0.4,
    cursor: "default",
  },
  rejectBtn: {
    marginLeft: "auto",
    color: "var(--text-muted)",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  subLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  fieldInput: {
    width: "100%",
    minHeight: "42px",
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    resize: "vertical",
    boxSizing: "border-box",
  },
  addOwnBtn: {
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
  addPlus: {
    fontWeight: 700,
    color: "var(--brand-primary)",
  },
  stepControls: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    paddingTop: "8px",
  },
  continueBtn: {
    width: "100%",
    maxWidth: "360px",
    minHeight: "48px",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    cursor: "pointer",
  },
  backBtn: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    padding: "2px 0",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },
  absencePrompt: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: "-4px 0 0",
  },
  // Keep the helper line close above the goal cards / pick chips (tighter than
  // the wrap's 20px gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  areaSections: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  pickGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  pickHeading: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },
  pickChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  pickChip: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
    textAlign: "left",
  },
  pickChipSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  emptyAreaRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    padding: "10px 14px",
    background: "var(--muted-surface)",
    borderRadius: "var(--r-sm)",
  },
  emptyAreaName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
  },
  emptyAreaWord: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
  gapBtn: {
    marginLeft: "auto",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "6px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  gapBtnOn: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
  },
  capNotice: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--ink)",
    background: "var(--warm-surface)",
    borderRadius: "var(--r-sm)",
    padding: "12px 16px",
    margin: 0,
  },
  spotlight: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  spotlightHeading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    margin: 0,
  },
  spotCard: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "18px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
  },
  spotHead: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  rank: {
    flexShrink: 0,
    width: "26px",
    height: "26px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    borderRadius: "50%",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    fontWeight: 700,
  },
  goalLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  areaTag: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--accent-strong)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  rankControls: {
    marginLeft: "auto",
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
    width: "36px",
    height: "36px",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  seasonChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  chip: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
  },
  chipSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation — the person's most important goals, each with the area of life it is
// about and its rough timing. The neutral card wrapper is the caller's.
export function BalancedGoalsSummary({
  result,
}: {
  result: BalancedGoalsResult;
}) {
  const goals = result.goals.filter((g) => g.label.trim());
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel}</p>
      <div style={summaryStyles.goals}>
        {goals.length ? (
          goals.map((g, i) => (
            <div key={i} style={summaryStyles.goalBody}>
              {g.area && <span style={summaryStyles.area}>{g.area}</span>}
              <span style={summaryStyles.goalLabel}>{g.label}</span>
              {g.cadence && <span style={summaryStyles.detail}>{g.cadence}</span>}
            </div>
          ))
        ) : (
          <span style={summaryStyles.areaEmpty}>—</span>
        )}
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
  goals: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  goalRow: {
    display: "flex",
    gap: "10px",
  },
  rank: {
    flexShrink: 0,
    width: "22px",
    height: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    borderRadius: "50%",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 700,
  },
  goalBody: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  goalLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  area: {
    fontWeight: 500,
    color: "var(--accent-strong)",
  },
  season: {
    fontWeight: 500,
    color: "var(--text-muted)",
  },
  note: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
  detail: {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    color: "var(--text-muted)",
    margin: 0,
  },
  byArea: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: "16px 0 0",
    paddingTop: "14px",
    borderTop: "1px solid var(--border)",
  },
  areaLine: {
    display: "flex",
    gap: "8px",
    alignItems: "baseline",
  },
  areaName: {
    flexShrink: 0,
    width: "92px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
  },
  areaGoals: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
  areaEmpty: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
};

const balCss = `
  .bal-track:focus-visible, .bal-chip:focus-visible, .bal-pick:focus-visible,
  .bal-gap:focus-visible, .bal-add:focus-visible, .bal-ghost:focus-visible,
  .bal-continue:focus-visible, .bal-arrow:focus-visible, .bal-remove:focus-visible,
  .bal-back:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .bal-track:not([aria-pressed="true"]):hover { border-color: var(--brand-primary); }
  .bal-chip:not([aria-pressed="true"]):hover { border-color: var(--brand-primary); }
  .bal-pick:not([aria-pressed="true"]):hover { border-color: var(--brand-primary); }
  .bal-gap:not([aria-pressed="true"]):hover { border-color: var(--brand-primary); }
  .bal-ghost:hover { border-color: var(--brand-primary); }
  .bal-arrow:not(:disabled):hover, .bal-remove:hover { border-color: var(--brand-primary); }
  .bal-arrow:disabled { opacity: 0.4; cursor: not-allowed; }
  .bal-continue:hover { background: var(--brand-primary-hover); }
  .bal-add:hover { background: var(--brand-primary-tint); }
  .bal-input:focus-visible {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .bal-back:hover { color: var(--text); }
`;
