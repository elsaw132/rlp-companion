"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  BalancedAreaId,
  BalancedGoalsInteraction,
  BalancedGoalsResult,
} from "@/lib/modules";
import type { BalancedSeed } from "@/lib/userModel";
import {
  FALLBACK_BALANCED_GOALS,
  fetchBalancedGoalsDraft,
  type GoalSuggestion,
  type GoalVariant,
} from "@/lib/balancedGoalsSeed";
import { useUserData } from "@/lib/userData";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

type Track = "do" | "be";

// A goal is carried at up to three intensities. The person steps between them
// without losing any: each is a complete phrasing with its own track and timing.
type Intensity = "quieter" | "original" | "bolder";
const INTENSITY_ORDER: Intensity[] = ["quieter", "original", "bolder"];

type Variant = {
  label: string;
  track: Track;
  cadence?: string;
  ordinaryWeek?: string;
};
type Goal = {
  id: string;
  area: BalancedAreaId;
  // The one-line "why we suggested this", carried from the draft; absent on a
  // goal the person adds.
  why?: string;
  // Which intensity is showing. "original" always exists; the others may not.
  level: Intensity;
  variants: Partial<Record<Intensity, Variant>> & { original: Variant };
};

// The phrasing currently in view — what gets edited, counted and committed.
function activeVariant(g: Goal): Variant {
  return g.variants[g.level] ?? g.variants.original;
}

type Detail = { note?: string; season?: string };

// The flattened goal the focus pass works with — just the active phrasing.
type FocusGoal = { id: string; area: BalancedAreaId; label: string };

// The coach-facing summary — the spotlit handful, ranked, each with its area,
// meaning, season and what success looks like, then the balance across the five
// areas including any the person left deliberately quiet.
export function balancedGoalsSummaryText(result: BalancedGoalsResult): string {
  const label = result.summaryLabel ?? "Your balanced retirement";
  const areaLabel = (id: string) =>
    result.areas.find((a) => a.id === id)?.label ?? id;
  const focus = result.goals
    .filter((g) => g.focus)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const focusText = focus
    .map((g) => {
      const success =
        g.track === "do"
          ? [g.cadence ? `roughly: ${g.cadence}` : ""]
          : [g.ordinaryWeek ? `in an ordinary week: ${g.ordinaryWeek}` : ""];
      const bits = [
        `area: ${areaLabel(g.area)}`,
        g.track === "do" ? "a thing to do" : "a way to live",
        g.note ? `what it means: ${g.note}` : "",
        g.season ? `season: ${g.season}` : "",
        ...success,
      ]
        .filter(Boolean)
        .join("; ");
      return `${g.rank}. ${g.label} (${bits})`;
    })
    .join(" ");

  const balance = result.areas
    .map((a) => {
      const inArea = result.goals.filter((g) => g.area === a.id);
      if (inArea.length === 0) {
        return result.deliberateGaps.includes(a.id)
          ? `${a.label} (left deliberately quiet)`
          : `${a.label} (empty)`;
      }
      return `${a.label}: ${inArea.map((g) => g.label).join(", ")}`;
    })
    .join("; ");

  const wider = result.goals.filter((g) => !g.focus);
  const widerText = wider.length
    ? ` Other goals they kept but didn't spotlight: ${wider
        .map((g) => `${g.label} (${areaLabel(g.area)})`)
        .join(", ")}.`
    : "";

  return `${label}. In the spotlight, most important first: ${focusText}. The balance across the five areas — ${balance}.${widerText}`;
}

function toVariant(v: GoalVariant): Variant {
  return {
    label: v.label,
    track: v.track,
    ...(v.cadence ? { cadence: v.cadence } : {}),
    ...(v.ordinaryWeek ? { ordinaryWeek: v.ordinaryWeek } : {}),
  };
}

function mapSuggestions(suggestions: GoalSuggestion[]): Goal[] {
  return suggestions.map((s, i) => ({
    id: `g${i}`,
    area: s.area,
    level: "original" as Intensity,
    ...(s.why ? { why: s.why } : {}),
    variants: {
      original: toVariant(s.original),
      ...(s.bolder ? { bolder: toVariant(s.bolder) } : {}),
      ...(s.quieter ? { quieter: toVariant(s.quieter) } : {}),
    },
  }));
}

type BalancedGoalsProps = {
  interaction: BalancedGoalsInteraction;
  // Per-area material drawn from the person's earlier words — the anchor for the
  // draft, sent to /api/balanced-goals so each goal lands in the right area.
  seed: BalancedSeed;
  sessionId: string;
  // The rendered user-model block and onboarding line, the rich input for the
  // draft. hasPartner filters partner-only framing.
  userModelText: string;
  onboardingContext: string;
  hasPartner: boolean;
  onFinish: (result: BalancedGoalsResult) => void;
} & EditableProps<BalancedGoalsResult>;

export default function BalancedGoals({
  interaction,
  seed,
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
    areas,
    draftingLabel,
    curationInstruction,
    balanceHint,
    trackDoLabel,
    trackBeLabel,
    cadenceLabel,
    cadencePlaceholder,
    ordinaryWeekLabel,
    ordinaryWeekPlaceholder,
    bolderLabel,
    quieterLabel,
    rejectLabel,
    addGoalLabel,
    addGoalPlaceholder,
    toFocusLabel,
    focusInstruction,
    absencePrompt,
    maxFocus,
    noteLabel,
    notePlaceholder,
    seasonLabel,
    seasons,
    deliberateGapLabel,
    summaryLabel,
  } = interaction;

  const userData = useUserData();

  // Editing reopens straight onto the curation view from the saved goals; a
  // fresh run uses any cached draft, or fetches one (the "loading" phase).
  const cachedSeed = initial ? null : userData.getGoalSeed(sessionId);

  const [phase, setPhase] = useState<"loading" | "curate" | "focus">(
    initial || cachedSeed ? "curate" : "loading"
  );

  const [goals, setGoals] = useState<Goal[]>(() => {
    if (initial) {
      // A saved goal keeps only its chosen phrasing, so it reopens as a single
      // "original" variant — the bolder/quieter swap was spent when it was kept.
      return initial.goals.map((g, i) => ({
        id: `g${i}`,
        area: g.area,
        level: "original" as Intensity,
        variants: {
          original: {
            label: g.label,
            track: g.track,
            ...(g.cadence ? { cadence: g.cadence } : {}),
            ...(g.ordinaryWeek ? { ordinaryWeek: g.ordinaryWeek } : {}),
          },
        },
      }));
    }
    if (cachedSeed) return mapSuggestions(cachedSeed.suggestions);
    return [];
  });

  const [focusOrder, setFocusOrder] = useState<string[]>(() => {
    if (!initial) return [];
    return initial.goals
      .map((g, i) => ({ i, rank: g.rank, focus: g.focus }))
      .filter((g) => g.focus)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((g) => `g${g.i}`);
  });

  const [detail, setDetail] = useState<Record<string, Detail>>(() => {
    const seeded: Record<string, Detail> = {};
    initial?.goals.forEach((g, i) => {
      if (!g.focus) return;
      seeded[`g${i}`] = {
        ...(g.note ? { note: g.note } : {}),
        ...(g.season ? { season: g.season } : {}),
      };
    });
    return seeded;
  });

  const [gaps, setGaps] = useState<Set<BalancedAreaId>>(
    () => new Set(initial?.deliberateGaps ?? [])
  );

  // Draft the goals once, the first time a fresh run has no cached draft.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (phase !== "loading" || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      // A prefetch started during the intro may have already landed in the cache.
      const cached = userData.getGoalSeed(sessionId);
      const draft =
        cached ??
        (await fetchBalancedGoalsDraft({
          userModel: userModelText,
          onboarding: onboardingContext,
          hasPartner,
          springboards: areas.map((a) => ({
            area: a.id,
            labels: seed.springboards
              .filter((s) => s.areas.includes(a.id))
              .map((s) => s.label),
          })),
        }));
      if (cancelled) return;
      if (draft && !cached) void userData.saveGoalSeed(sessionId, draft);
      setGoals(mapSuggestions((draft ?? FALLBACK_BALANCED_GOALS).suggestions));
      setPhase("curate");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // A monotonic counter for ids of goals the person adds themselves. A ref so it
  // survives re-renders and never collides with the drafted "g0, g1…" ids.
  const nextIdRef = useRef(0);
  const makeId = () => `goal-added-${nextIdRef.current++}`;

  const goalsInArea = (area: BalancedAreaId) =>
    goals.filter((g) => g.area === area);
  const namedGoals = goals.filter((g) => activeVariant(g).label.trim());
  const goalById = (id: string) => goals.find((g) => g.id === id);
  // The flattened view the focus pass needs — just the active phrasing.
  const flat = (g: Goal) => ({
    id: g.id,
    area: g.area,
    label: activeVariant(g).label,
  });

  function addGoal(area: BalancedAreaId) {
    const id = makeId();
    setGoals((prev) => [
      ...prev,
      { id, area, level: "original", variants: { original: { label: "", track: "do" } } },
    ]);
    // Adding to an area undoes any "deliberately quiet" mark on it.
    setGaps((prev) => {
      if (!prev.has(area)) return prev;
      const next = new Set(prev);
      next.delete(area);
      return next;
    });
  }
  // Edit the phrasing currently in view, leaving the other intensities intact.
  function updateActiveVariant(id: string, patch: Partial<Variant>) {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === id
          ? { ...g, variants: { ...g.variants, [g.level]: { ...activeVariant(g), ...patch } } }
          : g
      )
    );
  }
  // Step toward a bolder (+1) or quieter (-1) intensity, skipping any that the
  // draft didn't supply. Stepping back lands on the original, untouched.
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
    setFocusOrder((prev) => prev.filter((g) => g !== id));
    setDetail((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function toggleFocus(id: string) {
    setFocusOrder((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }
  function moveFocus(index: number, dir: -1 | 1) {
    setFocusOrder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function patchDetail(id: string, patch: Detail) {
    setDetail((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  function toggleGap(area: BalancedAreaId) {
    setGaps((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  }

  const focusReady = focusOrder.length >= 1 && focusOrder.length <= maxFocus;

  function buildResultObject(): BalancedGoalsResult {
    const named = namedGoals;
    const rankById = new Map(
      focusOrder
        .filter((id) => named.some((g) => g.id === id))
        .map((id, i) => [id, i + 1])
    );
    return {
      type: "balanced-goals",
      goals: named.map((g) => {
        const rank = rankById.get(g.id);
        const d = detail[g.id] ?? {};
        const v = activeVariant(g);
        return {
          label: v.label.trim(),
          area: g.area,
          track: v.track,
          ...(v.track === "do" && v.cadence?.trim()
            ? { cadence: v.cadence.trim() }
            : {}),
          ...(v.track === "be" && v.ordinaryWeek?.trim()
            ? { ordinaryWeek: v.ordinaryWeek.trim() }
            : {}),
          ...(rank ? { focus: true, rank } : {}),
          ...(rank && d.note?.trim() ? { note: d.note.trim() } : {}),
          ...(rank && d.season ? { season: d.season } : {}),
        };
      }),
      areas: areas.map((a) => ({ id: a.id, label: a.label })),
      deliberateGaps: areas
        .map((a) => a.id)
        .filter((id) => gaps.has(id) && named.every((g) => g.area !== id)),
      summaryLabel,
    };
  }

  if (phase === "loading") {
    return (
      <section style={styles.wrap}>
        <style>{balCss}</style>
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
      <style>{balCss}</style>

      <BalanceOverview
        areas={areas}
        countFor={(id) =>
          goalsInArea(id).filter((g) => activeVariant(g).label.trim()).length
        }
      />
      <p style={styles.balanceHint}>{balanceHint}</p>

      {phase === "curate" && (
        <>
          <p style={styles.instruction}>{curationInstruction}</p>

          <div style={styles.helperGroup}>
          <HelperLine>Tap to keep, reword, or set aside each goal.</HelperLine>
          <div style={styles.areaSections}>
            {areas.map((area) => (
              <div key={area.id} style={styles.areaSection}>
                <div>
                  <h3 style={styles.areaTitle}>{area.label}</h3>
                  <p style={styles.areaBlurb}>{area.blurb}</p>
                </div>

                {goalsInArea(area.id).map((goal) => (
                  <CurateCard
                    key={goal.id}
                    goal={goal}
                    labelPlaceholder={addGoalPlaceholder}
                    trackDoLabel={trackDoLabel}
                    trackBeLabel={trackBeLabel}
                    cadenceLabel={cadenceLabel}
                    cadencePlaceholder={cadencePlaceholder}
                    ordinaryWeekLabel={ordinaryWeekLabel}
                    ordinaryWeekPlaceholder={ordinaryWeekPlaceholder}
                    bolderLabel={bolderLabel}
                    quieterLabel={quieterLabel}
                    rejectLabel={rejectLabel}
                    onUpdateVariant={updateActiveVariant}
                    onStep={stepLevel}
                    onRemove={removeGoal}
                  />
                ))}

                <button
                  type="button"
                  className="bal-add"
                  style={styles.addOwnBtn}
                  onClick={() => addGoal(area.id)}
                >
                  <span aria-hidden="true" style={styles.addPlus}>
                    +
                  </span>
                  {addGoalLabel}
                </button>
              </div>
            ))}
          </div>
          </div>

          <div style={styles.stepControls}>
            <button
              type="button"
              className="bal-continue"
              style={styles.continueBtn}
              onClick={() => setPhase("focus")}
            >
              {toFocusLabel}
            </button>
          </div>
        </>
      )}

      {phase === "focus" && (
        <FocusStep
          instruction={focusInstruction}
          absencePrompt={absencePrompt}
          areas={areas}
          goalsInArea={(area) => goalsInArea(area).map(flat)}
          goalById={(id) => {
            const g = goalById(id);
            return g ? flat(g) : undefined;
          }}
          focusOrder={focusOrder}
          detail={detail}
          gaps={gaps}
          maxFocus={maxFocus}
          deliberateGapLabel={deliberateGapLabel}
          noteLabel={noteLabel}
          notePlaceholder={notePlaceholder}
          seasonLabel={seasonLabel}
          seasons={seasons}
          areaLabelOf={(id) => areas.find((a) => a.id === id)?.label ?? id}
          onToggle={toggleFocus}
          onMove={moveFocus}
          onDetail={patchDetail}
          onToggleGap={toggleGap}
          onBack={() => setPhase("curate")}
          mode={mode}
          canFinish={focusReady}
          onFinish={() => onFinish(buildResultObject())}
          onCancel={onCancel}
        />
      )}
    </section>
  );
}

// ---- the read-only balance picture across the five areas ----
function BalanceOverview({
  areas,
  countFor,
}: {
  areas: { id: BalancedAreaId; label: string }[];
  countFor: (id: BalancedAreaId) => number;
}) {
  return (
    <div style={styles.strip} aria-label="The five areas of a balanced retirement">
      {areas.map((a) => {
        const count = countFor(a.id);
        return (
          <div
            key={a.id}
            style={{
              ...styles.cell,
              ...(count > 0 ? styles.cellFilled : null),
            }}
          >
            <span style={styles.cellLabel}>{a.label}</span>
            <span
              style={{
                ...styles.cellCount,
                ...(count > 0 ? styles.cellCountOn : null),
              }}
            >
              {count > 0 ? count : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---- one drafted goal, on the curation surface ----
function CurateCard({
  goal,
  labelPlaceholder,
  trackDoLabel,
  trackBeLabel,
  cadenceLabel,
  cadencePlaceholder,
  ordinaryWeekLabel,
  ordinaryWeekPlaceholder,
  bolderLabel,
  quieterLabel,
  rejectLabel,
  onUpdateVariant,
  onStep,
  onRemove,
}: {
  goal: Goal;
  labelPlaceholder: string;
  trackDoLabel: string;
  trackBeLabel: string;
  cadenceLabel: string;
  cadencePlaceholder: string;
  ordinaryWeekLabel: string;
  ordinaryWeekPlaceholder: string;
  bolderLabel: string;
  quieterLabel: string;
  rejectLabel: string;
  onUpdateVariant: (id: string, patch: Partial<Variant>) => void;
  onStep: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const v = activeVariant(goal);
  const i = INTENSITY_ORDER.indexOf(goal.level);
  const canQuieter = INTENSITY_ORDER.slice(0, i).some((l) => goal.variants[l]);
  const canBolder = INTENSITY_ORDER.slice(i + 1).some((l) => goal.variants[l]);
  const levelNote =
    goal.level === "bolder"
      ? "Bolder version"
      : goal.level === "quieter"
        ? "Quieter version"
        : null;

  return (
    <div style={styles.goalCard}>
      {levelNote && <span style={styles.levelTag}>{levelNote}</span>}

      <AutoTextarea
        className="bal-input bal-label-input"
        style={styles.labelInput}
        minRows={2}
        value={v.label}
        ariaLabel="Goal"
        placeholder={labelPlaceholder}
        autoFocus={v.label === ""}
        onChange={(val) => onUpdateVariant(goal.id, { label: val })}
      />

      {goal.why && <p style={styles.whyLine}>Why we suggested this: {goal.why}</p>}

      <div style={styles.trackRow}>
        <button
          type="button"
          className="bal-track"
          style={{
            ...styles.trackBtn,
            ...(v.track === "do" ? styles.trackSelected : null),
          }}
          aria-pressed={v.track === "do"}
          onClick={() => onUpdateVariant(goal.id, { track: "do" })}
        >
          {trackDoLabel}
        </button>
        <button
          type="button"
          className="bal-track"
          style={{
            ...styles.trackBtn,
            ...(v.track === "be" ? styles.trackSelected : null),
          }}
          aria-pressed={v.track === "be"}
          onClick={() => onUpdateVariant(goal.id, { track: "be" })}
        >
          {trackBeLabel}
        </button>
      </div>

      {v.track === "do" ? (
        <Field
          label={cadenceLabel}
          placeholder={cadencePlaceholder}
          value={v.cadence ?? ""}
          onChange={(val) => onUpdateVariant(goal.id, { cadence: val })}
        />
      ) : (
        <Field
          label={ordinaryWeekLabel}
          placeholder={ordinaryWeekPlaceholder}
          value={v.ordinaryWeek ?? ""}
          rows={2}
          onChange={(val) => onUpdateVariant(goal.id, { ordinaryWeek: val })}
        />
      )}

      <div style={styles.actionRow}>
        <button
          type="button"
          className="bal-ghost"
          style={{
            ...styles.ghostBtn,
            ...(canQuieter ? null : styles.ghostBtnDisabled),
          }}
          disabled={!canQuieter}
          onClick={() => onStep(goal.id, -1)}
        >
          ↓ {quieterLabel}
        </button>
        <button
          type="button"
          className="bal-ghost"
          style={{
            ...styles.ghostBtn,
            ...(canBolder ? null : styles.ghostBtnDisabled),
          }}
          disabled={!canBolder}
          onClick={() => onStep(goal.id, 1)}
        >
          ↑ {bolderLabel}
        </button>
        <button
          type="button"
          className="bal-ghost bal-reject"
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

// ---- the focus pass ----
function FocusStep({
  instruction,
  absencePrompt,
  areas,
  goalsInArea,
  goalById,
  focusOrder,
  detail,
  gaps,
  maxFocus,
  deliberateGapLabel,
  noteLabel,
  notePlaceholder,
  seasonLabel,
  seasons,
  areaLabelOf,
  onToggle,
  onMove,
  onDetail,
  onToggleGap,
  onBack,
  mode,
  canFinish,
  onFinish,
  onCancel,
}: {
  instruction: string;
  absencePrompt: string;
  areas: { id: BalancedAreaId; label: string }[];
  goalsInArea: (area: BalancedAreaId) => FocusGoal[];
  goalById: (id: string) => FocusGoal | undefined;
  focusOrder: string[];
  detail: Record<string, Detail>;
  gaps: Set<BalancedAreaId>;
  maxFocus: number;
  deliberateGapLabel: string;
  noteLabel: string;
  notePlaceholder: string;
  seasonLabel: string;
  seasons: { id: string; label: string }[];
  areaLabelOf: (id: BalancedAreaId) => string;
  onToggle: (id: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onDetail: (id: string, patch: Detail) => void;
  onToggleGap: (area: BalancedAreaId) => void;
  onBack: () => void;
  mode: "create" | "edit";
  canFinish: boolean;
  onFinish: () => void;
  onCancel?: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="bal-back"
        style={styles.backBtn}
        onClick={onBack}
      >
        ← Back to the goals
      </button>
      <div>
        <p style={styles.areaProgress}>Last step · the wrap-up</p>
        <h3 style={styles.areaTitle}>The goals that matter most</h3>
      </div>
      <p style={styles.instruction}>{instruction}</p>
      <p style={styles.absencePrompt}>{absencePrompt}</p>

      <div style={styles.helperGroup}>
      <HelperLine>Tap the few you&apos;d most want to keep.</HelperLine>
      <div style={styles.areaSections}>
        {areas.map((area) => {
          const list = goalsInArea(area.id).filter((g) => g.label.trim());
          if (list.length === 0) {
            return (
              <div key={area.id} style={styles.emptyAreaRow}>
                <span style={styles.emptyAreaName}>{area.label}</span>
                <span style={styles.emptyAreaWord}>nothing here</span>
                <button
                  type="button"
                  className="bal-gap"
                  style={{
                    ...styles.gapBtn,
                    ...(gaps.has(area.id) ? styles.gapBtnOn : null),
                  }}
                  aria-pressed={gaps.has(area.id)}
                  onClick={() => onToggleGap(area.id)}
                >
                  {deliberateGapLabel}
                </button>
              </div>
            );
          }
          return (
            <div key={area.id} style={styles.pickGroup}>
              <p style={styles.pickHeading}>{area.label}</p>
              <div style={styles.pickChips}>
                {list.map((goal) => {
                  const selected = focusOrder.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      className="bal-pick"
                      style={{
                        ...styles.pickChip,
                        ...(selected ? styles.pickChipSelected : null),
                      }}
                      aria-pressed={selected}
                      onClick={() => onToggle(goal.id)}
                    >
                      {selected && <span aria-hidden="true">★ </span>}
                      {goal.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {focusOrder.length > maxFocus && (
        <p style={styles.capNotice}>
          That&apos;s {focusOrder.length}. Narrow the spotlight to {maxFocus} —
          let the few that matter most stand out.
        </p>
      )}

      {focusOrder.length > 0 && (
        <div style={styles.spotlight}>
          <p style={styles.spotlightHeading}>In the spotlight</p>
          {focusOrder.map((id, index) => {
            const goal = goalById(id);
            if (!goal) return null;
            const d = detail[id] ?? {};
            return (
              <div key={id} style={styles.spotCard}>
                <div style={styles.spotHead}>
                  <span style={styles.rank}>{index + 1}</span>
                  <span style={styles.goalLabel}>{goal.label}</span>
                  <span style={styles.areaTag}>{areaLabelOf(goal.area)}</span>
                  <div style={styles.rankControls}>
                    <button
                      type="button"
                      className="bal-arrow"
                      style={styles.arrow}
                      aria-label={`Move ${goal.label} up`}
                      disabled={index === 0}
                      onClick={() => onMove(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="bal-arrow"
                      style={styles.arrow}
                      aria-label={`Move ${goal.label} down`}
                      disabled={index === focusOrder.length - 1}
                      onClick={() => onMove(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="bal-remove"
                      style={styles.removeBtn}
                      aria-label={`Remove ${goal.label} from spotlight`}
                      onClick={() => onToggle(id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div style={styles.field}>
                  <span style={styles.subLabel}>{seasonLabel}</span>
                  <div style={styles.seasonChips}>
                    {seasons.map((season) => {
                      const selected = d.season === season.label;
                      return (
                        <button
                          key={season.id}
                          type="button"
                          className="bal-chip"
                          style={{
                            ...styles.chip,
                            ...(selected ? styles.chipSelected : null),
                          }}
                          aria-pressed={selected}
                          onClick={() =>
                            onDetail(id, {
                              season: selected ? undefined : season.label,
                            })
                          }
                        >
                          {season.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field
                  label={noteLabel}
                  placeholder={notePlaceholder}
                  value={d.note ?? ""}
                  rows={2}
                  onChange={(v) => onDetail(id, { note: v })}
                />
              </div>
            );
          })}
        </div>
      )}

      <FinishControls
        mode={mode}
        disabled={!canFinish}
        onFinish={onFinish}
        onCancel={onCancel}
        hint={
          canFinish
            ? undefined
            : focusOrder.length === 0
              ? "Spotlight at least one goal to carry on."
              : `Narrow the spotlight to ${maxFocus} to carry on.`
        }
      />
    </>
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
// conversation — the "balanced retirement" overview: the spotlit handful, then
// the five areas with the goals in each. The neutral card wrapper is the caller's.
export function BalancedGoalsSummary({
  result,
}: {
  result: BalancedGoalsResult;
}) {
  const areaLabel = (id: string) =>
    result.areas.find((a) => a.id === id)?.label ?? id;
  const focus = result.goals
    .filter((g) => g.focus)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel}</p>

      {focus.length > 0 && (
        <div style={summaryStyles.goals}>
          {focus.map((g) => (
            <div key={g.label} style={summaryStyles.goalRow}>
              <span style={summaryStyles.rank}>{g.rank}</span>
              <div style={summaryStyles.goalBody}>
                <p style={summaryStyles.goalLabel}>
                  {g.label}
                  <span style={summaryStyles.area}> · {areaLabel(g.area)}</span>
                  {g.season && (
                    <span style={summaryStyles.season}> · {g.season}</span>
                  )}
                </p>
                {g.note && <p style={summaryStyles.note}>{g.note}</p>}
                {g.track === "do" && g.cadence && (
                  <p style={summaryStyles.detail}>Roughly: {g.cadence}</p>
                )}
                {g.track === "be" && g.ordinaryWeek && (
                  <p style={summaryStyles.detail}>
                    In an ordinary week: {g.ordinaryWeek}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={summaryStyles.byArea}>
        {result.areas.map((a) => {
          const inArea = result.goals.filter((g) => g.area === a.id);
          const deliberate = result.deliberateGaps.includes(a.id);
          return (
            <div key={a.id} style={summaryStyles.areaLine}>
              <span style={summaryStyles.areaName}>{a.label}</span>
              {inArea.length > 0 ? (
                <span style={summaryStyles.areaGoals}>
                  {inArea.map((g) => g.label).join(", ")}
                </span>
              ) : (
                <span style={summaryStyles.areaEmpty}>
                  {deliberate ? "deliberately quiet" : "—"}
                </span>
              )}
            </div>
          );
        })}
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
